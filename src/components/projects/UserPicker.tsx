import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray } from '@/lib/projectResponse';
import { ChevronDown, Search, X } from 'lucide-react';

export interface ActiveUser {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role?: string;
  job_title?: string;
  department?: string;
}

function getInitialColor(name: string): string {
  const colors = [
    'hsl(var(--primary))',
    'hsl(210 80% 55%)',
    'hsl(340 75% 55%)',
    'hsl(160 60% 45%)',
    'hsl(45 90% 50%)',
    'hsl(270 60% 55%)',
    'hsl(200 70% 50%)',
    'hsl(15 80% 55%)',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function useActiveUsers() {
  const { data } = useQuery({
    queryKey: ['active-users'],
    queryFn: () => api.get('/users/active').then(r => extractProjectArray<ActiveUser>(r.data, ['users'])),
    staleTime: 2 * 60 * 1000,
  });
  return Array.isArray(data) ? data : [];
}

interface UserPickerProps {
  value: string | null;
  onChange: (userId: string | null, user?: ActiveUser) => void;
  placeholder?: string;
  label?: string;
  allowClear?: boolean;
  className?: string;
  /** For multi-select mode: pass selected IDs */
  multi?: boolean;
  selectedIds?: string[];
  onToggle?: (userId: string) => void;
}

function UserAvatar({ user, size = 28 }: { user: ActiveUser; size?: number }) {
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.full_name} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: getInitialColor(user.full_name), fontSize: size * 0.38 }}
    >
      {user.full_name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

export default function UserPicker({ value, onChange, placeholder = 'Select user...', label, allowClear = true, className = '', multi, selectedIds, onToggle }: UserPickerProps) {
  const users = useActiveUsers();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.job_title?.toLowerCase().includes(q);
  });

  const selectedUser = value ? users.find(u => u.id === value) : null;

  if (multi && selectedIds && onToggle) {
    return (
      <div ref={ref} className={`relative ${className}`}>
        {label && <label className="text-xs text-muted-foreground mb-1 block">{label}</label>}
        <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-left">
          <span className="truncate">{selectedIds.length ? `${selectedIds.length} selected` : placeholder}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        </button>
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {selectedIds.map(id => {
              const u = users.find(x => x.id === id);
              if (!u) return null;
              return (
                <button key={id} onClick={() => onToggle(id)} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
                  <UserAvatar user={u} size={16} />
                  <span className="truncate max-w-[80px]">{u.full_name}</span>
                  <X className="h-2.5 w-2.5" />
                </button>
              );
            })}
          </div>
        )}
        {open && (
          <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." autoFocus
                  className="w-full pl-7 pr-2 py-1.5 rounded bg-secondary border border-border text-xs focus:outline-none" />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {filtered.map(u => {
                const isSelected = selectedIds.includes(u.id);
                return (
                  <button key={u.id} onClick={() => onToggle(u.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-sm transition-colors ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>
                    <UserAvatar user={u} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{u.full_name}</div>
                      {u.job_title && <div className="text-[10px] text-muted-foreground truncate">{u.job_title}</div>}
                    </div>
                    {isSelected && <span className="text-xs text-primary">✓</span>}
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No users found</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && <label className="text-xs text-muted-foreground mb-1 block">{label}</label>}
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-left">
        {selectedUser ? (
          <>
            <UserAvatar user={selectedUser} size={22} />
            <span className="flex-1 truncate">{selectedUser.full_name}</span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground truncate">{placeholder}</span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {allowClear && value && (
            <span onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }} className="p-0.5 rounded hover:bg-muted cursor-pointer">
              <X className="h-3 w-3 text-muted-foreground" />
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." autoFocus
                className="w-full pl-7 pr-2 py-1.5 rounded bg-secondary border border-border text-xs focus:outline-none" />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.map(u => (
              <button key={u.id} onClick={() => { onChange(u.id, u); setOpen(false); setSearch(''); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-sm transition-colors ${u.id === value ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>
                <UserAvatar user={u} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{u.full_name}</div>
                  {u.job_title && <div className="text-[10px] text-muted-foreground truncate">{u.job_title}</div>}
                </div>
                {u.id === value && <span className="text-xs text-primary">✓</span>}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No users found</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact inline picker for table cells */
export function InlineUserPicker({ value, onChange, members }: { value: string; onChange: (userId: string | null) => void; members?: any[] }) {
  const users = useActiveUsers();
  const allUsers = users.length > 0 ? users : (members || []).map((m: any) => ({ id: m.user_id || m.id, full_name: m.full_name, email: m.email }));
  
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] focus:outline-none cursor-pointer max-w-[120px]"
    >
      <option value="">Unassigned</option>
      {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.full_name || u.name || u.email}</option>)}
    </select>
  );
}
