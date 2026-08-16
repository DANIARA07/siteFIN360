import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { Logo } from '../components/Logo'
import {
  auth,
  firebaseConfigured,
  firebaseEnvironmentSummary,
  firebaseInitializationError,
  missingFirebaseVariables,
  prepareAuthPersistence,
} from '../lib/firebase'

type Props = {
  onSuccess: (user: User) => void
  startupMessage?: string
}

type Feedback = {
  type: 'error' | 'success' | 'info'
  text: string
  code?: string
} | null

function getFirebaseCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '')
  }
  return ''
}

function authMessage(code: string) {
  const normalized = code.toLowerCase()

  if (
    normalized.includes('invalid-credential') ||
    normalized.includes('wrong-password') ||
    normalized.includes('user-not-found') ||
    normalized.includes('invalid-login-credentials')
  ) return 'E-mail ou senha incorretos. Redefina a senha no Firebase ou use “Esqueci minha senha”.'

  if (normalized.includes('invalid-email')) return 'Digite um endereço de e-mail válido.'
  if (normalized.includes('too-many-requests')) return 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.'
  if (normalized.includes('network-request-failed')) return 'Não foi possível acessar o Firebase. Verifique a internet, bloqueadores e tente novamente.'
  if (normalized.includes('user-disabled')) return 'Este usuário foi desativado no Firebase.'
  if (normalized.includes('operation-not-allowed')) return 'O método E-mail/Senha não está habilitado no Firebase Authentication.'
  if (normalized.includes('unauthorized-domain')) return 'O domínio atual não está autorizado no Firebase Authentication.'
  if (normalized.includes('invalid-api-key') || normalized.includes('api-key-not-valid')) return 'A chave de API do Firebase cadastrada na Vercel é inválida.'
  if (normalized.includes('configuration-not-found')) return 'A configuração de autenticação não foi encontrada neste projeto Firebase. Confirme se E-mail/Senha está ativado e faça novo deploy.'
  if (normalized.includes('requests-from-referer') || normalized.includes('referer')) return 'A chave do Firebase está bloqueando solicitações deste domínio. Revise as restrições da chave no Google Cloud.'
  if (normalized.includes('app-not-authorized')) return 'Este aplicativo não está autorizado a usar o Firebase Authentication.'
  if (normalized.includes('internal-error')) return 'O Firebase retornou um erro interno. Tente novamente em instantes.'
  if (normalized.includes('timeout')) return 'A tentativa de login demorou mais que o esperado. Tente novamente.'

  return 'Não foi possível entrar. O código técnico abaixo identifica a causa.'
}

