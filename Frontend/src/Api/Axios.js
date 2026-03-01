import axios from 'axios';

// 🚨 PRODUCTION FIX: Automatically strip trailing slashes to prevent 404 URL errors
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const cleanApiUrl = rawApiUrl.replace(/\/$/, ''); 

const api = axios.create({
  baseURL: cleanApiUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      console.warn("Session expired or invalid token. Redirecting...");
      localStorage.removeItem('token');
      
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;