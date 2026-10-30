/* ====================================================================
   auth-store.js  —  DARK ORBIT account storage & credential checker
   --------------------------------------------------------------------
   Handles ONLY:
     • saving accounts to localStorage
     • looking accounts up (by username OR email)
     • verifying passwords
     • checking if a username / email already exists
     • creating a new account
   Does NOT touch the DOM, forms, or the game.
   ==================================================================== */

(function (global) {
    'use strict';

    const USERS_KEY = 'darkorbit_users';

    /* ---------- low-level storage ---------- */

    function loadUsers() {
        try {
            return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    function saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    /* ---------- password hashing (FNV-1a, same as original) ---------- */

    function hashPassword(pw) {
        let h = 0x811c9dc5;
        for (let i = 0; i < pw.length; i++) {
            h ^= pw.charCodeAt(i);
            h = (h * 0x01000193) >>> 0;
        }
        return h.toString(16).padStart(8, '0');
    }

    function generateId() {
        return 'u_' + Date.now().toString(36) + '_' +
               Math.random().toString(36).slice(2, 8);
    }

    /* ---------- validation helpers ---------- */

    function isValidEmailFormat(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function isUsernameTaken(username) {
        const users = loadUsers();
        return !!users[username.toLowerCase()];
    }

    function isEmailRegistered(email) {
        const users = loadUsers();
        const lower = email.toLowerCase();
        for (const k in users) {
            if (users[k].email && users[k].email.toLowerCase() === lower) return true;
        }
        return false;
    }

    /* ---------- lookup ---------- */

    /**
     * Find an account by username (primary key) or by email.
     * @returns {{ key: string, account: object } | null}
     */
    function findAccount(identifier) {
        if (!identifier) return null;
        const users = loadUsers();
        const lower = identifier.toLowerCase();

        // 1. direct username key
        if (users[lower]) {
            return { key: lower, account: users[lower] };
        }

        // 2. fall back to email match
        for (const k in users) {
            const acc = users[k];
            if (acc.email && acc.email.toLowerCase() === lower) {
                return { key: k, account: acc };
            }
        }

        return null;
    }

    /* ---------- public: create account ---------- */

    /**
     * Create a new local account.
     * @returns {{ ok: true, key: string, account: object }
     *          | { ok: false, code: string, message: string }}
     */
    function createAccount({ username, email, password }) {
        if (!username || !email || !password) {
            return { ok: false, code: 'MISSING_FIELDS', message: 'All fields are required.' };
        }
        if (username.length < 3) {
            return { ok: false, code: 'USERNAME_SHORT', message: 'Username must be 3+ characters.' };
        }
        if (!isValidEmailFormat(email)) {
            return { ok: false, code: 'EMAIL_INVALID', message: 'Invalid email format.' };
        }
        if (password.length < 6) {
            return { ok: false, code: 'PASSWORD_SHORT', message: 'Password must be 6+ characters.' };
        }
        if (isUsernameTaken(username)) {
            return { ok: false, code: 'USERNAME_TAKEN', message: 'Username already taken.' };
        }
        if (isEmailRegistered(email)) {
            return { ok: false, code: 'EMAIL_TAKEN', message: 'Email already registered.' };
        }

        const users = loadUsers();
        const lowerUser = username.toLowerCase();

        const account = {
            id: generateId(),
            username,
            email,
            password: hashPassword(password),
            provider: 'local',
            createdAt: Date.now(),
            stats: { highScore: 0, gamesPlayed: 0 }
        };

        users[lowerUser] = account;
        saveUsers(users);

        return { ok: true, key: lowerUser, account };
    }

    /* ---------- public: verify credentials ---------- */

    /**
     * Check a login attempt against stored accounts.
     *
     * Possible results:
     *   { ok: true,  key, account }                    → ACCESS GRANTED
     *   { ok: false, code: 'NOT_FOUND' }               → account does not exist
     *   { ok: false, code: 'WRONG_PASSWORD' }          → exists but bad password
     *   { ok: false, code: 'SOCIAL_PROVIDER', provider}→ must sign in via Google/FB
     */
    function verifyCredentials(identifier, password) {
        const found = findAccount(identifier);

        if (!found) {
            return { ok: false, code: 'NOT_FOUND' };
        }

        const { key, account } = found;

        if (account.provider && account.provider !== 'local') {
            return { ok: false, code: 'SOCIAL_PROVIDER', provider: account.provider };
        }

        if (account.password !== hashPassword(password)) {
            return { ok: false, code: 'WRONG_PASSWORD' };
        }

        return { ok: true, key, account };
    }

    /* ---------- public: update password (used by reset flow) ---------- */

    function updatePassword(accountKey, newPassword) {
        const users = loadUsers();
        if (!users[accountKey]) return { ok: false, code: 'NOT_FOUND' };

        users[accountKey].password = hashPassword(newPassword);
        saveUsers(users);
        return { ok: true };
    }

    /* ---------- public: social / provider account ---------- */

    function createOrGetSocialAccount(provider, email, displayName) {
        const users = loadUsers();

        for (const k in users) {
            if (users[k].email === email) {
                return { ok: true, key: k, account: users[k] };
            }
        }

        const key = `${provider}_${Date.now().toString(36)}`;
        users[key] = {
            id: generateId(),
            username: displayName,
            email,
            password: null,
            provider,
            createdAt: Date.now(),
            stats: { highScore: 0, gamesPlayed: 0 }
        };
        saveUsers(users);
        return { ok: true, key, account: users[key] };
    }

    /* ---------- expose the API ---------- */

    global.AuthStore = {
        // storage
        loadUsers,
        saveUsers,

        // hashing
        hashPassword,
        generateId,

        // validation
        isValidEmailFormat,
        isUsernameTaken,
        isEmailRegistered,

        // lookup
        findAccount,

        // main operations
        createAccount,
        verifyCredentials,
        updatePassword,
        createOrGetSocialAccount
    };

})(window);
