// src/lib/api.js — Axios instance with auth interceptor
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach JWT ───────────────────────────────────────────────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('procureai_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: auto-logout on 401 ─────────────────────────────────────────────
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('procureai_token');
      localStorage.removeItem('procureai_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Typed helpers ─────────────────────────────────────────────────────────────
export const authApi = {
  login:    data => api.post('/auth/login', data),
  register: data => api.post('/auth/register', data),
  me:       ()   => api.get('/auth/me'),
};

export const dashboardApi = {
  get: () => api.get('/dashboard'),
};

export const lotsApi = {
  list:         params => api.get('/lots', { params }),
  get:          id     => api.get(`/lots/${id}`),
  updateStatus: (id, data) => api.patch(`/lots/${id}`, data),
};

export const analyzeApi = {
  run: data => api.post('/analyze', data),
};

export const calculatorApi = {
  compute: data  => api.post('/calculator/compute', data),
  save:    data  => api.post('/calculator/save', data),
  list:    ()    => api.get('/calculator'),
  delete:  id    => api.delete(`/calculator/${id}`),
};
