# FIN360 3.1.0

Aplicativo de gestão financeira pessoal com autenticação obrigatória pelo Firebase e fluxo de login estabilizado para Vercel, notebook e iPhone.

## O que mudou

- a tela de carregamento não fica aberta indefinidamente;
- após alguns segundos sem resposta, o aplicativo abre o login com uma mensagem clara;
- quando faltam variáveis do Firebase, a própria tela informa quais são;
- o painel nunca abre sem usuário autenticado;
- o modo demonstração continua removido;
- sessão persistente e recuperação de senha continuam disponíveis.

## Antes de publicar

1. Crie ou abra seu projeto no Firebase.
2. Em **Authentication → Sign-in method**, habilite **E-mail/senha**.
3. Em **Authentication → Users**, crie seu usuário de acesso.
4. Copie as configurações do aplicativo Web para as variáveis `VITE_FIREBASE_*` na Vercel.
5. Em **Authentication → Settings → Authorized domains**, inclua `360finances.vercel.app`.
6. Faça um novo deploy sem reutilizar o cache anterior.

Consulte `GUIA_VERCEL_FIREBASE_3_1.md` para o passo a passo completo.
