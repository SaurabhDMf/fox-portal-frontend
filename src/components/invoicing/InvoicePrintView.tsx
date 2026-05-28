import { X, Printer, Building2, Mail, Phone, MapPin, CreditCard, Link2, Wallet, Globe, Trash2, Share2, Send, Pencil, Lock, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { payWithStripe, payWithRazorpay } from '@/lib/payments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import ShareInvoiceModal from './ShareInvoiceModal';
import SendInvoiceModal from './SendInvoiceModal';
import InvoiceCreateModal from './InvoiceCreateModal';
import { useAuthStore } from '@/stores/authStore';
import { confirmAction } from '@/lib/confirmDialog';

interface Props {
  invoice: any;
  onClose: () => void;
  onDelete?: () => void;
}

const STATUS_OPTIONS = ['Draft', 'Sent', 'Viewed', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'];

export default function InvoicePrintView({ invoice, onClose, onDelete }: Props) {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin' || role === 'super_admin';
  // Backend already returns `company` alongside the invoice — no extra API call needed
  const company: any = invoice.company || {};
  const companyName = company.name || company.company_name || '';
  const items = invoice.items || [];
  const currency = invoice.currency_symbol || invoice.currency || company.currency_symbol || '$';
  const fmt = (n: number) =>
    `${currency}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const subtotal = items.reduce((s: number, i: any) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const discountAmt = Number(invoice.discount_amount) || (subtotal * (Number(invoice.discount_pct) || 0)) / 100;
  const taxableAmt = subtotal - discountAmt;
  const taxAmt = Number(invoice.tax_amount) || (taxableAmt * (Number(invoice.tax_pct) || 0)) / 100;
  const total = Number(invoice.total) || taxableAmt + taxAmt;
  const amountPaid = Number(invoice.amount_paid) || 0;
  const amountDue = total - amountPaid;
  const isPaid = invoice.status === 'Paid' || amountDue <= 0;

  const statusStyles: Record<string, string> = {
    Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Overdue: 'bg-red-50 text-red-700 ring-red-200',
    Sent: 'bg-blue-50 text-blue-700 ring-blue-200',
    Viewed: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    'Partially Paid': 'bg-amber-50 text-amber-700 ring-amber-200',
    Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  };
  const statusCls = statusStyles[invoice.status] || 'bg-slate-50 text-slate-700 ring-slate-200';

  const companyAddress = [company.address_line1, company.address_line2, company.city, company.state, company.postal_code, company.country]
    .filter(Boolean)
    .join(', ');

  // Fetch full invoice (with payment_providers) if not already present —
  // list-endpoint payloads typically don't include payment_providers.
  const [providers, setProviders] = useState<{ stripe: boolean; razorpay: boolean }>(
    invoice.payment_providers || { stripe: false, razorpay: false },
  );
  useEffect(() => {
    if (invoice.payment_providers || !invoice?.id) return;
    let cancelled = false;
    api.get(`/invoices/${invoice.id}`)
      .then((r) => {
        const data = r.data?.data ?? r.data ?? {};
        if (!cancelled && data.payment_providers) setProviders(data.payment_providers);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [invoice?.id]);

  const canPay = !isPaid
    && invoice.status !== 'Cancelled'
    && (providers?.stripe || providers?.razorpay);

  const [showPayChoice, setShowPayChoice] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>(invoice.status || 'Draft');

  useEffect(() => {
    setCurrentStatus(invoice.status || 'Draft');
  }, [invoice.status]);

  const statusMut = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/invoices/${invoice.id}/status`, { status }),
    onSuccess: (_res, status) => {
      setCurrentStatus(status);
      toast.success(`Status updated to ${status}`);
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice', invoice.id] });
    },
    onError: (e: any, _status, _ctx) => {
      // revert
      setCurrentStatus(invoice.status || 'Draft');
      toast.error(e?.response?.data?.message || 'Failed to update status');
    },
  });

  const handleStatusChange = async (next: string) => {
    if (next === currentStatus) return;
    if (next === 'Paid') {
      const ok = await confirmAction({
        title: 'Mark invoice as Paid?',
        description:
          'This will mark the invoice as fully paid and may trigger downstream actions (receipts, accounting). Continue?',
        confirmLabel: 'Mark as Paid',
        destructive: false,
      });
      if (!ok) return;
    }
    setCurrentStatus(next); // optimistic
    statusMut.mutate(next);
  };

  const isLocked = currentStatus === 'Paid';

  const onPaidSuccess = () => {
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: ['cp-invoices'] });
  };

  const handlePayClick = () => {
    if (providers.stripe && providers.razorpay) {
      setShowPayChoice(true);
    } else if (providers.stripe) {
      payWithStripe(invoice.id);
    } else if (providers.razorpay) {
      payWithRazorpay(invoice.id, onPaidSuccess);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static">
      <div className="w-full max-w-4xl max-h-[95vh] overflow-y-auto print:max-h-none print:overflow-visible">
        {/* Action bar - single row, hidden in print */}
        <div className="flex items-center gap-2 mb-3 print:hidden">
          {/* Status dropdown */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 shrink-0">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Status</label>
              <div className="relative">
                <select
                  value={currentStatus}
                  disabled={statusMut.isPending}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="px-2.5 py-1.5 pr-7 rounded-lg bg-secondary border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {statusMut.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                )}
              </div>
            </div>
          )}
          {isLocked && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium ring-1 ring-emerald-500/20 shrink-0">
              <Lock className="h-3 w-3" /> Locked
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions — primary ones keep text, secondary ones are icon+tooltip */}
          {canPay && (
            <button
              type="button"
              onClick={handlePayClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all shrink-0"
            >
              <CreditCard className="h-3.5 w-3.5" /> Pay Now
            </button>
          )}
          {onDelete && !isLocked && (
            <button
              onClick={() => setShowEdit(true)}
              title="Edit Invoice"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/70 active:scale-[0.97] transition-all shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
          {onDelete && currentStatus !== 'Cancelled' && (
            <button
              onClick={() => setShowSend(true)}
              title="Send Invoice"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/70 active:scale-[0.97] transition-all shrink-0"
            >
              <Send className="h-3.5 w-3.5" /> Send
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => setShowShare(true)}
              title="Share Invoice"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/70 active:scale-[0.97] transition-all shrink-0"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all shrink-0"
          >
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              title="Delete Invoice"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary shrink-0" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Invoice document */}
        <div
          className="bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none"
          id="invoice-print-area"
        >
          {/* Two-column professional header */}
          <div className="px-10 pt-10 pb-6 border-b border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
              {/* LEFT — company branding */}
              <div className="space-y-2">
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={companyName || 'Company logo'}
                    style={{ maxHeight: 80 }}
                    className="object-contain"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = 'none';
                      const fallback = img.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = 'flex';
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
                  {companyName || '—'}
                </h2>
                <div className="text-sm text-slate-600 leading-relaxed space-y-0.5">
                  {company.address_line1 && <div>{company.address_line1}</div>}
                  {(company.city || company.state || company.postal_code) && (
                    <div>
                      {[company.city, company.state, company.postal_code].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {company.country && <div>{company.country}</div>}
                  {(company.email || company.phone) && (
                    <div className="text-slate-500 pt-1">
                      {[company.email, company.phone].filter(Boolean).join(' | ')}
                    </div>
                  )}
                  {company.gst_number && (
                    <div className="text-slate-500">GST: {company.gst_number}</div>
                  )}
                </div>
              </div>

              {/* RIGHT — invoice meta */}
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
                      {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Due Date&nbsp;</span>
                    <span className="font-medium">
                      {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
                <span
                  className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${statusCls}`}
                >
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
                name={invoice.billing_name || invoice.client?.company_name || invoice.client_name || 'Client'}
                contact={invoice.billing_contact_name || invoice.client?.contact_name}
                address={
                  invoice.billing_address ||
                  invoice.client?.address ||
                  [
                    invoice.client?.address_line1,
                    invoice.client?.address_line2,
                    invoice.client?.city,
                    invoice.client?.state,
                    invoice.client?.postal_code || invoice.client?.zip,
                    invoice.client?.country,
                  ].filter(Boolean).join(', ')
                }
                email={invoice.billing_email || invoice.client?.email}
                phone={invoice.billing_phone || invoice.client?.phone}
                gst={invoice.billing_gst_number || invoice.client?.gst_number}
              />
            </div>

            {/* Quick meta strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Meta label="Issue Date" value={invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : '—'} />
              <Meta label="Due Date" value={invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'} />
              <Meta label="Invoice #" value={invoice.invoice_number || '—'} />
              <Meta label="Amount Due" value={fmt(amountDue)} highlight={!isPaid} />
            </div>

            {/* Line Items */}
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
                        <td className="px-4 py-3 text-right text-slate-700 align-top">{Number(item.quantity).toFixed(2)}</td>
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

            {/* Payment Section */}
            {!isPaid && (
              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
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
                  {canPay && (
                    <button
                      type="button"
                      onClick={handlePayClick}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors print:hidden"
                    >
                      <CreditCard className="h-4 w-4" /> Pay {fmt(amountDue)}
                    </button>
                  )}
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

            {/* Digital Signature */}
            {invoice.signature && (
              <div className="flex justify-end">
                <div className="text-right space-y-1">
                  <img
                    src={invoice.signature}
                    alt="Authorized Signature"
                    className="h-16 object-contain ml-auto"
                  />
                  <div className="border-t border-slate-300 pt-1 text-[11px] text-slate-500">
                    <p className="font-medium text-slate-700">{companyName}</p>
                    <p>Authorized Signatory</p>
                  </div>
                </div>
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
      </div>

      {/* Print isolation */}
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
        }
      `}</style>

      {/* Provider choice modal */}
      {showPayChoice && (
        <div
          className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPayChoice(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground mb-1">Choose payment method</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Select how you'd like to pay {fmt(amountDue)}.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <button
                  type="button"
                  onClick={() => { setShowPayChoice(false); payWithStripe(invoice.id, 4); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
                >
                  <CreditCard className="h-4 w-4" /> Pay with Card (Stripe)
                </button>
                <p className="text-[10px] text-muted-foreground text-center mt-1">4% transaction fee will be added if you choose Stripe</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowPayChoice(false); payWithRazorpay(invoice.id, onPaidSuccess); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition"
              >
                <Wallet className="h-4 w-4" /> Pay with Razorpay
              </button>
              <button
                type="button"
                onClick={() => setShowPayChoice(false)}
                className="w-full px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showShare && (
        <ShareInvoiceModal
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoice_number}
          onClose={() => setShowShare(false)}
        />
      )}

      {showSend && (
        <SendInvoiceModal invoice={invoice} onClose={() => setShowSend(false)} />
      )}

      {showEdit && (
        <InvoiceCreateModal
          existing={invoice}
          onClose={() => {
            setShowEdit(false);
            qc.invalidateQueries({ queryKey: ['invoices'] });
            qc.invalidateQueries({ queryKey: ['invoice', invoice.id] });
            // Close detail view so caller can refetch and reopen with fresh data
            onClose();
          }}
        />
      )}
    </div>
  );
}

function Meta({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-white ring-1 ring-slate-200 px-3 py-2 shadow-sm">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-blue-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function Party({
  label,
  name,
  contact,
  address,
  email,
  phone,
  gst,
}: {
  label: string;
  name: string;
  contact?: string;
  address?: string;
  email?: string;
  phone?: string;
  gst?: string;
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
  label,
  value,
  bold,
  valueClass = '',
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClass?: string;
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
