const DEFAULT_PROD_API_BASE_URL = 'https://online-donation-platform.onrender.com/api';
const DEFAULT_LOCAL_API_BASE_URL = 'http://localhost:5000/api';

const APP_CONFIG = {
  apiBaseUrl:
    window.ODP_API_BASE_URL ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? DEFAULT_LOCAL_API_BASE_URL
      : DEFAULT_PROD_API_BASE_URL),
  tokenKey: 'odp_jwt_token',
  userKey: 'odp_user'
};
