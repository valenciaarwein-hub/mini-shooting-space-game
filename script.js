// ====================================================================
//  DARK ORBIT · 2D SPACE SHOOTER  —  script.js
// ====================================================================

// ====================================================================
//  AUTH SYSTEM
// ====================================================================
const USERS_KEY = 'darkorbit_users';
const SESSION_KEY = 'darkorbit_session';
const RESET_KEY = 'darkorbit_reset';

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
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username, ts: Date.now() }));
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
    const lowerEmail = email.toLowerCase();
    for (const k in users) {
        if (users[k].email && users[k].email.toLowerCase() === lowerEmail) return true;
    }
    return false;
}

// ---------- UI ----------
const authOverlay = document.getElementById('authOverlay');
const authMsg = document.getElementById('authMsg');
const authTabs = document.getElementById('authTabs');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const forgotForm = document.getElementById('forgotForm');
const otpForm = document.getElementById('otpForm');
const resetForm = document.getElementById('resetForm');
const socialBlock = document.getElementById('socialBlock');
const tabs = document.querySelectorAll('.auth-tab');
const userBar = document.getElementById('userBar');
const userNameEl = document.getElementById('userName');
const avatarInitial = document.getElementById('avatarInitial');
const gameWrapper = document.getElementById('gameWrapper');
const gameInfo = document.getElementById('gameInfo');
const otpToast = document.getElementById('otpToast');
const toastCode = document.getElementById('toastCode');
const toastClose = document.getElementById('toastClose');
const emailInput = document.getElementById('signupEmail');
const emailStatus = document.getElementById('emailStatus');
const emailIcon = document.getElementById('emailIcon');
const signupBtn = document.getElementById('signupBtn');
const loginUserInput = document.getElementById('loginUser');
const loginPassInput = document.getElementById('loginPass');
const notFoundPrompt = document.getElementById('notFoundPrompt');
const notFoundText = document.getElementById('notFoundText');
const gotoSignupBtn = document.getElementById('gotoSignupBtn');

// ---------- Account-not-found prompt ----------
function showNotFoundPrompt(message) {
    notFoundText.textContent = message || 'This account is not yet registered. Please sign up first to create an account.';
    notFoundPrompt.classList.remove('show');
    // restart animation
    void notFoundPrompt.offsetWidth;
    notFoundPrompt.classList.add('show');
    loginUserInput.classList.add('input-error');
    loginPassInput.classList.add('input-error');
}
function hideNotFoundPrompt() {
    notFoundPrompt.classList.remove('show');
    loginUserInput.classList.remove('input-error');
    loginPassInput.classList.remove('input-error');
}

// Hide prompt when the user starts typing again
loginUserInput.addEventListener('input', hideNotFoundPrompt);
loginPassInput.addEventListener('input', hideNotFoundPrompt);

// "SIGN UP NOW" jumps to the signup tab, pre-filling the username/email if possible
gotoSignupBtn.addEventListener('click', () => {
    const typed = loginUserInput.value.trim();
    showForm('signup');
    // If user typed a valid email, carry it over to the signup email field
    if (typed && isValidEmailFormat(typed)) {
        document.getElementById('signupEmail').value = typed;
        emailInput.dispatchEvent(new Event('input'));
    } else if (typed) {
        document.getElementById('signupUser').value = typed;
    }
    setTimeout(() => {
        document.getElementById('signupUser').focus();
    }, 50);
});

// ====================================================================
//  FORM SWITCHING  ·  HYPERSPACE WARP TRANSITION
// ====================================================================
const formStage = document.getElementById('formStage');

const FORM_MAP   = { login: loginForm, signup: signupForm, forgot: forgotForm, otp: otpForm, reset: resetForm };
const FORM_ORDER = { login: 0, signup: 1, forgot: 2, otp: 3, reset: 4 };

let currentFormName = 'login';
let warpToken = 0;
let warpCleanupTimer = null;

