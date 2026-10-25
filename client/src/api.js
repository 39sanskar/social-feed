import axios from 'axios';

export const API_ORIGIN = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const api = axios.create({ baseURL: `${API_ORIGIN}/api` });

// Attach the JWT to every request
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// A 401 on a protected call means the session is gone (expired token, password
// changed elsewhere, account deactivated…): tell the AuthContext to log out.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && localStorage.getItem('token') && !url.includes('/auth/login'))
      window.dispatchEvent(new Event('auth:expired'));
    return Promise.reject(err);
  }
);

/** Human-readable error text from any failed request. */
export const errMsg = (e) => e?.response?.data?.message || (e?.code === 'ERR_NETWORK' ? 'Cannot reach the server. Check your connection.' : e?.message) || 'Something went wrong';
export default api;
