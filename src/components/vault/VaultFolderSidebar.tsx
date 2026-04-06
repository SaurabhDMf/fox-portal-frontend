import { useState } from 'react';
import { FolderClosed, FolderPlus, MoreVertical, Pencil, Share2, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Folder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  credential_count?: number;
}

interface Props {
  folders: Folder[];
  selectedFolder: string | null;
  onSelect: (id: string | null) => void;
  canCreate: boolean;
  onShareFolder: (id: string) => void;
}

export default function VaultFolderSidebar({ folders, selectedFolder, onSelect, canCreate, onShareFolder }: Props) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState('#3b82f6');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');

  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  const createMut = useMutation({
    mutationFn: (data: { name: string; color: string }) => api.post('/vault/folders', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vault-folders'] }); setShowCreate(false); setFolderName(''); toast.success('Folder created'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const renameMut = useMutation({
    mutationFn: (data: { id: string; name: string }) => api.put(`/vault/folders/${data.id}`, { name: data.name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vault-folders'] }); setRenameId(null); toast.success('Folder renamed'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/vault/folders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vault-folders'] }); if (selectedFolder) onSelect(null); toast.success('Folder deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const handleDelete = (id: string) => {
    if (confirm('Delete this folder and all its credentials?')) deleteMut.mutate(id);
  };

  return (
    <div className="w-full md:w-60 space-y-1">
      <button onClick={() => onSelect(null)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${!selectedFolder ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary'}`}>
        <FolderClosed className="h-4 w-4" /> All Credentials
      </button>

      {folders.map((f) => (
        <div key={f.id} className="relative group">
          {renameId === f.id ? (
            <form onSubmit={e => { e.preventDefault(); renameMut.mutate({ id: f.id, name: renameName }); }} className="flex items-center gap-1 px-2 py-1">
              <input autoFocus value={renameName} onChange={e => setRenameName(e.target.value)} className="flex-1 px-2 py-1 rounded bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
              <button type="submit" className="text-xs text-primary px-1">Save</button>
              <button type="button" onClick={() => setRenameId(null)} className="text-xs text-muted-foreground px-1">✕</button>
            </form>
          ) : (
            <button onClick={() => onSelect(f.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedFolder === f.id ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary'}`}>
              <FolderClosed className="h-4 w-4" style={{ color: f.color || undefined }} />
              <span className="flex-1 text-left truncate">{f.name}</span>
              {f.credential_count !== undefined && <span className="text-[10px] bg-secondary rounded-full px-1.5 py-0.5">{f.credential_count}</span>}
              <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === f.id ? null : f.id); }} className="p-0.5 rounded hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </button>
          )}

          {menuOpen === f.id && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
              <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg bg-popover border border-border shadow-lg py-1 text-sm">
                <button onClick={() => { setRenameId(f.id); setRenameName(f.name); setMenuOpen(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-foreground">
                  <Pencil className="h-3.5 w-3.5" /> Rename
                </button>
                <button onClick={() => { onShareFolder(f.id); setMenuOpen(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-foreground">
                  <Share2 className="h-3.5 w-3.5" /> Share
                </button>
                <button onClick={() => { handleDelete(f.id); setMenuOpen(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {canCreate && (
        <button onClick={() => setShowCreate(true)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary border border-dashed border-border mt-2">
          <FolderPlus className="h-4 w-4" /> New Folder
        </button>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold">New Folder</h2>
            <input placeholder="Folder name *" value={folderName} onChange={e => setFolderName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {colors.map(c => (
                  <button key={c} onClick={() => setFolderColor(c)} className={`w-7 h-7 rounded-full border-2 transition-all ${folderColor === c ? 'border-primary scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => createMut.mutate({ name: folderName, color: folderColor })} disabled={createMut.isPending || !folderName.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
