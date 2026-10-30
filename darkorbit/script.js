// ====================================================================
// AUTH SYSTEM
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
// ---------- UI ---------- const authOverlay = document.getElementById('authOverlay');
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
notFoundText.textContent = message || 'This account is not yet registered. Please sign up first
to create an account.';
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
(typed && isValidEmailFormat(typed)
? document.getElementById('signupUser')
: document.getElementById('signupUser')
).focus();
}, 50);
});
// ---------- Form switching ----------
function showForm(name) {
[loginForm, signupForm, forgotForm, otpForm, resetForm].forEach(f =>
f.classList.remove('active'));
({ login: loginForm, signup: signupForm, forgot: forgotForm, otp: otpForm, reset:
resetForm })[name].classList.add('active');
authTabs.style.display = (name === 'login' || name === 'signup') ? 'flex' : 'none';
socialBlock.style.display = (name === 'login' || name === 'signup') ? 'block' : 'none';
tabs.forEach(t => {
const isActive = t.dataset.tab === name;
t.classList.toggle('active', isActive);
t.setAttribute('aria-selected', isActive ? 'true' : 'false');
});
if (name !== 'signup') clearEmailFeedback();
if (name !== 'login') hideNotFoundPrompt();
showMsg('');
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
// ---------- Eye toggle ---------- document.querySelectorAll('.eye-toggle').forEach(btn => {
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
emailIcon.textContent = '⟳ ';
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
// SIGN UP
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
id: generateId(), username, email, password: hashPassword(pass), provider: 'local', createdAt: Date.now(), stats: { highScore: 0, gamesPlayed: 0 }
};
saveUsers(users);
showMsg('ACCOUNT CREATED · LOGGING IN…', 'success');
resetEmailStatus();
setTimeout(() => { setSession(lowerUser); startGame(username); }, 700);
});
// ====================================================================
// LOGIN
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
`The account "${loginUserInput.value.trim()}" is not yet registered. Please sign up first to
create an account.` );
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
// FORGOT PASSWORD + OTP
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
`The account "${input}" is not registered. Please sign up first to create an account.` );
return;
}
if (account.provider !== 'local') {
showMsg('THIS ACCOUNT USES ' + account.provider.toUpperCase() + ' · NO PASSWORD TO
RESET', 'error');
return;
}
const code = String(Math.floor(100000 + Math.random() * 900000));
resetCtx = {
key: accountKey, code, expires: Date.now() + 5 * 60 * 1000, displayName: account.username, email: account.email
};
localStorage.setItem(RESET_KEY, JSON.stringify(resetCtx));
document.getElementById('otpTarget').textContent = account.email;
showMsg('OTP SENT TO ' + account.email, 'success');
showOtpToast(code);
startResendCountdown();
showForm('otp');
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
const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,
'').slice(0, 6);
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
if (Date.now() > resetCtx.expires) { showMsg('OTP EXPIRED · REQUEST A NEW ONE', 'error');
return; }
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
// SOCIAL LOGIN
// ====================================================================
function socialLogin(provider) {
const providerName = provider === 'google' ? 'Google' : 'Facebook';
const fakeEmail =
`${provider}_pilot_${Math.floor(Math.random()*9000+1000)}@${provider}.com`;
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
id: generateId(), username: fakeName, email: fakeEmail, password: null, provider, createdAt: Date.now(), stats: { highScore: 0, gamesPlayed: 0 }
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
// LOGOUT
// ==================================================================== document.getElementById('logoutBtn').addEventListener('click', () => {
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
// START GAME
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
// AUTO-RESTORE SESSION
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
// GAME ENGINE (unchanged)
// ====================================================================
(function() {
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let started = false;
let rafId = null;
const COLORS = {
bg: '#05070c', stars: ['#1b3144', '#2a4e6b', '#0f1f2e', '#3a6b8f', '#152a3a'], player: '#6fc3ff', playerGlow: '#0088ff', enemy: '#b33e5c', enemyCore: '#ff4d6d', ui: '#3f7c9e' };
const RAPID_TIERS = {
low: { name: 'LOW', fireRateMult: 1.00, color: '#7fe0ff', glow: '#00c8ff', tier: 0 }, medium: { name: 'MEDIUM', fireRateMult: 0.70, color: '#7dffb8', glow: '#00ff88', tier: 1 }, high: { name: 'HIGH', fireRateMult: 0.45, color: '#ffd97d', glow: '#ffb000', tier: 2 }, extreme: { name: 'EXTREME', fireRateMult: 0.25, color: '#ff7de0', glow: '#ff00c8', tier: 3 }
};
const WEAPONS = {
pulse: { name: 'PULSE', damage: 1, fireRate: 8, bulletSpeed: -8.5, spread: 0, count: 1, size: 1.0, pierce: 0, color: '#7fe0ff', glowColor: '#00c8ff', explosive: false }, scatter: { name: 'SCATTER', damage: 0.7, fireRate: 14, bulletSpeed: -7.5, spread: 0.55, count:
5, size: 0.8, pierce: 0, color: '#ffb86b', glowColor: '#ff8a2b', explosive: false }, railgun: { name: 'RAILGUN', damage: 3, fireRate: 22, bulletSpeed: -14, spread: 0, count: 1, size: 1.4, pierce: 2, color: '#ff6b9d', glowColor: '#ff2a6d', explosive: false }, bazuka: { name: 'BAZUKA', damage: 4, fireRate: 42, bulletSpeed: -5.5, spread: 0, count: 1, size: 2.6, pierce: 0, color: '#ff8a3d', glowColor: '#ff5500', explosive: true, blastRadius: 78, blastDamage:
3, blastFalloff: true }
};
const WEAPON_ORDER = ['pulse', 'scatter', 'railgun', 'bazuka'];
const PICKUP_DEFS = {
weapon_pulse: { kind: 'weapon', value: 'pulse', label: 'PULSE', color: '#7fe0ff', glow:
'#00c8ff', icon: 'W' }, weapon_scatter: { kind: 'weapon', value: 'scatter', label: 'SCATTER', color: '#ffb86b', glow:
'#ff8a2b', icon: 'W' }, weapon_railgun: { kind: 'weapon', value: 'railgun', label: 'RAILGUN', color: '#ff6b9d', glow:
'#ff2a6d', icon: 'W' }, weapon_bazuka: { kind: 'weapon', value: 'bazuka', label: 'BAZUKA', color: '#ff8a3d', glow:
'#ff5500', icon: 'W' }, rapid_medium: { kind: 'rapid', value: 'medium', label: 'MEDIUM', color: '#7dffb8', glow:
'#00ff88', icon: 'R' }, rapid_high: { kind: 'rapid', value: 'high', label: 'HIGH', color: '#ffd97d', glow: '#ffb000',
icon: 'R' },rapid_extreme: { kind: 'rapid', value: 'extreme', label: 'EXTREME', color: '#ff7de0', glow:
'#ff00c8', icon: 'R' }
};
let gameOver = false, score = 0, frame = 0;
let enemySpawnRate = 35, enemySpawnTimer = 0, pickupSpawnTimer = 0;
const PICKUP_SPAWN_INTERVAL = 240;
let starField = [], nebulaClouds = [], explosions = [];
const player = {
x: 400, y: 540, speed: 5, hp: 100, maxHp: 100,
invincible: 0, cooldown: 0, size: 16, weapon: 'pulse', rapidTier: 'low', rapidTimer: 0, damageBonus: 0, speedBonus: 0, multishotBonus: 0
};
let bullets = [], enemies = [], particles = [], pickups = [];
const keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, Space:
false };
function initStars() {
starField = [];
for (let i = 0; i < 180; i++) {
const layer = Math.floor(Math.random() * 3);
starField.push({
x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: 0.7 + layer * 0.6 + Math.random() * 1.2, speed: 0.2 + layer * 0.35, brightness: 0.3 + layer * 0.25 + Math.random() * 0.3, color: COLORS.stars[Math.floor(Math.random() * COLORS.stars.length)]
});
}
}
function initNebula() {
nebulaClouds = [];
for (let i = 0; i < 7; i++) {
nebulaClouds.push({
x: Math.random() * canvas.width, y: Math.random() * canvas.height, radius: 120 + Math.random() * 200, alpha: 0.08 + Math.random() * 0.1, speed: 0.08 + Math.random() * 0.15
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
life: 1.0, decay: 0.012 + Math.random() * 0.02, size: sizeBase * (0.6 + Math.random() * 0.8), color
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
enemies.push({ x, y, w, h, vx: speedX, vy: speedY, hp, maxHp: hp, color: COLORS.enemy, coreColor: COLORS.enemyCore, hitFlash: 0 });
}
function spawnPickup(defKey) {
const def = PICKUP_DEFS[defKey];
if (!def) return;
const size = 26;
pickups.push({
def, x: Math.random() * (canvas.width - size - 40) + 20, y: -size, w: size, h: size, vy: 1.5 + Math.random() * 0.8, vx: (Math.random() - 0.5) * 0.6, rotation: 0, pulse: Math.random() * Math.PI * 2, life: 1.0
});
}
function chooseRandomPickup() {
if (Math.random() < 0.5) {
const weapons = ['weapon_pulse', 'weapon_scatter', 'weapon_railgun', 'weapon_bazuka'];
return weapons[Math.floor(Math.random() * weapons.length)];
} else {
const rapids = ['rapid_medium', 'rapid_high', 'rapid_extreme'];
return rapids[Math.floor(Math.random() * rapids.length)];
}
}
function getWeaponStats() {
const base = WEAPONS[player.weapon];
const rapid = getRapidTier();
const effectiveFireRate = Math.max(2, Math.round(base.fireRate * rapid.fireRateMult));
return {
damage: base.damage + player.damageBonus, fireRate: effectiveFireRate, bulletSpeed: base.bulletSpeed - player.speedBonus, spread: base.spread, count: base.count + player.multishotBonus, size: base.size, pierce: base.pierce, color: rapid.color, glowColor: rapid.glow, name: base.name, rapidName: rapid.name, explosive: base.explosive || false, blastRadius: base.blastRadius || 0, blastDamage: base.blastDamage || 0,
blastFalloff: base.blastFalloff || false
};
}
function shootBullet() {
if (player.cooldown > 0) return;
const stats = getWeaponStats();
const count = stats.count, spread = stats.spread;
const startAngle = -Math.PI / 2 - spread / 2;
const angleStep = count > 1 ? spread / (count - 1) : 0;
for (let i = 0; i < count; i++) {
const angle = count > 1 ? startAngle + angleStep * i : -Math.PI / 2;
const vx = Math.cos(angle) * Math.abs(stats.bulletSpeed);
const vy = Math.sin(angle) * Math.abs(stats.bulletSpeed);
const bulletW = stats.explosive ? 14 * stats.size : 4 * stats.size;
const bulletH = stats.explosive ? 22 * stats.size : 16 * stats.size;
bullets.push({
x: player.x + Math.sin(angle) * 4, y: player.y - 18, w: bulletW, h: bulletH, vx, vy, damage: stats.damage, pierce: stats.pierce, hits: [], life: 1.0, color: stats.color, glowColor: stats.glowColor, angle, explosive: stats.explosive, blastRadius: stats.blastRadius, blastDamage: stats.blastDamage, blastFalloff: stats.blastFalloff, trailTimer: 0
});
}
const flashCount = stats.explosive ? 18 : (6 + count * 2);
spawnParticles(player.x, player.y - 12, flashCount, stats.glowColor, stats.explosive ? 3.0 : 1.2, stats.explosive ? 2.4 : 1.2);
player.cooldown = stats.fireRate;
}
function detonate(x, y, bullet) {
const radius = bullet.blastRadius, baseDamage = bullet.blastDamage;
for (let i = enemies.length - 1; i >= 0; i--) {
const e = enemies[i];
const cx = e.x + e.w/2, cy = e.y + e.h/2;
const dist = Math.hypot(cx - x, cy - y);
if (dist <= radius) {
let dmg = baseDamage;
if (bullet.blastFalloff && radius > 0) dmg = baseDamage * (1 - (dist / radius) * 0.6);
e.hp -= dmg; e.hitFlash = 8;
if (e.hp <= 0) {
score += 10;
spawnParticles(e.x + e.w/2, e.y + e.h/2, 20, '#ff6b8f', 2.8, 2.4);
if (Math.random() < 0.18) spawnPickup(chooseRandomPickup());
enemies.splice(i, 1);
}
}
}
explosions.push({ x, y, radius: 8, maxRadius: radius, life: 1.0, decay: 0.055, color:
bullet.glowColor });
spawnParticles(x, y, 30, '#ffae5c', 4.2, 2.8);
spawnParticles(x, y, 18, '#ff5500', 3.0, 2.2);
spawnParticles(x, y, 12, '#ffffff', 5.0, 1.6);
}
function applyPickup(p) {
const def = p.def;
if (def.kind === 'weapon') {
player.weapon = def.value;
spawnParticles(player.x, player.y, 22, def.glow, 2.6, 2.2);
} else if (def.kind === 'rapid') {
setRapidTier(def.value);
}
}
function update() {
if (gameOver) return;
let dx = 0, dy = 0;
if (keys.ArrowLeft) dx -= 1;
if (keys.ArrowRight) dx += 1;
if (keys.ArrowUp) dy -= 1;
if (keys.ArrowDown) dy += 1;
if (dx !== 0 || dy !== 0) {
const len = Math.hypot(dx, dy);
dx = (dx / len) * player.speed; dy = (dy / len) * player.speed;
player.x = clamp(player.x + dx, 20, canvas.width - 20);
player.y = clamp(player.y + dy, 40, canvas.height - 30);
}
if (keys.Space) shootBullet();
if (player.cooldown > 0) player.cooldown--;
if (player.invincible > 0) player.invincible--;
if (player.rapidTimer > 0) {
player.rapidTimer--;
if (player.rapidTimer === 0 && player.rapidTier !== 'low') {
player.rapidTier = 'low';
spawnParticles(player.x, player.y, 12, '#4a7a9a', 2.0, 1.6);
}
}
enemySpawnTimer++;
if (enemySpawnTimer >= enemySpawnRate) {
enemySpawnTimer = 0;
spawnEnemy();
if (enemySpawnRate > 12) enemySpawnRate -= 0.15;
}
pickupSpawnTimer++;
if (pickupSpawnTimer >= PICKUP_SPAWN_INTERVAL) {
pickupSpawnTimer = 0;
spawnPickup(chooseRandomPickup());
}
for (let i = bullets.length - 1; i >= 0; i--) {
const b = bullets[i];
b.x += b.vx; b.y += b.vy; b.life -= 0.01;
if (b.explosive) {
b.trailTimer++;
if (b.trailTimer % 2 === 0) {
particles.push({
x: b.x + b.w/2 + (Math.random() - 0.5) * 6, y: b.y + b.h/2 + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 0.8, vy: 0.6 + Math.random() * 0.8,
life: 0.8, decay: 0.03, size: 2.4 + Math.random() * 2, color: '#ff8a3d' });
}
}
const oob = b.y + b.h < -30 || b.y > canvas.height + 30 || b.x < -30 || b.x > canvas.width +
30;
if (oob || b.life <= 0) {
if (b.explosive && b.y + b.h > -30) detonate(b.x + b.w/2, b.y + b.h/2, b);
bullets.splice(i, 1);
}
}
for (let i = enemies.length - 1; i >= 0; i--) {
const e = enemies[i];
e.x += e.vx; e.y += e.vy;
if (e.hitFlash > 0) e.hitFlash--;
if (e.x < 10 || e.x + e.w > canvas.width - 10) e.vx *= -0.8;
e.x = clamp(e.x, 5, canvas.width - e.w - 5);
if (e.y > canvas.height + 50) { enemies.splice(i, 1); continue; }
if (player.invincible <= 0 &&
player.x - player.size < e.x + e.w && player.x + player.size > e.x &&
player.y - player.size < e.y + e.h && player.y + player.size > e.y) {
player.hp -= 15; player.invincible = 24;
spawnParticles(e.x + e.w/2, e.y + e.h/2, 16, '#ff5e7c', 2.4, 2.2);
enemies.splice(i, 1);
if (player.hp <= 0) {
player.hp = 0; gameOver = true;
spawnParticles(player.x, player.y, 45, '#ff4d6d', 3.8, 3.0);
}
continue;
}
for (let j = bullets.length - 1; j >= 0; j--) {
const b = bullets[j];
if (b.x + b.w > e.x && b.x < e.x + e.w && b.y + b.h > e.y && b.y < e.y + e.h) {
if (b.hits && b.hits.includes(e)) continue;
if (b.explosive) { detonate(b.x + b.w/2, b.y + b.h/2, b); bullets.splice(j, 1); break; }
e.hp -= b.damage; e.hitFlash = 6;
spawnParticles(b.x, b.y, 8, b.glowColor, 1.8, 1.6);
if (b.hits) b.hits.push(e);
if (b.pierce > 0) b.pierce--; else bullets.splice(j, 1);
if (e.hp <= 0) {
score += 10;
spawnParticles(e.x + e.w/2, e.y + e.h/2, 20, '#ff6b8f', 2.8, 2.4);
if (Math.random() < 0.18) spawnPickup(chooseRandomPickup());
enemies.splice(i, 1);
break;
}
}
}
}
for (let i = pickups.length - 1; i >= 0; i--) {
const p = pickups[i];
p.x += p.vx; p.y += p.vy; p.rotation += 0.03; p.pulse += 0.1;
if (p.x < 10 || p.x + p.w > canvas.width - 10) p.vx *= -0.7;
const dxp = player.x - (p.x + p.w/2);
const dyp = player.y - (p.y + p.h/2);
if (Math.abs(dxp) < p.w/2 + player.size && Math.abs(dyp) < p.h/2 + player.size) {
applyPickup(p); pickups.splice(i, 1); continue;
}
if (p.y > canvas.height + 60) pickups.splice(i, 1);
}
for (let i = particles.length - 1; i >= 0; i--) {
const p = particles[i];
p.x += p.vx; p.y += p.vy;
p.vx *= 0.98; p.vy *= 0.98;
p.life -= p.decay;
if (p.life <= 0) particles.splice(i, 1);
}
for (let i = explosions.length - 1; i >= 0; i--) {
const ex = explosions[i];
ex.radius += (ex.maxRadius - ex.radius) * 0.25;
ex.life -= ex.decay;
if (ex.life <= 0) explosions.splice(i, 1);
}
for (let s of starField) {
s.y += s.speed;
if (s.y > canvas.height + 5) { s.y = -5; s.x = Math.random() * canvas.width; }
}
for (let n of nebulaClouds) {
n.y += n.speed;
if (n.y - n.radius > canvas.height + 100) { n.y = -n.radius - 50; n.x = Math.random() *
canvas.width; }
}
}
function draw() {
ctx.fillStyle = COLORS.bg;
ctx.fillRect(0, 0, canvas.width, canvas.height);
for (let n of nebulaClouds) {
const grad = ctx.createRadialGradient(n.x, n.y, 20, n.x, n.y, n.radius);
grad.addColorStop(0, `rgba(20, 70, 100, ${n.alpha})`);
grad.addColorStop(0.7, `rgba(8, 25, 45, ${n.alpha * 0.4})`);
grad.addColorStop(1, 'rgba(0,0,0,0)');
ctx.fillStyle = grad;
ctx.beginPath(); ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2); ctx.fill();
}
for (let s of starField) {
ctx.beginPath(); ctx.arc(s.x, s.y, s.size * 0.9, 0, Math.PI * 2);
ctx.fillStyle = s.color; ctx.globalAlpha = s.brightness; ctx.fill();
}
ctx.globalAlpha = 1.0;
for (let e of enemies) {
ctx.shadowColor = e.coreColor; ctx.shadowBlur = 14;
ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
ctx.beginPath();
ctx.moveTo(e.x + e.w/2, e.y);
ctx.lineTo(e.x + e.w, e.y + e.h * 0.6);
ctx.lineTo(e.x + e.w * 0.75, e.y + e.h);
ctx.lineTo(e.x + e.w * 0.25, e.y + e.h);
ctx.lineTo(e.x, e.y + e.h * 0.6);
ctx.closePath(); ctx.fill();
ctx.shadowBlur = 18; ctx.shadowColor = '#ff3a5e';
ctx.fillStyle = e.coreColor;
ctx.beginPath(); ctx.arc(e.x + e.w/2, e.y + e.h/2, e.w * 0.22, 0, Math.PI * 2); ctx.fill();
ctx.shadowBlur = 10; ctx.fillStyle = '#ff2a4a'; ctx.globalAlpha = 0.5;
ctx.beginPath(); ctx.ellipse(e.x + e.w/2, e.y + e.h + 3, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
ctx.globalAlpha = 1.0;
if (e.maxHp > 1) {
ctx.shadowBlur = 0;
ctx.fillStyle = '#0a1a2a'; ctx.fillRect(e.x, e.y - 6, e.w, 3);
ctx.fillStyle = '#ff4d6d'; ctx.fillRect(e.x, e.y - 6, e.w * (e.hp / e.maxHp), 3);
}
}
for (let p of pickups) {
ctx.save();
ctx.translate(p.x + p.w/2, p.y + p.h/2);
ctx.rotate(p.rotation);
const pulseScale = 1 + Math.sin(p.pulse) * 0.12;
const s = (p.w/2) * pulseScale;
ctx.shadowBlur = 24; ctx.shadowColor = p.def.glow;
ctx.fillStyle = p.def.color;
ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
ctx.closePath(); ctx.fill();
ctx.shadowBlur = 10; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.8;
ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2); ctx.fill();
ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
ctx.fillStyle = '#05070c'; ctx.font = 'bold 12px "Courier New", monospace';
ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
ctx.fillText(p.def.icon, 0, 1);
ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
ctx.restore();
}
for (let b of bullets) {
ctx.save();
ctx.translate(b.x + b.w/2, b.y + b.h/2);
ctx.rotate(b.angle + Math.PI / 2);
if (b.explosive) {
ctx.shadowBlur = 30; ctx.shadowColor = b.glowColor;
ctx.fillStyle = b.color;
ctx.beginPath(); ctx.roundRect(-b.w/2, -b.h/2, b.w, b.h, b.w/2); ctx.fill();
ctx.shadowBlur = 20; ctx.fillStyle = '#ffd97d';
ctx.beginPath(); ctx.ellipse(0, -b.h/2 + b.w*0.5, b.w*0.45, b.w*0.55, 0, 0, Math.PI*2);
ctx.fill();
ctx.shadowBlur = 25; ctx.fillStyle = '#ffffff';
ctx.beginPath(); ctx.arc(0, -b.h*0.1, b.w*0.28, 0, Math.PI * 2); ctx.fill();
ctx.shadowBlur = 12; ctx.fillStyle = '#ff5500';
ctx.beginPath(); ctx.moveTo(-b.w/2, b.h/2 - 2); ctx.lineTo(-b.w/2 - 5, b.h/2 + 8);
ctx.lineTo(-b.w/2, b.h/2 + 4); ctx.closePath(); ctx.fill();
ctx.beginPath(); ctx.moveTo(b.w/2, b.h/2 - 2); ctx.lineTo(b.w/2 + 5, b.h/2 + 8);
ctx.lineTo(b.w/2, b.h/2 + 4); ctx.closePath(); ctx.fill();
} else {
ctx.shadowBlur = 20; ctx.shadowColor = b.glowColor;
ctx.fillStyle = b.color;
ctx.beginPath(); ctx.roundRect(-b.w/2, -b.h/2, b.w, b.h, b.w/2); ctx.fill();
ctx.shadowBlur = 12; ctx.fillStyle = '#ffffff';
ctx.beginPath(); ctx.roundRect(-b.w/4, -b.h/3, b.w/2, b.h * 0.66, b.w/4); ctx.fill();
}
ctx.restore();
}
for (let ex of explosions) {
ctx.save();
ctx.globalAlpha = ex.life;
ctx.strokeStyle = ex.color; ctx.shadowBlur = 25; ctx.shadowColor = ex.color;
ctx.lineWidth = 3 + ex.life * 3;
ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2); ctx.stroke();
ctx.globalAlpha = ex.life * 0.35;
ctx.fillStyle = ex.color;
ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.radius * 0.75, 0, Math.PI * 2); ctx.fill();
ctx.restore();
}
for (let p of particles) {
ctx.globalAlpha = p.life * 0.9;
ctx.shadowBlur = 12; ctx.shadowColor = p.color;
ctx.fillStyle = p.color;
ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
}
ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
if (!gameOver || player.hp > 0) {
const blink = player.invincible > 0 && Math.floor(frame / 4) % 2 === 0;
if (!blink) {
ctx.shadowBlur = 28; ctx.shadowColor = COLORS.playerGlow;
ctx.fillStyle = COLORS.player;
ctx.beginPath();
ctx.moveTo(player.x, player.y - 20);
ctx.lineTo(player.x + 16, player.y + 6);
ctx.lineTo(player.x + 8, player.y + 12);
ctx.lineTo(player.x + 4, player.y + 18);
ctx.lineTo(player.x - 4, player.y + 18);
ctx.lineTo(player.x - 8, player.y + 12);
ctx.lineTo(player.x - 16, player.y + 6);
ctx.closePath(); ctx.fill();
ctx.shadowBlur = 20; ctx.shadowColor = '#3fa0ff'; ctx.fillStyle = '#b3e0ff';
ctx.beginPath(); ctx.ellipse(player.x, player.y - 6, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
const rt = getRapidTier();
ctx.shadowBlur = 25; ctx.shadowColor = rt.glow; ctx.fillStyle = rt.color;
ctx.globalAlpha = 0.8;
ctx.beginPath(); ctx.ellipse(player.x, player.y + 20, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
ctx.globalAlpha = 1.0;
}
}
ctx.shadowBlur = 0;
ctx.font = 'bold 18px "Courier New", monospace';
ctx.fillStyle = COLORS.ui; ctx.shadowBlur = 12; ctx.shadowColor = '#0088ff';
ctx.fillText('SCORE', 20, 40);
ctx.fillStyle = '#b0e0ff';
ctx.fillText(String(score).padStart(4, '0'), 20, 70);
ctx.shadowBlur = 15; ctx.shadowColor = '#0066aa';
ctx.fillStyle = '#102a3a'; ctx.fillRect(650, 30, 120, 16);
const hpPercent = player.hp / player.maxHp;
ctx.fillStyle = hpPercent > 0.6 ? '#3fb4ff' : (hpPercent > 0.3 ? '#ffaa33' : '#ff4d6d');
ctx.fillRect(652, 32, 116 * hpPercent, 12);
ctx.fillStyle = '#6fa8c0'; ctx.font = '14px "Courier New", monospace';
ctx.fillText('HULL', 650, 20);
const rt = getRapidTier();
const rapidY = 30;
ctx.shadowBlur = 14; ctx.shadowColor = rt.glow; ctx.fillStyle = rt.color;
ctx.font = 'bold 16px "Courier New", monospace'; ctx.textAlign = 'center';
ctx.fillText(`⚡ ${rt.name} RAPID ⚡ `, canvas.width/2, rapidY + 6);
ctx.textAlign = 'left';
if (player.rapidTimer > 0) {
const pct = player.rapidTimer / 600;
ctx.shadowBlur = 8; ctx.fillStyle = '#0a1a2a';
ctx.fillRect(canvas.width/2 - 70, rapidY + 12, 140, 5);
ctx.fillStyle = rt.glow;
ctx.fillRect(canvas.width/2 - 70, rapidY + 12, 140 * pct, 5);
}
ctx.shadowBlur = 10;
const wStats = getWeaponStats();
const hudY = canvas.height - 50;
WEAPON_ORDER.forEach((key, idx) => {
const w = WEAPONS[key];
const isActive = player.weapon === key;
const xPos = 12 + idx * 98;
ctx.fillStyle = isActive ? '#0a2a4a' : '#0a1520';
ctx.fillRect(xPos, hudY, 90, 36);
ctx.strokeStyle = isActive ? w.glowColor : '#1e3b5a';
ctx.lineWidth = isActive ? 2 : 1;
ctx.strokeRect(xPos, hudY, 90, 36);
ctx.fillStyle = isActive ? w.color : '#4a7a9a';
ctx.font = 'bold 12px "Courier New", monospace'; ctx.textAlign = 'center';
ctx.fillText(`[${idx+1}] ${w.name}`, xPos + 45, hudY + 16);
ctx.font = '8px "Courier New", monospace';
ctx.fillStyle = isActive ? '#8fc4e0' : '#3a6a8a';
if (w.explosive) ctx.fillText(`DMG ${w.damage} · BLAST ${w.blastRadius}`, xPos + 45, hudY +
30);
else ctx.fillText(`DMG ${w.damage.toFixed(1)} · RATE ${w.fireRate}`, xPos + 45, hudY + 30);
ctx.textAlign = 'left';
});
if (!gameOver) {
const panelX = canvas.width - 220;
ctx.fillStyle = '#081018cc'; ctx.fillRect(panelX, hudY - 6, 210, 44);
ctx.strokeStyle = wStats.glowColor; ctx.lineWidth = 1;
ctx.strokeRect(panelX, hudY - 6, 210, 44);
ctx.fillStyle = wStats.glowColor;
ctx.font = 'bold 12px "Courier New", monospace';
ctx.fillText(`${wStats.name} · ${wStats.rapidName}`, panelX + 8, hudY + 10);
ctx.fillStyle = '#9fc8e0';
ctx.font = '10px "Courier New", monospace';
if (wStats.explosive) ctx.fillText(`DMG ${wStats.damage.toFixed(1)} · BLAST
${wStats.blastRadius} · AoE ${wStats.blastDamage}`, panelX + 8, hudY + 26);
else ctx.fillText(`DMG ${wStats.damage.toFixed(1)} · RATE ${wStats.fireRate} · PIERCE
${wStats.pierce}`, panelX + 8, hudY + 26);
}
if (gameOver) {
ctx.shadowBlur = 30; ctx.shadowColor = '#ff2a4a';
ctx.fillStyle = '#000000aa'; ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#ff6b8f'; ctx.font = 'bold 52px "Courier New", monospace';
ctx.textAlign = 'center';
ctx.fillText('SIGNAL LOST', canvas.width/2, canvas.height/2 - 40);
ctx.font = '24px "Courier New", monospace'; ctx.fillStyle = '#7fc3e0';
ctx.fillText('PRESS R TO REBOOT', canvas.width/2, canvas.height/2 + 50);
ctx.textAlign = 'left';
}
ctx.shadowBlur = 0;
}
CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
if (w < 2 * r) r = w / 2;
if (h < 2 * r) r = h / 2;
this.moveTo(x + r, y);
this.lineTo(x + w - r, y);
this.quadraticCurveTo(x + w, y, x + w, y + r);
this.lineTo(x + w, y + h - r);
this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
this.lineTo(x + r, y + h);
this.quadraticCurveTo(x, y + h, x, y + h - r);
this.lineTo(x, y + r);
this.quadraticCurveTo(x, y, x + r, y);
return this;
};
function gameLoop() {
if (!window.__gameRunning) { rafId = requestAnimationFrame(gameLoop); return; }
if (!gameOver) update();
draw();
frame++;
rafId = requestAnimationFrame(gameLoop);
}
window.__initGame = function() {
resetGame();
if (!started) { started = true; initStars(); initNebula(); gameLoop(); }
};
window.addEventListener('keydown', (e) => {
if (!window.__gameRunning) return;
if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
if (e.key === 'ArrowLeft') keys.ArrowLeft = true;
if (e.key === 'ArrowRight') keys.ArrowRight = true;
if (e.key === 'ArrowUp') keys.ArrowUp = true;
if (e.key === 'ArrowDown') keys.ArrowDown = true;
if (e.key === ' ') keys.Space = true;
if (e.key === '1') player.weapon = 'pulse';
if (e.key === '2') player.weapon = 'scatter';
if (e.key === '3') player.weapon = 'railgun';
if (e.key === '4') player.weapon = 'bazuka';
if (e.key === 'r' || e.key === 'R') resetGame();
});
window.addEventListener('keyup', (e) => {
if (!window.__gameRunning) return;
if (e.key === 'ArrowLeft') keys.ArrowLeft = false;
if (e.key === 'ArrowRight') keys.ArrowRight = false;
if (e.key === 'ArrowUp') keys.ArrowUp = false;
if (e.key === 'ArrowDown') keys.ArrowDown = false;
if (e.key === ' ') keys.Space = false;
});
})();
