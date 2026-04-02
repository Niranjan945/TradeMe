import axios from 'axios';

const isDev = import.meta.env.DEV;
let rawApiUrl = import.meta.env.VITE_API_URL;

if (!rawApiUrl || isDev) {
  rawApiUrl = 'http://localhost:5000/api/v1';
}

const cleanApiUrl = rawApiUrl.replace(/\/+$/, '');

console.log(`🔗 API Base URL: ${cleanApiUrl} (DEV mode: ${isDev})`);

const api = axios.create({
  baseURL: cleanApiUrl,
});

// Request interceptor - Add JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor - Handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;