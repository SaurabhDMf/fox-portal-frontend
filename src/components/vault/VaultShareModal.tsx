import { useState, useEffect } from 'react';
import { X, Search, Check, Users, Trash2, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface ShareUser {
  id: string;
  full_name?: string;
  email: string;
  role?: string;
}

interface ExistingShare {
  user_id: string;
  full_name?: string;
  email?: string;
  can_edit: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  shareTarget: { type: 'folder' | 'credential'; id: string } | null;
}

export default function VaultShareModal({ open, onClose, shareTarget }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const resourceType = shareTarget?.type || 'folder';
  const resourceId = shareTarget?.id || '';

  const sharesQueryKey = ['vault-shares', resourceType, resourceId];

  const { data: users = [] } = useQuery<ShareUser[]>({
    queryKey: ['vault-users'],
    queryFn: () => api.get('/vault/users').then(r => {
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : d?.users || [];
    }),
    enabled: open,
  });

  const { data: existingShares = [], isLoading: loadingShares } = useQuery<ExistingShare[]>({
    queryKey: sharesQueryKey,
    queryFn: () => {
      const endpoint = resourceType === 'folder'
        ? `/vault/folders/${resourceId}/shares`
        : `/vault/credentials/${resourceId}/shares`;
      return api.get(endpoint).then(r => {
        const d = r.data?.data || r.data;
        return Array.isArray(d) ? d : [];
      });
    },
    enabled: open && !!resourceId,
  });

  useEffect(() => {
    if (open) { setSearch(''); setSelectedId(null); setCanEdit(false); }
  }, [open]);

  if (!open || !shareTarget) return null;

  const sharedUserIds = new Set(existingShares.map(s => s.user_id));
  const availableUsers = users.filter(u => !sharedUserIds.has(u.id));
  const filtered = availableUsers.filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (u.full_name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s);
  });

  const handleShare = async () => {
    if (!selectedId) return;
    setSharing(true);
    try {
      const endpoint = resourceType === 'folder'
        ? `/vault/folders/${resourceId}/share`
        : `/vault/credentials/${resourceId}/share`;
      await api.post(endpoint, { user_ids: [selectedId], can_edit: canEdit });
      toast.success('Shared successfully');
      setSelectedId(null);
      setCanEdit(false);
      queryClient.invalidateQueries({ queryKey: sharesQueryKey });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    try {
      const endpoint = resourceType === 'folder'
        ? `/vault/folders/${resourceId}/shares/${userId}`
        : `/vault/credentials/${resourceId}/shares/${userId}`;
      await api.delete(endpoint);
      toast.success('Share removed');
      queryClient.invalidateQueries({ queryKey: sharesQueryKey });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to remove share');
    } finally {
      setRemovingId(null);
    }
  };

  const title = resourceType === 'folder' ? 'Share Folder' : 'Share Credential';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {/* Existing shares */}
        {existingShares.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Currently Shared With</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {existingShares.map(share => (
                <div key={share.user_id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/50">
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-medium text-primary">
                    {(share.full_name || share.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{share.full_name || share.email}</div>
                    {share.email && share.full_name && <div className="text-xs text-muted-foreground truncate">{share.email}</div>}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${share.can_edit ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-secondary text-muted-foreground'}`}>
                    {share.can_edit ? 'Can Edit' : 'View Only'}
                  </span>
                  <button
                    onClick={() => handleRemove(share.user_id)}
                    disabled={removingId === share.user_id}
                    className="p-1 rounded-md hover:bg-destructive/10 text-destructive disabled:opacity-50"
                    title="Remove"
                  >
                    {removingId === share.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {loadingShares && (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Add new share */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Add People</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-10 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filtered.map(user => (
              <div
                key={user.id}
                onClick={() => setSelectedId(selectedId === user.id ? null : user.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedId === user.id ? 'bg-primary/10' : 'hover:bg-secondary'}`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedId === user.id ? 'bg-primary border-primary' : 'border-border'}`}>
                  {selectedId === user.id && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{user.full_name || user.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}{user.role ? ` • ${user.role}` : ''}</div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-center py-4 text-sm text-muted-foreground">No users available</div>}
          </div>
        </div>

        {/* Permission toggle + submit */}
        {selectedId && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Permission:</span>
            <button
              onClick={() => setCanEdit(!canEdit)}
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
