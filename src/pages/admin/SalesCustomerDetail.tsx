import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '@/lib/api';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import { ArrowLeftRight } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'badge-neutral', ASSIGNED: 'badge-primary', IN_PROGRESS: 'badge-info',
  CUSTOMER_REPLIED: 'badge-warning', WAITING_FOR_CUSTOMER: 'badge-neutral',
  FOLLOW_UP: 'badge-warning', PROPOSAL_SENT: 'badge-info',
  WON: 'badge-success', LOST: 'badge-danger', CLOSED: 'badge-neutral',
};

export default function SalesCustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  const isManagerRole = ['super_admin', 'admin', 'sales_manager'].includes(role || '');
  const basePath = window.location.pathname.startsWith('/sales') ? '/sales' : '/admin';
  const [showTransfer, setShowTransfer] = useState(false);
  const [newOwner, setNewOwner] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sales-customer', id],
    queryFn: () => salesApi.getCustomer(id!).then(r => r.data),
    enabled: !!id,
  });

  const { data: repsData } = useQuery({
    queryKey: ['sales-reps-list'],
    queryFn: () => api.get('/users', { params: { role: 'sales_rep' } }).then(r => r.data?.data || []),
    enabled: showTransfer,
  });

  const transferMut = useMutation({
    mutationFn: () => salesApi.transferCustomer(id!, newOwner),
    onSuccess: () => {
      toast.success('Customer transferred');
      setShowTransfer(false);
      qc.invalidateQueries({ queryKey: ['sales-customer', id] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to transfer'),
  });

  if (isLoading) return <div className="page-container"><div className="text-center py-16 text-sm text-muted-foreground">Loading…</div></div>;
  if (!data) return <div className="page-container"><div className="text-center py-16 text-sm text-muted-foreground">Not found</div></div>;

  const reps: any[] = repsData || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{data.name || data.email}</h1>
          <p className="page-subtitle">{data.email}{data.company ? ` · ${data.company}` : ''}</p>
        </div>
        {isManagerRole && (
          <button onClick={() => setShowTransfer(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-muted transition-colors">
            <ArrowLeftRight className="h-4 w-4" /> Transfer Owner
          </button>
        )}
      </div>

      <div className="glass-card p-4 flex flex-wrap gap-6 text-sm">
        <div><span className="text-xs text-muted-foreground block">Owner</span>{data.owner_name || '—'}</div>
        <div><span className="text-xs text-muted-foreground block">Phone</span>{data.phone || '—'}</div>
        <div><span className="text-xs text-muted-foreground block">Country</span>{data.country || '—'}</div>
        <div><span className="text-xs text-muted-foreground block">Source</span>{data.source_email || '—'}</div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tickets</h2>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-3">Ticket</th>
                <th className="p-3">Requirement</th>
                <th className="p-3">Assigned</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.tickets || []).length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground text-sm">No tickets yet</td></tr>
              ) : data.tickets.map((t: any) => (
                <tr key={t.id} onClick={() => navigate(`${basePath}/sales-tickets/${t.id}`)} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="p-3 font-medium">{t.ticket_number}</td>
                  <td className="p-3">{t.title}</td>
                  <td className="p-3 text-muted-foreground">{t.assignee_name || '—'}</td>
                  <td className="p-3"><span className={STATUS_COLORS[t.status] || 'badge-neutral'}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowTransfer(false)}>
          <div className="glass-card w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Transfer Customer</h2>
            <p className="text-xs text-muted-foreground">Future tickets from this customer will go to the new owner. Historical tickets keep their original assignment.</p>
            <select value={newOwner} onChange={e => setNewOwner(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              <option value="">Select new owner…</option>
              {reps.filter((r: any) => r.id !== data.owner_user_id).map((r: any) => (
                <option key={r.id} value={r.id}>{r.full_name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowTransfer(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => transferMut.mutate()} disabled={!newOwner || transferMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">
                {transferMut.isPending ? 'Transferring…' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
