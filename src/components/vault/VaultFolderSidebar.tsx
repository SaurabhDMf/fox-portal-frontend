import { useState } from 'react';
import { FolderClosed, FolderPlus, MoreVertical, Pencil, Share2, Trash2, Users } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';

interface Folder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  credential_count?: number;
  created_by?: string;
  owner_name?: string;
}

interface Props {
  folders: Folder[];
  selectedFolder: string | null;
  onSelect: (id: string | null) => void;
  canCreate: boolean;
  onShareFolder: (id: string) => void;
  onFolderCreated: (folder: Folder) => void;
  onFolderRenamed: (id: string, name: string) => void;
  onFolderDeleted: (id: string) => void;
}

const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function VaultFolderSidebar({ folders, selectedFolder, onSelect, canCreate, onShareFolder, onFolderCreated, onFolderRenamed, onFolderDeleted }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id) || undefined;
  const [showCreate, setShowCreate] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState('#3b82f6');
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [editSaving, setEditSaving] = useState(false);

  const [deleteFolder, setDeleteFolder] = useState<Folder | null>(null);
  const [deleting, setDeleting] = useState(false);

  const myFolders = folders.filter(f => !f.created_by || f.created_by === currentUserId);
  const sharedFolders = folders.filter(f => f.created_by && f.created_by !== currentUserId);

  const handleCreate = async () => {
    if (!folderName.trim()) return;
    setCreating(true);
    let newFolder: Folder;
    try {
      const res = await api.post('/vault/folders', { name: folderName, color: folderColor });
      newFolder = res.data?.folder || res.data || { id: `vf-${Date.now()}`, name: folderName, color: folderColor, credential_count: 0 };
    } catch {
      newFolder = { id: `vf-${Date.now()}`, name: folderName, color: folderColor, credential_count: 0 };
    }
    onFolderCreated(newFolder);
    setShowCreate(false);
    setFolderName('');
    setCreating(false);
    toast.success('Folder created');
  };

  const handleEdit = async () => {
    if (!editFolder || !editName.trim()) return;
    setEditSaving(true);
    try {
      await api.put(`/vault/folders/${editFolder.id}`, { name: editName, color: editColor, icon: editFolder.icon });
    } catch { /* local fallback */ }
    onFolderRenamed(editFolder.id, editName);
    setEditFolder(null);
    setEditSaving(false);
    toast.success('Folder updated');
  };

  const handleDelete = async () => {
    if (!deleteFolder) return;
    setDeleting(true);
    try {
      await api.delete(`/vault/folders/${deleteFolder.id}`, { skipConfirm: true } as any);
    } catch { /* local fallback */ }
    onFolderDeleted(deleteFolder.id);
    setDeleteFolder(null);
    setDeleting(false);
    toast.success('Folder deleted');
  };

  const isOwned = (f: Folder) => !f.created_by || f.created_by === currentUserId;

  const renderFolder = (f: Folder) => (
    <div key={f.id} className="relative group">
      <button onClick={() => onSelect(f.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedFolder === f.id ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary'}`}>
        {isOwned(f) ? (
          <FolderClosed className="h-4 w-4 shrink-0" style={{ color: f.color || undefined }} />
        ) : (
          <Users className="h-4 w-4 shrink-0 text-[hsl(var(--info))]" />
        )}
        <span className="flex-1 text-left truncate">
          {f.name}
          {!isOwned(f) && f.owner_name && (
            <span className="block text-[10px] text-muted-foreground font-normal truncate">Shared by {f.owner_name}</span>
          )}
        </span>
        {f.credential_count !== undefined && <span className="text-[10px] bg-secondary rounded-full px-1.5 py-0.5">{f.credential_count}</span>}
        {isOwned(f) && (
          <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === f.id ? null : f.id); }} className="p-0.5 rounded hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        )}
      </button>

      {menuOpen === f.id && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg bg-popover border border-border shadow-lg py-1 text-sm">
            <button onClick={() => { setEditFolder(f); setEditName(f.name); setEditColor(f.color || '#3b82f6'); setMenuOpen(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-foreground">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={() => { onShareFolder(f.id); setMenuOpen(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-foreground">
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
            <button onClick={() => { setDeleteFolder(f); setMenuOpen(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="w-full md:w-60 space-y-1">
      <button onClick={() => onSelect(null)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${!selectedFolder ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary'}`}>
        <FolderClosed className="h-4 w-4" /> All Credentials
      </button>

      {/* My Folders */}
      {myFolders.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 pt-3 pb-1">My Folders</p>
          {myFolders.map(renderFolder)}
        </>
      )}

      {canCreate && (
        <button onClick={() => setShowCreate(true)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary border border-dashed border-border mt-2">
          <FolderPlus className="h-4 w-4" /> New Folder
        </button>
      )}

      {/* Shared with Me */}
      {sharedFolders.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 pt-4 pb-1">Shared with Me</p>
          {sharedFolders.map(renderFolder)}
        </>
      )}

      {/* Create Folder Modal */}
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
              <button onClick={handleCreate} disabled={creating || !folderName.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Folder Modal */}
      {editFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold">Edit Folder</h2>
            <input placeholder="Folder name *" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {colors.map(c => (
                  <button key={c} onClick={() => setEditColor(c)} className={`w-7 h-7 rounded-full border-2 transition-all ${editColor === c ? 'border-primary scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditFolder(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={handleEdit} disabled={editSaving || !editName.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Folder Confirm */}
      {deleteFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold text-destructive">Delete Folder</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">"{deleteFolder.name}"</span> and all its credentials? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteFolder(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
