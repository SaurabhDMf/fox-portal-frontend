import axios from 'axios';
import { isLocalToken, getMockResponse } from '@/lib/mockDataService';

// Use relative path so requests go through Vercel/Netlify proxy (avoids CORS)
const API_BASE = '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: for local tokens, intercept and return mock data
api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('ubp-auth');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`;
      }
    } catch {}
  }

  // If using a local/demo token, short-circuit with mock data
  if (isLocalToken()) {
    const method = (config.method || 'get').toLowerCase();
    const url = config.url || '';
    const params = config.params;
    const mockData = getMockResponse(method, url, params);

    if (mockData !== null) {
      // Create a cancel token and cancel with mock data
      const source = axios.CancelToken.source();
      config.cancelToken = source.token;
      // Attach mock data to the config so response interceptor can use it
      (config as any).__mockData = mockData;
      source.cancel('__MOCK__');
    }
  }

  return config;
});

// Response interceptor: catch mock cancellations and return mock response
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // Handle mock data responses
    if (axios.isCancel(error) && error.message === '__MOCK__') {
      // Find the mock data from the original config
      const config = error.config || (error as any).__CANCEL__?.config;
      // We need to reconstruct the response
      return Promise.resolve({ data: (config as any)?.__mockData || {}, status: 200, statusText: 'OK (Mock)', headers: {}, config });
    }

    const originalRequest = error.config;
    const url = originalRequest?.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh');

    // Don't attempt refresh for local tokens or auth endpoints
    if (isLocalToken() || isAuthEndpoint) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
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
        return api(originalRequest);
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

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
};

export default api;
