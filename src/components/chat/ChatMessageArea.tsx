import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Send, Paperclip, Search, Pin, Info, ArrowLeft, MessageSquare,
  Smile, Reply, Pencil, Trash2, X, Check
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/hooks/useSocket';
import toast from 'react-hot-toast';

interface Props {
  roomId: string;
  roomName: string;
  memberCount?: number;
  onBack: () => void;
  onToggleInfo: () => void;
  onTogglePinned: () => void;
}

export default function ChatMessageArea({ roomId, roomName, memberCount, onBack, onToggleInfo, onTogglePinned }: Props) {
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

  const headerTitle = roomDetail?.type === '1-to-1'
    ? (roomDetail.dm_other_user_name ?? 'Direct Message')
    : (roomDetail?.name ?? roomName);

  const headerSubtitle = roomDetail?.type === '1-to-1'
    ? (roomDetail.dm_other_user_title ?? '')
    : (memberCount ? `${memberCount} members` : '');

  // Fetch messages imperatively whenever roomId changes
  useEffect(() => {
    if (!roomId) return;
    setFetchedMessages([]);
    setRealtimeMessages([]);
    setHasMore(false);
    setLoadingMessages(true);
    api.get(`/chat/rooms/${roomId}/messages?limit=50`)
      .then(r => {
        const d = r.data;
        const msgs = Array.isArray(d) ? d : d?.data || d?.messages || [];
        setFetchedMessages(msgs);
        setHasMore(d?.has_more ?? false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 80);
      })
      .catch(err => console.error('Failed to load messages:', err))
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
    });

    socket.on('message_updated', (msg) => {
      setRealtimeMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
      qc.setQueryData(['chat-messages', roomId], (old: any[]) =>
        old?.map(m => m.id === msg.id ? msg : m)
      );
    });

    socket.on('message_deleted', (data) => {
      const deletedId = data?.id || data?.message_id;
      if (!deletedId) return;
      setRealtimeMessages(prev => prev.map(m =>
        m.id === deletedId ? { ...m, deleted_at: data.deleted_at || new Date().toISOString(), is_deleted: true, content: '' } : m
      ));
      qc.setQueryData(['chat-messages', roomId], (old: any[]) =>
        old?.map(m => m.id === deletedId ? { ...m, deleted_at: data.deleted_at || new Date().toISOString(), is_deleted: true, content: '' } : m)
      );
    });

    socket.on('message_pinned', (msg) => {
      qc.setQueryData(['chat-messages', roomId], (old: any[]) =>
        old?.map(m => m.id === msg.id ? { ...m, is_pinned: msg.is_pinned } : m)
      );
      qc.invalidateQueries({ queryKey: ['chat-pinned', roomId] });
    });

    socket.on('message_reaction', (data) => {
      qc.setQueryData(['chat-messages', roomId], (old: any[]) =>
        old?.map(m => m.id === data.message_id ? { ...m, reactions: data.reactions } : m)
      );
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

    socket.on('added_to_room', () => {
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
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
      qc.setQueryData(['chat-messages', roomId], (old: any[]) =>
        old?.map(m => m.id === updated.id ? updated : m)
      );
      setEditingMsg(null);
      setEditText('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/chat/messages/${id}`),
    onSuccess: (_, id) => {
      qc.setQueryData(['chat-messages', roomId], (old: any[]) =>
        old?.map(m => m.id === id ? { ...m, deleted_at: new Date().toISOString(), is_deleted: true } : m)
      );
    },
  });

  const pinMut = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      pinned ? api.delete(`/chat/messages/${id}/pin`) : api.post(`/chat/messages/${id}/pin`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-messages', roomId] });
      qc.invalidateQueries({ queryKey: ['chat-pinned', roomId] });
    },
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post(`/chat/rooms/${roomId}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-messages', roomId] }),
    onError: () => toast.error('Upload failed'),
  });

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
          <h3 className="font-semibold text-sm truncate">{headerTitle}</h3>
          {headerSubtitle ? <p className="text-xs text-muted-foreground">{headerSubtitle}</p> : null}
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
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
      >
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
          const showSender = !isOwn && (i === 0 || allMessages[i - 1]?.sender_id !== msg.sender_id);

          if (isDeleted) {
            return (
              <div key={msg.id || i} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[70%] px-3 py-2 rounded-xl bg-secondary/50 italic text-muted-foreground text-sm">
                  This message was deleted
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id || i}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group relative`}
              onMouseEnter={() => setHoveredMsg(msg.id)}
              onMouseLeave={() => setHoveredMsg(null)}
            >
              <div className="max-w-[70%]">
                {/* Reply snippet */}
                {msg.reply_to_id && msg.reply_to_content && (
                  <div className={`text-xs px-2 py-1 mb-0.5 rounded-t-lg border-l-2 border-primary/50 bg-secondary/50 text-muted-foreground truncate ${isOwn ? 'ml-auto' : ''}`}>
                    ↩ {msg.reply_to_sender || 'User'}: {msg.reply_to_content.slice(0, 60)}
                  </div>
                )}
                <div className={`rounded-xl px-3 py-2 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                  {showSender && !isOwn && (
                    <div className="text-xs font-medium mb-0.5 text-muted-foreground">{msg.sender_name}</div>
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
                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    {Boolean(msg.is_pinned) && <Pin className="h-2.5 w-2.5 inline ml-1" />}
                  </div>
                </div>
              </div>

              {/* Hover actions */}
              {hoveredMsg === msg.id && !isDeleted && (
                <div className={`absolute top-0 ${isOwn ? 'right-[calc(70%+4px)]' : 'left-[calc(70%+4px)]'} flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-lg p-0.5 z-10`}>
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
          );
        })}
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
          <input type="file" ref={fileInputRef} className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadMut.mutate(f); e.target.value = ''; }}
            accept="image/*,.pdf,.csv,.doc,.docx,.xls,.xlsx,.zip" />
          <button onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors flex-shrink-0">
            <Paperclip className="h-4 w-4" />
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
    </div>
  );
}
