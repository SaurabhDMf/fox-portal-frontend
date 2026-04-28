import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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
  Mail,
  Phone,
  MapPin,
  Globe,
} from 'lucide-react';

const API_BASE =
  import.meta.env.VITE_API_URL || 'https://ubp-backend-production.up.railway.app/api/v1';

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
  const [searchParams] = useSearchParams();
  const paymentStatus = searchParams.get('payment');
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
        const raw = r.data?.data ?? r.data ?? {};
        // Backend returns { invoice, items, company, payment_providers, razorpay_key_id }
        const inv = raw.invoice ?? raw;
        setInvoice({
          ...inv,
          items: raw.items ?? inv.items ?? [],
          company: raw.company ?? inv.company ?? {},
          payment_providers: raw.payment_providers ?? inv.payment_providers ?? { stripe: false, razorpay: false },
          razorpay_key_id: raw.razorpay_key_id ?? inv.razorpay_key_id,
          // Normalise field name differences between backend and template
          total: inv.total ?? inv.total_amount,
          created_at: inv.created_at ?? inv.issue_date,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        const status = e?.response?.status;
        if (status === 404 || status === 410) {
          setError('This link is invalid or has been revoked.');
        } else {
          setError(e?.response?.data?.error || e?.response?.data?.message || 'Failed to load invoice');
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [token]);

  const company: any = invoice?.company || {};
  const companyName = company.name || company.company_name || '';
  const items: any[] = invoice?.items || [];
  const currency = invoice?.currency_symbol || invoice?.currency || company.currency_symbol || '$';
  const fmt = (n: number) =>
    `${currency}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const subtotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const discountAmt =
    Number(invoice?.discount_amount) || (subtotal * (Number(invoice?.discount_pct) || 0)) / 100;
  const taxableAmt = subtotal - discountAmt;
  const taxAmt =
    Number(invoice?.tax_amount) || (taxableAmt * (Number(invoice?.tax_pct) || 0)) / 100;
  const total = Number(invoice?.total) || taxableAmt + taxAmt;
  const amountPaid = Number(invoice?.amount_paid) || 0;
  const amountDue = total - amountPaid;
  const isPaid = invoice?.status === 'Paid' || amountDue <= 0;

  const providers = invoice?.payment_providers || { stripe: false, razorpay: false };
  const canPay = !isPaid && invoice?.status !== 'Cancelled' && (providers.stripe || providers.razorpay);

  const companyAddress = [
    company.address_line1, company.address_line2,
    company.city, company.state, company.postal_code, company.country,
  ].filter(Boolean).join(', ');

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
      const razorpayKey = data.key_id || invoice?.razorpay_key_id;
      if (!razorpayKey) {
        toast.error('Razorpay is not configured for this account');
        setPaying(false);
        return;
      }
      const rzp = new (window as any).Razorpay({
        key: razorpayKey,
        amount: data.amount,
        currency: data.currency,
        name: data.name,
        description: data.description,
        order_id: data.order_id,
        prefill: data.prefill || {},
        theme: { color: '#2563eb' },
        handler: async (resp: any) => {
          try {
            await publicApi.post(`/invoices/public/${token}/pay/razorpay/verify`, {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.success('Payment successful');
            publicApi.get(`/invoices/public/${token}`).then((r) => {
              const raw = r.data?.data ?? r.data ?? {};
              const inv = raw.invoice ?? raw;
              setInvoice((prev: any) => ({
                ...prev,
                ...inv,
                total: inv.total ?? inv.total_amount,
                created_at: inv.created_at ?? inv.issue_date,
              }));
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

  const statusStyles: Record<string, string> = {
    Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Overdue: 'bg-red-50 text-red-700 ring-red-200',
    Sent: 'bg-blue-50 text-blue-700 ring-blue-200',
    Viewed: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    'Partially Paid': 'bg-amber-50 text-amber-700 ring-amber-200',
    Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  };
  const statusCls = statusStyles[invoice.status] || 'bg-slate-50 text-slate-700 ring-slate-200';

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
      <Toaster position="top-center" />

      {/* Payment result banners */}
      {paymentStatus === 'success' && (
        <div className="max-w-4xl mx-auto mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800 text-sm font-medium print:hidden">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          Payment successful! Your invoice will be updated shortly.
        </div>
      )}
      {paymentStatus === 'cancelled' && (
        <div className="max-w-4xl mx-auto mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 text-amber-800 text-sm font-medium print:hidden">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          Payment was cancelled. You can try again anytime.
        </div>
      )}

      {/* Action bar */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-end gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-700 text-sm font-medium ring-1 ring-slate-200 hover:bg-slate-50 transition"
        >
          <Printer className="h-4 w-4" /> Print / PDF
        </button>
        {canPay && (
          <button
            type="button"
            disabled={paying}
            onClick={handlePay}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.97] transition disabled:opacity-50"
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
      <div
        className="max-w-4xl mx-auto bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none"
        id="invoice-print-area"
      >
        {/* Header */}
        <div className="px-8 sm:px-10 pt-10 pb-7 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            {/* LEFT — company branding */}
            <div className="flex flex-col gap-3 flex-1 min-w-0">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={companyName || 'Company logo'}
                  style={{ maxHeight: 64 }}
                  className="object-contain object-left"
                />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-7 w-7 text-slate-500" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-slate-900 leading-tight">{companyName || '—'}</h2>
                <div className="mt-1.5 text-sm text-slate-500 leading-relaxed space-y-0.5">
                  {company.address_line1 && <div>{company.address_line1}</div>}
                  {(company.city || company.state || company.postal_code) && (
                    <div>{[company.city, company.state, company.postal_code].filter(Boolean).join(', ')}</div>
                  )}
                  {company.country && <div>{company.country}</div>}
                  {(company.email || company.phone) && (
                    <div className="pt-0.5">{[company.email, company.phone].filter(Boolean).join(' · ')}</div>
                  )}
                  {company.gst_number && <div>GST: {company.gst_number}</div>}
                </div>
              </div>
            </div>

            {/* RIGHT — invoice meta */}
            <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">INVOICE</h1>
              <div className="text-sm space-y-1.5 sm:text-right">
                <div className="flex items-center sm:justify-end gap-3">
                  <span className="text-slate-400 w-20 sm:w-auto">Invoice #</span>
                  <span className="font-semibold text-slate-800">{invoice.invoice_number || '—'}</span>
                </div>
                <div className="flex items-center sm:justify-end gap-3">
                  <span className="text-slate-400 w-20 sm:w-auto">Issue Date</span>
                  <span className="font-medium text-slate-700">
                    {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : '—'}
                  </span>
                </div>
                <div className="flex items-center sm:justify-end gap-3">
                  <span className="text-slate-400 w-20 sm:w-auto">Due Date</span>
                  <span className="font-medium text-slate-700">
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>
              <span className={`mt-1 inline-flex items-center px-3 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${statusCls}`}>
                {invoice.status || 'Draft'}
              </span>
            </div>
          </div>
        </div>

        <div className="px-10 py-8 space-y-8">
          {/* Bill From / Bill To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Party
              label="Bill From"
              name={companyName || '—'}
              address={companyAddress}
              email={company.email}
              phone={company.phone}
              gst={company.gst_number}
            />
            <Party
              label="Bill To"
              name={
                invoice.billing_name ||
                invoice.billing_company_name ||
                invoice.client?.company_name ||
                invoice.client_name ||
                'Client'
              }
              contact={invoice.billing_contact_name || invoice.client?.contact_name}
              address={
                invoice.billing_address ||
                [
                  invoice.client?.address_line1, invoice.client?.address_line2,
                  invoice.client?.city, invoice.client?.state,
                  invoice.client?.postal_code, invoice.client?.country,
                ].filter(Boolean).join(', ')
              }
              email={invoice.billing_email || invoice.client?.email}
              phone={invoice.billing_phone || invoice.client?.phone}
              gst={invoice.billing_gst_number || invoice.client?.gst_number}
            />
          </div>

          {/* Meta strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetaCard label="Issue Date" value={invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : '—'} />
            <MetaCard label="Due Date" value={invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'} />
            <MetaCard label="Invoice #" value={invoice.invoice_number || '—'} />
            <MetaCard label="Amount Due" value={fmt(amountDue)} highlight={!isPaid} />
          </div>

          {/* Line items */}
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
                        {item.details && <div className="text-xs text-slate-500 mt-0.5">{item.details}</div>}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 align-top">
                        {Number(item.quantity).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 align-top">{fmt(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 align-top">
                        {fmt(Number(item.quantity || 0) * Number(item.unit_price || 0))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full sm:w-80 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-5 space-y-2 text-sm">
              <Row label="Subtotal" value={fmt(subtotal)} />
              {discountAmt > 0 && (
                <Row
                  label={`Discount${invoice.discount_pct ? ` (${invoice.discount_pct}%)` : ''}`}
                  value={`-${fmt(discountAmt)}`}
                  valueClass="text-red-600"
                />
              )}
              {taxAmt > 0 && (
                <Row
                  label={`Tax${invoice.tax_pct ? ` (${invoice.tax_pct}%)` : ''}`}
                  value={fmt(taxAmt)}
                />
              )}
              <div className="border-t border-slate-200 pt-2">
                <Row label="Total" value={fmt(total)} bold />
              </div>
              {amountPaid > 0 && (
                <Row label="Amount Paid" value={`-${fmt(amountPaid)}`} valueClass="text-emerald-600" />
              )}
              <div className="border-t-2 border-slate-300 pt-2 mt-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Amount Due</span>
                  <span className={`text-xl font-bold ${isPaid ? 'text-emerald-600' : 'text-blue-700'}`}>
                    {fmt(amountDue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment section */}
          {canPay && (
            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 print:hidden">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-600 text-white">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Make a Payment</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Pay securely online via card, UPI, or bank transfer.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={paying}
                  onClick={handlePay}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Pay {fmt(amountDue)}
                </button>
              </div>

              {(company.bank_name || company.bank_account || company.upi_id) && (
                <div className="mt-4 pt-4 border-t border-blue-200 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <p className="font-semibold text-slate-700 col-span-full mb-1">Bank Transfer Details</p>
                  {company.bank_name && <DetailRow label="Bank" value={company.bank_name} />}
                  {company.bank_account_name && <DetailRow label="Account Name" value={company.bank_account_name} />}
                  {company.bank_account && <DetailRow label="Account #" value={company.bank_account} />}
                  {company.ifsc && <DetailRow label="IFSC" value={company.ifsc} />}
                  {company.swift && <DetailRow label="SWIFT" value={company.swift} />}
                  {company.upi_id && <DetailRow label="UPI" value={company.upi_id} />}
                </div>
              )}
            </div>
          )}

          {/* Notes & Terms */}
          {(invoice.notes || invoice.payment_terms || company.payment_terms) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {(invoice.payment_terms || company.payment_terms) && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Payment Terms</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {invoice.payment_terms || company.payment_terms}
                  </p>
                </div>
              )}
              {invoice.notes && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Thank you */}
          <div className="text-center py-3">
            <p className="text-base font-semibold text-slate-800">Thank you for your business!</p>
            <p className="text-xs text-slate-500 mt-1">
              If you have any questions about this invoice, please contact us.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-10 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-4 flex-wrap">
              {companyName && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" /> {companyName}
                </span>
              )}
              {companyAddress && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> {companyAddress}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {company.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> {company.email}
                </span>
              )}
              {company.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> {company.phone}
                </span>
              )}
              {company.website && (
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3 w-3" /> {company.website}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
        }
      `}</style>

      {/* Payment provider choice */}
      {showPayChoice && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPayChoice(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900 mb-1">Choose payment method</h3>
            <p className="text-xs text-slate-500 mb-4">Select how you'd like to pay {fmt(amountDue)}.</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => { setShowPayChoice(false); payWithStripe(); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:opacity-90 transition"
              >
                <CreditCard className="h-4 w-4" /> Pay with Card (Stripe)
              </button>
              <button
                type="button"
                onClick={() => { setShowPayChoice(false); payWithRazorpay(); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:opacity-90 transition"
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

function MetaCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-white ring-1 ring-slate-200 px-3 py-2 shadow-sm">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-blue-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function Party({
  label, name, contact, address, email, phone, gst,
}: {
  label: string; name: string; contact?: string; address?: string;
  email?: string; phone?: string; gst?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-sm font-bold text-slate-900">{name}</p>
      {contact && <p className="text-xs text-slate-600 mt-0.5">{contact}</p>}
      {address && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{address}</p>}
      <div className="mt-1.5 space-y-0.5">
        {email && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Mail className="h-3 w-3" /> {email}
          </p>
        )}
        {phone && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Phone className="h-3 w-3" /> {phone}
          </p>
        )}
        {gst && <p className="text-[11px] text-slate-500">GSTIN: {gst}</p>}
      </div>
    </div>
  );
}

function Row({
  label, value, bold, valueClass = '',
}: {
  label: string; value: string; bold?: boolean; valueClass?: string;
}) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-500 min-w-[80px]">{label}:</span>
      <span className="font-medium text-slate-800 break-all">{value}</span>
    </div>
  );
}
