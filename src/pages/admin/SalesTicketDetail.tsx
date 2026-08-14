import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '@/lib/api';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import { Paperclip, Send, ArrowLeft } from 'lucide-react';

const STATUS_OPTIONS = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CUSTOMER_REPLIED', 'WAITING_FOR_CUSTOMER', 'FOLLOW_UP', 'PROPOSAL_SENT', 'WON', 'LOST', 'CLOSED'];
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const fmt = (d?: string) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

async function downloadAttachment(ticketId: string, att: any) {
  try {
    const res = await api.get(salesApi.attachmentUrl(ticketId, att.id), { responseType: 'blob' });
    const blob = new Blob([res.data], { type: att.mime_type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.filename || 'attachment';
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Failed to download attachment');
  }
}

export default function SalesTicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  const isManagerRole = ['super_admin', 'admin', 'sales_manager'].includes(role || '');

  const [replyText, setReplyText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupNote, setFollowupNote] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [assignTo, setAssignTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sales-ticket', id],
    queryFn: () => salesApi.getTicket(id!).then(r => r.data),
    enabled: !!id,
    refetchInterval: 20_000,
  });

  const { data: repsData } = useQuery({
    queryKey: ['sales-reps-list'],
    queryFn: () => api.get('/users', { params: { role: 'sales_rep' } }).then(r => r.data?.data || []),
    enabled: showAssign,
  });

  const patchMut = useMutation({
    mutationFn: (body: any) => salesApi.patchTicket(id!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-ticket', id] }),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update'),
  });

  const sendMut = useMutation({
    mutationFn: () => salesApi.sendTicketMessage(id!, { body_text: replyText }),
    onSuccess: () => {
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['sales-ticket', id] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to send'),
  });

  const noteMut = useMutation({
    mutationFn: () => salesApi.addTicketNote(id!, noteText),
    onSuccess: () => {
      setNoteText('');
      qc.invalidateQueries({ queryKey: ['sales-ticket', id] });
    },
  });

  const followupMut = useMutation({
    mutationFn: () => salesApi.addFollowup(id!, { due_date: followupDate, note: followupNote || undefined }),
    onSuccess: () => {
      toast.success('Follow-up set');
      setFollowupDate(''); setFollowupNote('');
      qc.invalidateQueries({ queryKey: ['sales-ticket', id] });
    },
  });

  if (isLoading) return <div className="page-container"><div className="text-center py-16 text-sm text-muted-foreground">Loading…</div></div>;
  if (!data) return <div className="page-container"><div className="text-center py-16 text-sm text-muted-foreground">Not found</div></div>;

  const reps: any[] = repsData || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-md hover:bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h1 className="page-title">{data.ticket_number} — {data.title}</h1>
            <p className="page-subtitle">{data.customer_name} · {data.customer_email} · Assigned: {data.assignee_name || 'Unassigned'}</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <select value={data.priority} onChange={e => patchMut.mutate({ priority: e.target.value })} className="text-xs px-2 py-1.5 rounded-lg bg-secondary border border-border">
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={data.status} onChange={e => patchMut.mutate({ status: e.target.value })} className="text-xs px-2 py-1.5 rounded-lg bg-secondary border border-border">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          {isManagerRole && (
            <button onClick={() => setShowAssign(true)} className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors">Reassign</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Conversation */}
        <div className="lg:col-span-2 glass-card p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {(data.messages || []).map((m: any) => (
            <div key={m.id} className={`max-w-[85%] rounded-xl p-3 text-sm ${m.direction === 'outbound' ? 'ml-auto bg-primary/10' : 'bg-secondary'}`}>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                <span>{m.direction === 'outbound' ? 'You (reply@)' : data.customer_name}</span>
                <span>{fmt(m.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap">{m.body_text}</p>
              {m.status === 'failed' && <p className="text-xs text-destructive mt-1">Failed to send — {m.last_send_error}</p>}
              {m.attachment_count > 0 && (
                <button onClick={() => downloadAttachment(id!, { id: m.id })} className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline">
                  <Paperclip className="h-3 w-3" /> {m.attachment_count} attachment{m.attachment_count > 1 ? 's' : ''}
                </button>
              )}
            </div>
          ))}
          {(!data.messages || data.messages.length === 0) && <p className="text-sm text-muted-foreground text-center py-8">No messages yet</p>}
        </div>

        {/* Side panel: notes + follow-up */}
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Follow-up</h3>
            <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-sm" />
            <textarea value={followupNote} onChange={e => setFollowupNote(e.target.value)} placeholder="Note (optional)" rows={2} className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-sm resize-none" />
            <button onClick={() => followupMut.mutate()} disabled={!followupDate || followupMut.isPending} className="w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">Set Follow-up</button>
            {data.next_followup_date && <p className="text-xs text-muted-foreground">Next: {new Date(data.next_followup_date).toLocaleDateString()}</p>}
          </div>

          <div className="glass-card p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Internal Notes</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(data.notes || []).map((n: any) => (
                <div key={n.id} className="text-xs bg-secondary rounded-lg p-2">
                  <div className="text-muted-foreground mb-0.5">{n.author_name} · {fmt(n.created_at)}</div>
                  <p>{n.note}</p>
                </div>
              ))}
              {(!data.notes || data.notes.length === 0) && <p className="text-xs text-muted-foreground">No notes yet</p>}
            </div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add an internal note (never sent to customer)" rows={2} className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-sm resize-none" />
            <button onClick={() => noteMut.mutate()} disabled={!noteText || noteMut.isPending} className="w-full py-1.5 rounded-lg bg-secondary hover:bg-muted text-xs font-medium disabled:opacity-50">Add Note</button>
          </div>
        </div>
      </div>

      {/* Reply box */}
      <div className="glass-card p-4 space-y-2">
        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply to customer — sent from reply@, never your personal address" rows={3} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm resize-none" />
        <div className="flex justify-end">
          <button onClick={() => sendMut.mutate()} disabled={!replyText || sendMut.isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">
            <Send className="h-4 w-4" /> {sendMut.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>

      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowAssign(false)}>
          <div className="glass-card w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Reassign Ticket</h2>
            <p className="text-xs text-muted-foreground">This changes only this ticket's assignment, not the customer's permanent owner.</p>
            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              <option value="">Select rep…</option>
              {reps.map((r: any) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAssign(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button
                onClick={() => { patchMut.mutate({ assigned_user_id: assignTo }); setShowAssign(false); }}
                disabled={!assignTo}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
              >
                Reassign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
