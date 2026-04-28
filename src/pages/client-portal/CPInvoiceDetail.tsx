import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { ArrowLeft, Printer, Download, CreditCard, FileText, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { payWithStripe, payWithRazorpay } from '@/lib/payments';
import { useCompanyCurrency } from '@/hooks/useCompanyCurrency';

export default function CPInvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cp-invoice', id],
    queryFn: () => api.get(`/invoices/${id}`).then((r) => r.data?.data || r.data || {}),
    enabled: !!id,
  });

  // Stripe success redirect handler
  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      toast.success('Payment successful! Thank you.');
      qc.invalidateQueries({ queryKey: ['cp-invoices'] });
      refetch();
      // clean the query param
      const next = new URLSearchParams(searchParams);
      next.delete('payment');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams]);

  const { currencySymbol } = useCompanyCurrency();
  const inv = data || {};
  const items = inv.items || inv.line_items || [];
  const payments = inv.payments || [];
  const fmt = (v: number) => `${currencySymbol(inv.currency)}${Number(v || 0).toLocaleString('en-IN')}`;
  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const total = inv.total_amount ?? inv.total ?? inv.amount ?? 0;
  const paid = inv.amount_paid ?? inv.paid_amount ?? 0;
  const due = inv.amount_due ?? Math.max(0, total - paid);
  const providers = inv.payment_providers || { stripe: false, razorpay: false };
  const hasProvider = !!(providers.stripe || providers.razorpay);
  const isPayable =
    inv.status !== 'Paid' &&
    inv.status !== 'Cancelled' &&
    due > 0 &&
    hasProvider;
  const isUploadedPdf = inv.source === 'uploaded' && inv.has_pdf;
  const [showPayChoice, setShowPayChoice] = useState(false);

  const downloadPdf = async () => {
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.invoice_number || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No PDF available');
    }
  };

  const onPaidSuccess = () => {
    qc.invalidateQueries({ queryKey: ['cp-invoices'] });
    refetch();
  };

  if (isLoading)
    return (
      <div className="page-container">
        <div className="text-center py-20 text-muted-foreground">Loading...</div>
      </div>
    );

  return (
    <div className="page-container">
      <button
        onClick={() => navigate('/client-portal/invoices')}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </button>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold">Invoice {inv.invoice_number}</h1>
          <p className="text-sm text-muted-foreground">
            Issue: {fmtDate(inv.date || inv.issue_date)} · Due: {fmtDate(inv.due_date)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {inv.has_pdf && (
            <button
              onClick={downloadPdf}
              className="px-3 py-2 rounded-lg text-sm bg-secondary hover:bg-secondary/70 inline-flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
          )}
          {!isUploadedPdf && (
            <button
              onClick={() => window.print()}
              className="px-3 py-2 rounded-lg text-sm bg-secondary hover:bg-secondary/70 inline-flex items-center gap-2"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
          )}
          {isPayable && (
            <button
              onClick={() => {
                if (providers.stripe && providers.razorpay) setShowPayChoice(true);
                else if (providers.stripe) payWithStripe(id!);
                else if (providers.razorpay) payWithRazorpay(id!, onPaidSuccess);
              }}
              className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90 inline-flex items-center gap-2"
            >
              <CreditCard className="h-4 w-4" /> Pay Now
            </button>
          )}
        </div>
      </div>

      {/* Body — embed PDF if uploaded, otherwise structured view */}
      {isUploadedPdf ? (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <FileText className="h-4 w-4" /> Uploaded invoice document
          </div>
          <iframe
            src={`${import.meta.env.VITE_API_URL || 'https://ubp-backend-production.up.railway.app/api/v1'}/invoices/${id}/pdf`}
            title="Invoice PDF"
            className="w-full h-[80vh] rounded-lg bg-white"
          />
          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">{fmt(total)}</span>
              </div>
              {paid > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span>{fmt(paid)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                <span>Amount Due</span>
                <span>{fmt(due)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card p-6 print:shadow-none print:border-0" id="invoice-print">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6 pb-4 border-b border-border">
            <div>
              <h2 className="text-lg font-bold">Invoice {inv.invoice_number}</h2>
              <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                <div>Issue Date: {fmtDate(inv.date || inv.issue_date)}</div>
                <div>Due Date: {fmtDate(inv.due_date)}</div>
              </div>
            </div>
            <StatusBadge status={inv.status} />
          </div>

          {/* Billing */}
          {(inv.billing_name || inv.client_name || inv.client?.company_name) && (
            <div className="mb-6">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Bill To</h3>
              <div className="text-sm font-medium">
                {inv.billing_name || inv.client?.company_name || inv.client_name}
              </div>
              {inv.billing_address && (
                <div className="text-sm text-muted-foreground">{inv.billing_address}</div>
              )}
            </div>
          )}

          {/* Line Items */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="p-3">{item.description || item.title || item.name}</td>
                    <td className="p-3 text-right">{item.quantity || item.qty || 1}</td>
                    <td className="p-3 text-right">{fmt(item.unit_price || item.rate || 0)}</td>
                    <td className="p-3 text-right font-medium">{fmt(item.amount || item.total || 0)}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      No line items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{fmt(inv.subtotal || total)}</span>
              </div>
              {inv.tax_amount != null && inv.tax_amount !== 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{fmt(inv.tax_amount)}</span>
                </div>
              )}
              {inv.discount_amount != null && inv.discount_amount !== 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-{fmt(inv.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
              {paid > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Paid</span>
                  <span>{fmt(paid)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-border text-primary">
                <span>Amount Due</span>
                <span>{fmt(due)}</span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Payment History</h3>
              <div className="space-y-2">
                {payments.map((p: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm p-3 rounded-lg bg-secondary/50"
                  >
                    <div>
                      <span className="font-medium">{fmt(p.amount)}</span>
                      <span className="text-muted-foreground ml-2">
                        via {p.method || p.payment_method || 'N/A'}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {fmtDate(p.date || p.payment_date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Provider choice modal */}
      {showPayChoice && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPayChoice(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground mb-1">Choose payment method</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Select how you'd like to pay {fmt(due)}.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => { setShowPayChoice(false); payWithStripe(id!); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
              >
                <CreditCard className="h-4 w-4" /> Pay with Card (Stripe)
              </button>
              <button
                type="button"
                onClick={() => { setShowPayChoice(false); payWithRazorpay(id!, onPaidSuccess); }}
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
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Paid'
      ? 'bg-success/15 text-success'
      : status === 'Overdue'
      ? 'bg-destructive/15 text-destructive'
      : status === 'Sent' || status === 'Viewed'
      ? 'bg-info/15 text-info'
      : status === 'Partially Paid'
      ? 'bg-warning/15 text-warning'
      : 'bg-secondary text-muted-foreground';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium h-fit ${cls}`}>
      {status}
    </span>
  );
}
