// ====================================================================
// DARK ORBIT · AUTH SYSTEM
// Handles: signup, login, social login, forgot password, OTP, reset,
// logout, session restore, and starting the game.
// Tab clicks use a smooth CSS crossfade between login and signup.
// ====================================================================
(function () {
  'use strict';

  // ---------- storage keys ----------
  const USERS_KEY   = 'darkorbit_users';
  const SESSION_KEY = 'darkorbit_session';
  const RESET_KEY   = 'darkorbit_reset';

  // ---------- storage helpers ----------
  function loadUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

  function hashPassword(pw) {
    let h = 0x811c9dc5;
    for (let i = 0; i < pw.length; i++) {
      h ^= pw.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }
  function generateId() {
    return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function setSession(username) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username: username, ts: Date.now() }));
  }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch (e) { return null; }
  }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function isValidEmailFormat(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  function isEmailRegistered(email) {
    const users = loadUsers();
    const lower = email.toLowerCase();
    for (const k in users) {
      if (users[k].email && users[k].email.toLowerCase() === lower) return true;
    }
    return false;
  }

  // ---------- UI refs ----------
  const authOverlay     = document.getElementById('authOverlay');
  const authMsg         = document.getElementById('authMsg');
  const authTabs        = document.getElementById('authTabs');
  const loginForm       = document.getElementById('loginForm');
  const signupForm      = document.getElementById('signupForm');
  const forgotForm      = document.getElementById('forgotForm');
  const otpForm         = document.getElementById('otpForm');
  const resetForm       = document.getElementById('resetForm');
  const socialBlock     = document.getElementById('socialBlock');
  const tabs            = document.querySelectorAll('.auth-tab');
  const userBar         = document.getElementById('userBar');
  const userNameEl      = document.getElementById('userName');
  const avatarInitial   = document.getElementById('avatarInitial');
  const gameWrapper     = document.getElementById('gameWrapper');
  const gameInfo        = document.getElementById('gameInfo');
  const otpToast        = document.getElementById('otpToast');
  const toastCode       = document.getElementById('toastCode');
  const toastClose      = document.getElementById('toastClose');
  const emailInput      = document.getElementById('signupEmail');
  const emailStatus     = document.getElementById('emailStatus');
  const emailIcon       = document.getElementById('emailIcon');
  const signupBtn       = document.getElementById('signupBtn');
  const loginUserInput  = document.getElementById('loginUser');
  const loginPassInput  = document.getElementById('loginPass');
  const notFoundPrompt  = document.getElementById('notFoundPrompt');
  const notFoundText    = document.getElementById('notFoundText');
  const gotoSignupBtn   = document.getElementById('gotoSignupBtn');

  // ---------- account-not-found prompt ----------
  function showNotFoundPrompt(message) {
    if (!notFoundPrompt || !notFoundText) return;
    notFoundText.textContent = message ||
      'This account is not yet registered. Please sign up first to create an account.';
    notFoundPrompt.classList.remove('show');
    void notFoundPrompt.offsetWidth;
    notFoundPrompt.classList.add('show');
    if (loginUserInput) loginUserInput.classList.add('input-error');
    if (loginPassInput) loginPassInput.classList.add('input-error');
  }
  function hideNotFoundPrompt() {
    if (!notFoundPrompt) return;
    notFoundPrompt.classList.remove('show');
    if (loginUserInput) loginUserInput.classList.remove('input-error');
    if (loginPassInput) loginPassInput.classList.remove('input-error');
  }
  if (loginUserInput) loginUserInput.addEventListener('input', hideNotFoundPrompt);
  if (loginPassInput) loginPassInput.addEventListener('input', hideNotFoundPrompt);

  if (gotoSignupBtn) {
    gotoSignupBtn.addEventListener('click', function () {
      const typed = loginUserInput ? loginUserInput.value.trim() : '';
      showForm('signup');
      if (typed && isValidEmailFormat(typed)) {
        const el = document.getElementById('signupEmail');
        if (el) { el.value = typed; if (emailInput) emailInput.dispatchEvent(new Event('input')); }
      } else if (typed) {
        const el = document.getElementById('signupUser');
        if (el) el.value = typed;
      }
      const focusEl = document.getElementById('signupUser');
      if (focusEl) setTimeout(function () { focusEl.focus(); }, 50);
    });
  }

  // ---------- form switching ----------
  function showForm(name) {
    [loginForm, signupForm, forgotForm, otpForm, resetForm]
      .forEach(function (f) { if (f) f.classList.remove('active'); });

    const targetForm = { login: loginForm, signup: signupForm, forgot: forgotForm,
                         otp: otpForm, reset: resetForm }[name];
    if (targetForm) targetForm.classList.add('active');

    if (authTabs) {
      authTabs.style.display = (name === 'login' || name === 'signup') ? 'flex' : 'none';
    }
    if (socialBlock) {
      socialBlock.style.display = (name === 'login' || name === 'signup') ? 'block' : 'none';
    }

    tabs.forEach(function (t) {
      const isActive = t.dataset.tab === name;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (name !== 'signup') clearEmailFeedback();
    if (name !== 'login')  hideNotFoundPrompt();
    showMsg('');
  }

  // ---------- tab clicks: smooth crossfade between forms ----------
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      const target = tab.dataset.tab;

      // If already on this tab, do nothing
      if (tab.classList.contains('active')) return;

      // Fade the current form out, then swap and let CSS fade the new one in
      const currentForm = document.querySelector('.auth-form.active');
      if (currentForm) {
        currentForm.classList.remove('active');
        setTimeout(function () {
          showForm(target);
        }, 140);
      } else {
        showForm(target);
      }
    });
  });

  document.querySelectorAll('[data-back]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      stopResendCountdown();
      clearResetState();
      showForm('login');
    });
  });

  // ---------- eye toggle ----------
  document.querySelectorAll('.eye-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const input = document.getElementById(btn.getAttribute('data-target'));
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.classList.toggle('showing', isHidden);
      input.focus();
    });
  });

  // ---------- messages ----------
  function showMsg(text, type) {
    if (!authMsg) return;
    authMsg.textContent = text;
    authMsg.className = 'auth-msg ' + (type || '');
    if (text) {
      clearTimeout(showMsg._t);
      showMsg._t = setTimeout(function () {
        if (authMsg.textContent === text) {
          authMsg.textContent = '';
          authMsg.className = 'auth-msg';
        }
      }, 3500);
    }
  }

  // ---------- email availability UI ----------
  let emailCheckTimer = null;
  let emailAvailable  = false;

  function resetEmailStatus() {
    if (!emailStatus || !emailIcon || !emailInput || !signupBtn) return;
    emailAvailable = false;
    emailStatus.textContent = '';
    emailStatus.className = 'field-status';
    emailIcon.textContent = '';
    emailIcon.className = 'email-icon';
    emailInput.classList.remove('valid-email', 'invalid-email');
    signupBtn.disabled = false;
  }
  function setEmailStatus(state, message) {
    if (!emailStatus || !emailIcon || !emailInput || !signupBtn) return;
    emailStatus.textContent = message || '';
    emailStatus.className = 'field-status ' + (state || '');
    emailIcon.className = 'email-icon ' + (state || '');
    if (state === 'available') {
      emailIcon.textContent = '\u2713';
      emailInput.classList.add('valid-email');
      emailInput.classList.remove('invalid-email');
      emailAvailable = true;
      signupBtn.disabled = false;
    } else if (state === 'taken') {
      emailIcon.textContent = '\u2717';
      emailInput.classList.add('invalid-email');
      emailInput.classList.remove('valid-email');
      emailAvailable = false;
      signupBtn.disabled = true;
    } else if (state === 'checking') {
      emailIcon.textContent = '\u27F3';
      emailInput.classList.remove('valid-email', 'invalid-email');
      emailAvailable = false;
      signupBtn.disabled = true;
    } else {
      emailIcon.textContent = '';
      emailInput.classList.remove('valid-email', 'invalid-email');
      emailAvailable = false;
      signupBtn.disabled = false;
    }
  }
  if (emailInput) {
    emailInput.addEventListener('input', function () {
      const email = emailInput.value.trim();
      clearTimeout(emailCheckTimer);
      if (!email) { resetEmailStatus(); return; }
      if (!isValidEmailFormat(email)) { setEmailStatus('taken', 'INVALID FORMAT'); return; }
      setEmailStatus('checking', 'CHECKING\u2026');
      emailCheckTimer = setTimeout(function () {
        if (isEmailRegistered(email)) setEmailStatus('taken', 'ALREADY REGISTERED');
        else                          setEmailStatus('available', 'AVAILABLE');
      }, 400);
    });
  }
  function clearEmailFeedback() {
    resetEmailStatus();
    clearTimeout(emailCheckTimer);
  }

  // ---------- OTP toast ----------
  let toastTimer = null;
  function showOtpToast(code) {
    if (!otpToast || !toastCode) return;
    toastCode.textContent = code;
    otpToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { otpToast.classList.remove('show'); }, 10000);
  }
  if (toastClose) toastClose.addEventListener('click', function () {
    if (otpToast) otpToast.classList.remove('show');
  });

  // ==================================================================
  // SIGN UP
  // ==================================================================
  if (signupForm) {
    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const usernameEl = document.getElementById('signupUser');
      const passEl     = document.getElementById('signupPass');
      const pass2El    = document.getElementById('signupPass2');
      const username   = usernameEl ? usernameEl.value.trim() : '';
      const email      = emailInput ? emailInput.value.trim() : '';
      const pass       = passEl ? passEl.value : '';
      const pass2      = pass2El ? pass2El.value : '';

      if (!username || !email || !pass) { showMsg('ALL FIELDS REQUIRED', 'error'); return; }
      if (username.length < 3)          { showMsg('USERNAME MUST BE 3+ CHARACTERS', 'error'); return; }
      if (!isValidEmailFormat(email))   { showMsg('INVALID EMAIL FORMAT', 'error'); return; }
      if (isEmailRegistered(email)) {
        showMsg('EMAIL ALREADY REGISTERED', 'error');
        setEmailStatus('taken', 'ALREADY REGISTERED');
        return;
      }
      if (pass.length < 6)              { showMsg('PASSWORD MUST BE 6+ CHARACTERS', 'error'); return; }
      if (pass !== pass2)               { showMsg('PASSWORDS DO NOT MATCH', 'error'); return; }

      const users = loadUsers();
      const lowerUser = username.toLowerCase();
      if (users[lowerUser]) { showMsg('USERNAME ALREADY TAKEN', 'error'); return; }

      users[lowerUser] = {
        id: generateId(),
        username: username,
        email: email,
        password: hashPassword(pass),
        provider: 'local',
        createdAt: Date.now(),
        stats: { highScore: 0, gamesPlayed: 0 }
      };
      saveUsers(users);

      showMsg('ACCOUNT CREATED \u00B7 LOGGING IN\u2026', 'success');
      resetEmailStatus();
      setTimeout(function () { setSession(lowerUser); startGame(username); }, 700);
    });
  }

  // ==================================================================
  // LOGIN
  // ==================================================================
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const userInput = loginUserInput ? loginUserInput.value.trim().toLowerCase() : '';
      const pass      = loginPassInput ? loginPassInput.value : '';
      if (!userInput || !pass) { showMsg('ALL FIELDS REQUIRED', 'error'); return; }

      const users = loadUsers();
      let account    = users[userInput];
      let accountKey = userInput;

      if (!account) {
        for (const k in users) {
          if (users[k].email && users[k].email.toLowerCase() === userInput) {
            account = users[k];
            accountKey = k;
            break;
          }
        }
      }

      if (!account) {
        showMsg('ACCOUNT NOT FOUND', 'error');
        showNotFoundPrompt(
          'The account "' + (loginUserInput ? loginUserInput.value.trim() : userInput) +
          '" is not yet registered. Please sign up first to create an account.'
        );
        return;
      }
      if (account.provider !== 'local') {
        showMsg('USE ' + account.provider.toUpperCase() + ' TO SIGN IN', 'error');
        return;
      }
      if (account.password !== hashPassword(pass)) {
        showMsg('INCORRECT PASSWORD', 'error');
        return;
      }

      showMsg('ACCESS GRANTED', 'success');
      hideNotFoundPrompt();
      const displayName = account.username;
      setTimeout(function () { setSession(accountKey); startGame(displayName); }, 500);
    });
  }

  // ==================================================================
  // FORGOT PASSWORD + OTP
  // ==================================================================
  let resetCtx       = null;
  let resendInterval = null;
  const RESEND_SECONDS = 30;

  const forgotLinkEl = document.getElementById('forgotLink');
  if (forgotLinkEl) {
    forgotLinkEl.addEventListener('click', function () {
      showForm('forgot');
      const el = document.getElementById('forgotUser');
      if (el) el.value = '';
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const el = document.getElementById('forgotUser');
      const input = el ? el.value.trim().toLowerCase() : '';
      if (!input) { showMsg('ENTER USERNAME OR EMAIL', 'error'); return; }

      const users = loadUsers();
      let accountKey = null, account = null;
      if (users[input]) { accountKey = input; account = users[input]; }
      else {
        for (const k in users) {
          if (users
