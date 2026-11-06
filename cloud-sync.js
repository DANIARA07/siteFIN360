(() => {
  'use strict';

  const statusButton = document.getElementById('cloudStatusBtn');
  const originalSave = window.save;
  let auth = null;
  let firestore = null;
  let unsubscribe = null;
  let applyingRemote = false;
  let saveTimer = null;
  let currentUser = null;
  let lastRemoteUpdate = null;

  const setStatus = (label, title = '') => {
    if (!statusButton) return;
    statusButton.textContent = label;
    statusButton.title = title;
  };

  const createDialog = () => {
    const wrapper = document.createElement('div');
    wrapper.id = 'cloudDialog';
    wrapper.className = 'modal';
    wrapper.innerHTML = `
      <div class="modalbox" style="width:min(520px,100%)">
        <button class="close" id="cloudClose" type="button">×</button>
        <h2>Sincronização Fin360</h2>
        <div id="cloudPanel"></div>
      </div>`;
    document.body.appendChild(wrapper);
    wrapper.querySelector('#cloudClose').onclick = () => wrapper.classList.remove('open');
    wrapper.addEventListener('click', event => {
      if (event.target === wrapper) wrapper.classList.remove('open');
    });
    return wrapper;
  };

  const dialog = createDialog();
  const panel = dialog.querySelector('#cloudPanel');

  function openDialog() {
    renderPanel();
    dialog.classList.add('open');
  }

  function renderPanel(message = '') {
    if (!window.FIN360_FIREBASE_CONFIGURED) {
      panel.innerHTML = `
        <div class="notice"><b>Configuração necessária</b><br>
        O aplicativo está funcionando em modo local. Para sincronizar computador e celular, preencha o arquivo <code>firebase-config.js</code> com as credenciais do seu projeto Firebase.</div>
        <p class="muted">O arquivo <b>GUIA_FIREBASE.md</b> incluído no pacote contém o passo a passo completo.</p>`;
      return;
    }

    if (currentUser) {
      panel.innerHTML = `
        <div class="notice"><b>Sincronização ativa</b><br>${escapeHtml(currentUser.email || '')}</div>
        <p>Alterações feitas neste aparelho são enviadas ao Firestore e aparecem nos demais aparelhos conectados à mesma conta.</p>
        <p class="muted">Última atualização recebida: ${lastRemoteUpdate ? new Date(lastRemoteUpdate).toLocaleString('pt-BR') : 'aguardando'}</p>
        ${message ? `<div class="notice">${escapeHtml(message)}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" id="forceUpload" type="button">Enviar dados deste aparelho</button>
          <button class="btn soft" id="forceDownload" type="button">Baixar dados da nuvem</button>
          <button class="btn danger" id="cloudLogout" type="button">Sair da conta</button>
        </div>`;
      panel.querySelector('#forceUpload').onclick = async () => {
        await uploadNow();
        renderPanel('Dados deste aparelho enviados para a nuvem.');
      };
      panel.querySelector('#forceDownload').onclick = async () => {
        await downloadNow(true);
      };
      panel.querySelector('#cloudLogout').onclick = () => auth.signOut();
      return;
    }

    panel.innerHTML = `
      ${message ? `<div class="notice">${escapeHtml(message)}</div>` : ''}
      <form id="cloudLoginForm" class="form">
        <div class="field full"><label>E-mail</label><input type="email" name="email" required autocomplete="email"></div>
        <div class="field full"><label>Senha</label><input type="password" name="password" required minlength="6" autocomplete="current-password"></div>
        <div class="field full" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" type="submit">Entrar</button>
          <button class="btn soft" id="createAccount" type="button">Criar conta</button>
          <button class="btn soft" id="resetPassword" type="button">Esqueci a senha</button>
        </div>
      </form>`;

    const form = panel.querySelector('#cloudLoginForm');
    form.onsubmit = async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      try {
        await auth.signInWithEmailAndPassword(data.email.trim(), data.password);
      } catch (error) {
        renderPanel(firebaseMessage(error));
      }
    };
    panel.querySelector('#createAccount').onclick = async () => {
      const data = Object.fromEntries(new FormData(form));
      if (!data.email || !data.password) return renderPanel('Informe e-mail e uma senha de pelo menos 6 caracteres.');
      try {
        await auth.createUserWithEmailAndPassword(data.email.trim(), data.password);
      } catch (error) {
        renderPanel(firebaseMessage(error));
      }
    };
    panel.querySelector('#resetPassword').onclick = async () => {
      const email = form.elements.email.value.trim();
      if (!email) return renderPanel('Informe seu e-mail para receber a redefinição de senha.');
      try {
        await auth.sendPasswordResetEmail(email);
        renderPanel('E-mail de redefinição enviado.');
      } catch (error) {
        renderPanel(firebaseMessage(error));
      }
    };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function firebaseMessage(error) {
    const map = {
      'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
      'auth/invalid-credential': 'E-mail ou senha inválidos.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.'
    };
    return map[error?.code] || `Não foi possível concluir: ${error?.message || 'erro desconhecido'}`;
  }

  function userDoc() {
    return firestore.collection('users').doc(currentUser.uid).collection('fin360').doc('database_v5_1_clean');
  }

  async function uploadNow() {
    if (!currentUser || applyingRemote) return;
    setStatus('☁️ Salvando…');
    await userDoc().set({
      data: window.FIN360_APP.getDb(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAtClient: new Date().toISOString(),
      schemaVersion: 5
    }, { merge: true });
    setStatus('☁️ Sincronizado', currentUser.email || '');
  }

  async function downloadNow(confirmOverwrite = false) {
    if (!currentUser) return;
    if (confirmOverwrite && !confirm('Substituir os dados deste aparelho pelos dados salvos na nuvem?')) return;
    const snapshot = await userDoc().get();
    if (!snapshot.exists || !snapshot.data()?.data) {
      alert('Ainda não há dados salvos na nuvem.');
      return;
    }
    applyRemote(snapshot.data().data, snapshot.data().updatedAtClient);
  }

  function applyRemote(remoteData, updatedAtClient) {
    if (!remoteData || typeof remoteData !== 'object') return;
    applyingRemote = true;
    window.FIN360_APP.setDb(remoteData);
    const activeDb = window.FIN360_APP.getDb();
    localStorage.setItem(window.FIN360_APP.getStorageKey(), JSON.stringify(activeDb));
    lastRemoteUpdate = updatedAtClient || new Date().toISOString();
    applyingRemote = false;
    window.FIN360_APP.render();
    setStatus('☁️ Sincronizado', currentUser?.email || '');
    if (dialog.classList.contains('open')) renderPanel();
  }

  function scheduleUpload() {
    if (!currentUser || applyingRemote) return;
    clearTimeout(saveTimer);
    setStatus('☁️ Alterações…', 'Aguardando envio');
    saveTimer = setTimeout(() => uploadNow().catch(error => {
      console.error(error);
      setStatus('⚠️ Sem sincronizar', error.message);
    }), 700);
  }

  if (typeof originalSave === 'function') {
    window.save = function fin360CloudSave() {
      originalSave();
      scheduleUpload();
    };
  }

  statusButton?.addEventListener('click', openDialog);

  if (!window.FIN360_FIREBASE_CONFIGURED) {
    setStatus('☁️ Modo local', 'Configure o Firebase para ativar a sincronização');
    return;
  }

  try {
    if (!firebase.apps.length) firebase.initializeApp(window.FIN360_FIREBASE_CONFIG);
    auth = firebase.auth();
    firestore = firebase.firestore();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

    auth.onAuthStateChanged(async user => {
      currentUser = user;
      window.FIN360_AUTH_USER = user || null;
      window.dispatchEvent(new CustomEvent('fin360-auth-changed', { detail: { user } }));
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      if (!user) {
        setStatus('☁️ Entrar', 'Entre para sincronizar');
        if (dialog.classList.contains('open')) renderPanel();
        return;
      }

      setStatus('☁️ Conectando…', user.email || '');
      const reference = userDoc();
      const first = await reference.get();
      if (!first.exists || !first.data()?.data) {
        await uploadNow();
      } else {
        applyRemote(first.data().data, first.data().updatedAtClient);
      }

      unsubscribe = reference.onSnapshot(snapshot => {
        const payload = snapshot.data();
        if (payload?.data) applyRemote(payload.data, payload.updatedAtClient);
      }, error => {
        console.error(error);
        setStatus('⚠️ Erro na nuvem', error.message);
      });

      if (dialog.classList.contains('open')) renderPanel();
    });
  } catch (error) {
    console.error(error);
    setStatus('⚠️ Configuração inválida', error.message);
  }
})();