// Chrome = everything that is NOT part of the warp stage
function setAuthChrome(name) {
    const showTabs = (name === 'login' || name === 'signup');
    authTabs.style.display    = showTabs ? 'flex' : 'none';
    socialBlock.style.display = showTabs ? 'block' : 'none';

    tabs.forEach(t => {
        const isActive = t.dataset.tab === name;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (name !== 'signup') clearEmailFeedback();
    if (name !== 'login')  hideNotFoundPrompt();

    showMsg('');
}

function showForm(name) {
    const nextForm = FORM_MAP[name];
    if (!nextForm) return;

    const prevForm = formStage.querySelector('.auth-form.active');

    // ---- nothing to warp to: just sync the chrome ----
    if (prevForm === nextForm) {
        currentFormName = name;
        setAuthChrome(name);
        return;
    }

    // ---- direction: forward = new form slides in from the right ----
    const dir = (FORM_ORDER[name] >= FORM_ORDER[currentFormName]) ? 1 : -1;

    // 1. Freeze the current height so the card can morph smoothly
    formStage.style.height = prevForm.offsetHeight + 'px';
    formStage.classList.add('warping');

    // 2. Launch the old form into hyperspace
    prevForm.classList.remove('warp-in');
    prevForm.classList.remove('active');
    prevForm.classList.add('warp-out');
    prevForm.style.setProperty('--warp-dir', dir);

    // 3. Drop the new form out of warp
    nextForm.classList.remove('warp-out', 'warp-in');
    nextForm.classList.add('active', 'warp-in');
    nextForm.style.setProperty('--warp-dir', dir);

    // 4. Animate the stage height towards the new form
    const targetHeight = nextForm.offsetHeight;
    void formStage.offsetHeight;                        // commit the start height
    formStage.style.height = targetHeight + 'px';

    setAuthChrome(name);
    currentFormName = name;

    // 5. Clean up once the jump is complete
    const token = ++warpToken;
    clearTimeout(warpCleanupTimer);
    warpCleanupTimer = setTimeout(() => {
        if (token !== warpToken) return;                // a newer warp took over
        formStage.querySelectorAll('.warp-out').forEach(f => {
            f.classList.remove('warp-out');
            f.style.removeProperty('--warp-dir');
        });
        nextForm.classList.remove('warp-in');
        nextForm.style.removeProperty('--warp-dir');
        formStage.classList.remove('warping');
        formStage.style.height = '';                    // back to natural height
    }, 520);
}

tabs.forEach(tab => {
    tab.addEventListener('click', () => showForm(tab.dataset.tab));
});

document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => {
        stopResendCountdown();
        clearResetState();
        showForm('login');
    });
});

// ---------- Eye toggle ----------
document.querySelectorAll('.eye-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.getAttribute('data-target'));
        if (!input) return;
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        btn.classList.toggle('showing', isHidden);
        btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        input.focus();
    });
});

// ---------- Messages ----------
function showMsg(text, type) {
    authMsg.textContent = text;
    authMsg.className = 'auth-msg ' + (type || '');
    if (text) {
        clearTimeout(showMsg._t);
        showMsg._t = setTimeout(() => {
            if (authMsg.textContent === text) {
                authMsg.textContent = '';
                authMsg.className = 'auth-msg';
            }
        }, 3500);
    }
}

// ---------- Email Availability UI ----------
let emailCheckTimer = null;
let emailAvailable = false;

function resetEmailStatus() {
    emailAvailable = false;
    emailStatus.textContent = '';
    emailStatus.className = 'field-status';
    emailIcon.textContent = '';
    emailIcon.className = 'email-icon';
    emailInput.classList.remove('valid-email', 'invalid-email');
    signupBtn.disabled = false;
}

