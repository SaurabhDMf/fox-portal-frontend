import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Eye, EyeOff, ExternalLink, Folder } from 'lucide-react';

export default function CPVault() {
  const { data } = useQuery({
    queryKey: ['cp-vault'],
    queryFn: () => api.get('/client/vault').then(r => r.data?.data || r.data || {}),
  });

  const credentials = data?.credentials || [];
  const folders = data?.folders || [];

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">Vault</h1><p className="page-subtitle">Credentials and folders shared with you</p></div></div>

      {/* Shared Credentials */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3 text-foreground">Shared Credentials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {credentials.map((c: any) => <CredentialCard key={c.id} credential={c} />)}
          {credentials.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No credentials shared</p>}
        </div>
      </section>

      {/* Shared Folders */}
      <section>
        <h2 className="text-sm font-semibold mb-3 text-foreground">Shared Folders</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {folders.map((f: any) => (
            <div key={f.id} className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: f.color ? `${f.color}20` : 'hsl(var(--secondary))' }}>
                <Folder className="h-5 w-5" style={{ color: f.color || 'hsl(var(--muted-foreground))' }} />
              </div>
              <div>
                <div className="text-sm font-medium">{f.name}</div>
                {f.credentials_count != null && <div className="text-xs text-muted-foreground">{f.credentials_count} credentials</div>}
              </div>
            </div>
          ))}
          {folders.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No folders shared</p>}
        </div>
      </section>
    </div>
  );
}

function CredentialCard({ credential: c }: { credential: any }) {
  const [showPw, setShowPw] = useState(false);
  return (
    <div className="glass-card p-4 space-y-2">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold">{c.title || c.name}</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{c.permission || 'view'}</span>
      </div>
      {c.username && <div className="text-xs"><span className="text-muted-foreground">Username: </span><span className="font-mono">{c.username}</span></div>}
      {c.password && (
        <div className="text-xs flex items-center gap-2">
          <span className="text-muted-foreground">Password: </span>
          <span className="font-mono">{showPw ? c.password : '••••••••'}</span>
          <button onClick={() => setShowPw(!showPw)} className="p-0.5 rounded hover:bg-secondary text-muted-foreground">
            {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
      {c.url && (
        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> {c.url}
        </a>
      )}
    </div>
  );
}
