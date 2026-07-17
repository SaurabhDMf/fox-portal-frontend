import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'https://foxportal.in/api/v1').replace(/\/api\/v1\/?$/, '');

let socketInstance: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(token: string): Socket {
  // If a socket already exists but was created with an older token, tear it
  // down and reconnect with the fresh one. Without this, the axios refresh
  // interceptor would rotate the REST token but the long-lived socket would
  // keep reconnecting with the stale token, get 401-rejected by the server,
  // and silently stop delivering new_message / new_notification events.
  if (socketInstance && currentToken && currentToken !== token) {
    try { socketInstance.disconnect(); } catch {}
    socketInstance = null;
  }

  if (!socketInstance || !socketInstance.connected) {
    socketInstance = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    currentToken = token;
  }
  return socketInstance;
}

export function disconnectSocket() {
  socketInstance?.disconnect();
  socketInstance = null;
  currentToken = null;
}
