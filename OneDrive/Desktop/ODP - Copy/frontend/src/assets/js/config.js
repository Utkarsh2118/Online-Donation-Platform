const DEFAULT_PROD_API_BASE_URL = 'https://your-backend-name.onrender.com/api';

const APP_CONFIG = {
  apiBaseUrl:
    window.ODP_API_BASE_URL ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000/api'
      : DEFAULT_PROD_API_BASE_URL),
  tokenKey: 'odp_jwt_token',
  userKey: 'odp_user'
};
