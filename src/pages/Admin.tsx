import { useEffect, useState } from 'react'
import { httpsCallable, getFunctions } from 'firebase/functions'
import type { User } from 'firebase/auth'
import { firebaseApp } from '../lib/firebase'

type Account = { uid: string; email: string; name: string; createdAt: string; lastLoginAt: string; disabled: boolean }
type Overview = { total: number; last30: number; accounts: Account[] }
export function Admin({user, onLogout}: {user: User; onLogout: () => void}) {
  const [allowed,setAllowed] = useState<boolean|null>(null)
  const [data,setData] = useState<Overview|null>(null)
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)
  const load = async () => {
    if (!firebaseApp) return
    setLoading(true); setError('')
    try {
      const fn = httpsCallable<undefined,Overview>(getFunctions(firebaseApp, 'us-central1'), 'adminOverview')
      const result = await fn()
      setData(result.data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar dados administrativos.') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    user.getIdTokenResult(true).then(token => {
      if (!active) return
      const isAdmin = token.claims.admin === true
      setAllowed(isAdmin)
      if (isAdmin) void load()
    }).catch(() => { if(active) {setAllowed(false); setError('Não foi possível validar a permissão.')} })
    return () => { active = false }
  }, [user.uid])
  return <div className="finAdmin">
    <aside className="finAdminSidebar"><div className="finAdminBrand"><span>◈</span> FIN360 <strong>ADMIN</strong></div><p>GESTÃO DA PLATAFORMA</p><nav><a className="active" href="/admin">▦ Visão geral</a><a href="/">↗ Aplicativo financeiro</a></nav><div className="finAdminFoot"><span>{user.email}</span><button onClick={onLogout}>Sair</button></div></aside>
    <main className="finAdminMain"><header><div><span className="finAdminEyebrow">CENTRAL ADMINISTRATIVA</span><h1>Visão geral</h1><p>Gestão de usuários e cadastros do FIN360</p></div><button onClick={() => void load()} disabled={loading || !allowed}>↻ Atualizar</button></header>
      {allowed === null ? <section className="finAdminPanel">Verificando autorização…</section> : !allowed ? <section className="finAdminPanel"><h2>Acesso restrito</h2><p>Esta conta não possui a permissão administrativa. A autorização deve ser concedida no Firebase pelo administrador do projeto.</p><a href="/">Voltar ao aplicativo</a></section> : <>
        <div className="finAdminCards"><article><span>Usuários cadastrados</span><strong>{data?.total ?? '—'}</strong><small>Contas no Firebase Authentication</small></article><article><span>Novos cadastros</span><strong>{data?.last30 ?? '—'}</strong><small>Últimos 30 dias</small></article><article><span>Notificações</span><strong>✉</strong><small>Destino: fin360.financas@gmail.com</small></article></div>
        {error && <div className="finAdminError" role="alert">{error} — Verifique a implantação das Cloud Functions.</div>}
        <section className="finAdminPanel"><div className="finAdminSectionHead"><div><h2>Usuários cadastrados</h2><p>Dados de autenticação. Informações financeiras não são exibidas.</p></div><span>{loading ? 'Atualizando…' : `${data?.accounts.length ?? 0} registros`}</span></div>
        <div className="finAdminTableScroll"><table><thead><tr><th>Usuário</th><th>E-mail</th><th>Cadastro</th><th>Último acesso</th><th>Status</th></tr></thead><tbody>{data?.accounts.map(x => <tr key={x.uid}><td>{x.name || '—'}</td><td>{x.email || '—'}</td><td>{x.createdAt ? new Date(x.createdAt).toLocaleDateString('pt-BR') : '—'}</td><td>{x.lastLoginAt ? new Date(x.lastLoginAt).toLocaleDateString('pt-BR') : '—'}</td><td>{x.disabled ? 'Desativado' : 'Ativo'}</td></tr>)}</tbody></table>{!data && !loading && <p>Os registros aparecerão após a ativação dos serviços administrativos.</p>}</div></section>
      </>}
    </main>
  </div>
}
