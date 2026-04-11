import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { ArrowLeft, Printer } from 'lucide-react';

export default function CPInvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['cp-invoice', id],
    queryFn: () => api.get(`/client/invoices/${id}`).then(r => r.data?.data || r.data || {}),
    enabled: !!id,
  });

  const inv = data || {};
  const items = inv.items || inv.line_items || [];
  const payments = inv.payments || [];
  const sym = inv.currency === 'USD' ? '$' : '₹';
  const fmt = (v: number) => `${sym}${Number(v || 0).toLocaleString('en-IN')}`;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  if (isLoading) return <div className="page-container"><div className="text-center py-20 text-muted-foreground">Loading...</div></div>;

  return (
    <div className="page-container">
      <button onClick={() => navigate('/client-portal/invoices')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </button>

      <div className="glass-card p-6 print:shadow-none print:border-0" id="invoice-print">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6 pb-4 border-b border-border">
          <div>
            <h1 className="text-xl font-bold">Invoice {inv.invoice_number}</h1>
            <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
              <div>Issue Date: {fmtDate(inv.date || inv.issue_date)}</div>
              <div>Due Date: {fmtDate(inv.due_date)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <StatusBadge status={inv.status} />
            <button onClick={() => window.print()} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground print:hidden">
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Billing */}
        {(inv.billing_name || inv.client_name) && (
          <div className="mb-6">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Bill To</h3>
            <div className="text-sm font-medium">{inv.billing_name || inv.client_name}</div>
            {inv.billing_address && <div className="text-sm text-muted-foreground">{inv.billing_address}</div>}
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
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No line items</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(inv.subtotal || inv.total || 0)}</span></div>
            {inv.tax_amount != null && inv.tax_amount !== 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{fmt(inv.tax_amount)}</span></div>
            )}
            {inv.discount_amount != null && inv.discount_amount !== 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{fmt(inv.discount_amount)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
              <span>Total</span><span>{fmt(inv.total || inv.amount || 0)}</span>
            </div>
          </div>
        </div>

        {/* Payment History */}
        {payments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Payment History</h3>
            <div className="space-y-2">
              {payments.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm p-3 rounded-lg bg-secondary/50">
                  <div>
                    <span className="font-medium">{fmt(p.amount)}</span>
                    <span className="text-muted-foreground ml-2">via {p.method || p.payment_method || 'N/A'}</span>
                  </div>
                  <span className="text-muted-foreground">{fmtDate(p.date || p.payment_date)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Paid' ? 'bg-success/15 text-success' :
    status === 'Overdue' ? 'bg-destructive/15 text-destructive' :
    status === 'Sent' || status === 'Viewed' ? 'bg-info/15 text-info' :
    status === 'Partially Paid' ? 'bg-warning/15 text-warning' :
    'bg-secondary text-muted-foreground';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}
