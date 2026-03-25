import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Plus, Search, Lock, Eye, EyeOff, Copy, FolderClosed, X, Globe, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

const categories = ['Social Media', 'Finance', 'Dev Tools', 'Email', 'CRM', 'Other'];

function getStrength(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak', color: 'bg-destructive', width: '20%' };
  if (score <= 2) return { label: 'Fair', color: 'bg-[hsl(var(--warning))]', width: '40%' };
  if (score <= 3) return { label: 'Good', color: 'bg-[hsl(var(--info))]', width: '60%' };
  if (score <= 4) return { label: 'Strong', color: 'bg-[hsl(var(--success))]', width: '80%' };
  return { label: 'Very Strong', color: 'bg-[hsl(var(--success))]', width: '100%' };
}

export default function Vault() {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedPw, setRevealedPw] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showShare, setShowShare] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareAccess, setShareAccess] = useState('view');
  const [form, setForm] = useState({ title: '', username: '', password: '', url: '', category: 'Other', notes: '', folder_id: '' });
  const canCreate = useAuthStore(s => s.canCreate);
  const qc = useQueryClient();

  const { data: folders = [] } = useQuery({
    queryKey: ['vault-folders'],
    queryFn: () => api.get('/vault/folders').then(r => r.data?.folders || r.data || []),
  });

  const { data: creds = [] } = useQuery({
    queryKey: ['vault-creds', selectedFolder],
    queryFn: () => api.get('/vault/credentials', { params: { folder_id: selectedFolder || undefined } }).then(r => r.data?.credentials || r.data || []),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/vault/credentials', { ...d, folder_id: d.folder_id || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vault-creds'] });
      setShowCreate(false);
      setForm({ title: '', username: '', password: '', url: '', category: 'Other', notes: '', folder_id: '' });
      toast.success('Credential saved');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const handleReveal = async (id: string) => {
    if (revealedId === id) { setRevealedId(null); setRevealedPw(''); return; }
    try {
      const { data } = await api.get(`/vault/credentials/${id}/reveal`);
      setRevealedId(id);
      setRevealedPw(data.password || '••••••');
    } catch { toast.error('Cannot reveal'); }
  };

  const copyPw = (pw: string) => {
    navigator.clipboard.writeText(pw);
    toast.success('Copied');
  };

  const foldersArr = Array.isArray(folders) ? folders : [];
  const credsArr = (Array.isArray(creds) ? creds : []).filter((c: any) =>
    !search || c.title?.toLowerCase().includes(search.toLowerCase()) || c.username?.toLowerCase().includes(search.toLowerCase())
  );
  const strength = getStrength(form.password);

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Password Vault</h1><p className="page-subtitle">Securely manage credentials</p></div>
        {canCreate('vault') && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> Add Credential
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search credentials..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      <div className="flex gap-4 flex-col md:flex-row">
        <div className="w-full md:w-56 space-y-1">
          <button onClick={() => setSelectedFolder(null)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${!selectedFolder ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary'}`}>
            <FolderClosed className="h-4 w-4" /> All
          </button>
          {foldersArr.map((f: any) => (
            <button key={f.id} onClick={() => setSelectedFolder(f.id)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${selectedFolder === f.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary'}`}>
              <FolderClosed className="h-4 w-4" /> {f.name}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-3">
          {credsArr.map((cred: any) => (
            <div key={cred.id} className="glass-card-hover p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{cred.title}</div>
                <div className="text-xs text-muted-foreground">{cred.username} • {cred.category}</div>
                {cred.url && <div className="text-xs text-primary truncate">{cred.url}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono">{revealedId === cred.id ? revealedPw : '••••••••'}</span>
                <button onClick={() => handleReveal(cred.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
                  {revealedId === cred.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                {revealedId === cred.id && (
                  <button onClick={() => copyPw(revealedPw)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {credsArr.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No credentials found</div>}
        </div>
      </div>

      {/* Create Credential Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Credential</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Username / Email *" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <div className="space-y-1">
                <input type="password" placeholder="Password *" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                {form.password && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full ${strength.color} rounded-full transition-all`} style={{ width: strength.width }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{strength.label}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input placeholder="URL (optional)" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="w-full pl-10 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={form.folder_id} onChange={e => setForm(f => ({ ...f, folder_id: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">No Folder</option>
                {foldersArr.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.title || !form.username} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Saving...' : 'Save Credential'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
