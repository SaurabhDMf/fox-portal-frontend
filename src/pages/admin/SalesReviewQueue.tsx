import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { HelpCircle } from 'lucide-react';

export default function SalesReviewQueue() {
  const qc = useQueryClient();
  const [pickedTicket, setPickedTicket] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['sales-review-queue'],
    queryFn: () => salesApi.getReviewQueue().then(r => r.data?.data || []),
    refetchInterval: 30_000,
  });

  const attachMut = useMutation({
    mutationFn: ({ id, ticket_id }: { id: string; ticket_id: string }) => salesApi.attachReview(id, ticket_id),
    onSuccess: () => { toast.success('Attached to ticket'); qc.invalidateQueries({ queryKey: ['sales-review-queue'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const createMut = useMutation({
    mutationFn: (id: string) => salesApi.createFromReview(id),
    onSuccess: () => { toast.success('New ticket created'); qc.invalidateQueries({ queryKey: ['sales-review-queue'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const items: any[] = data || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Review Queue</h1>
          <p className="page-subtitle">A known customer emailed with no clear thread match — never guessed, needs your call</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Nothing to review</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const candidates: string[] = JSON.parse(item.candidate_ticket_ids || '[]');
            return (
              <div key={item.id} className="glass-card p-4 space-y-3">
                <div>
                  <span className="font-semibold text-sm">{item.customer_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{item.customer_email}</span>
                  <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <select
                    value={pickedTicket[item.id] || ''}
                    onChange={e => setPickedTicket(prev => ({ ...prev, [item.id]: e.target.value }))}
                    className="text-xs px-2 py-1.5 rounded-lg bg-secondary border border-border"
                  >
                    <option value="">Choose existing ticket…</option>
                    {candidates.map(tid => <option key={tid} value={tid}>{tid}</option>)}
                  </select>
                  <button
                    onClick={() => pickedTicket[item.id] && attachMut.mutate({ id: item.id, ticket_id: pickedTicket[item.id] })}
                    disabled={!pickedTicket[item.id]}
                    className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Attach to Existing Ticket
                  </button>
                  <button
                    onClick={() => createMut.mutate(item.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all"
                  >
                    Create New Ticket
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
