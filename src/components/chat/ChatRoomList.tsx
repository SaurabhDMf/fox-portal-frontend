import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, MessageSquare, Search, Hash, User, Bell, ChevronDown, GripVertical, Pencil, Trash2, Check, X as XIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import StatusDot from '@/components/chat/StatusDot';
import StatusPicker from '@/components/chat/StatusPicker';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuthStore } from '@/stores/authStore';

interface ChatRoom {
  id: string;
  name: string | null;
  type: string;
  section_id?: string | null;
  avatar_url?: string;
  dm_other_user_name?: string;
  dm_other_user_avatar?: string;
  dm_other_user_status?: string;
  dm_other_user_status_text?: string;
  dm_other_user_status_emoji?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  member_count?: number;
}

interface ChatSection {
  id: string;
  name: string;
  is_default: boolean | number;
  default_type: 'Group' | '1-to-1' | null;
  collapsed: boolean | number;
  sort_order: number;
}

interface Props {
  activeRoom: string | null;
  onSelectRoom: (id: string) => void;
  onCreateGroup: () => void;
  onCreateDM: () => void;
  hideCreateGroup?: boolean;
}

function getDisplayName(room: ChatRoom) {
  return room.type === '1-to-1'
    ? (room.dm_other_user_name ?? 'Direct Message')
    : (room.name ?? 'Unnamed Room');
}

type DragState = { kind: 'section' | 'room'; id: string } | null;

