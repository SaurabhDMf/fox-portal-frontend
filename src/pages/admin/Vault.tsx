import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { useModulePermission } from '@/hooks/usePermission';
import { dummyVaultFolders, dummyVaultCreds } from '@/lib/dummyData';
import VaultFolderSidebar from '@/components/vault/VaultFolderSidebar';
import VaultCredentialCard from '@/components/vault/VaultCredentialCard';
import VaultCredentialModal, { type CredentialForm } from '@/components/vault/VaultCredentialModal';
import VaultShareModal from '@/components/vault/VaultShareModal';

const categoryOptions = ['All', 'Login', 'API Key', 'Database', 'SSH', 'Social Media', 'Finance', 'Dev Tools', 'Email', 'CRM', 'Other'];

export default function Vault() {
  const perm = useModulePermission('vault');
  const qc = useQueryClient();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [editCred, setEditCred] = useState<any>(null);
  const [shareTarget, setShareTarget] = useState<{ type: 'folder' | 'credential'; id: string } | null>(null);

  const { data: folders = [] } = useQuery({
    queryKey: ['vault-folders'],
    queryFn: () => api.get('/vault/folders').then(r => r.data?.folders || r.data || []),
  });

  const { data: creds = [] } = useQuery({
    queryKey: ['vault-creds', selectedFolder, search],
    queryFn: () => api.get('/vault/credentials', {
      params: { folder_id: selectedFolder || undefined, search: search || undefined },
    }).then(r => r.data?.credentials || r.data || []),
  });

  const createMut = useMutation({
    mutationFn: (d: CredentialForm) => api.post('/vault/credentials', { ...d, folder_id: d.folder_id || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vault-creds'] }); qc.invalidateQueries({ queryKey: ['vault-folders'] }); setShowCreate(false); toast.success('Credential saved'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const editMut = useMutation({
    mutationFn: (d: CredentialForm & { id: string }) => api.put(`/vault/credentials/${d.id}`, { ...d, folder_id: d.folder_id || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vault-creds'] }); setEditCred(null); toast.success('Credential updated'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/vault/credentials/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vault-creds'] }); qc.invalidateQueries({ queryKey: ['vault-folders'] }); toast.success('Credential deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const shareMut = useMutation({
    mutationFn: (data: { type: 'folder' | 'credential'; id: string; user_ids: string[]; can_edit: boolean[] }) => {
      const endpoint = data.type === 'folder' ? `/vault/folders/${data.id}/share` : `/vault/credentials/${data.id}/share`;
      return api.post(endpoint, { user_ids: data.user_ids, can_edit: data.can_edit[0] ?? false });
    },
    onSuccess: () => { setShareTarget(null); toast.success('Shared successfully'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const handleDelete = (id: string) => {
    if (confirm('Delete this credential permanently?')) deleteMut.mutate(id);
  };

  const rawFolders = Array.isArray(folders) ? folders : [];
  const foldersArr = rawFolders.length > 0 ? rawFolders : dummyVaultFolders;
  const rawCreds = Array.isArray(creds) ? creds : [];
  const credsArr = (rawCreds.length > 0 ? rawCreds : dummyVaultCreds).filter((c: any) => {
    if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;
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

      {/* Top bar: Search + Category filter */}
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

      {/* Main layout */}
      <div className="flex gap-4 flex-col md:flex-row">
        <VaultFolderSidebar
          folders={foldersArr}
          selectedFolder={selectedFolder}
          onSelect={setSelectedFolder}
          canCreate={perm.canCreate}
          onShareFolder={(id) => setShareTarget({ type: 'folder', id })}
        />

        <div className="flex-1 space-y-3">
          {credsArr.length > 0 ? credsArr.map((cred: any) => (
            <VaultCredentialCard
              key={cred.id}
              cred={cred}
              onEdit={(c) => setEditCred(c)}
              onShare={(id) => setShareTarget({ type: 'credential', id })}
              onDelete={handleDelete}
              canEdit={perm.canEdit}
              canDelete={perm.canDelete}
            />
          )) : (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <p>No credentials found</p>
              {perm.canCreate && <button onClick={() => setShowCreate(true)} className="mt-2 text-primary hover:underline text-sm">Add your first credential</button>}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      <VaultCredentialModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => createMut.mutate(data)}
        isPending={createMut.isPending}
        folders={foldersArr}
      />

      {/* Edit modal */}
      <VaultCredentialModal
        open={!!editCred}
        onClose={() => setEditCred(null)}
        onSubmit={(data) => editMut.mutate({ ...data, id: editCred?.id })}
        isPending={editMut.isPending}
        folders={foldersArr}
        initial={editCred}
        isEdit
      />

      {/* Share modal */}
      <VaultShareModal
        open={!!shareTarget}
        onClose={() => setShareTarget(null)}
        onSubmit={(ids, canEdit, shareType) => shareTarget && shareMut.mutate({ type: shareTarget.type, id: shareTarget.id, user_ids: ids, can_edit: canEdit })}
        isPending={shareMut.isPending}
        title={shareTarget?.type === 'folder' ? 'Share Folder' : 'Share Credential'}
      />
    </div>
  );
}
