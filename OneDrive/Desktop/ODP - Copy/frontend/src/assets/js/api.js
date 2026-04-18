function isLocalHost() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function withLocalPort(baseUrl, port) {
  try {
    const url = new URL(baseUrl);
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return baseUrl;
    }

    url.port = String(port);
    return url.toString().replace(/\/$/, '');
  } catch {
    return baseUrl;
  }
}

function isLikelyWrongLocalService(response, payload) {
  if (!isLocalHost() || response.status !== 404) {
    return false;
  }

  const message = String(payload?.message || '').toLowerCase();
  const statusText = String(response.statusText || '').toLowerCase();
  return message.includes('route not found') || statusText.includes('not found');
}

async function callApi(baseUrl, path, options, headers) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function apiRequest(path, options = {}) {
  const token = Auth.getToken();
  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    mergedHeaders.Authorization = `Bearer ${token}`;
  }

  const primaryBaseUrl = APP_CONFIG.apiBaseUrl;
  const fallbackBaseUrl = withLocalPort(primaryBaseUrl, 5001);

  try {
    const primary = await callApi(primaryBaseUrl, path, options, mergedHeaders);

    if (!primary.response.ok && isLikelyWrongLocalService(primary.response, primary.data) && fallbackBaseUrl !== primaryBaseUrl) {
      const fallback = await callApi(fallbackBaseUrl, path, options, mergedHeaders);
      if (!fallback.response.ok) {
        const message = fallback.data.message || 'Request failed';
        throw new Error(message);
      }

      return fallback.data;
    }

    if (!primary.response.ok) {
      const message = primary.data.message || 'Request failed';
      throw new Error(message);
    }

    return primary.data;
  } catch (error) {
    const isNetworkError = error instanceof TypeError;
    if (!isNetworkError || !isLocalHost() || fallbackBaseUrl === primaryBaseUrl) {
      throw error;
    }

    const fallback = await callApi(fallbackBaseUrl, path, options, mergedHeaders);
    if (!fallback.response.ok) {
      const message = fallback.data.message || 'Request failed';
      throw new Error(message);
    }

    return fallback.data;
  }
}
