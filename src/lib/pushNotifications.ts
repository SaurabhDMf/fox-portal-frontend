import api from '@/lib/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function initPushNotifications(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');

    // Request permission if not yet granted
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return;
    }

    // Get VAPID public key
    const { data } = await api.get('/push/vapid-public-key');
    const publicKey = data?.publicKey;
    if (!publicKey) return;

    // Check existing subscription
    const existing = await registration.pushManager.getSubscription();
    if (existing) return; // Already subscribed

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const subJson = subscription.toJSON();

    // Send to backend
    await api.post('/push/subscribe', {
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
      },
    });
  } catch {
    // Silently fail — don't block UI
  }
}
