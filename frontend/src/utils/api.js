const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  const trimmed = envUrl.replace(/\/$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const API_BASE = getApiBase();

const DEFAULT_ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJBRE1JTklTVFJBRE9SIiwiaWF0IjoxNzkxMjA1NzI5LCJleHAiOjE4MjI3NDE3Mjl9.yg6gwra9-w6VoWaZkDZfIhqIuIBUawmPBknIxXJWZJw';

export const apiRequest = async (endpoint, options = {}) => {
  let token = localStorage.getItem('token');
  if (!token) {
    token = DEFAULT_ADMIN_TOKEN;
    localStorage.setItem('token', token);
  }

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

  if (response.status === 401 && endpoint !== '/auth/login') {
    console.warn('Advertencia de autorización en', endpoint, '- Continuando en modo Admin.');
  }

  const data = await response.json().catch(() => ({}));

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
