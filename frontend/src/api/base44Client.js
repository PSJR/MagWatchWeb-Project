import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

class Base44Client {
  constructor() {
    this.axios = axios.create({
      baseURL: API,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.axios.interceptors.request.use((config) => {
      const token = localStorage.getItem('magwatch_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  auth = {
    me: async () => {
      try {
        const response = await this.axios.get('/auth/me');
        return response.data;
      } catch (err) {
        throw new Error('Not authenticated');
      }
    },
    register: async (email, fullName, password) => {
      const response = await this.axios.post('/auth/register', {
        email,
        full_name: fullName,
        password,
      });
      localStorage.setItem('magwatch_token', response.data.access_token);
      localStorage.setItem('magwatch_user', JSON.stringify(response.data.user));
      return response.data.user;
    },
    login: async (email, password) => {
      const response = await this.axios.post('/auth/login', {
        email,
        password,
      });
      localStorage.setItem('magwatch_token', response.data.access_token);
      localStorage.setItem('magwatch_user', JSON.stringify(response.data.user));
      return response.data.user;
    },
    logout: () => {
      localStorage.removeItem('magwatch_token');
      localStorage.removeItem('magwatch_user');
      window.location.href = '/';
    },
  };

  history = {
    add: async (magnet, title) => {
      const response = await this.axios.post('/history', { magnet, title });
      return response.data;
    },
    list: async () => {
      const response = await this.axios.get('/history');
      return response.data;
    },
  };
}

export const base44 = new Base44Client();
