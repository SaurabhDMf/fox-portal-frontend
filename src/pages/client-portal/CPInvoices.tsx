import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Download } from 'lucide-react';

export default function CPInvoices() {
  const { data = [] } = useQuery({
    queryKey: ['cp-invoices'],
    queryFn: () => api.get('/client/invoices').then(r => r.data?.data || r.data?.invoices || r.data || []),
  });
  const invoices = Array.isArray(data) ? data : [];

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">Invoices</h1><p className="page-subtitle">View and download your invoices</p></div></div>
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="p-4">Invoice #</th>
              <th className="p-4">Date</th>
              <th className="p-4">Due Date</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Status</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv: any) => (
              <tr key={inv.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="p-4 font-medium">{inv.invoice_number || inv.id?.slice(0, 8)}</td>
                <td className="p-4 text-muted-foreground">{inv.date ? new Date(inv.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                <td className="p-4 text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                <td className="p-4 font-semibold">${Number(inv.total || inv.amount || 0).toLocaleString()}</td>
                <td className="p-4">
                  <span className={
                    inv.status === 'Paid' ? 'badge-success' :
                    inv.status === 'Overdue' ? 'badge-danger' :
                    inv.status === 'Sent' ? 'badge-warning' : 'badge-neutral'
                  }>{inv.status}</span>
                </td>
                <td className="p-4">
                  {inv.pdf_url && (
                    <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground inline-flex">
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={6} className="p-12 text-center text-muted-foreground text-sm">No invoices found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
