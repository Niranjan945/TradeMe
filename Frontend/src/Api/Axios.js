import axios from 'axios';

// 🚀 PRODUCTION: Use environment variable, fallback to localhost
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// Strip trailing slashes to prevent 404 errors
const cleanApiUrl = rawApiUrl.replace(/\/+$/, '');

console.log('🔗 API Base URL:', cleanApiUrl); // ✅ Debug log

const api = axios.create({
  baseURL: cleanApiUrl,
});

// Request interceptor - Add JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('auth/login')) {
      console.warn('⚠️ Session expired. Redirecting to login...');
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
