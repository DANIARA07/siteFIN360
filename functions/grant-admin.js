// Executar somente em ambiente administrativo com credenciais Google seguras.
// GOOGLE_APPLICATION_CREDENTIALS deve apontar para uma credencial local fora do Git.
const admin = require('firebase-admin');
admin.initializeApp({projectId:'fin360-61a8f'});
const uid = 'XmuuPXAd2ZeLwIwQ5VWYgzLKGqH3';
(async () => {
  const user = await admin.auth().getUser(uid);
  if (user.email !== 'fin360.financas@gmail.com') throw new Error('E-mail do UID não corresponde à conta administradora.');
  await admin.auth().setCustomUserClaims(uid, {...(user.customClaims || {}), admin:true});
  console.log('Permissão concedida. Faça logout e login novamente para atualizar o token.');
})().catch(e => {console.error(e);process.exitCode=1});
