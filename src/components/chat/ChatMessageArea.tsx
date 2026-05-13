import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Send, Paperclip, Search, Pin, Info, ArrowLeft, MessageSquare,
  Smile, Reply, Pencil, Trash2, X, Check, CheckCheck, MoreVertical
} from 'lucide-react';
import StatusDot from '@/components/chat/StatusDot';
import StatusBadge from '@/components/chat/StatusBadge';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/hooks/useSocket';
import UserProfileCard from '@/components/chat/UserProfileCard';
import toast from 'react-hot-toast';

const formatDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  const diffDays = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  if (date.getFullYear() === today.getFullYear())
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

interface Props {
  roomId: string;
  roomName: string;
  memberCount?: number;
  onBack: () => void;
  onDeleteRoom?: () => void;
  onToggleInfo: () => void;
  onTogglePinned: () => void;
}

export default function ChatMessageArea({ roomId, roomName, memberCount, onBack, onDeleteRoom, onToggleInfo, onTogglePinned }: Props) {
  const user = useAuthStore(s => s.user);
  const accessToken = useAuthStore(s => s.accessToken);
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [fetchedMessages, setFetchedMessages] = useState<any[]>([]);
  const [realtimeMessages, setRealtimeMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [editText, setEditText] = useState('');
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<any>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const userRole = user?.role || '';
  const isAdminRole = userRole === 'admin' || userRole === 'super_admin';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Fetch room detail for DM header info
  const { data: roomDetail } = useQuery({
    queryKey: ['chat-room-detail', roomId],
    queryFn: () => api.get(`/chat/rooms/${roomId}`).then(r => r.data?.data || r.data),
    enabled: !!roomId,
  });

  const isDM = roomDetail?.type === '1-to-1';

  const headerTitle = isDM
    ? (roomDetail.dm_other_user_name ?? 'Direct Message')
    : (roomDetail?.name ?? roomName);

  const dmSubParts = [
    roomDetail?.dm_other_user_title || roomDetail?.dm_other_user_role || roomDetail?.dm_other_user_department || '',
    roomDetail?.dm_other_user_email || '',
  ].filter(Boolean).join(' · ');

  const headerSubtitle = isDM
    ? dmSubParts
    : (memberCount ? `${memberCount} members` : '');

  const dmStatusText = isDM && roomDetail?.dm_other_user_status_text
    ? `${roomDetail.dm_other_user_status_emoji || ''} ${roomDetail.dm_other_user_status_text}`.trim()
    : '';

  // Members for read receipts + status map
  const roomMembers: any[] = roomDetail?.members || [];
  const [statusMap, setStatusMap] = useState<Record<string, { status: string; status_text: string | null }>>({});

  // Populate statusMap from room members
  useEffect(() => {
    if (!roomMembers.length) return;
    const map: Record<string, any> = {};
    roomMembers.forEach((m: any) => { map[m.user_id || m.id] = { status: m.status || 'offline', status_text: m.status_text || null }; });
    setStatusMap(map);
  }, [roomMembers]);

  // Fetch messages imperatively whenever roomId changes
  useEffect(() => {
    if (!roomId) return;
    console.log('[Chat] Fetching messages for room:', roomId);
    setFetchedMessages([]);
    setRealtimeMessages([]);
    setHasMore(false);
    setLoadingMessages(true);

    api.get(`/chat/rooms/${roomId}/messages?limit=50`)
      .then(res => {
        console.log('[Chat] Messages API response:', res.data);
        const payload = res.data;
        const msgs = Array.isArray(payload) ? payload : (payload?.data ?? payload?.messages ?? []);
        console.log('[Chat] Parsed messages count:', msgs.length);
        setFetchedMessages(msgs);
        setHasMore(payload?.has_more ?? false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 80);
      })
      .catch(err => console.error('[Chat] Failed to load messages:', err))
      .finally(() => setLoadingMessages(false));

    // Mark room as read
    api.post(`/chat/rooms/${roomId}/read`).catch(() => {});
    qc.setQueryData(['chat-rooms'], (old: any[]) =>
      old?.map((r: any) => r.id === roomId ? { ...r, unread_count: 0 } : r)
    );
  }, [roomId]);

  // Load older messages on scroll to top
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el || !hasMore || loadingMessages) return;
    if (el.scrollTop < 50) {
      const oldest = fetchedMessages[0];
      if (!oldest?.created_at) return;
      setLoadingMessages(true);
      const prevHeight = el.scrollHeight;
      api.get(`/chat/rooms/${roomId}/messages?limit=50&before=${oldest.created_at}`)
        .then(r => {
          const d = r.data;
          const older = Array.isArray(d) ? d : d?.data || d?.messages || [];
          setFetchedMessages(prev => [...older, ...prev]);
          setHasMore(d?.has_more ?? false);
          requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prevHeight; });
        })
        .finally(() => setLoadingMessages(false));
    }
  };

  const { data: searchResults } = useQuery({
    queryKey: ['chat-search', roomId, searchQuery],
    queryFn: () => api.get(`/chat/rooms/${roomId}/search?q=${encodeURIComponent(searchQuery)}`).then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || d?.messages || [];
    }),
    enabled: !!searchQuery && searchQuery.length >= 2,
  });

  // Socket.IO connection via singleton
  useEffect(() => {
    if (!roomId || !accessToken) return;

    const socket = getSocket(accessToken);
    socketRef.current = socket;

    socket.emit('join_room', roomId);

    socket.on('new_message', (msg) => {
      setRealtimeMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      scrollToBottom();
      // Update room list: mark current room read, increment others
      qc.setQueryData(['chat-rooms'], (old: any[]) =>
        old?.map((r: any) => {
          if (r.id === msg.room_id && msg.room_id === roomId) {
            return { ...r, last_message: msg.content, last_message_at: msg.created_at, unread_count: 0 };
          }
          if (r.id === msg.room_id) {
            return { ...r, last_message: msg.content, last_message_at: msg.created_at, unread_count: (r.unread_count || 0) + 1 };
          }
          return r;
        })
      );
      if (msg.room_id === roomId) {
        api.post(`/chat/rooms/${roomId}/read`).catch(() => {});
        // Refresh room detail for read receipts after delay
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: ['chat-room-detail', roomId] });
        }, 3000);
      }
    });

    socket.on('message_updated', (msg) => {
      setRealtimeMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
      setFetchedMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
    });

    socket.on('message_deleted', (data) => {
      const deletedId = data?.id || data?.message_id;
      if (!deletedId) return;
      const patch = { deleted_at: data.deleted_at || new Date().toISOString(), is_deleted: true, content: '' };
      setRealtimeMessages(prev => prev.map(m => m.id === deletedId ? { ...m, ...patch } : m));
      setFetchedMessages(prev => prev.map(m => m.id === deletedId ? { ...m, ...patch } : m));
    });

    socket.on('message_pinned', (msg) => {
      setFetchedMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: msg.is_pinned } : m));
      setRealtimeMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: msg.is_pinned } : m));
      qc.invalidateQueries({ queryKey: ['chat-pinned', roomId] });
    });

    socket.on('message_reaction', (data) => {
      setFetchedMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, reactions: data.reactions } : m));
      setRealtimeMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, reactions: data.reactions } : m));
    });

    socket.on('user_typing', (data) => {
      const typingName = data.user_name || data.userId;
      if (data.user_id === user?.id || data.userId === user?.id) return;

      if (data.isTyping === false) {
        setTypingUsers(prev => prev.filter(n => n !== typingName));
      } else {
        setTypingUsers(prev => {
          if (prev.includes(typingName)) return prev;
          return [...prev, typingName];
        });
        setTimeout(() => setTypingUsers(prev => prev.filter(n => n !== typingName)), 3000);
      }
    });

    // Real-time status updates
    socket.on('user_status_changed', (data: any) => {
      setStatusMap(prev => ({ ...prev, [data.user_id]: { status: data.status, status_text: data.status_text } }));
      qc.setQueryData(['chat-rooms'], (old: any[]) =>
        old?.map((r: any) =>
          r.dm_other_user_id === data.user_id
            ? { ...r, dm_other_user_status: data.status, dm_other_user_status_text: data.status_text, dm_other_user_status_emoji: data.status_emoji }
            : r
        )
      );
      qc.invalidateQueries({ queryKey: ['chat-room-detail', roomId] });
    });

    socket.on('room_deleted', (data: any) => {
      if (data?.room_id === roomId || data?.id === roomId) {
        qc.invalidateQueries({ queryKey: ['chat-rooms'] });
        onBack();
        toast('This conversation was deleted');
      }
    });

    return () => {
      socket.emit('leave_room', roomId);
      socket.off('new_message');
      socket.off('message_updated');
      socket.off('message_deleted');
      socket.off('message_pinned');
      socket.off('message_reaction');
      socket.off('user_typing');
      socket.off('added_to_room');
      socket.off('user_status_changed');
      socket.off('room_deleted');
      setRealtimeMessages([]);
      setTypingUsers([]);
    };
  }, [roomId, accessToken]);

  const scrollToBottom = (force = false) => {
    const el = messagesContainerRef.current;
    if (!el) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (force || nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Scroll to bottom on initial load only
  useEffect(() => {
    scrollToBottom(true);
  }, [fetchedMessages]);

  const sendMut = useMutation({
    mutationFn: (content: string) => api.post(`/chat/rooms/${roomId}/messages`, {
      content,
      type: 'text',
      ...(replyTo ? { reply_to_id: replyTo.id } : {}),
    }),
    onSuccess: () => {
      setMessage('');
      setReplyTo(null);
      scrollToBottom(true);
    },
  });

  const editMut = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.put(`/chat/messages/${id}`, { content }),
    onSuccess: (res) => {
      const updated = res.data?.data || res.data;
      setFetchedMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      setRealtimeMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      setEditingMsg(null);
      setEditText('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/chat/messages/${id}`),
    onSuccess: (_, id) => {
      setFetchedMessages(prev => prev.map(m => m.id === id ? { ...m, deleted_at: new Date().toISOString(), is_deleted: true } : m));
      setRealtimeMessages(prev => prev.map(m => m.id === id ? { ...m, deleted_at: new Date().toISOString(), is_deleted: true } : m));
    },
  });

  const pinMut = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      pinned ? api.delete(`/chat/messages/${id}/pin`) : api.post(`/chat/messages/${id}/pin`),
    onSuccess: () => {
      // Re-fetch messages to get updated pin state
      api.get(`/chat/rooms/${roomId}/messages?limit=50`).then(r => {
        const d = r.data;
        setFetchedMessages(Array.isArray(d) ? d : d?.data || d?.messages || []);
      });
      qc.invalidateQueries({ queryKey: ['chat-pinned', roomId] });
    },
  });

  const [uploadingCount, setUploadingCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const uploadMut = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      // Do NOT set Content-Type manually — axios auto-sets multipart/form-data with boundary
      return api.post(`/chat/rooms/${roomId}/upload`, form);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || 'Upload failed';
      toast.error(msg);
    },
  });

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploadingCount(files.length);
    await Promise.allSettled(files.map(f => uploadMut.mutateAsync(f)));
    setUploadingCount(0);
    scrollToBottom(true);
  };

  const handleSend = () => {
    if (editingMsg) {
      if (editText.trim()) editMut.mutate({ id: editingMsg.id, content: editText });
      return;
    }
    if (message.trim()) sendMut.mutate(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (!editingMsg && socketRef.current) {
      socketRef.current.emit('typing', { roomId, isTyping: true });
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socketRef.current?.emit('typing', { roomId, isTyping: false });
      }, 2000);
    }
  };

  const allMessages = [...fetchedMessages, ...realtimeMessages]
    .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header — fixed, never scrolls */}
      <div className="flex-none px-4 py-3 border-b border-border flex items-center gap-3">
        <button onClick={onBack} className="md:hidden p-1 rounded-md hover:bg-secondary text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm truncate">{headerTitle}</h3>
            {isDM && <StatusDot status={roomDetail?.dm_other_user_status} />}
          </div>
          {isDM && (
            <StatusBadge
              status={roomDetail?.dm_other_user_status ?? 'offline'}
              statusText={roomDetail?.dm_other_user_status_text}
              showLabel={true}
              size="xs"
            />
          )}
          {!isDM && headerSubtitle ? <p className="text-xs text-muted-foreground">{headerSubtitle}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-md hover:bg-secondary transition-colors ${showSearch ? 'bg-secondary text-primary' : 'text-muted-foreground'}`}>
            <Search className="h-4 w-4" />
          </button>
          <button onClick={onTogglePinned} className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
            <Pin className="h-4 w-4" />
          </button>
          <button onClick={onToggleInfo} className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
            <Info className="h-4 w-4" />
          </button>
          {isAdminRole && (
            <div className="relative">
              <button onClick={() => setShowHeaderMenu(!showHeaderMenu)} className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
                <MoreVertical className="h-4 w-4" />
              </button>
              {showHeaderMenu && (
                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-20 min-w-[160px]">
                  <button onClick={() => { setShowHeaderMenu(false); if (confirm('Delete this conversation? This cannot be undone.')) onDeleteRoom?.(); }}
                    className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg flex items-center gap-2">
                    <Trash2 className="h-3.5 w-3.5" /> Delete Conversation
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex-none px-4 py-2 border-b border-border bg-secondary/30 flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            autoFocus
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            className="p-1 rounded hover:bg-secondary"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Search results */}
      {showSearch && searchQuery.length >= 2 && searchResults && (
        <div className="flex-none border-b border-border max-h-48 overflow-y-auto bg-card">
          {(searchResults as any[]).length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">No results found</p>
          ) : (
            (searchResults as any[]).map((r: any) => (
              <div key={r.id} className="px-4 py-2 hover:bg-secondary/50 cursor-pointer text-sm border-b border-border/50">
                <span className="text-xs text-muted-foreground">{r.sender_name}</span>
                <p className="truncate">{r.content}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Message list — only this scrolls */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1 relative"
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          handleFiles(files);
        }}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg pointer-events-none">
            <Paperclip className="h-10 w-10 text-primary mb-2" />
            <p className="text-sm font-medium text-primary">Drop files to upload</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, ZIP, Excel, images and more</p>
          </div>
        )}
        {loadingMessages && fetchedMessages.length === 0 && <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading...</div>}
        {!loadingMessages && allMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-2 opacity-20" />
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        )}
        {allMessages.map((msg, i) => {
          const isOwn = msg.sender_id === user?.id;
          const isDeleted = Boolean(msg.deleted_at) || Boolean(msg.is_deleted);
          const msgDate = new Date(msg.created_at).toDateString();
          const prevDate = i > 0 ? new Date(allMessages[i - 1].created_at).toDateString() : null;
          const showDateSeparator = msgDate !== prevDate;
          const showSender = !isOwn && (i === 0 || allMessages[i - 1]?.sender_id !== msg.sender_id || showDateSeparator);
          const isLastMessage = i === allMessages.length - 1;

          // Read receipt logic
          const otherMember = isDM ? roomMembers.find((m: any) => m.user_id !== user?.id) : null;
          const isSeen = isDM && otherMember?.last_read_at && new Date(otherMember.last_read_at) >= new Date(msg.created_at);
          const seenByGroup = !isDM && isLastMessage ? roomMembers.filter((m: any) =>
            m.user_id !== user?.id && m.last_read_at && new Date(m.last_read_at) >= new Date(msg.created_at)
          ) : [];

          return (
            <div key={msg.id || i}>
              {showDateSeparator && (
                <div className="flex items-center gap-3 my-4 px-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground font-medium px-2 whitespace-nowrap">
                    {formatDateLabel(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

          {isDeleted ? (
              <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] md:max-w-[70%] px-3 py-2 rounded-xl bg-secondary/50 italic text-muted-foreground text-sm">
                  This message was deleted
                </div>
              </div>
          ) : (
            <div
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group relative`}
              onMouseEnter={() => setHoveredMsg(msg.id)}
              onMouseLeave={() => setHoveredMsg(null)}
            >
              <div className="max-w-[85%] md:max-w-[70%]">
                {/* Reply snippet */}
                {msg.reply_to_id && msg.reply_to_content && (
                  <div className={`text-xs px-2 py-1 mb-0.5 rounded-t-lg border-l-2 border-primary/50 bg-secondary/50 text-muted-foreground truncate ${isOwn ? 'ml-auto' : ''}`}>
                    ↩ {msg.reply_to_sender || 'User'}: {msg.reply_to_content.slice(0, 60)}
                  </div>
                )}
                <div className={`rounded-xl px-3 py-2 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                  {showSender && !isOwn && (
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-muted-foreground cursor-pointer hover:underline"
                        onClick={() => setProfileUser({ id: msg.sender_id, full_name: msg.sender_name, avatar_url: msg.sender_avatar })}>{msg.sender_name}</span>
                      <StatusBadge
                        status={statusMap[msg.sender_id]?.status ?? 'offline'}
                        statusText={statusMap[msg.sender_id]?.status_text}
                        showLabel={statusMap[msg.sender_id]?.status !== 'online'}
                        size="xs"
                      />
                      <span className="text-[10px] text-muted-foreground opacity-70">
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}
                      </span>
                    </div>
                  )}
                  {/* File attachment */}
                  {msg.type === 'file' && msg.file_url && (
                    <a href={msg.file_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs underline mb-1">
                      <Paperclip className="h-3 w-3" /> {msg.file_name || 'Download file'}
                    </a>
                  )}
                  {msg.type === 'image' && msg.file_url && (
                    <img src={msg.file_url} alt="" className="max-w-full rounded-lg mb-1 max-h-64 object-contain" />
                  )}
                  <p className="text-sm break-words whitespace-pre-wrap">
                    {msg.content}
                    {Boolean(msg.is_edited) && <span className="text-[10px] opacity-60 ml-1">(edited)</span>}
                  </p>
                  {/* Reactions */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => (
                        <span key={emoji} className="text-xs bg-background/20 rounded-full px-1.5 py-0.5">
                          {emoji} {Array.isArray(users) ? users.length : users}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={`text-[10px] mt-1 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {isOwn && msg.created_at ? new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}
                    {Boolean(msg.is_pinned) && <Pin className="h-2.5 w-2.5 inline ml-1" />}
                  </div>
                </div>
              </div>

              {/* Hover actions */}
              {hoveredMsg === msg.id && (
                <div className={`absolute -top-8 ${isOwn ? 'right-0' : 'left-0'} flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-lg p-0.5 z-10`}>
                  <button onClick={() => {
                    api.post(`/chat/messages/${msg.id}/reaction`, { emoji: '👍' }).catch(() => {});
                  }} className="p-1.5 rounded hover:bg-secondary text-muted-foreground" title="React">
                    <Smile className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setReplyTo(msg)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground" title="Reply">
                    <Reply className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => pinMut.mutate({ id: msg.id, pinned: Boolean(msg.is_pinned) })}
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground" title={Boolean(msg.is_pinned) ? 'Unpin' : 'Pin'}>
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                  {isOwn && (
                    <button onClick={() => { setEditingMsg(msg); setEditText(msg.content); }}
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isOwn && (
                    <button onClick={() => { if (confirm('Delete this message?')) deleteMut.mutate(msg.id); }}
                      className="p-1.5 rounded hover:bg-secondary text-destructive" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

            </div>
          )}
            </div>
          );
        })}

        {/* Read receipt for last own message — rendered outside message loop */}
        {(() => {
          const lastOwnIdx = allMessages.map((m, i) => m.sender_id === user?.id ? i : -1).filter(i => i >= 0).pop();
          if (lastOwnIdx === undefined) return null;
          const lastOwnMsg = allMessages[lastOwnIdx];
          if (!lastOwnMsg || Boolean(lastOwnMsg.deleted_at) || Boolean(lastOwnMsg.is_deleted)) return null;
          const otherMember = isDM ? roomMembers.find((m: any) => m.user_id !== user?.id) : null;
          const isSeen = isDM && otherMember?.last_read_at && new Date(otherMember.last_read_at) >= new Date(lastOwnMsg.created_at);
          const seenByGroup = !isDM ? roomMembers.filter((m: any) =>
            m.user_id !== user?.id && m.last_read_at && new Date(m.last_read_at) >= new Date(lastOwnMsg.created_at)
          ) : [];

          return (
            <>
              {isDM && (
                <div className="flex items-center justify-end gap-1 -mt-0.5 mr-1 text-[10px] text-muted-foreground">
                  {isSeen
                    ? <><CheckCheck className="w-3 h-3 text-blue-400" /> Seen</>
                    : <><Check className="w-3 h-3" /> Sent</>
                  }
                </div>
              )}
              {!isDM && seenByGroup.length > 0 && (
                <div className="flex items-center justify-end gap-1 -mt-0.5 mr-1">
                  <span className="text-[10px] text-muted-foreground">Seen by</span>
                  <div className="flex -space-x-1">
                    {seenByGroup.slice(0, 5).map((m: any) => (
                      <div key={m.user_id} title={m.full_name}
                        className="w-4 h-4 rounded-full bg-primary/60 ring-1 ring-background flex items-center justify-center text-[8px] text-primary-foreground font-bold">
                        {m.full_name?.charAt(0)}
                      </div>
                    ))}
                    {seenByGroup.length > 5 && (
                      <div className="w-4 h-4 rounded-full bg-muted ring-1 ring-background flex items-center justify-center text-[8px] text-muted-foreground">
                        +{seenByGroup.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          );
        })()}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator — fixed above input */}
      {typingUsers.length > 0 && (
        <div className="flex-none px-4 pb-1 text-xs text-muted-foreground italic">
          {typingUsers.length === 1
            ? `${typingUsers[0]} is typing...`
            : `${typingUsers.length} people are typing...`}
        </div>
      )}

      {/* Reply bar */}
      {replyTo && (
        <div className="flex-none px-4 py-2 border-t border-border bg-secondary/30 flex items-center gap-2">
          <Reply className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs truncate flex-1">
            Replying to <strong>{replyTo.sender_name}</strong>: {replyTo.content?.slice(0, 50)}
          </span>
          <button onClick={() => setReplyTo(null)} className="p-1 rounded hover:bg-secondary"><X className="h-3 w-3" /></button>
        </div>
      )}

      {/* Edit bar */}
      {editingMsg && (
        <div className="flex-none px-4 py-2 border-t border-border bg-primary/5 flex items-center gap-2">
          <Pencil className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs flex-1">Editing message</span>
          <button onClick={() => { setEditingMsg(null); setEditText(''); }}
            className="p-1 rounded hover:bg-secondary"><X className="h-3 w-3" /></button>
        </div>
      )}

      {/* Input bar — fixed at bottom */}
      <div className="flex-none px-4 py-3 border-t border-border">
        <div className="flex gap-2 items-end">
          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            accept="*/*"
            onChange={async e => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              handleFiles(files);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingCount > 0}
            className="p-2.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors flex-shrink-0 disabled:opacity-50 relative"
            title={uploadingCount > 0 ? `Uploading ${uploadingCount} file${uploadingCount > 1 ? 's' : ''}…` : 'Attach files'}
          >
            <Paperclip className="h-4 w-4" />
            {uploadingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {uploadingCount}
              </span>
            )}
          </button>
          <textarea
            ref={textareaRef}
            value={editingMsg ? editText : message}
            onChange={e => editingMsg ? setEditText(e.target.value) : setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={editingMsg ? 'Edit message...' : 'Type a message...'}
            rows={1}
            className="flex-1 px-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none max-h-32"
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={handleSend}
            disabled={editingMsg ? !editText.trim() : !message.trim()}
            className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 flex-shrink-0"
          >
            {editingMsg ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* User profile card */}
      {profileUser && (
        <div className="fixed inset-0 z-50" onClick={() => setProfileUser(null)}>
          <div className="absolute inset-0" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" onClick={e => e.stopPropagation()}>
            <UserProfileCard user={profileUser} onClose={() => setProfileUser(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
