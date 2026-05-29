import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { X, UserPlus, Trash2, LogOut, Download, Image as ImageIcon, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import toast from 'react-hot-toast';
import UserPicker from '@/components/projects/UserPicker';
import StatusDot from '@/components/chat/StatusDot';
import StatusBadge from '@/components/chat/StatusBadge';

interface Props {
  roomId: string;
  onClose: () => void;
}

export default function ChatRoomInfo({ roomId, onClose }: Props) {
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();
  const [tab, setTab] = useState<'members' | 'media' | 'files'>('members');
  const [showAddMember, setShowAddMember] = useState(false);

  const { data: room } = useQuery({
    queryKey: ['chat-room-detail', roomId],
    queryFn: () => api.get(`/chat/rooms/${roomId}`).then(r => r.data?.data || r.data),
  });

  const { data: media = [] } = useQuery({
    queryKey: ['chat-media', roomId],
    queryFn: () => api.get(`/chat/rooms/${roomId}/media`).then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || [];
    }),
    enabled: tab === 'media',
  });

  const { data: files = [] } = useQuery({
    queryKey: ['chat-files', roomId],
    queryFn: () => api.get(`/chat/rooms/${roomId}/files`).then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || [];
    }),
    enabled: tab === 'files',
  });

  const addMemberMut = useMutation({
    mutationFn: (userIds: string[]) => api.post(`/chat/rooms/${roomId}/members`, { user_ids: userIds }),
    onSuccess: () => {
      toast.success('Member added');
      qc.invalidateQueries({ queryKey: ['chat-room-detail', roomId] });
      setShowAddMember(false);
    },
    onError: () => toast.error('Failed to add member'),
  });

  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  const removeMemberMut = useMutation({
    mutationFn: (uid: string) => api.delete(`/chat/rooms/${roomId}/members/${uid}`),
    onSuccess: (_res, uid) => {
      toast.success(uid === user?.id ? 'Left room' : 'Member removed');
      qc.invalidateQueries({ queryKey: ['chat-room-detail', roomId] });
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      setConfirmRemove(null);
      if (uid === user?.id) onClose();
    },
  });



  const members = room?.members || [];
  const isAdmin = Number(members.find((m: any) => m.user_id === user?.id)?.is_admin) === 1
    || room?.created_by === user?.id
    || user?.role === 'admin'
    || user?.role === 'super_admin';

  const tabs = [
    { key: 'members' as const, label: 'Members' },
    { key: 'media' as const, label: 'Media' },
    { key: 'files' as const, label: 'Files' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm">Room Info</h3>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
      </div>

      {/* Room name */}
      <div className="px-4 py-3 border-b border-border">
        <h4 className="font-medium text-base">{room?.name || 'Chat Room'}</h4>
        {room?.description && <p className="text-xs text-muted-foreground mt-1">{room.description}</p>}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === t.key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        {tab === 'members' && (
          <div className="p-3 space-y-1">
            {isAdmin && (
              <div className="mb-2">
                {showAddMember ? (
                  <div className="space-y-2">
                    <UserPicker
                      value={null}
                      onChange={(_id, u) => { if (u) addMemberMut.mutate([u.id]); }}
                      placeholder="Select user to add..."
                    />
                    <button onClick={() => setShowAddMember(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setShowAddMember(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/15 transition-colors">
                    <UserPlus className="h-3.5 w-3.5" /> Add Members
                  </button>
                )}
              </div>
            )}
            {members.map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/50 group">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: `hsl(${Math.abs(hashStr(m.full_name || '')) % 360}, 60%, 45%)`, color: '#fff' }}>
                    {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : (m.full_name?.[0] || '?').toUpperCase()}
                  </div>
                  <StatusDot status={m.status} className="absolute -bottom-0.5 -right-0.5 w-2 h-2" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{m.full_name || m.email}</span>
                    <StatusBadge
                      status={m.status ?? 'offline'}
                      statusText={m.status_text}
                      showLabel={m.status !== 'online'}
                      size="xs"
                    />
                  </div>
                  {m.job_title && <span className="text-[10px] text-muted-foreground truncate block">{m.job_title}</span>}
                  {Number(m.is_admin) === 1 && <span className="text-[10px] text-primary font-medium">Admin</span>}
                </div>
                {isAdmin && m.id !== user?.id && (
                  <button onClick={() => setConfirmRemove({ id: m.id, name: m.full_name || m.email || 'this member' })}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive transition-all">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => setConfirmRemove({ id: user?.id || '', name: 'yourself' })}
              className="w-full flex items-center gap-2 px-3 py-2 mt-3 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut className="h-3.5 w-3.5" /> Leave Room
            </button>
          </div>
        )}

        {tab === 'media' && (
          <div className="p-3">
            {(media as any[]).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No media shared yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {(media as any[]).map((item: any) => (
                  <a key={item.id} href={item.file_url} target="_blank" rel="noreferrer"
                    className="aspect-square rounded-lg overflow-hidden bg-secondary">
                    <img src={item.file_url} alt="" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'files' && (
          <div className="p-3 space-y-1">
            {(files as any[]).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No files shared yet</p>
              </div>
            ) : (
              (files as any[]).map((f: any) => (
                <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{f.file_name}</div>
                    <div className="text-[10px] text-muted-foreground">{f.sender_name} • {f.created_at ? new Date(f.created_at).toLocaleDateString() : ''}</div>
                  </div>
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              ))
            )}
          </div>
        )}
      </ScrollArea>

      {/* Remove/Leave Confirmation */}
      {confirmRemove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setConfirmRemove(null)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-sm p-6 space-y-4 shadow-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">
              {confirmRemove.id === user?.id ? 'Leave Room' : 'Remove Member'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {confirmRemove.id === user?.id
                ? 'Are you sure you want to leave this room? You will no longer receive messages.'
                : `Are you sure you want to remove ${confirmRemove.name} from this room?`}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmRemove(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button
                onClick={() => removeMemberMut.mutate(confirmRemove.id)}
                disabled={removeMemberMut.isPending}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {removeMemberMut.isPending ? 'Removing...' : confirmRemove.id === user?.id ? 'Leave' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}
