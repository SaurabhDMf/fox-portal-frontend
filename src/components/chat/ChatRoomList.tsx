import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, MessageSquare, Search, Hash, User, Bell, ChevronDown, GripVertical } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import StatusDot from '@/components/chat/StatusDot';
import StatusPicker from '@/components/chat/StatusPicker';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuthStore } from '@/stores/authStore';

interface ChatRoom {
  id: string;
  name: string | null;
  type: string;
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

const SECTION_ORDER_KEY = 'foxportal:chat:section-order:v1';
const SECTION_COLLAPSED_KEY = 'foxportal:chat:section-collapsed:v1';
const DEFAULT_SECTION_ORDER = ['groups', 'direct'];

function loadSectionOrder(): string[] {
  try {
    const saved: string[] = JSON.parse(localStorage.getItem(SECTION_ORDER_KEY) || 'null');
    if (!Array.isArray(saved)) return DEFAULT_SECTION_ORDER;
    // Keep any sections that vanished from a future build, and append new
    // ones that weren't in a stale saved order, so the list never drops a
    // section just because localStorage predates it.
    const merged = saved.filter(s => DEFAULT_SECTION_ORDER.includes(s));
    for (const s of DEFAULT_SECTION_ORDER) if (!merged.includes(s)) merged.push(s);
    return merged;
  } catch { return DEFAULT_SECTION_ORDER; }
}

function loadCollapsed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(SECTION_COLLAPSED_KEY) || '{}') || {}; }
  catch { return {}; }
}

export default function ChatRoomList({ activeRoom, onSelectRoom, onCreateGroup, onCreateDM, hideCreateGroup = false }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [sectionOrder, setSectionOrder] = useState<string[]>(loadSectionOrder);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);
  const [dragSection, setDragSection] = useState<string | null>(null);
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

  const typedRooms = rooms as ChatRoom[];

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

  const groupRooms = typedRooms.filter(r => r.type === 'Group' && matchesSearch(r));
  const dmRooms = typedRooms.filter(r => r.type === '1-to-1' && matchesSearch(r));
  const groupUnread = groupRooms.filter(r => Number(r.unread_count) > 0).length;
  const dmUnread = dmRooms.filter(r => Number(r.unread_count) > 0).length;

  const toggleCollapsed = (key: string) => {
    const next = { ...collapsed, [key]: !collapsed[key] };
    setCollapsed(next);
    localStorage.setItem(SECTION_COLLAPSED_KEY, JSON.stringify(next));
  };

  const reorderSection = (dragged: string, target: string) => {
    if (dragged === target) return;
    const next = [...sectionOrder];
    next.splice(next.indexOf(dragged), 1);
    next.splice(next.indexOf(target), 0, dragged);
    setSectionOrder(next);
    localStorage.setItem(SECTION_ORDER_KEY, JSON.stringify(next));
  };

  const sections: Record<string, { title: string; unread: number; onAdd?: () => void; addLabel: string; rooms: ChatRoom[] }> = {
    groups: { title: 'Groups', unread: groupUnread, onAdd: !hideCreateGroup ? onCreateGroup : undefined, addLabel: 'New Group', rooms: groupRooms },
    direct: { title: 'Direct Messages', unread: dmUnread, onAdd: onCreateDM, addLabel: 'New Message', rooms: dmRooms },
  };

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
        {groupRooms.length === 0 && dmRooms.length === 0 && (
          <div className="text-center py-12 px-4">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">{search ? 'No results' : 'No conversations yet'}</p>
          </div>
        )}

        {sectionOrder.map(key => {
          const s = sections[key];
          if (!s) return null;
          return (
            <RoomSection
              key={key}
              sectionKey={key}
              title={s.title}
              unread={s.unread}
              onAdd={s.onAdd}
              addLabel={s.addLabel}
              collapsed={!!collapsed[key]}
              onToggleCollapsed={() => toggleCollapsed(key)}
              dragging={dragSection === key}
              onDragStart={() => setDragSection(key)}
              onDragEnd={() => setDragSection(null)}
              onDropOn={() => dragSection && reorderSection(dragSection, key)}
            >
              {s.rooms.map(room => (
                <RoomRow key={room.id} room={room} active={activeRoom === room.id}
                  onSelect={() => onSelectRoom(room.id)} onHover={() => prefetchRoomMessages(room.id)} />
              ))}
            </RoomSection>
          );
        })}
      </ScrollArea>
    </div>
  );
}

function RoomSection({ title, unread, onAdd, addLabel, children, collapsed, onToggleCollapsed, dragging, onDragStart, onDragEnd, onDropOn }: {
  title: string; unread: number; onAdd?: () => void; addLabel: string; children: React.ReactNode;
  collapsed: boolean; onToggleCollapsed: () => void;
  dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onDropOn: () => void;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  if (!hasChildren && !onAdd) return null;
  return (
    <div
      className={`px-3 pt-3 transition-opacity ${dragging ? 'opacity-40' : ''}`}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); onDropOn(); }}
    >
      <div className="group flex items-center justify-between px-1 pb-1">
        <button
          onClick={onToggleCollapsed}
          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <GripVertical
            draggable
            onDragStart={e => { e.stopPropagation(); onDragStart(); }}
            onDragEnd={onDragEnd}
            className="h-3 w-3 opacity-0 group-hover:opacity-60 cursor-grab transition-opacity -ml-1"
          />
          <ChevronDown className={`h-3 w-3 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          {title}
          {/* Shown regardless of collapsed state so a shrunk section never
              hides that it has something new. */}
          {unread > 0 && (
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
              {unread}
            </span>
          )}
        </button>
        {onAdd && (
          <button onClick={onAdd} title={addLabel}
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {!collapsed && <div className="space-y-0.5 pb-1">{children}</div>}
    </div>
  );
}

function RoomRow({ room, active, onSelect, onHover }: {
  room: ChatRoom; active: boolean; onSelect: () => void; onHover: () => void;
}) {
  const displayName = getDisplayName(room);
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${active ? 'bg-accent' : 'hover:bg-secondary/50'}`}
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
