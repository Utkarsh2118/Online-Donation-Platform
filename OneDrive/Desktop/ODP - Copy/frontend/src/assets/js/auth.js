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
      localStorage.removeItem(APP_CONFIG.tokenKey);
      localStorage.removeItem(APP_CONFIG.userKey);
      return null;
    }
  },

  redirectTo(path) {
    window.location.replace(path);
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
    const token = this.getToken();
    const user = this.getUser();
    return Boolean(token && user && typeof user === 'object');
  },

  hasRole(roles) {
    const user = this.getUser();
    if (!user) {
      return false;
    }

    const roleList = Array.isArray(roles) ? roles : [roles];
    return roleList.map((role) => String(role).toLowerCase()).includes(String(user.role || '').toLowerCase());
  },

  requireRole(roles, redirectTo) {
    if (!this.isLoggedIn() || !this.hasRole(roles)) {
      this.redirectTo(redirectTo || '/login');
      return false;
    }

    return true;
  },

  requireAuth(redirectTo) {
    if (!this.isLoggedIn()) {
      this.redirectTo(redirectTo || '/login');
      return false;
    }

    return true;
  },

  requireAdmin(redirectTo) {
    return this.requireRole(['support', 'finance', 'admin', 'super_admin'], redirectTo);
  }
};

window.Auth = Auth;
