import { Logo } from '../components/Logo'

type Props = { onEnter: () => void }

export function Landing({ onEnter }: Props) {
  return (
    <main className="landing">
      <nav className="topbar container">
        <Logo />
        <div className="navActions">
          <button className="ghost" onClick={onEnter}>Entrar</button>
          <button className="primary" onClick={onEnter}>Criar conta grátis</button>
        </div>
      </nav>
      <section className="hero container">
        <div className="heroCopy">
          <span className="eyebrow">CONTROLE FINANCEIRO COMPLETO</span>
          <h1>Sua vida financeira, organizada em <em>360 graus.</em></h1>
          <p>Orçamento, cartões, recorrências, metas, investimentos e milhas em uma experiência simples e moderna.</p>
          <div className="heroButtons">
            <button className="primary large" onClick={onEnter}>Começar agora</button>
            <button className="ghost large" onClick={onEnter}>Ver demonstração</button>
          </div>
          <div className="trust"><span>✓ Sem planilhas confusas</span><span>✓ Acesso no celular e notebook</span></div>
        </div>
        <div className="heroPanel">
          <div className="miniHeader"><span>Visão geral</span><span className="live">● Atualizado</span></div>
          <div className="balance"><small>Saldo disponível</small><strong>R$ 18.420,00</strong><span>+8,4% neste mês</span></div>
          <div className="metricGrid">
            <article><small>Receitas</small><b>R$ 12.800</b></article>
            <article><small>Despesas</small><b>R$ 7.430</b></article>
          </div>
          <div className="bars"><i style={{height:'35%'}}/><i style={{height:'52%'}}/><i style={{height:'46%'}}/><i style={{height:'68%'}}/><i style={{height:'58%'}}/><i style={{height:'86%'}}/></div>
        </div>
      </section>
      <section className="features container">
        {[
          ['Orçamento inteligente','Compare o planejado com o realizado e acompanhe seus limites.'],
          ['Cartões e faturas','Visualize compras, parcelas, limites e vencimentos em um só lugar.'],
          ['Milhas e patrimônio','Acompanhe pontos, investimentos, metas e evolução patrimonial.']
        ].map(([title,text]) => <article key={title}><span>✦</span><h3>{title}</h3><p>{text}</p></article>)}
      </section>
      <footer className="container footer">© 2026 FIN360 · Privacidade · Termos</footer>
    </main>
  )
}
