const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  const trimmed = envUrl.replace(/\/$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const API_BASE = getApiBase();

export const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  const data = await response.json().catch(() => ({}));

  if (!['/auth/login', '/auth/google'].includes(endpoint) && (response.status === 401 || (response.status === 403 && /token inválido|token invalido|expirado/i.test(data.message || '')))) {
    window.dispatchEvent(new Event('auth:expired'));
  }

  if (!response.ok) {
    const errorMsg = data.message || `Error en la solicitud (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export default apiRequest;

const authHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Sube un archivo (multipart, el archivo es opcional). El navegador define el Content-Type con su boundary. */
export const apiUpload = async (endpoint, file, fields = {}) => {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  if (file) form.append('file', file);
  const response = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: authHeader(), body: form });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) window.dispatchEvent(new Event('auth:expired'));
  if (!response.ok) {
    const error = new Error(data.message || `Error al subir el archivo (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
};

/** Abre un documento privado: se descarga con el token y se muestra desde una URL temporal. */
export const openPrivateFile = async (uploadId) => {
  const response = await fetch(`${API_BASE}/files/private/${uploadId}`, { headers: authHeader() });
  if (!response.ok) throw new Error('No se pudo abrir el documento.');
  const url = URL.createObjectURL(await response.blob());
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

/** Convierte una ruta de archivo público del backend en URL utilizable desde el frontend. */
export const fileUrl = (path) => {
  if (!path) return null;
  return API_BASE === '/api' ? path : `${API_BASE.replace(/\/api$/, '')}${path}`;
};
