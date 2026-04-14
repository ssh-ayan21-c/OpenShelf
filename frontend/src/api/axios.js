import axios from 'axios';
import { supabase } from '../supabaseClient';

const rawApiBase = import.meta.env.VITE_API_BASE_URL || '';
const isPlaceholderApiBase = rawApiBase.includes('your-railway-backend.up.railway.app');
const API_BASE = rawApiBase && !isPlaceholderApiBase
  ? rawApiBase.replace(/\/+$/, '')
  : (import.meta.env.DEV ? 'http://localhost:3000' : '');

if (!API_BASE) {
  console.warn('VITE_API_BASE_URL is not configured. API requests to the backend will fail until it is set.');
}

const api = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000, // 10 second timeout
});

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
