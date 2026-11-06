const admin = require('firebase-admin');
const functions = require('firebase-functions/v1');
admin.initializeApp();
const ADMIN_UID = 'XmuuPXAd2ZeLwIwQ5VWYgzLKGqH3';
const NOTIFY_TO = 'fin360.financas@gmail.com';

exports.adminOverview = functions.region('us-central1').https.onCall(async (_data, context) => {
  if (!context.auth || context.auth.token.admin !== true || context.auth.uid !== ADMIN_UID) {
    throw new functions.https.HttpsError('permission-denied', 'Acesso administrativo não autorizado.');
  }
  const accounts = [];
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    accounts.push(...page.users.map(u => ({ uid: u.uid, email: u.email || '', name: u.displayName || '', createdAt: u.metadata.creationTime || '', lastLoginAt: u.metadata.lastSignInTime || '', disabled: u.disabled })));
    pageToken = page.pageToken;
  } while (pageToken);
  const cutoff = Date.now() - 30*24*60*60*1000;
  const last30 = accounts.filter(u => Date.parse(u.createdAt) >= cutoff).length;
  return { total: accounts.length, last30, accounts: accounts.sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt)) };
});

// Envia notificações apenas para novos cadastros realizados após o deploy.
// Configure RESEND_API_KEY no Secret Manager e um remetente verificado em FIN360_EMAIL_FROM.
exports.notifyNewUser = functions.region('us-central1').auth.user().onCreate(async (user) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FIN360_EMAIL_FROM;
  if (!apiKey || !from) { console.error('Configure RESEND_API_KEY e FIN360_EMAIL_FROM nas Functions.'); return; }
  const createdAt = user.metadata.creationTime || new Date().toISOString();
  const safe = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST', headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({from,to:[NOTIFY_TO],subject:'FIN360 | Novo usuário cadastrado',html:`<h2>Novo cadastro no FIN360</h2><p>Nome: ${safe(user.displayName || 'Não informado')}</p><p>E-mail: ${safe(user.email || 'Não informado')}</p><p>Data: ${safe(createdAt)}</p>`})
  });
  if (!response.ok) throw new Error(`Falha no envio da notificação: ${response.status}`);
});