function withTimeout<T>(promise: Promise<T>, milliseconds = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      const error = new Error('Tempo limite excedido ao conectar com o Firebase.') as Error & { code?: string }
      error.code = 'auth/timeout'
      reject(error)
    }, milliseconds)

    promise.then(
      value => {
        window.clearTimeout(timer)
        resolve(value)
      },
      error => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export function Login({ onSuccess, startupMessage }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showDiagnostic, setShowDiagnostic] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(
    startupMessage ? { type: 'info', text: startupMessage } : null,
  )

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFeedback(null)

    if (!firebaseConfigured || !auth) {
      setFeedback({
        type: 'error',
        text: firebaseInitializationError || 'O acesso seguro ainda não foi configurado corretamente na Vercel.',
        code: 'auth/firebase-not-initialized',
      })
      return
    }

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !password) {
      setFeedback({ type: 'error', text: 'Preencha o e-mail e a senha.' })
      return
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setFeedback({ type: 'error', text: 'Informe o nome completo.' })
        return
      }
      if (password.length < 6) {
        setFeedback({ type: 'error', text: 'A senha precisa ter pelo menos 6 caracteres.' })
        return
      }
      if (password !== confirmPassword) {
        setFeedback({ type: 'error', text: 'As senhas não coincidem.' })
        return
      }
      if (!acceptedTerms) {
        setFeedback({ type: 'error', text: 'Aceite os Termos de Uso e a Política de Privacidade para criar a conta.' })
        return
      }
    }

    setLoading(true)
    try {
      await prepareAuthPersistence()
      if (mode === 'register') {
        const credential = await withTimeout(createUserWithEmailAndPassword(auth, cleanEmail, password))
        await updateProfile(credential.user, { displayName: name.trim() })
        await sendEmailVerification(credential.user)
        await signOut(auth)
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        setAcceptedTerms(false)
        setFeedback({
          type: 'success',
          text: 'Conta criada. Enviamos um e-mail de verificação. Depois de confirmar, entre com seu e-mail e senha.',
        })
      } else {
        const credential = await withTimeout(signInWithEmailAndPassword(auth, cleanEmail, password))
        onSuccess(credential.user)
      }
    } catch (error) {
      const code = getFirebaseCode(error) || 'auth/unknown-error'
      console.error('[FIN360] Falha na autenticação Firebase:', code, error)
      const registerMessage = code.toLowerCase().includes('email-already-in-use')
        ? 'Este e-mail já possui uma conta. Use Entrar ou recupere sua senha.'
        : code.toLowerCase().includes('weak-password')
          ? 'Escolha uma senha mais forte, com pelo menos 6 caracteres.'
          : authMessage(code)
      setFeedback({ type: 'error', text: registerMessage, code })
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async () => {
    setFeedback(null)
    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) {
      setFeedback({ type: 'error', text: 'Digite seu e-mail para recuperar a senha.' })
      return
    }

    if (!auth || !firebaseConfigured) {
      setFeedback({ type: 'error', text: 'A recuperação exige o Firebase configurado.' })
      return
    }

    setLoading(true)
    try {
      await withTimeout(sendPasswordResetEmail(auth, cleanEmail))
      setFeedback({
        type: 'success',
        text: 'Enviamos as instruções de recuperação. Confira também a caixa de spam.',
      })
    } catch (error) {
      const code = getFirebaseCode(error) || 'auth/unknown-error'
      console.error('[FIN360] Falha na recuperação de senha:', code, error)
      setFeedback({ type: 'error', text: authMessage(code), code })
    } finally {
      setLoading(false)
    }
  }

  const diagnostic = firebaseEnvironmentSummary()

  return (
    <main className="authPage">
      <form className="authCard" onSubmit={submit} noValidate>
        <Logo />
        <h1>{mode === 'login' ? 'Acesso seguro ao FIN360' : 'Crie sua conta FIN360'}</h1>
        <p>{mode === 'login' ? 'Entre com seu e-mail e senha para acessar seus dados financeiros.' : 'Cadastre-se para ter um ambiente financeiro pessoal e separado dos demais usuários.'}</p>

        <div className="authModeTabs" role="tablist" aria-label="Acesso ao FIN360">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setFeedback(null) }}>Entrar</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setFeedback(null) }}>Criar conta</button>
        </div>

        {!firebaseConfigured && (
          <div className="authFeedback error" role="alert">
            <strong>Configuração necessária na Vercel.</strong>
            <span>Variáveis ausentes:</span>
            <code className="missingVariables">{missingFirebaseVariables.join(', ')}</code>
          </div>
        )}

        {feedback && (
          <div className={`authFeedback ${feedback.type}`} role="alert">
            <span>{feedback.text}</span>
            {feedback.code && <code className="authErrorCode">Código: {feedback.code}</code>}
          </div>
        )}

        {mode === 'register' && (
          <label>
            Nome completo
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Seu nome"
              required
            />
          </label>
        )}

        <label>
          E-mail
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="seu@email.com"
            required
          />
        </label>

        <label>
          Senha
          <div className="passwordField">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              className="passwordToggle"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </label>

        {mode === 'register' && (
          <>
            <label>
              Confirmar senha
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                placeholder="Repita a senha"
                required
              />
            </label>
            <label className="termsAcceptance">
              <input type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} />
              <span>Li e aceito os <a href="/termos.html" target="_blank" rel="noreferrer">Termos de Uso</a> e a <a href="/privacidade.html" target="_blank" rel="noreferrer">Política de Privacidade</a>.</span>
            </label>
          </>
        )}

        <button className="primary large full" type="submit" disabled={loading || !firebaseConfigured}>
          {loading ? (mode === 'login' ? 'Conectando ao Firebase…' : 'Criando sua conta…') : (mode === 'login' ? 'Entrar com segurança' : 'Criar minha conta')}
        </button>

        {mode === 'login' && (
          <button type="button" className="linkButton" onClick={resetPassword} disabled={loading || !firebaseConfigured}>
            Esqueci minha senha
          </button>
        )}

        <button type="button" className="linkButton diagnosticToggle" onClick={() => setShowDiagnostic(value => !value)}>
          {showDiagnostic ? 'Ocultar diagnóstico' : 'Ver diagnóstico da conexão'}
        </button>

        {showDiagnostic && (
          <div className="authDiagnostic" aria-live="polite">
            <div><span>Firebase configurado</span><strong>{diagnostic.configured ? 'Sim' : 'Não'}</strong></div>
            <div><span>Firebase inicializado</span><strong>{diagnostic.initialized ? 'Sim' : 'Não'}</strong></div>
            <div><span>Projeto</span><strong>{diagnostic.projectId || 'Não informado'}</strong></div>
            <div><span>Domínio Firebase</span><strong>{diagnostic.authDomain || 'Não informado'}</strong></div>
            <div><span>Domínio atual</span><strong>{diagnostic.currentDomain || 'Indisponível'}</strong></div>
            {diagnostic.initializationError && (
              <code className="authErrorCode">{diagnostic.initializationError}</code>
            )}
          </div>
        )}

        <small>O painel permanece bloqueado enquanto não houver um usuário autenticado.</small>
      </form>
    </main>
  )
}
