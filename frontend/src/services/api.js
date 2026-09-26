import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests if it exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Optionally redirect to signin
    }
    return Promise.reject(error);
  }
);

export const authService = {
  signUp: async (userData) => {
    const response = await api.post('/signup', userData);
    return response.data;
  },
  signIn: async (credentials) => {
    const response = await api.post('/signin', credentials);
    return response.data;
  },
};

export default api;