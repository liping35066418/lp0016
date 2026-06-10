import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API请求失败:', error);
    return Promise.reject(error.response?.data || { success: false, message: error.message });
  }
);

export default api;
