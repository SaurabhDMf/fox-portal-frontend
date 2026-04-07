import { useEffect, useMemo, useState } from 'react';
import { X, Search, Check, Users, Building2, Trash2, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type SharePartyType = 'user' | 'client';

interface ShareTargetItem {
  id: string;
  name: string;
  email?: string;
  meta?: string;
  type: SharePartyType;
}

interface ExistingShare {
  id: string;
  name: string;
  email?: string;
  canEdit: boolean;
  type: SharePartyType;
}

interface Props {
  open: boolean;
  onClose: () => void;
  shareTarget: { type: 'folder' | 'credential'; id: string } | null;
}

const isTruthy = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';

const firstArray = (...values: unknown[]) => values.find(Array.isArray) as any[] | undefined;

const normalizeUsers = (payload: any): ShareTargetItem[] => {
  const raw = firstArray(payload?.data, payload?.users, payload?.data?.users, payload) || [];
  return raw
    .map((item: any) => ({
      id: String(item.id ?? ''),
      name: item.full_name || item.name || item.email || 'Unnamed user',
      email: item.email || undefined,
      meta: item.role || undefined,
      type: 'user' as const,
    }))
    .filter((item) => item.id);
};

const normalizeClients = (payload: any): ShareTargetItem[] => {
  const raw = firstArray(payload?.clients, payload?.data, payload?.data?.clients, payload) || [];
  return raw
    .map((item: any) => ({
      id: String(item.id ?? ''),
      name: item.company_name || item.full_name || item.name || item.email || 'Unnamed client',
      email: item.email || undefined,
      meta: item.client_type || item.status || undefined,
      type: 'client' as const,
    }))
    .filter((item) => item.id);
};

const normalizeShareRecord = (item: any, fallbackType?: SharePartyType): ExistingShare | null => {
  const type: SharePartyType = fallbackType || (item.client_id || item.company_name || item.client_name ? 'client' : 'user');
  const id = item.user_id || item.client_id || item.id;
  if (!id) return null;

  return {
    id: String(id),
    type,
    name: item.full_name || item.company_name || item.client_name || item.name || item.email || 'Unknown',
    email: item.email || undefined,
    canEdit: isTruthy(item.can_edit),
  };
};

const normalizeExistingShares = (payload: any): ExistingShare[] => {
  const nested = payload?.data || payload;
  const candidates = [
    ...(firstArray(nested?.shares, nested) || []).map((item) => normalizeShareRecord(item)),
    ...(firstArray(nested?.users, nested?.user_shares) || []).map((item) => normalizeShareRecord(item, 'user')),
    ...(firstArray(nested?.clients, nested?.client_shares) || []).map((item) => normalizeShareRecord(item, 'client')),
  ].filter(Boolean) as ExistingShare[];

  const unique = new Map<string, ExistingShare>();
  candidates.forEach((item) => unique.set(`${item.type}:${item.id}`, item));
  return Array.from(unique.values());
};

export default function VaultShareModal({ open, onClose, shareTarget }: Props) {
  const queryClient = useQueryClient();
  const supportsClients = shareTarget?.type === 'folder';
  const [activeTab, setActiveTab] = useState<SharePartyType>('user');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const resourceType = shareTarget?.type || 'folder';
  const resourceId = shareTarget?.id || '';
  const shareBasePath = resourceType === 'folder' ? `/vault/folders/${resourceId}` : `/vault/credentials/${resourceId}`;
  const sharesQueryKey = ['vault-shares', resourceType, resourceId];

  const { data: users = [] } = useQuery<ShareTargetItem[]>({
    queryKey: ['vault-users'],
    queryFn: () => api.get('/vault/users').then((response) => normalizeUsers(response.data)),
    enabled: open,
  });

  const { data: clients = [] } = useQuery<ShareTargetItem[]>({
    queryKey: ['vault-clients'],
    queryFn: () => api.get('/clients').then((response) => normalizeClients(response.data)),
    enabled: open && supportsClients,
  });

  const { data: existingShares = [], isLoading: loadingShares } = useQuery<ExistingShare[]>({
    queryKey: sharesQueryKey,
    queryFn: () => api.get(`${shareBasePath}/shares`).then((response) => normalizeExistingShares(response.data)),
    enabled: open && !!resourceId,
  });

  useEffect(() => {
    if (!open) return;
    setActiveTab('user');
    setSearch('');
    setSelectedId(null);
    setCanEdit(false);
  }, [open, resourceId]);

  const currentItems = activeTab === 'user' ? users : clients;

  const filteredItems = useMemo(() => {
    const sharedIds = new Set(existingShares.filter((item) => item.type === activeTab).map((item) => item.id));
    const term = search.trim().toLowerCase();

    return currentItems.filter((item) => {
      if (sharedIds.has(item.id)) return false;
      if (!term) return true;
      return item.name.toLowerCase().includes(term) || (item.email || '').toLowerCase().includes(term);
    });
  }, [activeTab, currentItems, existingShares, search]);

  const handleShare = async () => {
    if (!selectedId) return;
    setSharing(true);

    try {
      const payload = activeTab === 'client'
        ? { client_ids: [selectedId], can_edit: canEdit }
        : { user_ids: [selectedId], can_edit: canEdit };

      await api.post(`${shareBasePath}/share`, payload);
      toast.success(`${activeTab === 'client' ? 'Client' : 'User'} shared successfully`);
      setSelectedId(null);
      setCanEdit(false);
      queryClient.invalidateQueries({ queryKey: sharesQueryKey });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const handleRemove = async (share: ExistingShare) => {
    const removingId = `${share.type}:${share.id}`;
    setRemovingKey(removingId);

    try {
      await api.delete(`${shareBasePath}/shares/${share.id}`);
      toast.success('Share removed');
      queryClient.invalidateQueries({ queryKey: sharesQueryKey });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove share');
    } finally {
      setRemovingKey(null);
    }
  };

  if (!open || !shareTarget) return null;

  const title = resourceType === 'folder' ? 'Share Folder' : 'Share Credential';
  const emptyLabel = activeTab === 'client' ? 'clients' : 'users';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary" aria-label="Close share dialog">
            <X className="h-4 w-4" />
          </button>
        </div>

        {supportsClients && (
          <div className="flex rounded-lg bg-secondary p-1 gap-1">
            <button
              onClick={() => { setActiveTab('user'); setSelectedId(null); setSearch(''); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'user' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Users className="h-4 w-4" /> Users
            </button>
            <button
              onClick={() => { setActiveTab('client'); setSelectedId(null); setSearch(''); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'client' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Building2 className="h-4 w-4" /> Clients
            </button>
          </div>
        )}

        {loadingShares ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : existingShares.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Currently Shared With</p>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {existingShares.map((share) => {
                const key = `${share.type}:${share.id}`;
                return (
                  <div key={key} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/50">
                    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                      {share.type === 'client' ? <Building2 className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{share.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[share.email, share.type === 'client' ? 'Client' : 'User'].filter(Boolean).join(' • ')}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${share.canEdit ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-secondary text-muted-foreground'}`}>
                      {share.canEdit ? 'Can Edit' : 'View Only'}
                    </span>
                    <button
                      onClick={() => handleRemove(share)}
                      disabled={removingKey === key}
                      className="p-1 rounded-md hover:bg-destructive/10 text-destructive disabled:opacity-50"
                      title="Remove share"
                    >
                      {removingKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-2 flex-1 min-h-0">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Add {activeTab === 'client' ? 'Client' : 'User'}
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${emptyLabel}...`}
              className="w-full pl-10 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="max-h-44 overflow-y-auto space-y-1">
            {filteredItems.map((item) => (
              <div
                key={`${item.type}:${item.id}`}
                onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedId === item.id ? 'bg-primary/10' : 'hover:bg-secondary'}`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedId === item.id ? 'bg-primary border-primary' : 'border-border'}`}>
                  {selectedId === item.id && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{[item.email, item.meta].filter(Boolean).join(' • ')}</div>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">No {emptyLabel} available</div>
            )}
          </div>
        </div>

        {selectedId && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Permission:</span>
            <button
              onClick={() => setCanEdit((value) => !value)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${canEdit ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-secondary text-muted-foreground'}`}
            >
              {canEdit ? 'Can Edit' : 'View Only'}
            </button>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button
            onClick={handleShare}
            disabled={sharing || !selectedId}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {sharing ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}
