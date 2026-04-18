const Auth = {
  getToken() {
    return localStorage.getItem(APP_CONFIG.tokenKey);
  },

  getUser() {
    const raw = localStorage.getItem(APP_CONFIG.userKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (err) {
      localStorage.removeItem(APP_CONFIG.userKey);
      return null;
    }
  },

  setSession(token, user) {
    localStorage.setItem(APP_CONFIG.tokenKey, token);
    localStorage.setItem(APP_CONFIG.userKey, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(APP_CONFIG.tokenKey);
    localStorage.removeItem(APP_CONFIG.userKey);
  },

  isLoggedIn() {
    return Boolean(this.getToken());
  },

  requireAuth(redirectTo) {
    if (!this.isLoggedIn()) {
      window.location.href = redirectTo || './login.html';
      return false;
    }

    return true;
  },

  requireAdmin(redirectTo) {
    const user = this.getUser();
    if (!this.isLoggedIn() || !user || user.role !== 'admin') {
      window.location.href = redirectTo || '../user/login.html';
      return false;
    }

    return true;
  }
};
