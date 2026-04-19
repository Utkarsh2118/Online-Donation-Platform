const DEFAULT_PROD_API_BASE_URL = 'https://online-donation-platform.onrender.com/api';

const APP_CONFIG = {
  apiBaseUrl:
    window.ODP_API_BASE_URL ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'https://online-donation-platform.onrender.com/api'
      : DEFAULT_PROD_API_BASE_URL),
  tokenKey: 'odp_jwt_token',
  userKey: 'odp_user'
};
