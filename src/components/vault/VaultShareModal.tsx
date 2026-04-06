import { useState, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface ShareUser {
  id: string;
  full_name: string;
  email: string;
  role?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (userIds: string[], canEdit: boolean[]) => void;
  isPending: boolean;
  title: string;
}

export default function VaultShareModal({ open, onClose, onSubmit, isPending, title }: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Map<string, boolean>>(new Map());

  const { data: users = [] } = useQuery({
    queryKey: ['vault-users'],
    queryFn: () => api.get('/vault/users').then(r => {
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : d?.users || [];
    }),
    enabled: open,
  });

  useEffect(() => {
    if (open) { setSelected(new Map()); setSearch(''); }
  }, [open]);

  if (!open) return null;

  const filtered = (users as ShareUser[]).filter(u =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (id: string) => {
    const next = new Map(selected);
    if (next.has(id)) next.delete(id);
    else next.set(id, false);
    setSelected(next);
  };

  const toggleCanEdit = (id: string) => {
    const next = new Map(selected);
    next.set(id, !next.get(id));
    setSelected(next);
  };

  const handleSubmit = () => {
    const ids = Array.from(selected.keys());
    const edits = ids.map(id => selected.get(id) || false);
    onSubmit(ids, edits);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-10 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 max-h-64">
          {filtered.map((u: ShareUser) => (
            <div key={u.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selected.has(u.id) ? 'bg-primary/10' : 'hover:bg-secondary'}`} onClick={() => toggleUser(u.id)}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selected.has(u.id) ? 'bg-primary border-primary' : 'border-border'}`}>
                {selected.has(u.id) && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{u.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email} {u.role && `• ${u.role}`}</div>
              </div>
              {selected.has(u.id) && (
                <button onClick={e => { e.stopPropagation(); toggleCanEdit(u.id); }} className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${selected.get(u.id) ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-secondary text-muted-foreground'}`}>
                  {selected.get(u.id) ? 'Can Edit' : 'View Only'}
                </button>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-6 text-sm text-muted-foreground">No users found</div>}
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={isPending || selected.size === 0} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {isPending ? 'Sharing...' : `Share with ${selected.size} user${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