function setEmailStatus(state, message) {
    emailStatus.textContent = message || '';
    emailStatus.className = 'field-status ' + (state || '');
    emailIcon.className = 'email-icon ' + (state || '');
    if (state === 'available') {
        emailIcon.textContent = '✓';
        emailInput.classList.add('valid-email');
        emailInput.classList.remove('invalid-email');
        emailAvailable = true;
        signupBtn.disabled = false;
    } else if (state === 'taken') {
        emailIcon.textContent = '✗';
        emailInput.classList.add('invalid-email');
        emailInput.classList.remove('valid-email');
        emailAvailable = false;
        signupBtn.disabled = true;
    } else if (state === 'checking') {
        emailIcon.textContent = '⟳';
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

emailInput.addEventListener('input', () => {
    const email = emailInput.value.trim();
    clearTimeout(emailCheckTimer);

    if (!email) { resetEmailStatus(); return; }

    if (!isValidEmailFormat(email)) {
        setEmailStatus('taken', 'INVALID FORMAT');
        return;
    }

    setEmailStatus('checking', 'CHECKING…');

    emailCheckTimer = setTimeout(() => {
        if (isEmailRegistered(email)) {
            setEmailStatus('taken', 'ALREADY REGISTERED');
        } else {
            setEmailStatus('available', 'AVAILABLE');
        }
    }, 400);
});

function clearEmailFeedback() {
    resetEmailStatus();
    clearTimeout(emailCheckTimer);
}

// ---------- OTP Toast ----------
let toastTimer = null;
function showOtpToast(code) {
    toastCode.textContent = code;
    otpToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => otpToast.classList.remove('show'), 10000);
}
toastClose.addEventListener('click', () => otpToast.classList.remove('show'));

// ====================================================================
//  SIGN UP
// ====================================================================
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('signupUser').value.trim();
    const email = emailInput.value.trim();
    const pass = document.getElementById('signupPass').value;
    const pass2 = document.getElementById('signupPass2').value;

    if (!username || !email || !pass) { showMsg('ALL FIELDS REQUIRED', 'error'); return; }
    if (username.length < 3) { showMsg('USERNAME MUST BE 3+ CHARACTERS', 'error'); return; }
    if (!isValidEmailFormat(email)) { showMsg('INVALID EMAIL FORMAT', 'error'); return; }
    if (isEmailRegistered(email)) {
        showMsg('EMAIL ALREADY REGISTERED', 'error');
        setEmailStatus('taken', 'ALREADY REGISTERED');
        return;
    }
    if (pass.length < 6) { showMsg('PASSWORD MUST BE 6+ CHARACTERS', 'error'); return; }
    if (pass !== pass2) { showMsg('PASSWORDS DO NOT MATCH', 'error'); return; }

    const users = loadUsers();
    const lowerUser = username.toLowerCase();
    if (users[lowerUser]) { showMsg('USERNAME ALREADY TAKEN', 'error'); return; }

    users[lowerUser] = {
        id: generateId(), username, email,
        password: hashPassword(pass), provider: 'local',
        createdAt: Date.now(), stats: { highScore: 0, gamesPlayed: 0 }
    };
    saveUsers(users);
    showMsg('ACCOUNT CREATED · LOGGING IN…', 'success');
    resetEmailStatus();
    setTimeout(() => { setSession(lowerUser); startGame(username); }, 700);
});

// ====================================================================
//  LOGIN
// ====================================================================
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userInput = loginUserInput.value.trim().toLowerCase();
    const pass = loginPassInput.value;
    if (!userInput || !pass) { showMsg('ALL FIELDS REQUIRED', 'error'); return; }

    const users = loadUsers();
    let account = users[userInput];
    let accountKey = userInput;
    if (!account) {
        for (const k in users) {
            if (users[k].email && users[k].email.toLowerCase() === userInput) {
                account = users[k]; accountKey = k; break;
            }
        }
    }

    // ---- ACCOUNT NOT FOUND: show the sign-up prompt ----
    if (!account) {
        showMsg('ACCOUNT NOT FOUND', 'error');
        showNotFoundPrompt(
            `The account "${loginUserInput.value.trim()}" is not yet registered. Please sign up first to create an account.`
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
    setTimeout(() => { setSession(accountKey); startGame(displayName); }, 500);
});

