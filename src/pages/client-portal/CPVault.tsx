import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Eye, EyeOff, ExternalLink, Folder } from 'lucide-react';

export default function CPVault() {
  const [tab, setTab] = useState<'credentials' | 'folders'>('credentials');

  const { data } = useQuery({
    queryKey: ['cp-vault'],
    queryFn: () => api.get('/client/vault').then(r => r.data?.data || r.data || {}),
  });

  const credentials = data?.credentials || [];
  const folders = data?.folders || [];

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">Vault</h1><p className="page-subtitle">Credentials and folders shared with you</p></div></div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button onClick={() => setTab('credentials')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'credentials' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
          Credentials ({credentials.length})
        </button>
        <button onClick={() => setTab('folders')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'folders' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
          Folders ({folders.length})
        </button>
      </div>

      {tab === 'credentials' && (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-4">Title</th>
                <th className="p-4">Username</th>
                <th className="p-4">URL</th>
                <th className="p-4">Permission</th>
                <th className="p-4">Password</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((c: any) => <CredentialRow key={c.id} credential={c} />)}
              {credentials.length === 0 && (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground text-sm">No credentials shared</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'folders' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {folders.map((f: any) => (
            <div key={f.id} className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: f.color ? `${f.color}20` : 'hsl(var(--secondary))' }}>
                <Folder className="h-5 w-5" style={{ color: f.color || 'hsl(var(--muted-foreground))' }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{f.name}</div>
                {f.shared_by_name && <div className="text-xs text-muted-foreground">Shared by {f.shared_by_name}</div>}
              </div>
              <PermBadge perm={f.permission} />
            </div>
          ))}
          {folders.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-12">No folders shared</p>}
        </div>
      )}
    </div>
  );
}

function CredentialRow({ credential: c }: { credential: any }) {
  const [showPw, setShowPw] = useState(false);
  return (
    <tr className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
      <td className="p-4 font-medium">{c.title || c.name}</td>
      <td className="p-4 font-mono text-xs">{c.username || '—'}</td>
      <td className="p-4">
        {c.url ? (
          <a href={c.url.startsWith('http') ? c.url : `https://${c.url}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> {c.url}
          </a>
        ) : '—'}
      </td>
      <td className="p-4"><PermBadge perm={c.permission} /></td>
      <td className="p-4">
        {c.password ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">{showPw ? c.password : '••••••••'}</span>
            <button onClick={() => setShowPw(!showPw)} className="p-1 rounded hover:bg-secondary text-muted-foreground">
              {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : '—'}
      </td>
    </tr>
  );
}

function PermBadge({ perm }: { perm?: string }) {
  const p = (perm || 'view').toLowerCase();
  const cls = p === 'edit' ? 'bg-info/15 text-info' : 'bg-secondary text-muted-foreground';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${cls}`}>{p}</span>;
}
