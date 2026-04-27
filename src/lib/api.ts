import axios from 'axios';
import { confirmDelete } from './confirmDialog';

const API_BASE = import.meta.env.VITE_API_URL || 'https://foxportal.in/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// URL patterns that should NOT prompt for confirmation on DELETE
// (toggle-style endpoints that delete a resource as part of a non-destructive UX)
const DELETE_CONFIRM_SKIP = [
  /\/chat\/messages\/[^/]+\/pin$/, // unpin a chat message
  /\/tasks\/[^/]+\/watch$/,        // unwatch a task
];

api.interceptors.request.use(async (config) => {
  // Auth token
  const stored = localStorage.getItem('ubp-auth');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`;
      }
    } catch {}
  }

  // Global confirmation guard for destructive DELETE requests.
  // Components can opt out by setting `(config as any).skipConfirm = true`
  // (e.g. when the component already showed a custom confirm dialog).
  const method = (config.method || '').toLowerCase();
  if (method === 'delete' && !(config as any).skipConfirm) {
    const url = config.url || '';
    const skip = DELETE_CONFIRM_SKIP.some((re) => re.test(url));
    if (!skip) {
      const desc = (config as any).confirmMessage
        || 'This will permanently delete the item. This action cannot be undone.';
      const ok = await confirmDelete(desc);
      if (!ok) {
        // Block silently — never resolves nor rejects, so existing
        // onError handlers don't toast "Failed to delete".
        return new Promise(() => {}) as any;
      }
    }
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

// Helper: check if a token looks like a real JWT (3 dot-separated parts)
function isRealJwt(token: string | null): boolean {
  if (!token) return false;
  return token.split('.').length === 3;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const current = JSON.parse(localStorage.getItem('ubp-auth') || '{}');
      const currentToken = current.state?.accessToken;

      // If the token is not a real JWT (e.g. local/demo token), don't try refresh
      // and don't auto-logout — just reject silently
      if (!isRealJwt(currentToken)) {
        return Promise.reject(error);
      }

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

export const emailApi = {
  // Accounts
  getAccounts:   ()              => api.get('/email/accounts'),
  addAccount:    (data: any)     => api.post('/email/accounts', data),
  deleteAccount: (id: string)    => api.delete(`/email/accounts/${id}`),
  testAccount:   (id: string)    => api.post(`/email/accounts/${id}/test`),
  syncAccount:   (id: string, folder = 'INBOX') =>
    api.post(`/email/accounts/${id}/sync`, { folder }),
  getFolders:    (id: string)    => api.get(`/email/accounts/${id}/folders`),
  // Messages
  getMessages:   (params: any)   => api.get('/email/messages', { params }),
  getMessage:    (id: string)    => api.get(`/email/messages/${id}`),
  patchMessage:  (id: string, data: any) => api.patch(`/email/messages/${id}`, data),
  deleteMessage: (id: string)    => api.delete(`/email/messages/${id}`),
  // Send
  send:          (data: any)     => api.post('/email/send', data),
};

export default api;
