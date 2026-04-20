import api from './api';
import toast from 'react-hot-toast';

/**
 * Stripe — opens hosted checkout in same tab.
 */
export async function payWithStripe(invoiceId: string) {
  try {
    const { data } = await api.post(`/invoices/${invoiceId}/pay/stripe`);
    if (data?.checkout_url) {
      window.location.href = data.checkout_url;
    } else {
      toast.error('No checkout URL returned');
    }
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Failed to start Stripe checkout');
  }
}

/**
 * Razorpay — loads checkout JS, opens modal, verifies on success.
 */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function payWithRazorpay(
  invoiceId: string,
  onSuccess?: () => void
) {
  const ok = await loadRazorpayScript();
  if (!ok) {
    toast.error('Failed to load Razorpay');
    return;
  }
  try {
    const { data } = await api.post(`/invoices/${invoiceId}/pay/razorpay`);
    const rzp = new (window as any).Razorpay({
      key: data.key_id,
      amount: data.amount,
      currency: data.currency,
      name: data.name,
      description: data.description,
      order_id: data.order_id,
      prefill: data.prefill || {},
      theme: { color: '#06b6d4' },
      handler: async (resp: any) => {
        try {
          await api.post(`/invoices/${invoiceId}/pay/razorpay/verify`, {
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          });
          toast.success('Payment successful');
          onSuccess?.();
        } catch (e: any) {
          toast.error(
            e.response?.data?.message || 'Payment verification failed'
          );
        }
      },
      modal: {
        ondismiss: () => {
          // user cancelled — no-op
        },
      },
    });
    rzp.open();
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Failed to start Razorpay');
  }
}
