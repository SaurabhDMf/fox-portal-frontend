import { useState, useCallback, useEffect } from 'react';
import { Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useModulePermission } from '@/hooks/usePermission';
import VaultFolderSidebar from '@/components/vault/VaultFolderSidebar';
import VaultCredentialCard from '@/components/vault/VaultCredentialCard';
import VaultCredentialModal, { type CredentialForm } from '@/components/vault/VaultCredentialModal';
import VaultShareModal from '@/components/vault/VaultShareModal';
import VaultDetailPanel from '@/components/vault/VaultDetailPanel';
import api from '@/lib/api';

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
  username?: string;
  url?: string;
  category?: string;
  notes?: string;
  folder_id?: string;
  item_type?: string;
  is_owner?: boolean | number;
  shared_can_edit?: boolean | number;
  is_favorite?: boolean | number;
  is_trashed?: boolean | number;
  password_strength?: string;
}

export default function Vault() {
  const perm = useModulePermission('vault');
  const [folders, setFolders]         = useState<VaultFolder[]>([]);
  const [creds, setCreds]             = useState<VaultCred[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [selectedCred, setSelectedCred] = useState<VaultCred | null>(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [editCred, setEditCred]       = useState<any>(null);
  const [shareTarget, setShareTarget] = useState<{ type: 'folder' | 'credential'; id: string } | null>(null);
  const [savingCred, setSavingCred]   = useState(false);

  const isInTrash     = selectedFolder === '__trash__';
  const isInFavorites = selectedFolder === '__favorites__';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [fRes, cRes] = await Promise.all([
          api.get('/vault/folders'),
          api.get('/vault/credentials'),
        ]);
        const fData = fRes.data?.data || fRes.data?.folders || fRes.data || [];
        const cData = cRes.data?.data || cRes.data?.credentials || cRes.data || [];
        const fArr: VaultFolder[] = Array.isArray(fData) ? fData : [];
        const cArr: VaultCred[]   = Array.isArray(cData) ? cData : [];
        setFolders(fArr.map(f => ({ ...f, credential_count: cArr.filter(c => c.folder_id === f.id).length })));
        setCreds(cArr);
      } catch {
        setFolders([]); setCreds([]);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  // Re-fetch when switching to trash/favorites (those need ?view= param)
  useEffect(() => {
    const loadView = async () => {
      if (!isInTrash && !isInFavorites) return;
      try {
        const view = isInTrash ? 'trash' : 'favorites';
        const res  = await api.get(`/vault/credentials?view=${view}`);
        const data = res.data?.data || res.data?.credentials || res.data || [];
        setCreds(Array.isArray(data) ? data : []);
      } catch {}
    };
    loadView();
  }, [selectedFolder]);

  const recount = useCallback((allCreds: VaultCred[], allFolders: VaultFolder[]) =>
    allFolders.map(f => ({ ...f, credential_count: allCreds.filter(c => c.folder_id === f.id).length }))
  , []);

  const handleFolderCreated  = useCallback((f: VaultFolder) => setFolders(prev => recount(creds, [...prev, f])), [creds, recount]);
  const handleFolderRenamed  = useCallback((id: string, name: string) => setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f)), []);
  const handleFolderDeleted  = useCallback((id: string) => {
    setCreds(prev => { const next = prev.filter(c => c.folder_id !== id); setFolders(fp => recount(next, fp.filter(f => f.id !== id))); return next; });
    if (selectedFolder === id) setSelectedFolder(null);
  }, [selectedFolder, recount]);

  const handleSelectFolder = useCallback((id: string | null) => {
    setSelectedFolder(id);
    setSelectedCred(null);
    setSearch('');
    // reload normal creds when switching back from trash/favorites
    if (id !== '__trash__' && id !== '__favorites__') {
      api.get('/vault/credentials').then(res => {
        const data = res.data?.data || res.data?.credentials || res.data || [];
        setCreds(Array.isArray(data) ? data : []);
      }).catch(() => {});
    }
  }, []);

  const handleCreateCred = useCallback(async (data: CredentialForm) => {
    setSavingCred(true);
    try {
      const res = await api.post('/vault/credentials', { ...data, folder_id: data.folder_id || undefined });
      const newCred = res.data?.credential || res.data;
      if (newCred?.id) {
        setCreds(prev => { const next = [...prev, newCred]; setFolders(fp => recount(next, fp)); return next; });
      }
      setShowCreate(false);
      toast.success('Credential saved');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to save'); }
    finally { setSavingCred(false); }
  }, [recount]);

  const handleEditCred = useCallback(async (data: CredentialForm) => {
    if (!editCred) return;
    setSavingCred(true);
    try {
      const res = await api.put(`/vault/credentials/${editCred.id}`, { ...data, folder_id: data.folder_id || undefined });
      const updated = res.data?.credential || res.data || { ...editCred, ...data };
      setCreds(prev => { const next = prev.map(c => c.id === editCred.id ? { ...c, ...updated } : c); setFolders(fp => recount(next, fp)); return next; });
      if (selectedCred?.id === editCred.id) setSelectedCred(c => c ? { ...c, ...updated } : c);
      setEditCred(null);
      toast.success('Credential updated');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to update'); }
    finally { setSavingCred(false); }
  }, [editCred, recount, selectedCred]);

  const handleTrash = useCallback(async (id: string) => {
    try {
      await api.patch(`/vault/credentials/${id}/trash`);
      setCreds(prev => { const next = prev.filter(c => c.id !== id); setFolders(fp => recount(next, fp)); return next; });
      if (selectedCred?.id === id) setSelectedCred(null);
      toast.success('Moved to trash');
    } catch { toast.error('Failed to trash'); }
  }, [recount, selectedCred]);

  const handleRestore = useCallback(async (id: string) => {
    try {
      await api.patch(`/vault/credentials/${id}/restore`);
      setCreds(prev => prev.filter(c => c.id !== id));
      if (selectedCred?.id === id) setSelectedCred(null);
      toast.success('Restored from trash');
    } catch { toast.error('Failed to restore'); }
  }, [selectedCred]);

  const handleFavorite = useCallback(async (id: string) => {
    try {
      const res = await api.patch(`/vault/credentials/${id}/favorite`);
      const isFav = Boolean(res.data?.is_favorite);
      setCreds(prev => prev.map(c => c.id === id ? { ...c, is_favorite: isFav } : c));
      if (selectedCred?.id === id) setSelectedCred(c => c ? { ...c, is_favorite: isFav } : c);
      toast.success(isFav ? 'Added to favorites' : 'Removed from favorites');
    } catch { toast.error('Failed to update favorite'); }
  }, [selectedCred]);

  const handlePermanentDelete = useCallback(async (id: string) => {
    try {
      await api.delete(`/vault/credentials/${id}`);
      setCreds(prev => prev.filter(c => c.id !== id));
      if (selectedCred?.id === id) setSelectedCred(null);
      toast.success('Permanently deleted');
    } catch { toast.error('Failed to delete'); }
  }, [selectedCred]);

  const filteredCreds = creds.filter(c => {
    if (isInTrash)     return Boolean(c.is_trashed);
    if (isInFavorites) return Boolean(c.is_favorite) && !c.is_trashed;
    if (selectedFolder) return c.folder_id === selectedFolder && !c.is_trashed;
    if (!c.is_trashed) {
      if (search) {
        const s = search.toLowerCase();
        return c.title.toLowerCase().includes(s) || (c.username || '').toLowerCase().includes(s) || (c.url || '').toLowerCase().includes(s);
      }
      return true;
    }
    return false;
  }).filter(c => !search || isInTrash || isInFavorites ? true :
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.url || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Header */}
      <div className="page-header flex-shrink-0">
        <div>
          <h1 className="page-title">Password Manager</h1>
          <p className="page-subtitle">Securely manage and share credentials</p>
        </div>
        {perm.canCreate && !isInTrash && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> Add
          </button>
        )}
      </div>

      {/* Body: sidebar | list | detail */}
      <div className="flex flex-1 min-h-0 gap-0">

        {/* Sidebar */}
        <div className="w-52 flex-shrink-0 border-r border-border overflow-y-auto pr-2 py-2">
          <VaultFolderSidebar
            folders={folders}
            selectedFolder={selectedFolder}
            onSelect={handleSelectFolder}
            canCreate={perm.canCreate}
            onShareFolder={id => setShareTarget({ type: 'folder', id })}
            onFolderCreated={handleFolderCreated}
            onFolderRenamed={handleFolderRenamed}
            onFolderDeleted={handleFolderDeleted}
          />
        </div>

        {/* Credential list */}
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-border flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full pl-8 pr-7 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Count label */}
          <div className="px-3 py-1.5 flex-shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
              {isInTrash ? 'Trash' : isInFavorites ? 'Favorites' : selectedFolder ? folders.find(f => f.id === selectedFolder)?.name || 'Folder' : 'All Items'} · {filteredCreds.length}
            </span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {loading ? (
              [...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-secondary animate-pulse" />)
            ) : filteredCreds.length > 0 ? filteredCreds.map(cred => (
              <VaultCredentialCard
                key={cred.id}
                cred={cred}
                selected={selectedCred?.id === cred.id}
                onClick={() => setSelectedCred(cred)}
                onFavorite={handleFavorite}
              />
            )) : (
              <div className="text-center py-12 text-muted-foreground text-sm px-4">
                {isInTrash ? 'Trash is empty' : isInFavorites ? 'No favorites yet' : 'No credentials found'}
                {perm.canCreate && !isInTrash && !isInFavorites && (
                  <button onClick={() => setShowCreate(true)} className="block mx-auto mt-2 text-primary hover:underline text-xs">
                    Add your first credential
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {selectedCred ? (
            <VaultDetailPanel
              cred={selectedCred}
              onEdit={c => setEditCred(c)}
              onTrash={isInTrash ? handlePermanentDelete : handleTrash}
              onRestore={isInTrash ? handleRestore : undefined}
              onShare={id => setShareTarget({ type: 'credential', id })}
              onFavorite={handleFavorite}
              onClose={() => setSelectedCred(null)}
              canEdit={perm.canEdit}
              canDelete={perm.canDelete}
              inTrash={isInTrash}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                <Search className="h-7 w-7 opacity-30" />
              </div>
              <p className="text-sm">Select an item to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
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
    </div>
  );
}
