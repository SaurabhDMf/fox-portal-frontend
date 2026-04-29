import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Download, Eye, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCompanyCurrency } from '@/hooks/useCompanyCurrency';

// Clients only see Paid or Pending
const STATUS_FILTERS = ['All', 'Paid', 'Pending'];

function clientStatus(inv: any): 'Paid' | 'Pending' {
  return inv.status === 'Paid' ? 'Paid' : 'Pending';
}

async function downloadPdf(inv: any) {
  try {
    const res = await api.get(`/invoices/${inv.id}/pdf`, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.invoice_number || inv.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('No PDF available');
  }
}

export default function CPInvoices() {
  const [filter, setFilter] = useState('All');
  const navigate = useNavigate();
  const { currencySymbol } = useCompanyCurrency();

  const { data = [] } = useQuery({
    queryKey: ['cp-invoices'],
    queryFn: () =>
      api.get('/invoices').then((r) => {
        const d = r.data;
        return Array.isArray(d) ? d : d?.data || d?.invoices || [];
      }),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const invoices = Array.isArray(data) ? data : [];
  const filtered = filter === 'All'
    ? invoices
    : invoices.filter((inv: any) => clientStatus(inv) === filter);

  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtAmt = (v: number, currency?: string) =>
    `${currencySymbol(currency)}${Number(v || 0).toLocaleString('en-IN')}`;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">View, download and pay your invoices</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="p-4">Invoice #</th>
              <th className="p-4">Issue Date</th>
              <th className="p-4">Due Date</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Paid</th>
              <th className="p-4">Status</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv: any) => {
              const total  = Number(inv.total_amount ?? inv.total ?? inv.amount ?? 0);
              const isPaid = inv.status === 'Paid';
              const paid   = isPaid && !Number(inv.amount_paid) ? total : Number(inv.amount_paid ?? inv.paid_amount ?? 0);
              return (
                <tr key={inv.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="p-4 font-medium">{inv.invoice_number || inv.id?.slice(0, 8)}</td>
                  <td className="p-4 text-muted-foreground">{fmtDate(inv.date || inv.issue_date)}</td>
                  <td className="p-4 text-muted-foreground">{fmtDate(inv.due_date)}</td>
                  <td className="p-4 font-semibold">{fmtAmt(total, inv.currency)}</td>
                  <td className="p-4 text-muted-foreground">{fmtAmt(paid, inv.currency)}</td>
                  <td className="p-4">
                    <StatusBadge status={clientStatus(inv)} />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/client-portal/invoices/${inv.id}`)}
                        className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                      >
                        <Eye className="h-4 w-4" /> View
                      </button>
                      {inv.has_pdf && (
                        <button
                          onClick={() => downloadPdf(inv)}
                          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                        >
                          <Download className="h-4 w-4" /> PDF
                        </button>
                      )}
                      {!isPaid && (
                        <button
                          onClick={() => navigate(`/client-portal/invoices/${inv.id}`)}
                          className="px-2 py-1 rounded-md bg-primary text-primary-foreground inline-flex items-center gap-1 text-xs font-medium hover:opacity-90"
                        >
                          <CreditCard className="h-3.5 w-3.5" /> Pay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center text-muted-foreground text-sm">
                  No invoices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'Paid' | 'Pending' }) {
  const cls = status === 'Paid'
    ? 'bg-success/15 text-success'
    : 'bg-warning/15 text-warning';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}
