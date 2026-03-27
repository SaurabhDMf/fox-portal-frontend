import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { isLocalToken, getMockResponse } from '@/lib/mockDataService';

// Use relative path so requests go through Vercel/Netlify proxy (avoids CORS)
const API_BASE = '/api/v1';

const realAxios = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

realAxios.interceptors.request.use((config) => {
  const stored = localStorage.getItem('ubp-auth');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`;
      }
    } catch {}
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
};

realAxios.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (isLocalToken() || isAuthEndpoint) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(realAxios(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const current = JSON.parse(localStorage.getItem('ubp-auth') || '{}');
        const res = await axios.post(`${API_BASE}/auth/refresh`, {
          refreshToken: current.state?.refreshToken,
        });
        const { accessToken, refreshToken } = res.data;
        current.state = { ...current.state, accessToken, refreshToken };
        localStorage.setItem('ubp-auth', JSON.stringify(current));
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return realAxios(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('ubp-auth');
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// Proxy that intercepts calls for local tokens and returns mock data
const api = {
  get(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    if (isLocalToken()) {
      const mock = getMockResponse('get', url, config?.params);
      if (mock !== null) return Promise.resolve({ data: mock, status: 200, statusText: 'OK', headers: {}, config: config || {} } as AxiosResponse);
    }
    return realAxios.get(url, config);
  },
  post(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    if (isLocalToken() && !url.includes('/auth/')) {
      const mock = getMockResponse('post', url);
      if (mock !== null) return Promise.resolve({ data: mock, status: 200, statusText: 'OK', headers: {}, config: config || {} } as AxiosResponse);
    }
    return realAxios.post(url, data, config);
  },
  put(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    if (isLocalToken()) {
      const mock = getMockResponse('put', url);
      if (mock !== null) return Promise.resolve({ data: mock, status: 200, statusText: 'OK', headers: {}, config: config || {} } as AxiosResponse);
    }
    return realAxios.put(url, data, config);
  },
  patch(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    if (isLocalToken()) {
      const mock = getMockResponse('patch', url);
      if (mock !== null) return Promise.resolve({ data: mock, status: 200, statusText: 'OK', headers: {}, config: config || {} } as AxiosResponse);
    }
    return realAxios.patch(url, data, config);
  },
  delete(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    if (isLocalToken()) {
      const mock = getMockResponse('delete', url);
      if (mock !== null) return Promise.resolve({ data: mock, status: 200, statusText: 'OK', headers: {}, config: config || {} } as AxiosResponse);
    }
    return realAxios.delete(url, config);
  },
};

export default api;
