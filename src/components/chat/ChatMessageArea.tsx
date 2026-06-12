import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useMentionInput } from '@/hooks/useMentionInput';
import { MentionDropdown } from '@/components/MentionDropdown';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Send, Paperclip, Search, Pin, Info, ArrowLeft, MessageSquare,
  Smile, Reply, Pencil, Trash2, X, Check, CheckCheck, MoreVertical,
  Image as ImageIcon, Loader2,
} from 'lucide-react';
import StatusDot from '@/components/chat/StatusDot';
import StatusBadge from '@/components/chat/StatusBadge';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/hooks/useSocket';
import UserProfileCard from '@/components/chat/UserProfileCard';
import toast from 'react-hot-toast';

function Avatar({ name, avatarUrl, size = 8 }: { name?: string; avatarUrl?: string; size?: number }) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-orange-500','bg-pink-500','bg-cyan-500','bg-amber-500','bg-rose-500'];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return avatarUrl
    ? <img src={avatarUrl} alt={name} className={`w-${size} h-${size} rounded-full object-cover shrink-0`} />
    : <div className={`w-${size} h-${size} rounded-full ${color} flex items-center justify-center text-white font-semibold shrink-0`}
        style={{ fontSize: size <= 7 ? 11 : 13 }}>{initials}</div>;
}

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
  const [isScrollReady, setIsScrollReady] = useState(false);
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const userRole = user?.role || '';
  const isAdminRole = userRole === 'admin' || userRole === 'super_admin';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();
  const initialScrollDoneRef = useRef(false);
  const isNearBottomRef = useRef(true);

  // @ mention
  const { data: mentionUsers = [] } = useQuery({
    queryKey: ['users-active-mention'],
    queryFn: () => api.get('/users/active').then(r => {
      const d = r.data;
      const arr = Array.isArray(d) ? d : d?.users || d?.data || [];
      return arr.map((u: any) => ({ id: String(u.id), name: u.name || u.username || u.email }));
    }),
    staleTime: 5 * 60 * 1000,
  });
  const mention = useMentionInput(message, setMessage, textareaRef as any);
  const mentionFiltered = useMemo(
    () => mentionUsers.filter((u: any) => u.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 7),
    [mentionUsers, mention.query]
  );

  // Fetch room detail for DM header info
  const { data: roomDetail } = useQuery({
    queryKey: ['chat-room-detail', roomId],
    queryFn: () => api.get(`/chat/rooms/${roomId}`).then(r => r.data?.data || r.data),
    enabled: !!roomId,
  });

  const isRoomAdmin = !!roomDetail?.current_user_is_admin;
  const canDeleteRoom = isAdminRole || isRoomAdmin;

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
  // readMap: userId → last_read_at; updated by messages_read socket event
  const [readMap, setReadMap] = useState<Record<string, string>>({});

  // Populate statusMap + readMap from room members
  useEffect(() => {
    if (!roomMembers.length) return;
    const smap: Record<string, any> = {};
    const rmap: Record<string, string> = {};
    roomMembers.forEach((m: any) => {
      smap[m.user_id || m.id] = { status: m.status || 'offline', status_text: m.status_text || null };
      if (m.last_read_at) rmap[m.user_id] = m.last_read_at;
    });
    setStatusMap(smap);
    setReadMap(rmap);
  }, [roomMembers.length]);

  // When room changes: reset scroll state and clear any staged files
  useEffect(() => {
    initialScrollDoneRef.current = false;
    isNearBottomRef.current = true;
    setIsScrollReady(false);
    setPendingFiles([]);
  }, [roomId]);

  // Fetch messages imperatively whenever roomId changes
  useEffect(() => {
    if (!roomId) return;
    setFetchedMessages([]);
    setRealtimeMessages([]);
    setHasMore(false);
    setLoadingMessages(true);

    api.get(`/chat/rooms/${roomId}/messages?limit=50`)
      .then(res => {
        const payload = res.data;
        const msgs = Array.isArray(payload) ? payload : (payload?.data ?? payload?.messages ?? []);
        setFetchedMessages(msgs);
        setHasMore(payload?.has_more ?? false);
      })
      .catch(err => console.error('[Chat] Failed to load messages:', err))
      .finally(() => setLoadingMessages(false));

    // Mark room as read
    api.post(`/chat/rooms/${roomId}/read`).catch(() => {});
    qc.setQueryData(['chat-rooms'], (old: any[]) =>
      old?.map((r: any) => r.id === roomId ? { ...r, unread_count: 0 } : r)
    );
  }, [roomId]);

  // Scroll to bottom before browser paints when messages first load for this room.
  // useLayoutEffect fires synchronously after DOM update but before paint —
  // the user never sees the list at the top position.
  useLayoutEffect(() => {
    if (initialScrollDoneRef.current || fetchedMessages.length === 0) return;
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    initialScrollDoneRef.current = true;
    setIsScrollReady(true);
  }, [fetchedMessages]);

  // Load older messages on scroll to top; track near-bottom for auto-scroll decisions
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;

    // Keep track of whether user is near the bottom
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;

    if (!hasMore || loadingMessages) return;
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
          // Restore scroll position so the view doesn't jump after prepend
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

    const joinRoom = () => socket.emit('join_room', roomId);
    joinRoom();

    // Re-join room after any reconnect — server drops room membership on disconnect
    socket.on('connect', joinRoom);

    const handleNewMessage = (msg: any) => {
      setRealtimeMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      scrollToBottom();
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
        if (document.visibilityState === 'visible') {
          api.post(`/chat/rooms/${roomId}/read`).catch(() => {});
        }
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: ['chat-room-detail', roomId] });
        }, 3000);
      }
    };

    const handleMessageUpdated = (msg: any) => {
      setRealtimeMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
      setFetchedMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
    };

    const handleMessageDeleted = (data: any) => {
      const deletedId = data?.id || data?.message_id;
      if (!deletedId) return;
      const patch = { deleted_at: data.deleted_at || new Date().toISOString(), is_deleted: true, content: '' };
      setRealtimeMessages(prev => prev.map(m => m.id === deletedId ? { ...m, ...patch } : m));
      setFetchedMessages(prev => prev.map(m => m.id === deletedId ? { ...m, ...patch } : m));
    };

    const handleMessagePinned = (msg: any) => {
      setFetchedMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: msg.is_pinned } : m));
      setRealtimeMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: msg.is_pinned } : m));
      qc.invalidateQueries({ queryKey: ['chat-pinned', roomId] });
    };

    const handleMessageReaction = (data: any) => {
      setFetchedMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, reactions: data.reactions } : m));
      setRealtimeMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, reactions: data.reactions } : m));
    };

    const handleUserTyping = (data: any) => {
      const typingName = data.user_name || data.userId;
      if (data.user_id === user?.id || data.userId === user?.id) return;
      if (data.isTyping === false) {
        setTypingUsers(prev => prev.filter(n => n !== typingName));
      } else {
        setTypingUsers(prev => prev.includes(typingName) ? prev : [...prev, typingName]);
        setTimeout(() => setTypingUsers(prev => prev.filter(n => n !== typingName)), 3000);
      }
    };

    const handleStatusChanged = (data: any) => {
      setStatusMap(prev => ({ ...prev, [data.user_id]: { status: data.status, status_text: data.status_text } }));
      qc.setQueryData(['chat-rooms'], (old: any[]) =>
        old?.map((r: any) =>
          r.dm_other_user_id === data.user_id
            ? { ...r, dm_other_user_status: data.status, dm_other_user_status_text: data.status_text, dm_other_user_status_emoji: data.status_emoji }
            : r
        )
      );
      qc.invalidateQueries({ queryKey: ['chat-room-detail', roomId] });
    };

    const handleMessagesRead = (data: any) => {
      if (data.room_id !== roomId) return;
      setReadMap(prev => ({ ...prev, [data.user_id]: data.read_at }));
    };

    const handleRoomDeleted = (data: any) => {
      if (data?.room_id === roomId || data?.id === roomId) {
        qc.invalidateQueries({ queryKey: ['chat-rooms'] });
        onBack();
        toast('This conversation was deleted');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        api.post(`/chat/rooms/${roomId}/read`).catch(() => {});
        qc.invalidateQueries({ queryKey: ['chat-room-detail', roomId] });
      }
    };

    socket.on('new_message',       handleNewMessage);
    socket.on('message_updated',   handleMessageUpdated);
    socket.on('message_deleted',   handleMessageDeleted);
    socket.on('message_pinned',    handleMessagePinned);
    socket.on('message_reaction',  handleMessageReaction);
    socket.on('user_typing',       handleUserTyping);
    socket.on('user_status_changed', handleStatusChanged);
    socket.on('messages_read',     handleMessagesRead);
    socket.on('room_deleted',      handleRoomDeleted);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      socket.emit('leave_room', roomId);
      socket.off('connect',            joinRoom);
      socket.off('new_message',        handleNewMessage);
      socket.off('message_updated',    handleMessageUpdated);
      socket.off('message_deleted',    handleMessageDeleted);
      socket.off('message_pinned',     handleMessagePinned);
      socket.off('message_reaction',   handleMessageReaction);
      socket.off('user_typing',        handleUserTyping);
      socket.off('user_status_changed', handleStatusChanged);
      socket.off('messages_read',      handleMessagesRead);
      socket.off('room_deleted',       handleRoomDeleted);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setRealtimeMessages([]);
      setTypingUsers([]);
    };
  }, [roomId, accessToken]);

  const scrollToBottom = (force = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    // Only auto-scroll if user is already near the bottom, or forced (own send/upload)
    if (force || isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      isNearBottomRef.current = true;
    }
  };


  const sendMut = useMutation({
    mutationFn: (content: string) => api.post(`/chat/rooms/${roomId}/messages`, {
      content,
      type: 'text',
      ...(replyTo ? { reply_to_id: replyTo.id } : {}),
    }),
    onSuccess: (res) => {
      const saved = res.data?.data || res.data;
      if (saved?.id) {
        setRealtimeMessages(prev => prev.find(m => m.id === saved.id) ? prev : [...prev, saved]);
      }
      setMessage('');
      setReplyTo(null);
      // Defer until after React has flushed the new message into the DOM
      requestAnimationFrame(() => scrollToBottom(true));
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const getToken = () => {
    try { return JSON.parse(localStorage.getItem('ubp-auth') || '{}')?.state?.accessToken || ''; }
    catch { return ''; }
  };

  const uploadFileOptimistic = async (file: File, localId: string) => {
    const BASE = import.meta.env.VITE_API_URL || 'https://foxportal.in/api/v1';
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${BASE}/chat/rooms/${roomId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed (${res.status})`);
      }
      const data = await res.json();
      const msg = data?.data || data;
      setRealtimeMessages(prev => {
        const without = prev.filter(m => (m as any)._localId !== localId);
        if (msg?.id && without.find(m => m.id === msg.id)) return without;
        return msg?.id ? [...without, msg] : without;
      });
      requestAnimationFrame(() => scrollToBottom(true));
    } catch (err: any) {
      setRealtimeMessages(prev => prev.filter(m => (m as any)._localId !== localId));
      toast.error(err?.message || 'Upload failed');
    }
  };

  // Immediately add an optimistic bubble in the chat and start upload in background
  const sendFilesOptimistic = (files: File[]) => {
    if (!files.length) return;
    for (const file of files) {
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
      const optimistic: any = {
        id: localId, _localId: localId, _uploading: true,
        type: isImage ? 'image' : 'file',
        file_name: file.name, file_url: previewUrl || '',
        content: file.name,
        sender_id: user?.id, sender_name: user?.full_name, sender_avatar: (user as any)?.avatar_url,
        created_at: new Date().toISOString(), room_id: roomId,
      };
      setRealtimeMessages(prev => [...prev, optimistic]);
      scrollToBottom(true);
      uploadFileOptimistic(file, localId);
    }
  };

  const stageFiles = (files: File[]) => {
    if (!files.length) return;
    setPendingFiles(prev => [...prev, ...files]);
  };

  // Keep for paste/drag-drop that should upload immediately without staging
  const handleFiles = (files: File[]) => sendFilesOptimistic(files);

  // Auto-grow textarea
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  };

  // Clipboard paste — works from textarea (React) and window-level (captures
  // paste even when focus is not on the textarea, e.g. after clicking a message)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const fileItems = items.filter(i => i.kind === 'file');
    if (!fileItems.length) return;
    e.preventDefault();
    const files = fileItems.map(i => i.getAsFile()).filter(Boolean) as File[];
    if (files.length) handleFiles(files);
  };

  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      // Only intercept if a text input is NOT currently focused (prevent double-firing)
      const active = document.activeElement;
      const isInputFocused = active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable);
      if (isInputFocused) return; // textarea's own onPaste handles it
      const items = Array.from(e.clipboardData?.items || []);
      const fileItems = items.filter(i => i.kind === 'file');
      if (!fileItems.length) return;
      e.preventDefault();
      const files = fileItems.map(i => i.getAsFile()).filter(Boolean) as File[];
      if (files.length) handleFiles(files);
    };
    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [roomId]); // eslint-disable-line

  const handleSend = () => {
    if (editingMsg) {
      if (editText.trim()) editMut.mutate({ id: editingMsg.id, content: editText });
      return;
    }
    if (pendingFiles.length > 0) {
      const toUpload = pendingFiles;
      setPendingFiles([]);
      sendFilesOptimistic(toUpload);
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

  const [showEmojiToolbar, setShowEmojiToolbar] = useState(false);

  const allMessages = [...fetchedMessages, ...realtimeMessages]
    .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i);

  return (
    <div
      className="flex flex-col h-full overflow-hidden bg-background relative"
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
      onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
      onDragLeave={e => {
        // Only clear when leaving the entire chat container, not a child element
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
      }}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) stageFiles(files);
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex-none px-4 py-2.5 border-b border-border flex items-center gap-3 bg-card/50 backdrop-blur-sm">
        <button onClick={onBack} className="md:hidden p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Avatar in header */}
        {isDM
          ? <div className="relative shrink-0">
              <Avatar name={headerTitle} avatarUrl={roomDetail?.dm_other_user_avatar} size={9} />
              <span className="absolute bottom-0 right-0">
                <StatusDot status={roomDetail?.dm_other_user_status} />
              </span>
            </div>
          : <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
        }

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate leading-tight">{headerTitle}</h3>
          {isDM ? (
            <StatusBadge
              status={roomDetail?.dm_other_user_status ?? 'offline'}
              statusText={roomDetail?.dm_other_user_status_text}
              showLabel={true}
              size="xs"
            />
          ) : (
            headerSubtitle && <p className="text-xs text-muted-foreground">{headerSubtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <button onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-md hover:bg-secondary transition-colors ${showSearch ? 'bg-secondary text-primary' : 'text-muted-foreground'}`}
            title="Search">
            <Search className="h-4 w-4" />
          </button>
          <button onClick={onTogglePinned} className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors" title="Pinned messages">
            <Pin className="h-4 w-4" />
          </button>
          <button onClick={onToggleInfo} className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors" title="Info">
            <Info className="h-4 w-4" />
          </button>
          {canDeleteRoom && (
            <div className="relative">
              <button
                onClick={() => setShowHeaderMenu(v => !v)}
                className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
                title="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {showHeaderMenu && (
                <>
                  {/* Backdrop to close on outside click */}
                  <div className="fixed inset-0 z-10" onClick={() => setShowHeaderMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-xl z-20 min-w-[180px] py-1 overflow-hidden">
                    <button
                      onClick={() => {
                        setShowHeaderMenu(false);
                        if (window.confirm('Delete this conversation? This cannot be undone.')) {
                          onDeleteRoom?.();
                        }
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2.5 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 shrink-0" />
                      <span>Delete Conversation</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Search bar ─────────────────────────────────────────── */}
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
      {showSearch && searchQuery.length >= 2 && searchResults && (
        <div className="flex-none border-b border-border max-h-48 overflow-y-auto bg-card">
          {(searchResults as any[]).length === 0
            ? <p className="text-xs text-muted-foreground p-3">No results found</p>
            : (searchResults as any[]).map((r: any) => (
              <div key={r.id} className="px-4 py-2 hover:bg-secondary/50 cursor-pointer text-sm border-b border-border/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate">{r.sender_name}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {r.created_at ? new Date(r.created_at).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="truncate">{r.content}</p>
              </div>
            ))
          }
        </div>
      )}

      {/* Drag-over overlay — covers full chat area (moved to outer container) */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg pointer-events-none">
          <Paperclip className="h-12 w-12 text-primary mb-3" />
          <p className="text-base font-semibold text-primary">Drop files to send</p>
          <p className="text-xs text-muted-foreground mt-1">Images, PDF, ZIP, Excel and more</p>
        </div>
      )}

      {/* ── Message list ───────────────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-4 relative"
      >

        {loadingMessages && fetchedMessages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading…</div>
        )}

        {/* Hidden until initial instant-scroll fires — prevents visible top-to-bottom scroll animation */}
        <div style={{ visibility: isScrollReady ? 'visible' : 'hidden' }}>

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
          const nextMsg = allMessages[i + 1];
          const prevMsg = allMessages[i - 1];
          const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id || showDateSeparator;
          const isLastInGroup  = !nextMsg || nextMsg.sender_id !== msg.sender_id ||
            new Date(nextMsg.created_at).toDateString() !== msgDate;
          const timeStr = msg.created_at
            ? new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
            : '';

          const otherMember = isDM ? roomMembers.find((m: any) => m.user_id !== user?.id) : null;
          const otherLastRead = otherMember ? (readMap[otherMember.user_id] || otherMember.last_read_at) : null;
          const isSeen = isDM && !!otherLastRead &&
            new Date(otherLastRead) >= new Date(msg.created_at);
          const isLastMessage = i === allMessages.length - 1;
          const seenByGroup = !isDM && isLastMessage
            ? roomMembers.filter((m: any) =>
                m.user_id !== user?.id && m.last_read_at &&
                new Date(m.last_read_at) >= new Date(msg.created_at))
            : [];

          return (
            <div key={msg.id || i}>
              {/* Date separator */}
              {showDateSeparator && (
                <div className="flex items-center gap-3 my-5 px-6">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground font-medium px-3 py-0.5 bg-secondary rounded-full whitespace-nowrap">
                    {formatDateLabel(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              {isDeleted ? (
                <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-4 mb-0.5`}>
                  <span className="text-xs italic text-muted-foreground/60 px-3 py-1">This message was deleted</span>
                </div>
              ) : (
                <div
                  className={`flex items-end gap-2 px-4 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'} group relative`}
                  onMouseEnter={() => setHoveredMsg(msg.id)}
                  onMouseLeave={() => setHoveredMsg(null)}
                >
                  {/* Avatar — only for received, only on last in group */}
                  {!isOwn && (
                    <div className="w-8 shrink-0 self-end mb-0.5">
                      {isLastInGroup
                        ? <button onClick={() => setProfileUser({ id: msg.sender_id, full_name: msg.sender_name, avatar_url: msg.sender_avatar })}>
                            <Avatar name={msg.sender_name} avatarUrl={msg.sender_avatar} size={8} />
                          </button>
                        : <div className="w-8 h-8" />
                      }
                    </div>
                  )}

                  <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[72%] md:max-w-[60%]`}>
                    {/* Sender name + time for received messages (first in group) */}
                    {!isOwn && isFirstInGroup && (
                      <div className="flex items-baseline gap-2 mb-1 px-1">
                        <button
                          onClick={() => setProfileUser({ id: msg.sender_id, full_name: msg.sender_name, avatar_url: msg.sender_avatar })}
                          className="text-xs font-semibold text-foreground hover:underline"
                        >
                          {msg.sender_name}
                        </button>
                        <StatusBadge
                          status={statusMap[msg.sender_id]?.status ?? 'offline'}
                          statusText={statusMap[msg.sender_id]?.status_text}
                          showLabel={false}
                          size="xs"
                        />
                        <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                      </div>
                    )}

                    {/* Reply snippet */}
                    {msg.reply_to_id && msg.reply_to_content && (
                      <div className={`text-xs px-3 py-1.5 mb-0.5 rounded-lg border-l-2 border-primary/50 bg-secondary/60 text-muted-foreground max-w-full ${isOwn ? 'text-right border-l-0 border-r-2' : ''}`}>
                        <span className="font-medium">{msg.reply_to_sender || 'User'}</span>: {msg.reply_to_content.slice(0, 80)}
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`relative px-3.5 py-2 ${
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-[18px] rounded-br-[4px]'
                        : 'bg-secondary text-foreground rounded-[18px] rounded-bl-[4px]'
                    } ${isFirstInGroup && isOwn ? 'rounded-tr-[4px]' : ''} ${isFirstInGroup && !isOwn ? 'rounded-tl-[4px]' : ''}`}
                    >
                      {msg.type === 'file' && (msg.file_url || msg._uploading) && (
                        msg._uploading ? (
                          <div className={`flex items-center gap-2 text-xs mb-1 opacity-70`}>
                            <div className={`p-1.5 rounded ${isOwn ? 'bg-primary-foreground/10' : 'bg-primary/10'}`}>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            </div>
                            <span className="truncate max-w-[200px]">{msg.file_name}</span>
                          </div>
                        ) : (
                          <a href={msg.file_url} target="_blank" rel="noreferrer"
                            className={`flex items-center gap-2 text-xs mb-1 ${isOwn ? 'text-primary-foreground/80 hover:text-primary-foreground' : 'text-primary hover:underline'}`}>
                            <div className={`p-1.5 rounded ${isOwn ? 'bg-primary-foreground/10' : 'bg-primary/10'}`}>
                              <Paperclip className="h-3.5 w-3.5" />
                            </div>
                            <span className="truncate max-w-[200px]">{msg.file_name || 'Download file'}</span>
                          </a>
                        )
                      )}
                      {msg.type === 'image' && msg.file_url && (
                        <div className="relative">
                          <img
                            src={msg.file_url} alt=""
                            className="max-w-full rounded-xl mb-1 max-h-64 object-contain cursor-zoom-in"
                            onClick={() => !msg._uploading && setLightboxUrl(msg.file_url)}
                          />
                          {msg._uploading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl mb-1">
                              <Loader2 className="h-6 w-6 animate-spin text-white" />
                            </div>
                          )}
                        </div>
                      )}
                      {msg.content && !(msg.type === 'file' && msg.file_url) && (
                        <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                          {Boolean(msg.is_edited) && <span className="text-[10px] opacity-50 ml-1.5">(edited)</span>}
                        </p>
                      )}
                      {/* Reactions */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap -mb-0.5">
                          {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => (
                            <button key={emoji}
                              onClick={() => api.post(`/chat/messages/${msg.id}/reaction`, { emoji }).catch(() => {})}
                              className={`text-xs rounded-full px-2 py-0.5 flex items-center gap-0.5 ${isOwn ? 'bg-primary-foreground/15 hover:bg-primary-foreground/25' : 'bg-background/60 hover:bg-background border border-border/50'}`}>
                              <span>{emoji}</span>
                              <span className="font-medium">{Array.isArray(users) ? users.length : users}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Timestamp + pin + read receipt — below last bubble in group */}
                    {isLastInGroup && isOwn && (
                      <div className="flex items-center gap-1.5 mt-0.5 px-1">
                        {Boolean(msg.is_pinned) && <Pin className="h-2.5 w-2.5 text-muted-foreground/60" />}
                        <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                        {isSeen
                          ? <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                          : <Check className="w-3.5 h-3.5 text-muted-foreground/60" />
                        }
                      </div>
                    )}
                    {isLastInGroup && !isOwn && Boolean(msg.is_pinned) && (
                      <div className="flex items-center gap-1 mt-0.5 px-1">
                        <Pin className="h-2.5 w-2.5 text-muted-foreground/60" />
                      </div>
                    )}
                    {/* Group seen avatars below last own message */}
                    {isLastMessage && !isDM && seenByGroup.length > 0 && isOwn && (
                      <div className="flex items-center gap-1 mt-1 px-1">
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
                  </div>

                  {/* Hover action toolbar */}
                  {hoveredMsg === msg.id && (
                    <div className={`absolute -top-9 ${isOwn ? 'right-0' : 'left-10'} flex items-center gap-0.5 bg-card border border-border rounded-xl shadow-xl p-1 z-10`}>
                      <div className="relative">
                        <button
                          onClick={() => setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="React"
                        >
                          <Smile className="h-3.5 w-3.5" />
                        </button>
                        {emojiPickerMsgId === msg.id && (
                          <div className={`absolute -top-12 ${isOwn ? 'right-0' : 'left-0'} bg-card border border-border rounded-2xl shadow-2xl p-1.5 flex gap-0.5 z-20`}
                            onMouseLeave={() => setEmojiPickerMsgId(null)}>
                            {['👍','❤️','😂','😮','😢','🔥','✅','👏'].map(emoji => (
                              <button key={emoji} onClick={() => {
                                api.post(`/chat/messages/${msg.id}/reaction`, { emoji }).catch(() => {});
                                setEmojiPickerMsgId(null);
                              }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary text-lg leading-none transition-transform hover:scale-125">
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setReplyTo(msg)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Reply">
                        <Reply className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => pinMut.mutate({ id: msg.id, pinned: Boolean(msg.is_pinned) })}
                        className={`p-1.5 rounded-lg hover:bg-secondary transition-colors ${Boolean(msg.is_pinned) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} title={Boolean(msg.is_pinned) ? 'Unpin' : 'Pin'}>
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      {isOwn && <>
                        <button onClick={() => { setEditingMsg(msg); setEditText(msg.content); }}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { if (confirm('Delete this message?')) deleteMut.mutate(msg.id); }}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
        </div>{/* end visibility wrapper */}
      </div>

      {/* ── Typing indicator ───────────────────────────────────── */}
      {typingUsers.length > 0 && (
        <div className="flex-none px-6 pb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex gap-0.5 items-center">
            <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="italic">
            {typingUsers.length === 1 ? `${typingUsers[0]} is typing…` : `${typingUsers.length} people are typing…`}
          </span>
        </div>
      )}

      {/* ── Reply / Edit context bar ───────────────────────────── */}
      {(replyTo || editingMsg) && (
        <div className={`flex-none mx-4 mb-1 px-3 py-2 rounded-xl border flex items-center gap-2 ${editingMsg ? 'bg-primary/5 border-primary/20' : 'bg-secondary/50 border-border'}`}>
          {editingMsg
            ? <Pencil className="h-3.5 w-3.5 text-primary shrink-0" />
            : <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
          }
          <span className="text-xs truncate flex-1 text-muted-foreground">
            {editingMsg
              ? 'Editing message'
              : <>Replying to <strong className="text-foreground">{replyTo.sender_name}</strong>: {replyTo.content?.slice(0, 60)}</>
            }
          </span>
          <button onClick={() => { setReplyTo(null); setEditingMsg(null); setEditText(''); }}
            className="p-1 rounded-lg hover:bg-secondary text-muted-foreground shrink-0">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ── Input area (Teams-style) ───────────────────────────── */}
      <div className="flex-none px-4 pb-4">
        <div className="relative rounded-2xl border border-border bg-card shadow-sm overflow-visible focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
          {/* @ mention dropdown */}
          {!editingMsg && mention.active && (
            <MentionDropdown
              users={mentionFiltered}
              query={mention.query}
              selectedIdx={mention.idx}
              onSelect={mention.selectUser}
            />
          )}

          <input type="file" multiple ref={fileInputRef} className="hidden" accept="*/*"
            onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; stageFiles(f); }} />

          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1 bg-secondary rounded-lg px-2 py-1 text-xs text-foreground max-w-[200px]">
                  <Paperclip style={{ width: 11, height: 11 }} className="shrink-0 text-muted-foreground" />
                  <span className="truncate">{f.name}</span>
                  <button
                    onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                    className="ml-0.5 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X style={{ width: 11, height: 11 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={editingMsg ? editText : message}
            onChange={e => {
              if (editingMsg) { setEditText(e.target.value); } else { mention.handleChange(e); }
              autoGrow(e.target);
            }}
            onKeyDown={e => mention.handleKeyDown(e, mentionFiltered.length, handleKeyDown)}
            onPaste={handlePaste}
            placeholder={editingMsg ? 'Edit message…' : 'Type a message… (@mention)'}
            rows={1}
            className="w-full px-4 pt-3 pb-1 bg-transparent text-sm focus:outline-none resize-none text-foreground placeholder:text-muted-foreground/60"
            style={{ minHeight: '44px', maxHeight: '128px', overflowY: 'auto' }}
          />

          {/* Toolbar row */}
          <div className="flex items-center gap-0.5 px-2 py-1.5 border-t border-border/50">
            {/* Emoji panel toggle */}
            <div className="relative">
              <button
                onClick={() => setShowEmojiToolbar(!showEmojiToolbar)}
                className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Emoji"
              >
                <Smile className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              </button>
              {showEmojiToolbar && (
                <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-2xl shadow-2xl p-2 flex flex-wrap gap-0.5 w-56 z-30"
                  onMouseLeave={() => setShowEmojiToolbar(false)}>
                  {['😀','😂','😍','🥰','😎','🤔','😅','😭','😡','🥹','👍','❤️','🔥','✅','👏','🎉','💯','🙏','😊','🤝'].map(emoji => (
                    <button key={emoji} onClick={() => {
                      setMessage(m => m + emoji);
                      setShowEmojiToolbar(false);
                      textareaRef.current?.focus();
                    }} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary text-xl transition-transform hover:scale-125">
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Attach file */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingCount > 0}
              className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 relative"
              title={uploadingCount > 0 ? `Uploading ${uploadingCount}…` : 'Attach file'}
            >
              <Paperclip style={{ width: 18, height: 18 }} />
              {uploadingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {uploadingCount}
                </span>
              )}
            </button>

            {/* Attach image */}
            <button
              onClick={() => {
                const inp = document.createElement('input');
                inp.type = 'file';
                inp.accept = 'image/*';
                inp.multiple = true;
                inp.onchange = () => stageFiles(Array.from(inp.files || []));
                inp.click();
              }}
              disabled={uploadingCount > 0}
              className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              title="Attach image"
            >
              <ImageIcon style={{ width: 18, height: 18 }} />
            </button>

            {/* Reply shortcut */}
            <button
              onClick={() => textareaRef.current?.focus()}
              className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Reply"
            >
              <Reply style={{ width: 18, height: 18 }} />
            </button>

            <div className="flex-1" />

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={editingMsg ? !editText.trim() : (!message.trim() && pendingFiles.length === 0)}
              className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send"
            >
              {editingMsg ? <Check style={{ width: 18, height: 18 }} /> : <Send style={{ width: 18, height: 18 }} />}
            </button>
          </div>
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

      {/* Image lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <button className="absolute top-4 right-4 text-white/80 hover:text-white p-2">
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl} alt=""
            className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
