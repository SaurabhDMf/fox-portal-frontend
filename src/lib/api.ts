import axios from 'axios';
import { confirmDelete } from './confirmDialog';
import { useAuthStore } from '@/stores/authStore';

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
        // Also push the fresh tokens through Zustand so any subscriber (the
        // socket hooks in particular) re-renders with the new value. Without
        // this, the WebSocket connection would keep reconnecting with the old
        // token — silently rejected by the server, breaking realtime chat.
        // Static import (see top of file) avoids the previous dynamic-import
        // hang risk where a slow chunk fetch would stall the retry queue.
        try { useAuthStore.setState({ accessToken, refreshToken }); } catch {}
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('ubp-auth');
        // Don't redirect away from public pages (e.g. /invoice/:token)
        const isPublicPage = window.location.pathname.startsWith('/invoice/');
        if (!isPublicPage) {
          window.location.href = '/login';
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export const inboxApi = {
  // Inboxes
  getInboxes:    ()                => api.get('/inbox'),
  createInbox:   (data: any)       => api.post('/inbox', data),
  updateInbox:   (id: string, data: any) => api.put(`/inbox/${id}`, data),
  deleteInbox:   (id: string)      => api.delete(`/inbox/${id}`),
  syncInbox:       (id: string) => api.post(`/inbox/${id}/sync`),
  resetSyncBackoff:(id: string) => api.post(`/inbox/${id}/sync/reset-backoff`),
  pullOlderEmails: (id: string) => api.post(`/inbox/${id}/pull-older`),
  // Folders
  getFolders:    (id: string)               => api.get(`/inbox/${id}/folders`),
  createFolder:  (id: string, data: any)    => api.post(`/inbox/${id}/folders`, data),
  deleteFolder:  (id: string, fid: string)  => api.delete(`/inbox/${id}/folders/${fid}`),
  moveThread:    (id: string, tid: string, folder_id: string | null) =>
    api.put(`/inbox/${id}/threads/${tid}/folder`, { folder_id }),
  // Senders
  getSenders:    (id: string)      => api.get(`/inbox/${id}/senders`),
  addSender:     (id: string, data: any) => api.post(`/inbox/${id}/senders`, data),
  updateSender:  (id: string, sid: string, data: any) => api.put(`/inbox/${id}/senders/${sid}`, data),
  deleteSender:  (id: string, sid: string) => api.delete(`/inbox/${id}/senders/${sid}`),
  // Members
  getMembers:    (id: string)      => api.get(`/inbox/${id}/members`),
  addMember:     (id: string, data: any) => api.post(`/inbox/${id}/members`, data),
  removeMember:  (id: string, uid: string) => api.delete(`/inbox/${id}/members/${uid}`),
  // Threads
  getThreads:    (id: string, params?: any) => api.get(`/inbox/${id}/threads`, { params }),
  getThread:     (id: string, tid: string) => api.get(`/inbox/${id}/threads/${tid}`),
  assignThread:  (id: string, tid: string, user_id: string | null) =>
    api.post(`/inbox/${id}/threads/${tid}/assign`, { user_id }),
  patchThread:   (id: string, tid: string, data: any) => api.patch(`/inbox/${id}/threads/${tid}`, data),
  getThreadActivity: (id: string, tid: string) => api.get(`/inbox/${id}/threads/${tid}/activity`),
  replyThread:   (id: string, tid: string, data: any) => api.post(`/inbox/${id}/threads/${tid}/reply`, data),
  addNote:       (id: string, tid: string, body_text: string) => api.post(`/inbox/${id}/threads/${tid}/note`, { body_text }),
  newThread:       (id: string, data: any) => api.post(`/inbox/${id}/threads`, data),
  deleteMessage:   (id: string, tid: string, mid: string) => api.delete(`/inbox/${id}/threads/${tid}/messages/${mid}`),
  deleteThread:    (id: string, tid: string) => api.delete(`/inbox/${id}/threads/${tid}`),
  markThreadRead:  (id: string, tid: string) => api.post(`/inbox/${id}/threads/${tid}/read`),
  // AI: draft a reply for the open thread (server uses thread context). Pass
  // optional hints for extra steering. Server returns { draft }.
  aiDraftReply:    (id: string, tid: string, hints?: string) =>
    api.post(`/inbox/${id}/threads/${tid}/ai-draft`, hints ? { hints } : {}),
  // AI: draft a fresh outbound email — topic is what the sender wants to say.
  aiCompose:       (id: string, data: { topic: string; to?: string; subject?: string }) =>
    api.post(`/inbox/${id}/ai-compose`, data),
  // Stage a file to attach to a reply/compose message — returns the upload row.
  uploadAttachment: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/inbox/${id}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ── Personal Email (IMAP/SMTP accounts, not the Shared Inbox) ─────────────
export interface EmailAccount {
  id: string; email: string; provider: string;
  imap_host: string; imap_port: number; imap_secure: boolean; imap_user: string;
  smtp_host: string; smtp_port: number; smtp_secure: boolean; smtp_user: string;
  is_primary: boolean; sync_folders: boolean; send_as: boolean;
  status: 'connected' | 'error'; last_error?: string; last_synced_at?: string;
}

export interface EmailAccountForm {
  email: string; provider: string;
  imap_host: string; imap_port: number; imap_secure: boolean; imap_user: string; imap_password: string;
  smtp_host: string; smtp_port: number; smtp_secure: boolean; smtp_user: string; smtp_password: string;
  sync_folders?: boolean; send_as?: boolean;
}

export interface EmailFolder { id: string; account_id: string; name: string; }

export interface EmailAttachment { id: string; file_name: string; file_size?: number; url: string; }

export interface EmailMessage {
  id: string; account_id: string; folder: 'INBOX' | 'SENT' | 'DRAFTS' | 'ARCHIVE' | 'TRASH';
  custom_folder_id?: string | null; direction: 'inbound' | 'outbound';
  from_address: string; from_name?: string; to_addresses: string; cc_addresses?: string;
  subject: string; body_text?: string; body_html?: string;
  is_read: boolean; is_starred: boolean; is_archived: boolean; is_trashed: boolean;
  has_attachments: boolean; received_at?: string; attachments?: EmailAttachment[];
}

export const emailApi = {
  // GET list endpoints on this backend module wrap results as { data: [...] }
  // (same envelope convention as vault.ts/inbox.ts) — typed here as the wrapper,
  // not the bare array, so callers unwrap with `.then(r => r.data.data)`.
  getAccounts:  ()                        => api.get<{ data: EmailAccount[] }>('/email/accounts'),
  createAccount:(data: EmailAccountForm)  => api.post('/email/accounts', data),
  updateAccount:(id: string, data: Partial<EmailAccountForm> & { is_primary?: boolean }) => api.put(`/email/accounts/${id}`, data),
  deleteAccount:(id: string)              => api.delete(`/email/accounts/${id}`),
  syncAccount:  (id: string, folder = 'INBOX') => api.post(`/email/accounts/${id}/sync`, { folder }),

  getFolders:   ()                        => api.get<{ data: EmailFolder[] }>('/email/folders'),
  createFolder: (name: string)            => api.post('/email/folders', { name }),
  deleteFolder: (id: string)              => api.delete(`/email/folders/${id}`),

  getMessages:  (params: { account_id?: string; folder?: string; custom_folder_id?: string; search?: string; limit?: number; offset?: number }) =>
    api.get<{ data: EmailMessage[] }>('/email/messages', { params }),
  getMessage:   (id: string)              => api.get<EmailMessage>(`/email/messages/${id}`),
  patchMessage: (id: string, patch: Record<string, any>) => api.patch(`/email/messages/${id}`, patch),

  send: (data: { account_id: string; to: string; cc?: string; subject: string; body_text: string; attachments?: File[] }) => {
    if (data.attachments && data.attachments.length > 0) {
      const form = new FormData();
      form.append('account_id', data.account_id);
      form.append('to', data.to);
      if (data.cc) form.append('cc', data.cc);
      form.append('subject', data.subject);
      form.append('body_text', data.body_text);
      data.attachments.forEach(f => form.append('attachments', f));
      return api.post('/email/send', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.post('/email/send', {
      account_id: data.account_id, to: data.to, cc: data.cc,
      subject: data.subject, body_text: data.body_text,
    });
  },
};

export default api;
