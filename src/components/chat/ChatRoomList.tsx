import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, MessageSquare, Search, Hash, User, Bell } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import StatusDot from '@/components/chat/StatusDot';
import StatusBadge from '@/components/chat/StatusBadge';
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

export default function ChatRoomList({ activeRoom, onSelectRoom, onCreateGroup, onCreateDM, hideCreateGroup = false }: Props) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'dm' | 'group'>('all');
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
  const dmUnread = typedRooms.filter(r => r.type === '1-to-1' && Number(r.unread_count) > 0).length;
  const grpUnread = typedRooms.filter(r => r.type === 'Group' && Number(r.unread_count) > 0).length;

  const tabs = [
    { key: 'all' as const, label: 'All', unread: dmUnread + grpUnread },
    { key: 'dm' as const, label: 'Direct', unread: dmUnread },
    { key: 'group' as const, label: 'Groups', unread: grpUnread },
  ];

  const filtered = typedRooms.filter(r => {
    if (activeTab === 'dm' && r.type !== '1-to-1') return false;
    if (activeTab === 'group' && r.type !== 'Group') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = getDisplayName(r).toLowerCase();
      const lastMsg = r.last_message?.toLowerCase() || '';
      return name.includes(q) || lastMsg.includes(q);
    }
    return true;
  });

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

      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Messages</h2>
          <div className="flex gap-1">
            <button onClick={onCreateDM} title="New Message"
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <MessageSquare className="h-4 w-4" />
            </button>
            {!hideCreateGroup && (
              <button onClick={onCreateGroup} title="New Group"
                className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-secondary border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-border mx-3">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent'
            }`}
          >
            {tab.label}
            {tab.unread > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        {filtered.length === 0 && (
          <div className="text-center py-12 px-4">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              {search ? 'No results' : activeTab === 'dm' ? 'No direct messages yet' : activeTab === 'group' ? 'No group rooms yet' : 'No conversations yet'}
            </p>
          </div>
        )}
        {filtered.map((room) => {
          const displayName = getDisplayName(room);
          return (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={`w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/50 transition-colors ${activeRoom === room.id ? 'bg-secondary' : ''}`}
            >
              <RoomAvatar room={room} displayName={displayName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{displayName}</span>
                  {room.type === '1-to-1' && (
                    <StatusBadge
                      status={room.dm_other_user_status ?? 'offline'}
                      statusText={room.dm_other_user_status_text}
                      showLabel={room.dm_other_user_status !== 'online'}
                      size="xs"
                    />
                  )}
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
        })}
      </ScrollArea>
    </div>
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
