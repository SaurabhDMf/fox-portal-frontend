import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { X, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onCreated?: (roomId: string) => void;
}

export default function CreateDMModal({ onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['active-users'],
    queryFn: () => api.get('/users/active').then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || d?.users || [];
    }),
    staleTime: 2 * 60 * 1000,
  });

  const filtered = (users as any[]).filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const mut = useMutation({
    mutationFn: (userId: string) => api.post('/chat/direct', { user_id: userId }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      const id = res.data?.data?.id || res.data?.id || res.data?.room?.id;
      if (id && onCreated) onCreated(id);
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create DM'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><MessageSquare className="h-5 w-5" /> New Message</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
          autoFocus
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-3" />
        <div className="flex-1 overflow-y-auto space-y-0.5 border border-border rounded-lg max-h-64">
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No users found</p>}
          {filtered.map((u: any) => (
            <button key={u.id} onClick={() => mut.mutate(u.id)} disabled={mut.isPending}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: `hsl(${Math.abs(hash(u.full_name || '')) % 360}, 60%, 45%)`, color: '#fff' }}>
                {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full rounded-full object-cover" /> : (u.full_name?.[0] || '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{u.full_name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{u.job_title || u.email}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; }
