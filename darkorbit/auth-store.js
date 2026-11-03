// ====================================================================
// DARK ORBIT · AUTH SYSTEM
// Signup redirects to LOGIN; the user must log in before the game.
// Fixed-size card during login ↔ signup morph.
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

  // ---------- morph helpers ----------
  const authCard = document.querySelector('.auth-card');
  let indicator = null;
  let morphing = false;

  function ensureIndicator() {
    if (indicator || !authTabs) return;
    indicator = document.createElement('div');
    indicator.className = 'auth-tab-indicator';
    authTabs.appendChild(indicator);
  }

  function placeIndicator(name) {
    if (!indicator) return;
    const idx = name === 'signup' ? 1 : 0;
    indicator.style.transform = 'translateX(' + (idx * 100) + '%)';
  }

  // Crossfade between login and signup without resizing the card.
  // The card's CSS min-height holds it at the taller (signup) size.
  function morphToForm(targetName, instant) {
    const targetForm = { login: loginForm, signup: signupForm, forgot: forgotForm,
                         otp: otpForm, reset: resetForm }[targetName];
    if (!targetForm) return;

    const currentActive = document.querySelector('.auth-form.active');
    const currentName = currentActive ? currentActive.id.replace('Form', '').toLowerCase() : '';

    if (authTabs)    authTabs.style.display    = (targetName === 'login' || targetName === 'signup') ? 'flex'  : 'none';
    if (socialBlock) socialBlock.style.display = (targetName === 'login' || targetName === 'signup') ? 'block' : 'none';

    tabs.forEach(function (t) {
      const isActive = t.dataset.tab === targetName;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    placeIndicator(targetName);

    if (targetName !== 'signup') clearEmailFeedback();
    if (targetName !== 'login')  hideNotFoundPrompt();
    showMsg('');

    const reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTopLevelSwitch =
      (currentName === 'login' || currentName === 'signup') &&
      (targetName  === 'login' || targetName  === 'signup') &&
      currentName !== targetName;

    // ---- Instant swap (non-morph cases) ----
    if (!authCard || instant || reducedMotion || !isTopLevelSwitch) {
      [loginForm, signupForm, forgotForm, otpForm, resetForm].forEach(function (f) {
        if (f) f.classList.remove('active');
      });
      targetForm.classList.add('active');
      // Non-tab forms need the card to size to their content
      if (targetName === 'forgot' || targetName === 'otp' || targetName === 'reset') {
        authCard.classList.add('card-autoheight');
      } else {
        authCard.classList.remove('card-autoheight');
      }
      return;
    }

    // ---- Morph: crossfade inside a FIXED card ----
    authCard.classList.remove('card-autoheight');
    if (morphing) morphing = false;
    morphing = true;

    if (currentActive) currentActive.classList.remove('active');

    setTimeout(function () {
      targetForm.classList.add('active');
    }, 120);

    setTimeout(function () {
      morphing = false;
    }, 500);
  }

  function showForm(name) {
    morphToForm(name, false);
  }

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
      if (focusEl) setTimeout(function () { focusEl.focus(); }, 450);
    });
  }

  // ---------- tab clicks ----------
  ensureIndicator();
  placeIndicator('login');

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      showForm(tab.dataset.tab);
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
  // SIGN UP  →  redirect to LOGIN (no auto-login)
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

      if (usernameEl) usernameEl.value = '';
      if (passEl)     passEl.value = '';
      if (pass2El)    pass2El.value = '';
      if (emailInput) emailInput.value = '';
      resetEmailStatus();

      showMsg('ACCOUNT CREATED \u00B7 PLEASE LOG IN', 'success');

      setTimeout(function () {
        morphToForm('login', false);
        if (loginUserInput) {
          loginUserInput.value = username;
          loginUserInput.focus();
        }
        if (loginPassInput) loginPassInput.value = '';
        setTimeout(function () {
          showMsg('ACCOUNT CREATED \u00B7 PLEASE LOG IN', 'success');
        }, 420);
      }, 700);
    });
  }

  // ==================================================================
  // LOGIN  (required to enter the game)
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
          if (users[k].email && users[k].email.toLowerCase() === input) {
            accountKey = k; account = users[k]; break;
          }
        }
      }
      if (!account) {
        showMsg('ACCOUNT NOT FOUND \u00B7 PLEASE SIGN UP', 'error');
        showNotFoundPrompt(
          'The account "' + input + '" is not registered. Please sign up first to create an account.'
        );
        return;
      }
      if (account.provider !== 'local') {
        showMsg('THIS ACCOUNT USES ' + account.provider.toUpperCase() + ' \u00B7 NO PASSWORD TO RESET', 'error');
        return;
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      resetCtx = {
        key: accountKey, code: code,
        expires: Date.now() + 5 * 60 * 1000,
        displayName: account.username,
        email: account.email
      };
      localStorage.setItem(RESET_KEY, JSON.stringify(resetCtx));
      const otpTargetEl = document.getElementById('otpTarget');
      if (otpTargetEl) otpTargetEl.textContent = account.email;
      showMsg('OTP SENT TO ' + account.email, 'success');
      showOtpToast(code);
      startResendCountdown();
      showForm('otp');
      clearOtpInputs();
      const firstOtp = document.querySelector('[data-otp="0"]');
      if (firstOtp) setTimeout(function () { firstOtp.focus(); }, 450);
    });
  }

  function startResendCountdown() {
    stopResendCountdown();
    let remaining = RESEND_SECONDS;
    const resendBtn = document.getElementById('resendOtp');
    if (!resendBtn) return;
    resendBtn.disabled = true;

    let countEl = document.getElementById('resendCount');
    if (!countEl) {
      resendBtn.innerHTML = 'RESEND OTP (<span id="resendCount">' + remaining + '</span>s)';
      countEl = document.getElementById('resendCount');
    } else {
      countEl.textContent = remaining;
    }

    resendInterval = setInterval(function () {
      remaining--;
      const el = document.getElementById('resendCount');
      if (el) el.textContent = remaining;
      if (remaining <= 0) {
        stopResendCountdown();
        const btn = document.getElementById('resendOtp');
        if (btn) { btn.disabled = false; btn.innerHTML = 'RESEND OTP'; }
      }
    }, 1000);
  }
  function stopResendCountdown() {
    if (resendInterval) { clearInterval(resendInterval); resendInterval = null; }
    const resendBtn = document.getElementById('resendOtp');
    if (resendBtn) resendBtn.disabled = false;
  }

  const resendOtpBtn = document.getElementById('resendOtp');
  if (resendOtpBtn) {
    resendOtpBtn.addEventListener('click', function () {
      if (!resetCtx) { showMsg('SESSION EXPIRED \u00B7 START OVER', 'error'); return; }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      resetCtx.code = code;
      resetCtx.expires = Date.now() + 5 * 60 * 1000;
      localStorage.setItem(RESET_KEY, JSON.stringify(resetCtx));
      showMsg('NEW OTP SENT', 'success');
      showOtpToast(code);
      clearOtpInputs();
      const firstOtp = document.querySelector('[data-otp="0"]');
      if (firstOtp) firstOtp.focus();
      startResendCountdown();
    });
  }

  // ---------- OTP inputs ----------
  const otpInputs = document.querySelectorAll('[data-otp]');
  otpInputs.forEach(function (input, idx) {
    input.addEventListener('input', function (e) {
      const v = e.target.value.replace(/\D/g, '');
      e.target.value = v.slice(0, 1);
      e.target.classList.toggle('filled', !!e.target.value);
      if (e.target.value && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) otpInputs[idx - 1].focus();
      if (e.key === 'ArrowLeft'  && idx > 0)                    otpInputs[idx - 1].focus();
      if (e.key === 'ArrowRight' && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
    });
    input.addEventListener('paste', function (e) {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData)
        .getData('text').replace(/\D/g, '').slice(0, 6);
      for (let i = 0; i < otpInputs.length; i++) {
        otpInputs[i].value = text[i] || '';
        otpInputs[i].classList.toggle('filled', !!text[i]);
      }
      otpInputs[Math.min(text.length, otpInputs.length - 1)].focus();
    });
  });
  function clearOtpInputs() {
    otpInputs.forEach(function (i) { i.value = ''; i.classList.remove('filled'); });
  }
  function getOtpValue() {
    return Array.prototype.map.call(otpInputs, function (i) { return i.value; }).join('');
  }

  if (otpForm) {
    otpForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!resetCtx) { showMsg('SESSION EXPIRED \u00B7 START OVER', 'error'); showForm('forgot'); return; }
      const entered = getOtpValue();
      if (entered.length !== 6)          { showMsg('ENTER ALL 6 DIGITS', 'error'); return; }
      if (Date.now() > resetCtx.expires) { showMsg('OTP EXPIRED \u00B7 REQUEST A NEW ONE', 'error'); return; }
      if (entered !== resetCtx.code)     { showMsg('INVALID OTP', 'error'); return; }

      showMsg('IDENTITY VERIFIED', 'success');
      stopResendCountdown();
      setTimeout(function () {
        showForm('reset');
        const rp  = document.getElementById('resetPass');
        const rp2 = document.getElementById('resetPass2');
        if (rp)  rp.value = '';
        if (rp2) rp2.value = '';
        if (rp) setTimeout(function () { rp.focus(); }, 450);
      }, 400);
    });
  }

  if (resetForm) {
    resetForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!resetCtx) { showMsg('SESSION EXPIRED \u00B7 START OVER', 'error'); showForm('forgot'); return; }
      const rp  = document.getElementById('resetPass');
      const rp2 = document.getElementById('resetPass2');
      const pass  = rp ? rp.value : '';
      const pass2 = rp2 ? rp2.value : '';
      if (pass.length < 6) { showMsg('PASSWORD MUST BE 6+ CHARACTERS', 'error'); return; }
      if (pass !== pass2)  { showMsg('PASSWORDS DO NOT MATCH', 'error'); return; }

      const users   = loadUsers();
      const account = users[resetCtx.key];
      if (!account) { showMsg('ACCOUNT NO LONGER EXISTS', 'error'); showForm('login'); return; }

      account.password = hashPassword(pass);
      saveUsers(users);
      clearResetState();
      showMsg('PASSWORD UPDATED \u00B7 PLEASE LOGIN', 'success');
      setTimeout(function () { showForm('login'); }, 800);
    });
  }

  function clearResetState() {
    resetCtx = null;
    localStorage.removeItem(RESET_KEY);
    stopResendCountdown();
    clearOtpInputs();
  }

  (function restoreReset() {
    try {
      const saved = JSON.parse(localStorage.getItem(RESET_KEY));
      if (saved && saved.expires > Date.now()) {
        resetCtx = saved;
        const t = document.getElementById('otpTarget');
        if (t) t.textContent = saved.email || 'your account';
        showForm('otp');
        startResendCountdown();
      } else if (saved) {
        localStorage.removeItem(RESET_KEY);
      }
    } catch (e) {}
  })();

  // ==================================================================
  // SOCIAL LOGIN
  // ==================================================================
  function socialLogin(provider) {
    const providerName = provider === 'google' ? 'Google' : 'Facebook';
    const fakeEmail = provider + '_pilot_' + Math.floor(Math.random() * 9000 + 1000) + '@' + provider + '.com';
    const fakeName  = providerName + ' Pilot';

    const users = loadUsers();
    let existingKey = null;
    for (const k in users) {
      if (users[k].email === fakeEmail) { existingKey = k; break; }
    }

    let displayName, sessionKey;
    if (existingKey) {
      displayName = users[existingKey].username;
      sessionKey  = existingKey;
      showMsg('WELCOME BACK, ' + displayName.toUpperCase(), 'success');
    } else {
      const key = provider + '_' + Date.now().toString(36);
      users[key] = {
        id: generateId(),
        username: fakeName,
        email: fakeEmail,
        password: null,
        provider: provider,
        createdAt: Date.now(),
        stats: { highScore: 0, gamesPlayed: 0 }
      };
      saveUsers(users);
      displayName = fakeName;
      sessionKey  = key;
      showMsg('SIGNED IN WITH ' + providerName.toUpperCase(), 'success');
    }
    setTimeout(function () { setSession(sessionKey); startGame(displayName); }, 700);
  }
  const googleBtn = document.getElementById('googleBtn');
  if (googleBtn) googleBtn.addEventListener('click', function () { socialLogin('google'); });
  const facebookBtn = document.getElementById('facebookBtn');
  if (facebookBtn) facebookBtn.addEventListener('click', function () { socialLogin('facebook'); });

  // ==================================================================
  // LOGOUT
  // ==================================================================
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      clearSession();
      clearResetState();
      clearEmailFeedback();
      hideNotFoundPrompt();

      if (userBar)     userBar.classList.remove('visible');
      if (gameWrapper) gameWrapper.classList.remove('visible');
      if (gameInfo)    gameInfo.classList.add('hidden');
      if (authOverlay) authOverlay.classList.remove('hidden');

      showForm('login');
      showMsg('LOGGED OUT', 'success');
      window.__gameRunning = false;

      document.querySelectorAll('.eye-toggle.showing').forEach(function (btn) {
        const input = document.getElementById(btn.getAttribute('data-target'));
        if (input) input.type = 'password';
        btn.classList.remove('showing');
      });
    });
  }

  // ==================================================================
  // START GAME
  // ==================================================================
  function startGame(displayName) {
    if (authOverlay) authOverlay.classList.add('hidden');
    if (userBar)     userBar.classList.add('visible');
    if (gameWrapper) gameWrapper.classList.add('visible');
    if (gameInfo)    gameInfo.classList.remove('hidden');

    if (userNameEl)    userNameEl.textContent    = displayName;
    if (avatarInitial) avatarInitial.textContent = displayName.charAt(0).toUpperCase();

    if (typeof window.__initGame === 'function') window.__initGame();
    window.__gameRunning = true;
  }

  // ==================================================================
  // AUTO-RESTORE SESSION
  // ==================================================================
  (function restoreSession() {
    const session = getSession();
    if (session && session.username) {
      const users   = loadUsers();
      const account = users[session.username];
      if (account) setTimeout(function () { startGame(account.username); }, 100);
      else         clearSession();
    }
  })();

  window.DarkOrbitAuth = {
    showForm: showForm,
    showMsg: showMsg,
    startGame: startGame,
    loadUsers: loadUsers,
    saveUsers: saveUsers
  };
})();
