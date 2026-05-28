import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function ClientInvoices() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['my-invoices'],
    queryFn: () => api.get('/invoices').then(r => r.data?.invoices || r.data || []),
  });
  const invoices = Array.isArray(data) ? data : [];

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">My Invoices</h1></div></div>
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="p-4">Invoice #</th><th className="p-4">Amount</th><th className="p-4">Due Date</th><th className="p-4">Status</th><th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv: any) => (
              <tr key={inv.id} className="border-b border-border/50">
                <td className="p-4 font-medium">{inv.invoice_number || inv.id?.slice(0, 8)}</td>
                <td className="p-4 font-medium">${Number(inv.total || 0).toLocaleString()}</td>
                <td className="p-4 text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : ''}</td>
                <td className="p-4"><span className={inv.status === 'Paid' ? 'badge-success' : inv.status === 'Overdue' ? 'badge-danger' : 'badge-warning'}>{inv.status}</span></td>
                <td className="p-4">{inv.status !== 'Paid' && <button className="text-xs text-primary hover:underline">Pay Now</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