// ====================================================================
//  FORGOT PASSWORD + OTP
// ====================================================================
let resetCtx = null;
let resendInterval = null;
const RESEND_SECONDS = 30;

document.getElementById('forgotLink').addEventListener('click', () => {
    showForm('forgot');
    document.getElementById('forgotUser').value = '';
});

forgotForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('forgotUser').value.trim().toLowerCase();
    if (!input) { showMsg('ENTER USERNAME OR EMAIL', 'error'); return; }

    const users = loadUsers();
    let accountKey = null, account = null;
    if (users[input]) { accountKey = input; account = users[input]; }
    else {
        for (const k in users) {
            if (users[k].email && users[k].email.toLowerCase() === input) { accountKey = k; account = users[k]; break; }
        }
    }

    if (!account) {
        showMsg('ACCOUNT NOT FOUND · PLEASE SIGN UP', 'error');
        showNotFoundPrompt(
            `The account "${input}" is not registered. Please sign up first to create an account.`
        );
        return;
    }
    if (account.provider !== 'local') {
        showMsg('THIS ACCOUNT USES ' + account.provider.toUpperCase() + ' · NO PASSWORD TO RESET', 'error');
        return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    resetCtx = {
        key: accountKey, code,
        expires: Date.now() + 5 * 60 * 1000,
        displayName: account.username,
        email: account.email
    };
    localStorage.setItem(RESET_KEY, JSON.stringify(resetCtx));

    document.getElementById('otpTarget').textContent = account.email;
    showOtpToast(code);
    startResendCountdown();
    showForm('otp');
    showMsg('OTP SENT TO ' + account.email, 'success');
    clearOtpInputs();
    document.querySelector('[data-otp="0"]').focus();
});

function startResendCountdown() {
    stopResendCountdown();
    let remaining = RESEND_SECONDS;
    const resendBtn = document.getElementById('resendOtp');
    const countEl = document.getElementById('resendCount');
    resendBtn.disabled = true;
    countEl.textContent = remaining;
    resendInterval = setInterval(() => {
        remaining--;
        countEl.textContent = remaining;
        if (remaining <= 0) {
            stopResendCountdown();
            resendBtn.disabled = false;
            resendBtn.innerHTML = 'RESEND OTP';
        }
    }, 1000);
}
function stopResendCountdown() {
    if (resendInterval) { clearInterval(resendInterval); resendInterval = null; }
    const resendBtn = document.getElementById('resendOtp');
    resendBtn.disabled = false;
}

document.getElementById('resendOtp').addEventListener('click', () => {
    if (!resetCtx) { showMsg('SESSION EXPIRED · START OVER', 'error'); return; }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    resetCtx.code = code;
    resetCtx.expires = Date.now() + 5 * 60 * 1000;
    localStorage.setItem(RESET_KEY, JSON.stringify(resetCtx));
    showMsg('NEW OTP SENT', 'success');
    showOtpToast(code);
    clearOtpInputs();
    document.querySelector('[data-otp="0"]').focus();
    startResendCountdown();
});

const otpInputs = document.querySelectorAll('[data-otp]');
otpInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
        const v = e.target.value.replace(/\D/g, '');
        e.target.value = v.slice(0, 1);
        e.target.classList.toggle('filled', !!e.target.value);
        if (e.target.value && idx < otpInputs.length - 1) {
            otpInputs[idx + 1].focus();
        }
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
            otpInputs[idx - 1].focus();
        }
        if (e.key === 'ArrowLeft' && idx > 0) otpInputs[idx - 1].focus();
        if (e.key === 'ArrowRight' && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
    });
    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
        for (let i = 0; i < otpInputs.length; i++) {
            otpInputs[i].value = text[i] || '';
            otpInputs[i].classList.toggle('filled', !!text[i]);
        }
        const next = Math.min(text.length, otpInputs.length - 1);
        otpInputs[next].focus();
    });
});

function clearOtpInputs() {
    otpInputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
}
function getOtpValue() {
    return Array.from(otpInputs).map(i => i.value).join('');
}

otpForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!resetCtx) { showMsg('SESSION EXPIRED · START OVER', 'error'); showForm('forgot'); return; }
    const entered = getOtpValue();
    if (entered.length !== 6) { showMsg('ENTER ALL 6 DIGITS', 'error'); return; }
    if (Date.now() > resetCtx.expires) { showMsg('OTP EXPIRED · REQUEST A NEW ONE', 'error'); return; }
    if (entered !== resetCtx.code) { showMsg('INVALID OTP', 'error'); return; }

    showMsg('IDENTITY VERIFIED', 'success');
    stopResendCountdown();
    setTimeout(() => {
        showForm('reset');
        document.getElementById('resetPass').value = '';
        document.getElementById('resetPass2').value = '';
        document.getElementById('resetPass').focus();
    }, 400);
});

resetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!resetCtx) { showMsg('SESSION EXPIRED · START OVER', 'error'); showForm('forgot'); return; }
    const pass = document.getElementById('resetPass').value;
    const pass2 = document.getElementById('resetPass2').value;
    if (pass.length < 6) { showMsg('PASSWORD MUST BE 6+ CHARACTERS', 'error'); return; }
    if (pass !== pass2) { showMsg('PASSWORDS DO NOT MATCH', 'error'); return; }

    const users = loadUsers();
    const account = users[resetCtx.key];
    if (!account) { showMsg('ACCOUNT NO LONGER EXISTS', 'error'); showForm('login'); return; }

    account.password = hashPassword(pass);
    saveUsers(users);
    clearResetState();
    showMsg('PASSWORD UPDATED · PLEASE LOGIN', 'success');
    setTimeout(() => showForm('login'), 800);
});

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
            document.getElementById('otpTarget').textContent = saved.email || 'your account';
            showForm('otp');
            startResendCountdown();
        } else if (saved) {
            localStorage.removeItem(RESET_KEY);
        }
    } catch (e) {}
})();

// ====================================================================
//  SOCIAL LOGIN
// ====================================================================
function socialLogin(provider) {
    const providerName = provider === 'google' ? 'Google' : 'Facebook';
    const fakeEmail = `${provider}_pilot_${Math.floor(Math.random()*9000+1000)}@${provider}.com`;
    const fakeName = `${providerName} Pilot`;
    const users = loadUsers();

    let existingKey = null;
    for (const k in users) {
        if (users[k].email === fakeEmail) { existingKey = k; break; }
    }

    let displayName, sessionKey;
    if (existingKey) {
        displayName = users[existingKey].username;
        sessionKey = existingKey;
        showMsg(`WELCOME BACK, ${displayName.toUpperCase()}`, 'success');
    } else {
        const key = `${provider}_${Date.now().toString(36)}`;
        users[key] = {
            id: generateId(), username: fakeName, email: fakeEmail,
            password: null, provider, createdAt: Date.now(),
            stats: { highScore: 0, gamesPlayed: 0 }
        };
        saveUsers(users);
        displayName = fakeName;
        sessionKey = key;
        showMsg(`SIGNED IN WITH ${providerName.toUpperCase()}`, 'success');
    }
    setTimeout(() => { setSession(sessionKey); startGame(displayName); }, 700);
}
document.getElementById('googleBtn').addEventListener('click', () => socialLogin('google'));
document.getElementById('facebookBtn').addEventListener('click', () => socialLogin('facebook'));

// ====================================================================
//  LOGOUT
// ====================================================================
document.getElementById('logoutBtn').addEventListener('click', () => {
    clearSession();
    clearResetState();
    clearEmailFeedback();
    hideNotFoundPrompt();
    userBar.classList.remove('visible');
    gameWrapper.classList.remove('visible');
    gameInfo.classList.add('hidden');
    authOverlay.classList.remove('hidden');
    showForm('login');
    showMsg('LOGGED OUT', 'success');
    window.__gameRunning = false;
    document.querySelectorAll('.eye-toggle.showing').forEach(btn => {
        const input = document.getElementById(btn.getAttribute('data-target'));
        if (input) input.type = 'password';
        btn.classList.remove('showing');
    });
});

