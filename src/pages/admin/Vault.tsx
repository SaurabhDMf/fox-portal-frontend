import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Plus, Search, Lock, Eye, EyeOff, Copy, FolderClosed } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Vault() {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedPw, setRevealedPw] = useState('');

  const { data: folders = [] } = useQuery({
    queryKey: ['vault-folders'],
    queryFn: () => api.get('/vault/folders').then(r => r.data?.folders || r.data || []),
  });

  const { data: creds = [] } = useQuery({
    queryKey: ['vault-creds', selectedFolder],
    queryFn: () => api.get('/vault/credentials', { params: { folder_id: selectedFolder || undefined } }).then(r => r.data?.credentials || r.data || []),
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
  const credsArr = Array.isArray(creds) ? creds : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Password Vault</h1><p className="page-subtitle">Securely manage credentials</p></div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
          <Plus className="h-4 w-4" /> Add Credential
        </button>
      </div>

      <div className="flex gap-4 flex-col md:flex-row">
        {/* Folders */}
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

        {/* Credentials */}
        <div className="flex-1 space-y-3">
          {credsArr.map((cred: any) => (
            <div key={cred.id} className="glass-card-hover p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{cred.title}</div>
                <div className="text-xs text-muted-foreground">{cred.username} • {cred.category}</div>
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
    </div>
  );
}
