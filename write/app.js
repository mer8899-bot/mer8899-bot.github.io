(function () {
  'use strict';

  const DRAFT_TITLE_KEY = 'shenlanDraftTitle';
  const DRAFT_CONTENT_KEY = 'shenlanDraftContent';
  const config = window.SHENLAN_CONFIG || {};
  const apiOrigin = String(config.apiOrigin || '').replace(/\/$/, '');

  const authView = document.getElementById('authView');
  const editorView = document.getElementById('editorView');
  const authStatus = document.getElementById('authStatus');
  const loginButton = document.getElementById('loginButton');
  const logoutButton = document.getElementById('logoutButton');
  const title = document.getElementById('title');
  const content = document.getElementById('content');
  const saveStatus = document.getElementById('saveStatus');
  const wordCount = document.getElementById('wordCount');
  const publishMessage = document.getElementById('publishMessage');
  const publishButton = document.getElementById('publishButton');

  let csrfToken = '';
  let saveTimer;
  let publishing = false;
  let pendingIdempotencyKey = '';

  function apiUrl(path) {
    return `${apiOrigin}${path}`;
  }

  function autosize() {
    content.style.height = 'auto';
    content.style.height = `${Math.max(content.scrollHeight, window.innerHeight * 0.54)}px`;
  }

  function updateWordCount() {
    const count = content.value.replace(/\s/g, '').length;
    wordCount.textContent = `${count} 字`;
  }

  function persistDraft() {
    window.localStorage.setItem(DRAFT_TITLE_KEY, title.value);
    window.localStorage.setItem(DRAFT_CONTENT_KEY, content.value);
    saveStatus.textContent = '已保存';
  }

  function scheduleSave() {
    if (!publishing) pendingIdempotencyKey = '';
    saveStatus.textContent = '保存中…';
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(persistDraft, 350);
    updateWordCount();
    autosize();
  }

  function restoreDraft() {
    title.value = window.localStorage.getItem(DRAFT_TITLE_KEY) || '';
    content.value = window.localStorage.getItem(DRAFT_CONTENT_KEY) || '';
    updateWordCount();
    autosize();
  }

  function showEditor(session) {
    csrfToken = session.csrfToken || '';
    authView.hidden = true;
    editorView.hidden = false;
    restoreDraft();
    title.focus({ preventScroll: true });
  }

  function showLogin(message, enabled) {
    authView.hidden = false;
    editorView.hidden = true;
    authStatus.textContent = message;
    loginButton.disabled = !enabled;
  }

  async function loadSession() {
    try {
      const response = await fetch(apiUrl('/api/session'), {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      const session = await response.json();
      if (response.ok && session.authenticated) {
        showEditor(session);
        return;
      }
      showLogin('仅限作者本人使用', true);
    } catch (_error) {
      showLogin('写作服务暂未连接，请稍后再试', false);
    }
  }

  async function publish() {
    if (publishing) return;

    const cleanTitle = title.value.trim();
    const cleanContent = content.value.trim();
    if (!cleanTitle) {
      publishMessage.textContent = '请先写标题';
      title.focus();
      return;
    }
    if (!cleanContent) {
      publishMessage.textContent = '正文还是空的';
      content.focus();
      return;
    }

    publishing = true;
    persistDraft();
    publishButton.disabled = true;
    publishButton.textContent = '发布中…';
    publishMessage.textContent = '正在提交文章';

    try {
      const response = await fetch(apiUrl('/api/publish'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Idempotency-Key': pendingIdempotencyKey || (pendingIdempotencyKey = window.crypto.randomUUID())
        },
        body: JSON.stringify({ title: cleanTitle, content: cleanContent })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '发布没有成功，请再试一次');

      window.localStorage.removeItem(DRAFT_TITLE_KEY);
      window.localStorage.removeItem(DRAFT_CONTENT_KEY);
      pendingIdempotencyKey = '';
      title.value = '';
      content.value = '';
      updateWordCount();
      autosize();
      publishMessage.textContent = '已提交，网站正在更新';
      publishButton.textContent = '已发布';
      window.setTimeout(() => {
        publishButton.textContent = '发布';
        publishButton.disabled = false;
        publishing = false;
      }, 2200);
    } catch (error) {
      publishMessage.textContent = error.message;
      publishButton.textContent = '重新发布';
      publishButton.disabled = false;
      publishing = false;
    }
  }

  loginButton.addEventListener('click', () => {
    const returnTo = `${window.location.origin}${window.location.pathname}`;
    window.location.assign(`${apiUrl('/auth/github')}?returnTo=${encodeURIComponent(returnTo)}`);
  });

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
      await fetch(apiUrl('/auth/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken }
      });
    } finally {
      csrfToken = '';
      showLogin('已安全退出', true);
      logoutButton.disabled = false;
    }
  });

  title.addEventListener('input', scheduleSave);
  content.addEventListener('input', scheduleSave);
  publishButton.addEventListener('click', publish);
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !editorView.hidden) {
      event.preventDefault();
      publish();
    }
  });
  window.addEventListener('resize', autosize);

  loadSession();
}());
