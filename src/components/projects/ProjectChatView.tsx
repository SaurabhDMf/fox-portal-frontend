import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { MessageSquare, Link2, Unlink, Search, Loader2 } from 'lucide-react';
import ChatMessageArea from '@/components/chat/ChatMessageArea';

interface Props {
  projectId: string;
  chatRoomId?: string | null;
  chatRoomName?: string | null;
}

interface Room {
  id: string;
  name: string;
  type?: string;
  member_count?: number;
}

export default function ProjectChatView({ projectId, chatRoomId, chatRoomName }: Props) {
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');

  const linkMut = useMutation({
    mutationFn: (roomId: string | null) =>
      api.put(`/projects/${projectId}/chat-room`, { chat_room_id: roomId }),
    onSuccess: (_, roomId) => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      setPicking(false);
      toast.success(roomId ? 'Chat group connected' : 'Chat group disconnected');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Could not update chat group'),
  });

  if (chatRoomId && !picking) {
    return (
      <div className="flex flex-col h-[calc(100vh-280px)] min-h-[420px] rounded-xl border border-border overflow-hidden bg-card">
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" />
            Connected to chat group:
            <span className="font-medium text-foreground">{chatRoomName || chatRoomId}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPicking(true)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary"
            >
              Change
            </button>
            <button
              onClick={() => linkMut.mutate(null)}
              disabled={linkMut.isPending}
              className="flex items-center gap-1 text-xs text-destructive hover:bg-destructive/10 px-2 py-1 rounded disabled:opacity-50"
            >
              <Unlink className="h-3 w-3" /> Disconnect
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ChatMessageArea
            roomId={chatRoomId}
            roomName={chatRoomName || 'Chat'}
            onBack={() => { /* no-op — there's nowhere to go back to from inside the project tab */ }}
            onToggleInfo={() => { /* hidden in embedded view */ }}
            onTogglePinned={() => { /* hidden in embedded view */ }}
          />
        </div>
      </div>
    );
  }

  return <ChatPicker
    onPick={(id) => linkMut.mutate(id)}
    onCancel={chatRoomId ? () => setPicking(false) : undefined}
    saving={linkMut.isPending}
    search={search}
    setSearch={setSearch}
  />;
}

function ChatPicker({ onPick, onCancel, saving, search, setSearch }: {
  onPick: (roomId: string) => void;
  onCancel?: () => void;
  saving: boolean;
  search: string;
  setSearch: (s: string) => void;
}) {
  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ['chat-rooms-for-project-link'],
    queryFn: () => api.get('/chat/rooms').then(r => {
      const list = r.data?.rooms || r.data?.data || r.data || [];
      // Only show actual groups — DMs aren't useful as a project home.
      return (Array.isArray(list) ? list : []).filter((x: any) => x.type !== 'direct');
    }),
  });

  const filtered = rooms.filter(r =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Connect a chat group</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pin an existing chat group to this project so the team can read and post here without leaving the project view.
            </p>
          </div>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary">
            Cancel
          </button>
        )}
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search your chat groups…"
          className="w-full pl-10 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="max-h-80 overflow-y-auto rounded-lg border border-border divide-y divide-border">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="animate-spin h-5 w-5" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            {search ? 'No chat groups match' : 'You aren\'t in any chat groups yet'}
          </div>
        ) : (
          filtered.map(room => (
            <button
              key={room.id}
              disabled={saving}
              onClick={() => onPick(room.id)}
              className="w-full text-left px-4 py-3 hover:bg-secondary transition-colors flex items-center gap-3 disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{room.name}</div>
                {typeof room.member_count === 'number' && (
                  <div className="text-xs text-muted-foreground">{room.member_count} member{room.member_count === 1 ? '' : 's'}</div>
                )}
              </div>
              <span className="text-xs text-primary font-medium">Connect</span>
            </button>
          ))
        )}
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        You can only connect groups you're a member of. Disconnect later from the chat tab.
      </p>
    </div>
  );
}
