import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { unlockAudioContext } from "./hooks/useNotificationsSocket";

// Initialize theme before render to prevent flash
const savedTheme = JSON.parse(localStorage.getItem('fox-portal-theme') || '{}')?.state?.theme || 'dark';
document.documentElement.classList.toggle('dark', savedTheme === 'dark');

createRoot(document.getElementById("root")!).render(<App />);

// Unlock AudioContext on first user interaction so notification sounds play reliably
document.addEventListener('click',   unlockAudioContext, { once: true });
document.addEventListener('keydown', unlockAudioContext, { once: true });

// Init push notifications for returning logged-in users (non-blocking)
const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
const isPreview = window.location.hostname.includes('id-preview--');
if (!isInIframe && !isPreview) {
  const auth = JSON.parse(localStorage.getItem('ubp-auth') || '{}');
  if (auth?.state?.isAuthenticated) {
    import('./lib/pushNotifications').then(m => m.initPushNotifications());
  }
}