// ====================================================================
//  START GAME
// ====================================================================
function startGame(displayName) {
    authOverlay.classList.add('hidden');
    userBar.classList.add('visible');
    gameWrapper.classList.add('visible');
    gameInfo.classList.remove('hidden');
    userNameEl.textContent = displayName;
    avatarInitial.textContent = displayName.charAt(0).toUpperCase();
    if (typeof window.__initGame === 'function') window.__initGame();
    window.__gameRunning = true;
}

// ====================================================================
//  AUTO-RESTORE SESSION
// ====================================================================
(function restoreSession() {
    const session = getSession();
    if (session && session.username) {
        const users = loadUsers();
        const account = users[session.username];
        if (account) {
            setTimeout(() => startGame(account.username), 100);
        } else {
            clearSession();
        }
    }
})();

// ====================================================================
//  GAME ENGINE
// ====================================================================
(function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let started = false;
    let rafId = null;

    const COLORS = {
        bg: '#05070c',
        stars: ['#1b3144', '#2a4e6b', '#0f1f2e', '#3a6b8f', '#152a3a'],
        player: '#6fc3ff', playerGlow: '#0088ff',
        enemy: '#b33e5c', enemyCore: '#ff4d6d', ui: '#3f7c9e'
    };

    const RAPID_TIERS = {
        low:     { name: 'LOW',     fireRateMult: 1.00, color: '#7fe0ff', glow: '#00c8ff', tier: 0 },
        medium:  { name: 'MEDIUM',  fireRateMult: 0.70, color: '#7dffb8', glow: '#00ff88', tier: 1 },
        high:    { name: 'HIGH',    fireRateMult: 0.45, color: '#ffd97d', glow: '#ffb000', tier: 2 },
        extreme: { name: 'EXTREME', fireRateMult: 0.25, color: '#ff7de0', glow: '#ff00c8', tier: 3 }
    };

    const WEAPONS = {
        pulse:   { name: 'PULSE',   damage: 1,   fireRate: 8,  bulletSpeed: -8.5, spread: 0,    count: 1, size: 1.0, pierce: 0, color: '#7fe0ff', glowColor: '#00c8ff', explosive: false },
        scatter: { name: 'SCATTER', damage: 0.7, fireRate: 14, bulletSpeed: -7.5, spread: 0.55, count: 5, size: 0.8, pierce: 0, color: '#ffb86b', glowColor: '#ff8a2b', explosive: false },
        railgun: { name: 'RAILGUN', damage: 3,   fireRate: 22, bulletSpeed: -14,  spread: 0,    count: 1, size: 1.4, pierce: 2, color: '#ff6b9d', glowColor: '#ff2a6d', explosive: false },
        bazuka:  { name: 'BAZUKA',  damage: 4,   fireRate: 42, bulletSpeed: -5.5, spread: 0,    count: 1, size: 2.6, pierce: 0, color: '#ff8a3d', glowColor: '#ff5500', explosive: true, blastRadius: 78, blastDamage: 3, blastFalloff: true }
    };
    const WEAPON_ORDER = ['pulse', 'scatter', 'railgun', 'bazuka'];

    const PICKUP_DEFS = {
        weapon_pulse:   { kind: 'weapon', value: 'pulse',   label: 'PULSE',   color: '#7fe0ff', glow: '#00c8ff', icon: 'W' },
        weapon_scatter: { kind: 'weapon', value: 'scatter', label: 'SCATTER', color: '#ffb86b', glow: '#ff8a2b', icon: 'W' },
        weapon_railgun: { kind: 'weapon', value: 'railgun', label: 'RAILGUN', color: '#ff6b9d', glow: '#ff2a6d', icon: 'W' },
        weapon_bazuka:  { kind: 'weapon', value: 'bazuka',  label: 'BAZUKA',  color: '#ff8a3d', glow: '#ff5500', icon: 'W' },
        rapid_medium:   { kind: 'rapid',  value: 'medium',  label: 'MEDIUM',  color: '#7dffb8', glow: '#00ff88', icon: 'R' },
        rapid_high:     { kind: 'rapid',  value: 'high',    label: 'HIGH',    color: '#ffd97d', glow: '#ffb000', icon: 'R' },
        rapid_extreme:  { kind: 'rapid',  value: 'extreme', label: 'EXTREME', color: '#ff7de0', glow: '#ff00c8', icon: 'R' }
    };

    let gameOver = false, score = 0, frame = 0;
    let enemySpawnRate = 35, enemySpawnTimer = 0, pickupSpawnTimer = 0;
    const PICKUP_SPAWN_INTERVAL = 240;
    let starField = [], nebulaClouds = [], explosions = [];

    const player = {
        x: 400, y: 540, speed: 5, hp: 100, maxHp: 100,
        invincible: 0, cooldown: 0, size: 16,
        weapon: 'pulse', rapidTier: 'low', rapidTimer: 0,
        damageBonus: 0, speedBonus: 0, multishotBonus: 0
    };

    let bullets = [], enemies = [], particles = [], pickups = [];
    const keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, Space: false };

    function initStars() {
        starField = [];
        for (let i = 0; i < 180; i++) {
            const layer = Math.floor(Math.random() * 3);
            starField.push({
                x: Math.random() * canvas.width, y: Math.random() * canvas.height,
                size: 0.7 + layer * 0.6 + Math.random() * 1.2,
                speed: 0.2 + layer * 0.35,
                brightness: 0.3 + layer * 0.25 + Math.random() * 0.3,
                color: COLORS.stars[Math.floor(Math.random() * COLORS.stars.length)]
            });
        }
    }
    function initNebula() {
        nebulaClouds = [];
        for (let i = 0; i < 7; i++) {
            nebulaClouds.push({
                x: Math.random() * canvas.width, y: Math.random() * canvas.height,
                radius: 120 + Math.random() * 200,
                alpha: 0.08 + Math.random() * 0.1,
                speed: 0.08 + Math.random() * 0.15
            });
        }
    }
    function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
    function spawnParticles(x, y, count, color, speedBase = 2, sizeBase = 1.8) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = speedBase * (0.5 + Math.random() * 0.8);
            particles.push({
                x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                life: 1.0, decay: 0.012 + Math.random() * 0.02,
                size: sizeBase * (0.6 + Math.random() * 0.8), color
            });
        }
    }
    function getRapidTier() { return RAPID_TIERS[player.rapidTier] || RAPID_TIERS.low; }
    function setRapidTier(tierName) {
        const target = RAPID_TIERS[tierName];
        const current = RAPID_TIERS[player.rapidTier];
        if (!target) return;
        if (target.tier > current.tier) {
            player.rapidTier = tierName;
            player.rapidTimer = 600;
            spawnParticles(player.x, player.y, 18, target.glow, 2.4, 2.2);
        }
    }
    function resetGame() {
        gameOver = false; score = 0;
        player.hp = player.maxHp; player.x = 400; player.y = 540;
        player.invincible = 0; player.cooldown = 0;
        player.weapon = 'pulse'; player.rapidTier = 'low'; player.rapidTimer = 0;
        player.damageBonus = 0; player.speedBonus = 0; player.multishotBonus = 0;
        bullets = []; enemies = []; particles = []; pickups = []; explosions = [];
        enemySpawnTimer = 0; enemySpawnRate = 35; pickupSpawnTimer = 0;
        initStars(); initNebula();
    }
    function spawnEnemy() {
        const w = 26 + Math.floor(Math.random() * 14);
        const h = 22 + Math.floor(Math.random() * 10);
        const x = Math.random() * (canvas.width - w - 20) + 10;
        const y = -h - Math.random() * 20;
        const speedY = 1.4 + Math.random() * 1.8;
        const speedX = (Math.random() - 0.5) * 1.2;
        const hp = 1 + Math.floor(Math.random() * 2);
        enemies.push({ x, y,
