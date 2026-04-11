import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { X, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onCreated?: (roomId: string) => void;
}

export default function CreateGroupModal({ onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
    mutationFn: () => api.post('/chat/rooms', {
      name, type: 'Group', description, member_ids: selectedIds,
    }),
    onSuccess: (res) => {
      toast.success('Group created');
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      const id = res.data?.data?.id || res.data?.id;
      if (id && onCreated) onCreated(id);
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create group'),
  });

  const toggle = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> New Group</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 flex-1 overflow-y-auto">
          <div>
            <label className="text-sm font-medium">Group Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Engineering Team"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Add Members</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-2" />
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedIds.map(id => {
                  const u = (users as any[]).find(x => x.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                      {u?.full_name || 'User'}
                      <button onClick={() => toggle(id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="max-h-40 overflow-y-auto space-y-0.5 border border-border rounded-lg">
              {filtered.map((u: any) => (
                <button key={u.id} onClick={() => toggle(u.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/50 transition-colors ${selectedIds.includes(u.id) ? 'bg-primary/5' : ''}`}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ backgroundColor: `hsl(${Math.abs(hash(u.full_name || '')) % 360}, 60%, 45%)`, color: '#fff' }}>
                    {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full rounded-full object-cover" /> : (u.full_name?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm truncate">{u.full_name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{u.job_title || u.email}</div>
                  </div>
                  {selectedIds.includes(u.id) && <span className="ml-auto text-primary text-xs">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-secondary transition-colors">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {mut.isPending ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; }
