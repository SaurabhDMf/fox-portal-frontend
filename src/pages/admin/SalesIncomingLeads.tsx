import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Inbox, X, Send } from 'lucide-react';

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export default function SalesIncomingLeads() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['sales-incoming-leads'],
    queryFn: () => salesApi.getIncomingLeads().then(r => r.data?.data || []),
    refetchInterval: 30_000,
  });

  const ignoreMut = useMutation({
    mutationFn: (id: string) => salesApi.ignoreLead(id),
    onSuccess: () => { toast.success('Ignored'); qc.invalidateQueries({ queryKey: ['sales-incoming-leads'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const forwardMut = useMutation({
    mutationFn: (id: string) => salesApi.forwardLead(id),
    onSuccess: (res) => {
      toast.success(`Qualified as ${res.data?.data?.ticketNumber || 'ticket'}`);
      qc.invalidateQueries({ queryKey: ['sales-incoming-leads'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to qualify'),
  });

  const leads: any[] = data || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Incoming Leads</h1>
          <p className="page-subtitle">Review lead@ intake — ignore junk, forward genuine leads to sales</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : leads.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No pending leads</p>
          <p className="text-xs text-muted-foreground mt-1">New intake mail will appear here for review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => (
            <div key={lead.id} className="glass-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{lead.from_name || lead.from_address}</span>
                    <span className="text-xs text-muted-foreground">{lead.from_address}</span>
                  </div>
                  <p className="text-sm mt-1">{lead.subject || '(no subject)'}</p>
                  {lead.source_email && <span className="text-xs badge-primary mt-1 inline-block">via {lead.source_email}</span>}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(lead.received_at)}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">{lead.body_text}</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => ignoreMut.mutate(lead.id)}
                  disabled={ignoreMut.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Ignore
                </button>
                <button
                  onClick={() => forwardMut.mutate(lead.id)}
                  disabled={forwardMut.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" /> Forward to Sales
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
