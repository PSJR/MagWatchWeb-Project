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
  }

  auth = {
    me: async () => {
      const user = localStorage.getItem('magwatch_user');
      if (!user) throw new Error('Not authenticated');
      return JSON.parse(user);
    },
    login: async (email, password) => {
      const user = { email, full_name: email.split('@')[0], id: Date.now() };
      localStorage.setItem('magwatch_user', JSON.stringify(user));
      return user;
    },
    logout: () => {
      localStorage.removeItem('magwatch_user');
      window.location.href = '/';
    },
    redirectToLogin: () => {
      const email = prompt('Digite seu email para entrar:');
      if (email) {
        const user = { email, full_name: email.split('@')[0], id: Date.now() };
        localStorage.setItem('magwatch_user', JSON.stringify(user));
        window.location.reload();
      }
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
