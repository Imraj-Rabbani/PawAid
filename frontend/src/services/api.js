import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

// The login token is an httpOnly cookie the browser sends itself; scripts can't read it.
// The backend refuses changes without X-Requested-With, which other sites can't add.
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

// tokens saved by earlier versions, before the cookie
localStorage.removeItem('token');

// Handle response errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// Keep the user saved at sign in up to date after profile changes
export const updateStoredUser = (fields) => {
  const stored = JSON.parse(localStorage.getItem('user') || 'null');
  if (!stored) return;
  localStorage.setItem('user', JSON.stringify({ ...stored, ...fields }));
};

// the Turnstile token for sign in and sign up; the backend checks it with Cloudflare
const captchaHeaders = (captchaToken) =>
  captchaToken ? { headers: { 'X-Captcha-Token': captchaToken } } : undefined;

export const authService = {
  signUp: async (userData, captchaToken) => {
    const response = await api.post('/signup', userData, captchaHeaders(captchaToken));
    return response.data;
  },
  signIn: async (credentials, captchaToken) => {
    const response = await api.post('/signin', credentials, captchaHeaders(captchaToken));
    return response.data;
  },
  signInWithGoogle: async (credential) => {
    const response = await api.post('/signin/google', { credential });
    return response.data;
  },
  signOut: async () => {
    await api.post('/signout');
  },
  // ends every session, for when someone else may be using the account
  signOutEverywhere: async () => {
    await api.post('/signout/all');
  },
  // emails a reset link; the reply is the same whether or not the email has an account
  forgotPassword: async (email) => {
    const response = await api.post('/password/forgot', { email });
    return response.data;
  },
  resetPassword: async (token, password) => {
    const response = await api.post('/password/reset', { token, password });
    return response.data;
  },
};

export default api;