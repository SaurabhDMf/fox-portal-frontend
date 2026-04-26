import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import {
  Building2,
  CreditCard,
  Wallet,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Printer,
} from 'lucide-react';

const API_BASE =
  import.meta.env.VITE_API_URL || 'https://ubp-backend-production.up.railway.app/api/v1';

// Anonymous axios instance (no Bearer token, no auth interceptors)
const publicApi = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [paying, setPaying] = useState(false);
  const [showPayChoice, setShowPayChoice] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    publicApi
      .get(`/invoices/public/${token}`)
      .then((r) => {
        if (cancelled) return;
        const data = r.data?.data ?? r.data ?? {};
        setInvoice(data);
      })
      .catch((e) => {
        if (cancelled) return;
        const status = e?.response?.status;
        if (status === 404 || status === 410) {
          setError('This link is invalid or has been revoked.');
        } else {
          setError(e?.response?.data?.message || 'Failed to load invoice');
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const company = invoice?.company || {};
  const items = invoice?.items || [];
  const currency = invoice?.currency_symbol || invoice?.currency || '$';
  const fmt = (n: number) =>
    `${currency}${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const subtotal = items.reduce(
    (s: number, i: any) => s + Number(i.quantity || 0) * Number(i.unit_price || 0),
    0,
  );
  const discountAmt =
    Number(invoice?.discount_amount) ||
    (subtotal * (Number(invoice?.discount_pct) || 0)) / 100;
  const taxableAmt = subtotal - discountAmt;
  const taxAmt =
    Number(invoice?.tax_amount) ||
    (taxableAmt * (Number(invoice?.tax_pct) || 0)) / 100;
  const total = Number(invoice?.total) || taxableAmt + taxAmt;
  const amountPaid = Number(invoice?.amount_paid) || 0;
  const amountDue = total - amountPaid;
  const isPaid = invoice?.status === 'Paid' || amountDue <= 0;

  const providers = invoice?.payment_providers || { stripe: false, razorpay: false };
  const canPay =
    !isPaid && invoice?.status !== 'Cancelled' && (providers.stripe || providers.razorpay);

  const payWithStripe = async () => {
    setPaying(true);
    try {
      const { data } = await publicApi.post(`/invoices/public/${token}/pay/stripe`);
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error('No checkout URL returned');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to start checkout');
    } finally {
      setPaying(false);
    }
  };

  const payWithRazorpay = async () => {
    setPaying(true);
    const ok = await loadRazorpayScript();
    if (!ok) {
      toast.error('Failed to load Razorpay');
      setPaying(false);
      return;
    }
    try {
      const { data } = await publicApi.post(`/invoices/public/${token}/pay/razorpay`);
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
            await publicApi.post(`/invoices/public/${token}/pay/razorpay/verify`, {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.success('Payment successful');
            // Refresh invoice
            publicApi.get(`/invoices/public/${token}`).then((r) => {
              setInvoice(r.data?.data ?? r.data ?? {});
            });
          } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Payment verification failed');
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to start Razorpay');
    } finally {
      setPaying(false);
    }
  };

  const handlePay = () => {
    if (providers.stripe && providers.razorpay) {
      setShowPayChoice(true);
    } else if (providers.stripe) {
      payWithStripe();
    } else if (providers.razorpay) {
      payWithRazorpay();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center text-slate-600">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-slate-400" />
          Loading invoice…
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-red-50 mx-auto flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-1">Invoice unavailable</h1>
          <p className="text-sm text-slate-600">{error || 'Invoice not found'}</p>
        </div>
      </div>
    );
  }

  const billingAddress =
    invoice.billing_address ||
    [
      invoice.client?.address_line1,
      invoice.client?.address_line2,
      invoice.client?.city,
      invoice.client?.state,
      invoice.client?.postal_code,
      invoice.client?.country,
    ]
      .filter(Boolean)
      .join(', ');

  const companyName = company.name || company.company_name || 'Company';

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
      <Toaster position="top-center" />

      {/* Action bar (hidden in print) */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-end gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-700 text-sm font-medium ring-1 ring-slate-200 hover:bg-slate-50 transition"
        >
          <Printer className="h-4 w-4" /> Print
        </button>
        {canPay && (
          <button
            type="button"
            disabled={paying}
            onClick={handlePay}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition disabled:opacity-50"
          >
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Pay {fmt(amountDue)}
          </button>
        )}
        {isPaid && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium ring-1 ring-emerald-200">
            <CheckCircle2 className="h-4 w-4" /> Paid
          </span>
        )}
      </div>

      {/* Invoice document */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="px-10 pt-10 pb-6 border-b border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            <div className="space-y-2">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={companyName}
                  style={{ maxHeight: 80 }}
                  className="object-contain"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.style.display = 'none';
                    const fb = img.nextElementSibling as HTMLElement | null;
                    if (fb) fb.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="h-16 w-16 rounded-xl bg-slate-100 ring-1 ring-slate-200 items-center justify-center"
                style={{ display: company.logo_url ? 'none' : 'flex' }}
              >
                <Building2 className="h-7 w-7 text-slate-500" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {companyName}
              </h2>
              <div className="text-sm text-slate-600 leading-relaxed space-y-0.5">
                {company.address_line1 && <div>{company.address_line1}</div>}
                {(company.city || company.state || company.postal_code) && (
                  <div>
                    {[company.city, company.state, company.postal_code]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
                {company.country && <div>{company.country}</div>}
                {(company.email || company.phone) && (
                  <div className="text-slate-500 pt-1">
                    {[company.email, company.phone].filter(Boolean).join(' | ')}
                  </div>
                )}
              </div>
            </div>

            <div className="sm:text-right space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">INVOICE</h1>
              <div className="text-sm text-slate-700 space-y-1">
                <div>
                  <span className="text-slate-500">Invoice #&nbsp;</span>
                  <span className="font-semibold">{invoice.invoice_number || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Issue Date&nbsp;</span>
                  <span className="font-medium">
                    {invoice.created_at
                      ? new Date(invoice.created_at).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Due Date&nbsp;</span>
                  <span className="font-medium">
                    {invoice.due_date
                      ? new Date(invoice.due_date).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-10 py-8 space-y-8">
          {/* Bill To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-1">
                Bill To
              </p>
              <p className="font-semibold text-slate-900">
                {invoice.billing_company_name ||
                  invoice.billing_name ||
                  invoice.client?.company_name ||
                  invoice.client_name ||
                  'Client'}
              </p>
              {invoice.billing_contact_name && (
                <p className="text-sm text-slate-600">{invoice.billing_contact_name}</p>
              )}
              {billingAddress && (
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{billingAddress}</p>
              )}
              {invoice.billing_email && (
                <p className="text-xs text-slate-500">{invoice.billing_email}</p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-1">
                Amount Due
              </p>
              <p className="text-3xl font-bold text-slate-900">{fmt(amountDue)}</p>
              <p className="text-xs text-slate-500 mt-1">
                Status: <span className="font-medium text-slate-700">{invoice.status}</span>
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-20">
                    Qty
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-32">
                    Unit Price
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-32">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                      No line items
                    </td>
                  </tr>
                ) : (
                  items.map((item: any, i: number) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-800">{item.description}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-right text-slate-700">
                        {item.quantity}
                        {item.unit ? ` ${item.unit}` : ''}
                      </td>
                      <td className="px-4 py-3 align-top text-right text-slate-700">
                        {fmt(Number(item.unit_price))}
                      </td>
                      <td className="px-4 py-3 align-top text-right font-medium text-slate-800">
                        {fmt(Number(item.quantity) * Number(item.unit_price))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 space-y-1 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Discount</span>
                  <span className="text-red-600">-{fmt(discountAmt)}</span>
                </div>
              )}
              {taxAmt > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>{invoice.tax_label || 'Tax'}</span>
                  <span>{fmt(taxAmt)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-200">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
              {amountPaid > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Paid</span>
                  <span>-{fmt(amountPaid)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-200">
                <span>Amount Due</span>
                <span>{fmt(amountDue)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="text-sm text-slate-600">
              <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-1">
                Notes
              </p>
              <p className="whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}

          {/* Pay CTA bottom */}
          {canPay && (
            <div className="flex justify-center pt-2 print:hidden">
              <button
                type="button"
                disabled={paying}
                onClick={handlePay}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition disabled:opacity-50"
              >
                {paying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Pay {fmt(amountDue)}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Provider choice */}
      {showPayChoice && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPayChoice(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              Choose payment method
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Select how you'd like to pay {fmt(amountDue)}.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPayChoice(false);
                  payWithStripe();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:opacity-90 transition"
              >
                <CreditCard className="h-4 w-4" /> Pay with Card (Stripe)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPayChoice(false);
                  payWithRazorpay();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cyan-600 text-white text-sm font-semibold hover:opacity-90 transition"
              >
                <Wallet className="h-4 w-4" /> Pay with Razorpay
              </button>
              <button
                type="button"
                onClick={() => setShowPayChoice(false)}
                className="w-full px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
