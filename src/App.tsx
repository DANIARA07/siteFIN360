import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { auth, firebaseConfigured, prepareAuthPersistence } from './lib/firebase'

type AuthStatus = 'checking' | 'signed-out' | 'signed-in' | 'signing-out'

const AUTH_CHECK_TIMEOUT = 6500
const INSTITUTIONAL_SITE_URL = 'https://site-fin-360.vercel.app/'

const applySavedTheme = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('fin360.settings.theme') || '"dark"') as 'dark' | 'light' | 'system'
    const mode = stored === 'light' || stored === 'system' ? stored : 'dark'
    const resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode
    document.documentElement.dataset.theme = resolved
    document.documentElement.dataset.themePreference = mode
    document.documentElement.classList.toggle('theme-light', resolved === 'light')
    document.documentElement.classList.toggle('theme-dark', resolved === 'dark')
    document.documentElement.style.colorScheme = resolved
    document.body.dataset.theme = resolved
    document.body.classList.toggle('theme-light', resolved === 'light')
    document.body.classList.toggle('theme-dark', resolved === 'dark')
  } catch {
    document.documentElement.dataset.theme = 'dark'
    document.documentElement.classList.add('theme-dark')
  }
}


export default function App() {
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<User | null>(null)
  const [startupMessage, setStartupMessage] = useState('Verificando sua sessão com segurança.')

  useEffect(() => {
    applySavedTheme()
    if (!firebaseConfigured || !auth) {
      setUser(null)
      setStartupMessage('Configure o Firebase na Vercel para liberar o acesso seguro.')
      setStatus('signed-out')
      return
    }

    let active = true
    let resolved = false

    const timeoutId = window.setTimeout(() => {
      if (!active || resolved) return
      resolved = true
      setUser(null)
      setStartupMessage('Não foi possível confirmar a sessão. Faça o login novamente.')
      setStatus('signed-out')
    }, AUTH_CHECK_TIMEOUT)

    // Prepara a persistência antes de observar a sessão para evitar estados
    // inconsistentes no Safari/iPhone.
    void prepareAuthPersistence()

    const unsubscribe = onAuthStateChanged(
      auth,
      currentUser => {
        if (!active || resolved) return
        resolved = true
        window.clearTimeout(timeoutId)
        setUser(currentUser)
        if (!currentUser) setStartupMessage('')
        setStatus(currentUser ? 'signed-in' : 'signed-out')
      },
      () => {
        if (!active || resolved) return
        resolved = true
        window.clearTimeout(timeoutId)
        setUser(null)
        setStartupMessage('Falha ao conectar com a autenticação. Tente entrar novamente.')
        setStatus('signed-out')
      },
    )

    return () => {
      active = false
      window.clearTimeout(timeoutId)
      unsubscribe()
    }
  }, [])

  const handleLoginSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser)
    setStatus('signed-in')
  }

  const logout = async () => {
    setStatus('signing-out')

    if (auth) {
      try {
        await signOut(auth)
      } catch {
        // Mesmo sem rede, a interface local permanece bloqueada.
      }
    }

    setUser(null)

    try {
      sessionStorage.clear()
      localStorage.removeItem('fin360.auth.redirect')
      localStorage.removeItem('fin360.session')
    } catch {
      // O redirecionamento continua mesmo se o armazenamento estiver indisponível.
    }

    window.setTimeout(() => {
      window.location.replace(INSTITUTIONAL_SITE_URL)
    }, 1800)
  }


  if (status === 'signing-out') {
    return (
      <main className="authPage logoutPage" aria-live="polite">
        <section className="authCard logoutCard">
          <div className="logoutMark" aria-hidden="true">✓</div>
          <span className="logoutEyebrow">SESSÃO ENCERRADA</span>
          <h1>Até logo!</h1>
          <p>Sua sessão foi encerrada com segurança.</p>
          <small>Redirecionando para o site do FIN360…</small>
          <div className="logoutProgress" aria-hidden="true"><i /></div>
          <a className="logoutFallback" href={INSTITUTIONAL_SITE_URL}>Voltar ao site agora</a>
        </section>
      </main>
    )
  }

  if (status === 'checking') {
    return (
      <main className="authPage authLoadingPage" aria-live="polite">
        <div className="authCard authLoadingCard">
          <div className="loginSpinner" aria-hidden="true" />
          <h1>Carregando o FIN360</h1>
          <p>{startupMessage}</p>
          <small>Esta verificação é encerrada automaticamente em alguns segundos.</small>
        </div>
      </main>
    )
  }

  if (status === 'signed-in' && user) {
    return <Dashboard onLogout={logout} userId={user.uid} userName={user.displayName || user.email || 'Usuário'} />
  }

  return (
    <Login
      onSuccess={handleLoginSuccess}
      startupMessage={startupMessage}
    />
  )
}
