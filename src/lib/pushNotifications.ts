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

    // Register (or reuse) service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Request permission if not yet granted
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return;
    }

    // Get VAPID public key from backend
    const { data } = await api.get('/push/vapid-public-key');
    const publicKey = data?.publicKey;
    if (!publicKey) {
      console.warn('[push] VAPID public key not available — push notifications disabled');
      return;
    }

    // Unsubscribe stale subscription if applicationServerKey changed
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Re-use if still valid; unsubscribe and resubscribe to pick up key changes
      try {
        await api.post('/push/subscribe', {
          endpoint: existing.endpoint,
          keys: {
            p256dh: (existing.toJSON().keys as any)?.p256dh,
            auth:   (existing.toJSON().keys as any)?.auth,
          },
        });
        return; // subscription refreshed on backend
      } catch {
        await existing.unsubscribe();
      }
    }

    // Fresh subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const subJson = subscription.toJSON();
    await api.post('/push/subscribe', {
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys?.p256dh,
        auth:   subJson.keys?.auth,
      },
    });
  } catch (err) {
    console.warn('[push] init failed:', err);
  }
}
