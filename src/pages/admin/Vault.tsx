import { useState, useCallback, useEffect } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { useModulePermission } from '@/hooks/usePermission';
import VaultFolderSidebar from '@/components/vault/VaultFolderSidebar';
import VaultCredentialCard from '@/components/vault/VaultCredentialCard';
import VaultCredentialModal, { type CredentialForm } from '@/components/vault/VaultCredentialModal';
import VaultShareModal from '@/components/vault/VaultShareModal';
import api from '@/lib/api';

const categoryOptions = ['All', 'Login', 'API Key', 'Database', 'SSH', 'Social Media', 'Finance', 'Dev Tools', 'Email', 'CRM', 'Other'];

interface VaultFolder {
  id: string;
  name: string;
  color?: string;
  credential_count?: number;
  created_by?: string;
  owner_name?: string;
}

interface VaultCred {
  id: string;
  title: string;
  username: string;
  password?: string;
  url?: string;
  category?: string;
  notes?: string;
  folder_id?: string;
  is_owner?: boolean;
  shared_can_edit?: boolean;
  password_strength?: string;
}

export default function Vault() {
  const perm = useModulePermission('vault');
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [creds, setCreds] = useState<VaultCred[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [editCred, setEditCred] = useState<any>(null);
  const [shareTarget, setShareTarget] = useState<{ type: 'folder' | 'credential'; id: string } | null>(null);
  const [savingCred, setSavingCred] = useState(false);
  const [sharingPending, setSharingPending] = useState(false);

  // Load folders and credentials from API
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [fRes, cRes] = await Promise.all([
          api.get('/vault/folders'),
          api.get('/vault/credentials'),
        ]);
        const fData = fRes.data?.folders || fRes.data || [];
        const cData = cRes.data?.credentials || cRes.data || [];
        const fArr: VaultFolder[] = Array.isArray(fData) ? fData : [];
        const cArr: VaultCred[] = Array.isArray(cData) ? cData : [];
        // Recount
        setFolders(fArr.map(f => ({ ...f, credential_count: cArr.filter(c => c.folder_id === f.id).length })));
        setCreds(cArr);
      } catch {
        // API unavailable — start empty
        setFolders([]);
        setCreds([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const recount = useCallback((allCreds: VaultCred[], allFolders: VaultFolder[]) => {
    return allFolders.map(f => ({ ...f, credential_count: allCreds.filter(c => c.folder_id === f.id).length }));
  }, []);

  // --- Folder callbacks ---
  const handleFolderCreated = useCallback((folder: VaultFolder) => {
    setFolders(prev => recount(creds, [...prev, folder]));
  }, [creds, recount]);

  const handleFolderRenamed = useCallback((id: string, name: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
  }, []);

  const handleFolderDeleted = useCallback((id: string) => {
    setCreds(prev => {
      const next = prev.filter(c => c.folder_id !== id);
      setFolders(fPrev => recount(next, fPrev.filter(f => f.id !== id)));
      return next;
    });
    if (selectedFolder === id) setSelectedFolder(null);
  }, [selectedFolder, recount]);

  // --- Credential CRUD ---
  const handleCreateCred = useCallback(async (data: CredentialForm) => {
    setSavingCred(true);
    try {
      const res = await api.post('/vault/credentials', { ...data, folder_id: data.folder_id || undefined });
      const newCred = res.data?.credential || res.data;
      if (newCred?.id) {
        setCreds(prev => {
          const next = [...prev, newCred];
          setFolders(fPrev => recount(next, fPrev));
          return next;
        });
      }
      setShowCreate(false);
      toast.success('Credential saved');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save credential');
    } finally {
      setSavingCred(false);
    }
  }, [recount]);

  const handleEditCred = useCallback(async (data: CredentialForm) => {
    if (!editCred) return;
    setSavingCred(true);
    try {
      const res = await api.put(`/vault/credentials/${editCred.id}`, { ...data, folder_id: data.folder_id || undefined });
      const updated = res.data?.credential || res.data || { ...editCred, ...data };
      setCreds(prev => {
        const next = prev.map(c => c.id === editCred.id ? { ...c, ...updated, folder_id: data.folder_id || undefined } : c);
        setFolders(fPrev => recount(next, fPrev));
        return next;
      });
      setEditCred(null);
      toast.success('Credential updated');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update');
    } finally {
      setSavingCred(false);
    }
  }, [editCred, recount]);

  const [deleteCredId, setDeleteCredId] = useState<string | null>(null);
  const [deletingCred, setDeletingCred] = useState(false);

  const confirmDeleteCred = useCallback(async () => {
    if (!deleteCredId) return;
    setDeletingCred(true);
    try {
      await api.delete(`/vault/credentials/${deleteCredId}`);
      setCreds(prev => {
        const next = prev.filter(c => c.id !== deleteCredId);
        setFolders(fPrev => recount(next, fPrev));
        return next;
      });
      toast.success('Credential deleted');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleteCredId(null);
      setDeletingCred(false);
    }
  }, [deleteCredId, recount]);

  // Share logic is now handled inside VaultShareModal

  // --- Filtered credentials ---
  const filteredCreds = creds.filter(c => {
    if (selectedFolder && c.folder_id !== selectedFolder) return false;
    if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!c.title.toLowerCase().includes(s) && !c.username.toLowerCase().includes(s) && !(c.url || '').toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Password Vault</h1>
          <p className="page-subtitle">Securely manage and share credentials</p>
        </div>
        {perm.canCreate && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> Add Credential
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search across all folders..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-4 flex-col md:flex-row">
        <VaultFolderSidebar
          folders={folders}
          selectedFolder={selectedFolder}
          onSelect={setSelectedFolder}
          canCreate={perm.canCreate}
          onShareFolder={(id) => setShareTarget({ type: 'folder', id })}
          onFolderCreated={handleFolderCreated}
          onFolderRenamed={handleFolderRenamed}
          onFolderDeleted={handleFolderDeleted}
        />

        <div className="flex-1 space-y-3">
          {loading ? (
            [...Array(3)].map((_, i) => <div key={i} className="glass-card h-20 animate-pulse" />)
          ) : filteredCreds.length > 0 ? filteredCreds.map((cred) => (
            <VaultCredentialCard
              key={cred.id}
              cred={cred}
              onEdit={(c) => setEditCred(c)}
              onShare={(id) => setShareTarget({ type: 'credential', id })}
              onDelete={(id) => setDeleteCredId(id)}
              canEdit={perm.canEdit}
              canDelete={perm.canDelete}
            />
          )) : (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <p>No credentials found{selectedFolder ? ' in this folder' : ''}</p>
              {perm.canCreate && <button onClick={() => setShowCreate(true)} className="mt-2 text-primary hover:underline text-sm">Add your first credential</button>}
            </div>
          )}
        </div>
      </div>

      <VaultCredentialModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreateCred}
        isPending={savingCred}
        folders={folders}
      />

      <VaultCredentialModal
        open={!!editCred}
        onClose={() => setEditCred(null)}
        onSubmit={handleEditCred}
        isPending={savingCred}
        folders={folders}
        initial={editCred}
        isEdit
      />

      <VaultShareModal
        open={!!shareTarget}
        onClose={() => setShareTarget(null)}
        shareTarget={shareTarget}
      />

      {/* Delete Credential Confirm */}
      {deleteCredId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold text-destructive">Delete Credential</h2>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this credential permanently? This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteCredId(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={confirmDeleteCred} disabled={deletingCred} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {deletingCred ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
