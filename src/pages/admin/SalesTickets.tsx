import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { salesApi } from '@/lib/api';
import { Ticket as TicketIcon } from 'lucide-react';

const STATUS_TABS = ['All', 'NEW', 'ASSIGNED', 'IN_PROGRESS', 'CUSTOMER_REPLIED', 'WAITING_FOR_CUSTOMER', 'FOLLOW_UP', 'PROPOSAL_SENT', 'WON', 'LOST', 'CLOSED'];

const STATUS_COLORS: Record<string, string> = {
  NEW: 'badge-neutral', ASSIGNED: 'badge-primary', IN_PROGRESS: 'badge-info',
  CUSTOMER_REPLIED: 'badge-warning', WAITING_FOR_CUSTOMER: 'badge-neutral',
  FOLLOW_UP: 'badge-warning', PROPOSAL_SENT: 'badge-info',
  WON: 'badge-success', LOST: 'badge-danger', CLOSED: 'badge-neutral',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'badge-neutral', MEDIUM: 'badge-neutral', HIGH: 'badge-warning', URGENT: 'badge-danger',
};

export default function SalesTickets() {
  const navigate = useNavigate();
  const basePath = window.location.pathname.startsWith('/sales') ? '/sales' : '/admin';
  const [tab, setTab] = useState('All');

  const { data, isLoading } = useQuery({
    queryKey: ['sales-tickets', tab],
    queryFn: () => salesApi.getTickets(tab === 'All' ? {} : { status: tab }).then(r => r.data?.data || []),
    refetchInterval: 30_000,
  });

  const tickets: any[] = data || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Tickets</h1>
          <p className="page-subtitle">Sales requirements &amp; conversations</p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {STATUS_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`text-xs px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
            {t === 'All' ? 'All' : t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <TicketIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No tickets</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-3">Ticket</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Requirement</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
                <th className="p-3">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id} onClick={() => navigate(`${basePath}/sales-tickets/${t.id}`)} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="p-3 font-medium">{t.ticket_number}</td>
                  <td className="p-3">
                    <div>{t.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{t.customer_email}</div>
                  </td>
                  <td className="p-3">{t.title}</td>
                  <td className="p-3"><span className={PRIORITY_COLORS[t.priority] || 'badge-neutral'}>{t.priority}</span></td>
                  <td className="p-3"><span className={STATUS_COLORS[t.status] || 'badge-neutral'}>{t.status.replace(/_/g, ' ')}</span></td>
                  <td className="p-3 text-muted-foreground text-xs">{t.next_followup_date ? new Date(t.next_followup_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
