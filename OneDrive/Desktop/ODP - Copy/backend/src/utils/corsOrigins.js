const DEFAULT_LOCAL_ORIGINS = ['http://localhost:5500', 'http://127.0.0.1:5500'];

function parseFrontendOrigins(frontendUrlEnv) {
  if (!frontendUrlEnv) {
    return [];
  }

  return frontendUrlEnv
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLocalDevOrigin(origin) {
  try {
    const parsed = new URL(origin);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function isTrustedVercelOrigin(origin) {
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    const projectSlug = (process.env.VERCEL_PROJECT_SLUG || 'online-donation-platform').toLowerCase();

    if (!host.endsWith('.vercel.app')) {
      return false;
    }

    return host === `${projectSlug}.vercel.app` || host.startsWith(`${projectSlug}-`);
  } catch {
    return false;
  }
}

function buildAllowedOrigins(frontendUrlEnv = process.env.FRONTEND_URL) {
  return new Set([...parseFrontendOrigins(frontendUrlEnv), ...DEFAULT_LOCAL_ORIGINS]);
}

function isAllowedOrigin(origin, allowedOrigins = buildAllowedOrigins()) {
  return !origin || allowedOrigins.has(origin) || isLocalDevOrigin(origin) || isTrustedVercelOrigin(origin);
}

module.exports = {
  buildAllowedOrigins,
  isAllowedOrigin
};