export default function ChatRoomList({ activeRoom, onSelectRoom, onCreateGroup, onCreateDM, hideCreateGroup = false }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [drag, setDrag] = useState<DragState>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const user = useAuthStore(s => s.user);
  const [myStatus, setMyStatus] = useState('online');
  const [myStatusText, setMyStatusText] = useState('');
  const [myStatusEmoji, setMyStatusEmoji] = useState('');

  // Fetch own status on mount (mobile profile section)
  useEffect(() => {
    api.get('/users/me').then(r => {
      const d = r.data?.data || r.data;
      if (d?.status) setMyStatus(d.status);
      if (d?.status_text) setMyStatusText(d.status_text);
      if (d?.status_emoji) setMyStatusEmoji(d.status_emoji);
    }).catch(() => {});
  }, []);

  const handleStatusChange = (status: string, text: string, emoji: string) => {
    setMyStatus(status);
    setMyStatusText(text);
    setMyStatusEmoji(emoji);
  };

  const { data: rooms = [] } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: () => api.get('/chat/rooms').then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || d?.rooms || [];
    }),
    refetchInterval: 15000,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['chat-sections'],
    queryFn: () => api.get('/chat/sections').then(r => (r.data?.data || []) as ChatSection[]),
    staleTime: 30_000,
  });

  const typedRooms = rooms as ChatRoom[];
  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);
  const defaultSectionId = (type: string) =>
    sections.find(s => s.is_default && s.default_type === type)?.id;

  const toggleCollapsedMut = useMutation({
    mutationFn: ({ id, collapsed }: { id: string; collapsed: boolean }) =>
      api.put(`/chat/sections/${id}`, { collapsed }),
    onMutate: async ({ id, collapsed }) => {
      qc.setQueryData(['chat-sections'], (prev: ChatSection[] = []) =>
        prev.map(s => s.id === id ? { ...s, collapsed } : s));
    },
  });

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => api.put('/chat/sections/reorder', { ids }),
  });

  const createSectionMut = useMutation({
    mutationFn: (name: string) => api.post('/chat/sections', { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chat-sections'] }); setNewSectionName(''); setAddingSection(false); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Could not create section'),
  });

  const renameSectionMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.put(`/chat/sections/${id}`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-sections'] }),
  });

  const deleteSectionMut = useMutation({
    mutationFn: (id: string) => api.delete(`/chat/sections/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-sections'] });
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
    },
  });

  const moveRoomMut = useMutation({
    mutationFn: ({ roomId, sectionId }: { roomId: string; sectionId: string | null }) =>
      api.put(`/chat/rooms/${roomId}/section`, { section_id: sectionId }),
    onMutate: async ({ roomId, sectionId }) => {
      qc.setQueryData(['chat-rooms'], (prev: ChatRoom[] = []) =>
        prev.map(r => r.id === roomId ? { ...r, section_id: sectionId } : r));
    },
  });

  const reorderSections = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const ids = sortedSections.map(s => s.id);
    ids.splice(ids.indexOf(draggedId), 1);
    ids.splice(ids.indexOf(targetId), 0, draggedId);
    qc.setQueryData(['chat-sections'], (prev: ChatSection[] = []) =>
      ids.map((id, i) => ({ ...prev.find(s => s.id === id)!, sort_order: i })));
    reorderMut.mutate(ids);
  };

  // Prefetch messages for a room into the same react-query cache key
  // ChatMessageArea reads from, so opening it shows messages immediately
  // instead of a loading state. Options must mirror ChatMessageArea's
  // useQuery exactly (staleTime/gcTime) or the two disagree on freshness.
  const prefetchRoomMessages = (roomId: string) => {
    qc.prefetchQuery({
      queryKey: ['chat-messages', roomId],
      queryFn: () => api.get(`/chat/rooms/${roomId}/messages?limit=50`).then(r => r.data),
      staleTime: 30_000,
    });
  };

  // /chat/rooms has no server-side limit, so a heavy user could have dozens
  // of rooms — only preload the most recent ones on mount (already sorted
  // by activity by the backend); the rest get prefetched on hover instead.
  useEffect(() => {
    (rooms as ChatRoom[]).slice(0, 8).forEach(r => prefetchRoomMessages(r.id));
  }, [rooms]); // eslint-disable-line react-hooks/exhaustive-deps

  const matchesSearch = (r: ChatRoom) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = getDisplayName(r).toLowerCase();
    const lastMsg = r.last_message?.toLowerCase() || '';
    return name.includes(q) || lastMsg.includes(q);
  };

  const roomsBySection = new Map<string, ChatRoom[]>();
  for (const r of typedRooms) {
    if (!matchesSearch(r)) continue;
    const sid = r.section_id || defaultSectionId(r.type);
    if (!sid) continue; // sections not loaded yet
    if (!roomsBySection.has(sid)) roomsBySection.set(sid, []);
    roomsBySection.get(sid)!.push(r);
  }

  const totalVisible = [...roomsBySection.values()].reduce((n, arr) => n + arr.length, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Mobile user profile & status section */}
      <div className="md:hidden border-b border-border p-3">
        <div className="flex items-center gap-3">
          <StatusPicker
            currentStatus={myStatus}
            currentStatusText={myStatusText}
            currentStatusEmoji={myStatusEmoji}
            onStatusChange={handleStatusChange}
          >
            <button className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  : (user?.full_name?.[0] || 'U').toUpperCase()}
              </div>
              <StatusDot status={myStatus} className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5" />
            </button>
          </StatusPicker>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{user?.full_name}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {myStatusText
                ? `${myStatusEmoji} ${myStatusText}`
                : <span className="capitalize">{user?.role?.replace('_', ' ')}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-destructive" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-secondary border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {totalVisible === 0 && (
          <div className="text-center py-12 px-4">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">{search ? 'No results' : 'No conversations yet'}</p>
          </div>
        )}

        {sortedSections.map(section => {
          const sectionRooms = roomsBySection.get(section.id) || [];
          const unread = sectionRooms.filter(r => Number(r.unread_count) > 0).length;
          const isDefault = !!section.is_default;
          const onAdd = isDefault
            ? (section.default_type === 'Group' ? (!hideCreateGroup ? onCreateGroup : undefined) : onCreateDM)
            : undefined;
          return (
            <RoomSection
              key={section.id}
              title={section.name}
              unread={unread}
              onAdd={onAdd}
              addLabel={section.default_type === 'Group' ? 'New Group' : 'New Message'}
              collapsed={!!section.collapsed}
              onToggleCollapsed={() => toggleCollapsedMut.mutate({ id: section.id, collapsed: !section.collapsed })}
              dragging={drag?.kind === 'section' && drag.id === section.id}
              onSectionDragStart={() => setDrag({ kind: 'section', id: section.id })}
              onDragEnd={() => setDrag(null)}
              onDropOn={() => {
                if (!drag) return;
                if (drag.kind === 'section') reorderSections(drag.id, section.id);
                else moveRoomMut.mutate({ roomId: drag.id, sectionId: isDefault ? null : section.id });
                setDrag(null);
              }}
              isDefault={isDefault}
              onRename={name => renameSectionMut.mutate({ id: section.id, name })}
              onDelete={() => deleteSectionMut.mutate(section.id)}
            >
              {sectionRooms.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground/60">Drop a chat here</p>
              ) : sectionRooms.map(room => (
                <RoomRow key={room.id} room={room} active={activeRoom === room.id}
                  onSelect={() => onSelectRoom(room.id)} onHover={() => prefetchRoomMessages(room.id)}
                  dragging={drag?.kind === 'room' && drag.id === room.id}
                  onDragStart={() => setDrag({ kind: 'room', id: room.id })}
                  onDragEnd={() => setDrag(null)}
                />
              ))}
            </RoomSection>
          );
        })}

        <div className="px-3 pt-2 pb-3">
          {addingSection ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={newSectionName}
                onChange={e => setNewSectionName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newSectionName.trim()) createSectionMut.mutate(newSectionName.trim());
                  if (e.key === 'Escape') { setAddingSection(false); setNewSectionName(''); }
                }}
                placeholder="Section name…"
                className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-secondary border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button onClick={() => newSectionName.trim() && createSectionMut.mutate(newSectionName.trim())}
                className="p-1.5 rounded-md bg-primary text-primary-foreground"><Check size={12} /></button>
              <button onClick={() => { setAddingSection(false); setNewSectionName(''); }}
                className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><XIcon size={12} /></button>
            </div>
          ) : (
            <button onClick={() => setAddingSection(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Plus size={13} /> New section
            </button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function RoomSection({
  title, unread, onAdd, addLabel, children, collapsed, onToggleCollapsed,
  dragging, onSectionDragStart, onDragEnd, onDropOn, isDefault, onRename, onDelete,
}: {
  title: string; unread: number; onAdd?: () => void; addLabel: string; children: React.ReactNode;
  collapsed: boolean; onToggleCollapsed: () => void;
  dragging: boolean; onSectionDragStart: () => void; onDragEnd: () => void; onDropOn: () => void;
  isDefault: boolean; onRename: (name: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={`px-3 pt-3 transition-opacity ${dragging ? 'opacity-40' : ''}`}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); onDropOn(); }}
    >
      <div className="group flex items-center justify-between px-1 pb-1 gap-1">
        {editing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && editValue.trim()) { onRename(editValue.trim()); setEditing(false); }
                if (e.key === 'Escape') { setEditValue(title); setEditing(false); }
              }}
              onBlur={() => { if (editValue.trim() && editValue.trim() !== title) onRename(editValue.trim()); setEditing(false); }}
              className="flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-wider bg-secondary rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        ) : (
          <button
            onClick={onToggleCollapsed}
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors min-w-0"
          >
            <GripVertical
              draggable
              onDragStart={e => { e.stopPropagation(); onSectionDragStart(); }}
              onDragEnd={onDragEnd}
              className="h-3 w-3 opacity-0 group-hover:opacity-60 cursor-grab transition-opacity -ml-1 flex-shrink-0"
            />
            <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            <span className="truncate">{title}</span>
            {/* Shown regardless of collapsed state so a shrunk section never
                hides that it has something new. */}
            {unread > 0 && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none flex-shrink-0">
                {unread}
              </span>
            )}
          </button>
        )}
        {!editing && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {!isDefault && !confirmDelete && (
              <>
                <button onClick={() => { setEditValue(title); setEditing(true); }} title="Rename"
                  className="p-1 rounded-md hover:bg-secondary text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground transition-colors">
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={() => setConfirmDelete(true)} title="Delete section"
                  className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            )}
            {!isDefault && confirmDelete && (
              <>
                <span className="text-[10px] text-destructive">Delete?</span>
                <button onClick={onDelete} className="text-[10px] font-semibold text-destructive px-1">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-muted-foreground px-1">No</button>
              </>
            )}
            {onAdd && (
              <button onClick={onAdd} title={addLabel}
                className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
      {!collapsed && <div className="space-y-0.5 pb-1">{children}</div>}
    </div>
  );
}

function RoomRow({ room, active, onSelect, onHover, dragging, onDragStart, onDragEnd }: {
  room: ChatRoom; active: boolean; onSelect: () => void; onHover: () => void;
  dragging: boolean; onDragStart: () => void; onDragEnd: () => void;
}) {
  const displayName = getDisplayName(room);
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors cursor-grab ${dragging ? 'opacity-40' : ''} ${active ? 'bg-accent' : 'hover:bg-secondary/50'}`}
    >
      <RoomAvatar room={room} displayName={displayName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate flex items-center gap-1">
            {room.type === 'Group' && <Hash className="h-3 w-3 text-muted-foreground shrink-0" />}
            {displayName}
          </span>
          {room.last_message_at && (
            <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
              {formatTime(room.last_message_at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate">
            {room.last_message ? room.last_message.slice(0, 40) + (room.last_message.length > 40 ? '…' : '') : 'No messages'}
          </span>
          {Number(room.unread_count) > 0 && (
            <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center flex-shrink-0 ml-1">
              {room.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function RoomAvatar({ room, displayName }: { room: ChatRoom; displayName: string }) {
  const isDM = room.type === '1-to-1';

  const avatarEl = (() => {
    if (isDM && room.dm_other_user_avatar) {
      return <img src={room.dm_other_user_avatar} alt="" className="w-10 h-10 rounded-full object-cover" />;
    }
    if (!isDM && room.avatar_url) {
      return <img src={room.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />;
    }
    const bg = `hsl(${hashCode(displayName) % 360}, 60%, 45%)`;
    return (
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ backgroundColor: bg, color: '#fff' }}>
        {isDM ? (displayName[0] || 'D').toUpperCase() : <Hash className="h-4 w-4" />}
      </div>
    );
  })();

  return (
    <div className="relative flex-shrink-0">
      {avatarEl}
      {isDM && (
        <StatusDot
          status={room.dm_other_user_status}
          className="absolute bottom-0 right-0 w-2 h-2"
        />
      )}
    </div>
  );
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function formatTime(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 86400000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 604800000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
