import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ClientSupport() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'General', priority: 'Medium' });
  const qc = useQueryClient();

  const { data = [] } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => api.get('/tickets').then(r => r.data?.tickets || r.data || []),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/tickets', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-tickets'] }); setShowCreate(false); toast.success('Ticket created'); },
  });

  const tickets = Array.isArray(data) ? data : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Support</h1></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
          <Plus className="h-4 w-4" /> New Ticket
        </button>
      </div>

      <div className="space-y-3">
        {tickets.map((t: any) => (
          <div key={t.id} className="glass-card-hover p-4 space-y-2">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-sm">{t.title}</h3>
              <span className={t.status === 'Resolved' || t.status === 'Closed' ? 'badge-success' : 'badge-warning'}>{t.status}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Support Ticket</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => createMut.mutate(form)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
