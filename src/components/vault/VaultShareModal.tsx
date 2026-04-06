import { useState, useEffect } from 'react';
import { X, Search, Check, Users, Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface ShareEntity {
  id: string;
  full_name?: string;
  company_name?: string;
  email: string;
  role?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (ids: string[], canEdit: boolean[], type: 'user' | 'client') => void;
  isPending: boolean;
  title: string;
}

export default function VaultShareModal({ open, onClose, onSubmit, isPending, title }: Props) {
  const [tab, setTab] = useState<'users' | 'clients'>('users');
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

  const { data: clients = [] } = useQuery({
    queryKey: ['vault-clients'],
    queryFn: () => api.get('/clients').then(r => {
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : d?.clients || [];
    }),
    enabled: open,
  });

  useEffect(() => {
    if (open) { setSelected(new Map()); setSearch(''); setTab('users'); }
  }, [open]);

  if (!open) return null;

  const list: ShareEntity[] = tab === 'users' ? users : clients;
  const filtered = list.filter((item: ShareEntity) => {
    const name = item.full_name || item.company_name || '';
    return !search || name.toLowerCase().includes(search.toLowerCase()) || item.email?.toLowerCase().includes(search.toLowerCase());
  });

  const toggleItem = (id: string) => {
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
    onSubmit(ids, edits, tab === 'users' ? 'user' : 'client');
  };

  const switchTab = (t: 'users' | 'clients') => {
    setTab(t);
    setSelected(new Map());
    setSearch('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg bg-secondary p-1 gap-1">
          <button onClick={() => switchTab('users')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'users' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Users className="h-4 w-4" /> Users
          </button>
          <button onClick={() => switchTab('clients')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'clients' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Building2 className="h-4 w-4" /> Clients
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${tab}...`} className="w-full pl-10 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 max-h-64">
          {filtered.map((item: ShareEntity) => {
            const name = item.full_name || item.company_name || 'Unknown';
            return (
              <div key={item.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selected.has(item.id) ? 'bg-primary/10' : 'hover:bg-secondary'}`} onClick={() => toggleItem(item.id)}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selected.has(item.id) ? 'bg-primary border-primary' : 'border-border'}`}>
                  {selected.has(item.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{name}</div>
                  <div className="text-xs text-muted-foreground truncate">{item.email} {item.role && `• ${item.role}`}</div>
                </div>
                {selected.has(item.id) && (
                  <button onClick={e => { e.stopPropagation(); toggleCanEdit(item.id); }} className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${selected.get(item.id) ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-secondary text-muted-foreground'}`}>
                    {selected.get(item.id) ? 'Can Edit' : 'View Only'}
                  </button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-center py-6 text-sm text-muted-foreground">No {tab} found</div>}
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={isPending || selected.size === 0} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {isPending ? 'Sharing...' : `Share with ${selected.size} ${tab === 'users' ? 'user' : 'client'}${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
