import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Inbox, Plus, RefreshCw, Search, Send, Clock,
  X, Check, MoreVertical,
  Settings, Mail, Tag, Zap, Archive,
  ArrowLeft, UserPlus, Loader2, Bot, ChevronDown, CalendarDays,
  FolderOpen, FolderPlus, Trash2, ArrowUpDown,
} from 'lucide-react';
import api, { inboxApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ── helpers ────────────────────────────────────────────────────────────────

const fmtRelative = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const fmtDateTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

const errMsg = (e: any) =>
  e?.response?.data?.error || e?.response?.data?.message || 'Something went wrong';

const ADMIN_ROLES = ['super_admin', 'admin'];

// ── date preset helpers ────────────────────────────────────────────────────

const toYMD = (d: Date) => d.toISOString().slice(0, 10);

const DATE_PRESETS: { label: string; key: string; from: () => string; to: () => string }[] = [
  {
    label: 'Today', key: 'today',
    from: () => toYMD(new Date()),
    to:   () => toYMD(new Date()),
  },
  {
    label: 'This week', key: 'week',
    from: () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return toYMD(d); },
    to:   () => toYMD(new Date()),
  },
  {
    label: 'This month', key: 'month',
    from: () => { const d = new Date(); d.setDate(1); return toYMD(d); },
    to:   () => toYMD(new Date()),
  },
  {
    label: 'Last month', key: 'lastmonth',
    from: () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return toYMD(d); },
    to:   () => { const d = new Date(); d.setDate(0); return toYMD(d); },
  },
  {
    label: 'Last 3 months', key: '3mo',
    from: () => { const d = new Date(); d.setMonth(d.getMonth() - 3); return toYMD(d); },
    to:   () => toYMD(new Date()),
  },
  {
    label: 'This year', key: 'year',
    from: () => `${new Date().getFullYear()}-01-01`,
    to:   () => toYMD(new Date()),
  },
  {
    label: 'Last year', key: 'lastyear',
    from: () => `${new Date().getFullYear() - 1}-01-01`,
    to:   () => `${new Date().getFullYear() - 1}-12-31`,
  },
];

const INP = 'w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400/50 transition-colors';
const LBL = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';

// ── types ──────────────────────────────────────────────────────────────────

interface SharedInbox {
  id: string; name: string; email_address: string;
  ai_followup_enabled: number; ai_followup_delay_hr: number; ai_followup_tone: string;
  last_synced_at?: string; member_count?: number; thread_count?: number;
  imap_host: string; imap_port: number; imap_secure: number;
  imap_user: string; imap_password?: string;
  smtp_host: string; smtp_port: number; smtp_secure: number;
  smtp_user: string; smtp_password?: string;
}

interface Thread {
  id: string; inbox_id: string; subject: string;
  client_email: string; client_name?: string; received_on?: string;
  assigned_to?: string; assignee_name?: string; assignee_avatar?: string;
  status: 'open' | 'followup' | 'closed';
  followup_count: number; last_inbound_at?: string; last_outbound_at?: string;
  ai_sent_at?: string; updated_at: string; message_count: number; last_body?: string;
  folder_id?: string; folder_name?: string; folder_color?: string;
}

interface Message {
  id: string; direction: 'inbound' | 'outbound';
  from_address: string; from_name?: string;
  to_addresses: string; cc_addresses?: string;
  subject: string; body_text?: string; body_html?: string;
  sender_name?: string; is_ai_generated: number;
  scheduled_at?: string; sent_at?: string; status: string; created_at: string;
}

interface Sender { id: string; email_address: string; display_name?: string; }

// ── StatusBadge ────────────────────────────────────────────────────────────

function ThreadStatusBadge({ thread }: { thread: Thread }) {
  if (thread.status === 'closed')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"><Archive size={10} /> Closed</span>;
  if (thread.status === 'followup')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><Tag size={10} /> Follow-up ({thread.followup_count}/5)</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><Mail size={10} /> Open</span>;
}

function AvatarFallback({ name, size = 8 }: { name?: string; size?: number }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500'];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`w-${size} h-${size} rounded-full ${color} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function SharedInbox() {
  const user = useAuthStore(s => s.user);
  const isAdmin = ADMIN_ROLES.includes(user?.role || '');
  const qc = useQueryClient();
  const navigate = useNavigate();

  const basePath = window.location.pathname.startsWith('/emp') ? '/emp/inbox' : '/admin/inbox';

  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQ, setSearchQ] = useState('');
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [selectedFolderId, setSelectedFolderIdRaw] = useState<string | null>(null);
  const [showMoveFolder, setShowMoveFolder] = useState(false);
  const [moveFolderThreadId, setMoveFolderThreadId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);

  // Persist folder selection per inbox in localStorage
  const setSelectedFolderId = (fid: string | null) => {
    setSelectedFolderIdRaw(fid);
    if (selectedInboxId) {
      if (fid) localStorage.setItem(`inbox_folder_${selectedInboxId}`, fid);
      else localStorage.removeItem(`inbox_folder_${selectedInboxId}`);
    }
  };

  // Restore folder selection when inbox changes; reset sort to newest-first
  useEffect(() => {
    if (selectedInboxId) {
      const saved = localStorage.getItem(`inbox_folder_${selectedInboxId}`);
      setSelectedFolderIdRaw(saved || null);
      setSortOrder('desc');
    }
  }, [selectedInboxId]);

  const [datePreset, setDatePreset] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const applyPreset = (key: string) => {
    const preset = DATE_PRESETS.find(p => p.key === key);
    if (!preset) { setDatePreset(''); setDateFrom(''); setDateTo(''); return; }
    setDatePreset(key);
    setDateFrom(preset.from());
    setDateTo(preset.to());
  };

  const clearDate = () => { setDatePreset(''); setDateFrom(''); setDateTo(''); };

  const [showNewThread, setShowNewThread] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  const anyOverlayOpen = showNewThread || showAssign || showMoveFolder;

  // ── Queries ──────────────────────────────────────────────────

  const { data: inboxes = [], isLoading: loadingInboxes } = useQuery<SharedInbox[]>({
    queryKey: ['shared-inboxes'],
    queryFn: () => inboxApi.getInboxes().then(r => r.data),
    staleTime: 60_000, refetchOnWindowFocus: false,
    refetchInterval: anyOverlayOpen ? false : 60_000,
  });

  const selectedInbox = inboxes.find(i => i.id === selectedInboxId) ?? null;

  const {
    data: threadPages,
    isLoading: loadingThreads,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['inbox-threads', selectedInboxId, filterStatus, searchQ, showUnassigned, dateFrom, dateTo, selectedFolderId, sortOrder],
    queryFn: ({ pageParam = 1 }) => inboxApi.getThreads(selectedInboxId!, {
      status: filterStatus === 'all' ? undefined : filterStatus,
      search: searchQ || undefined,
      unassigned: showUnassigned ? '1' : undefined,
      from_date: dateFrom || undefined,
      to_date:   dateTo   || undefined,
      folder_id: selectedFolderId || undefined,
      order: sortOrder,
      page: pageParam,
      limit: 100,
    }).then(r => {
      const d = r.data;
      if (Array.isArray(d)) return { threads: d as Thread[], hasMore: false, page: 1, total: d.length };
      return d as { threads: Thread[]; hasMore: boolean; page: number; total: number };
    }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => lastPage.hasMore ? allPages.length + 1 : undefined,
    enabled: !!selectedInboxId,
    staleTime: 30_000, refetchOnWindowFocus: false,
    refetchInterval: anyOverlayOpen ? false : 30_000,
  });

  const threads = threadPages?.pages.flatMap(p => p.threads) ?? [];
  const total   = threadPages?.pages[0]?.total ?? 0;

  const { data: threadDetail, isLoading: loadingThread } = useQuery<{ thread: Thread; messages: Message[]; senders: Sender[] }>({
    queryKey: ['inbox-thread', selectedInboxId, selectedThreadId],
    queryFn: () => inboxApi.getThread(selectedInboxId!, selectedThreadId!).then(r => r.data),
    enabled: !!(selectedInboxId && selectedThreadId),
    staleTime: 30_000, refetchOnWindowFocus: false,
    refetchInterval: anyOverlayOpen ? false : 30_000,
  });

  const { data: members = [] } = useQuery<any[]>({
    queryKey: ['inbox-members', selectedInboxId],
    queryFn: () => inboxApi.getMembers(selectedInboxId!).then(r => r.data),
    enabled: !!selectedInboxId,
    staleTime: 60_000, refetchOnWindowFocus: false,
  });

  const { data: salesUsers = [] } = useQuery<any[]>({
    queryKey: ['sales-users'],
    queryFn: () => api.get('/users/active').then(r => {
      const all: any[] = r.data?.data || r.data || [];
      return all.filter((u: any) => ['sales_rep', 'sales_manager', 'pre_sales', 'marketing'].includes(u.role));
    }),
    staleTime: 120_000, refetchOnWindowFocus: false,
  });

  const { data: senders = [] } = useQuery<Sender[]>({
    queryKey: ['inbox-senders', selectedInboxId],
    queryFn: () => inboxApi.getSenders(selectedInboxId!).then(r => r.data),
    enabled: !!selectedInboxId,
    staleTime: 60_000, refetchOnWindowFocus: false,
  });

  const { data: folders = [], refetch: refetchFolders } = useQuery<any[]>({
    queryKey: ['inbox-folders', selectedInboxId],
    queryFn: () => inboxApi.getFolders(selectedInboxId!).then(r => r.data),
    enabled: !!selectedInboxId,
    staleTime: 60_000, refetchOnWindowFocus: false,
  });

  // ── Mutations ────────────────────────────────────────────────

  const syncMut = useMutation({
    mutationFn: () => inboxApi.syncInbox(selectedInboxId!),
    onSuccess: (r) => {
      toast.success(`Synced — ${r.data.synced} new message(s)`);
      qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] });
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const pullOlderMut = useMutation({
    mutationFn: () => inboxApi.pullOlderEmails(selectedInboxId!),
    onSuccess: (r) => {
      const { imported, hasMore } = r.data;
      if (imported > 0) {
        toast.success(`Imported ${imported} older email${imported !== 1 ? 's' : ''}${hasMore ? ' — click again to load more' : ''}`);
        qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] });
      } else {
        toast.success(hasMore ? 'All emails in this batch already synced' : 'No more older emails on server');
      }
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const patchThreadMut = useMutation({
    mutationFn: ({ tid, data }: { tid: string; data: any }) =>
      inboxApi.patchThread(selectedInboxId!, tid, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] }),
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const assignMut = useMutation({
    mutationFn: ({ tid, uid }: { tid: string; uid: string | null }) =>
      inboxApi.assignThread(selectedInboxId!, tid, uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] });
      qc.invalidateQueries({ queryKey: ['inbox-thread', selectedInboxId, selectedThreadId] });
      setShowAssign(false);
      toast.success('Thread assigned');
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const moveFolderMut = useMutation({
    mutationFn: ({ tid, fid }: { tid: string; fid: string | null }) =>
      inboxApi.moveThread(selectedInboxId!, tid, fid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] });
      qc.invalidateQueries({ queryKey: ['inbox-thread', selectedInboxId, selectedThreadId] });
      setShowMoveFolder(false);
      toast.success('Moved');
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const createFolderMut = useMutation({
    mutationFn: (name: string) => inboxApi.createFolder(selectedInboxId!, { name }),
    onSuccess: () => {
      refetchFolders();
      setNewFolderName('');
      setShowNewFolder(false);
      toast.success('Folder created');
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const deleteFolderMut = useMutation({
    mutationFn: (fid: string) => inboxApi.deleteFolder(selectedInboxId!, fid),
    onSuccess: () => {
      refetchFolders();
      if (selectedFolderId && deleteFolderMut.variables === selectedFolderId) setSelectedFolderId(null);
      toast.success('Folder deleted');
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  // Auto-select first inbox
  useEffect(() => {
    if (inboxes.length > 0 && !selectedInboxId) {
      setSelectedInboxId(inboxes[0].id);
    }
  }, [inboxes]);

  // Redirect admins to create page when no inboxes exist
  useEffect(() => {
    if (!loadingInboxes && inboxes.length === 0 && isAdmin) {
      navigate(`${basePath}/new`, { replace: true });
    }
  }, [loadingInboxes, inboxes.length, isAdmin]);

  // ── Reply state ──────────────────────────────────────────────

  const [replyText, setReplyText] = useState('');
  const [replyFrom, setReplyFrom] = useState('');
  const [replyCC, setReplyCC] = useState('');
  const [sendLater, setSendLater] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const replyFromInitialised = useRef<string | null>(null);

  useEffect(() => {
    if (threadDetail?.senders?.length && replyFromInitialised.current !== selectedThreadId) {
      replyFromInitialised.current = selectedThreadId;
      setReplyFrom(threadDetail.thread.received_on || threadDetail.senders[0].email_address);
    }
  }, [threadDetail, selectedThreadId]);

  const sendReply = async () => {
    if (!replyText.trim() || !selectedInboxId || !selectedThreadId) return;
    setSendingReply(true);
    try {
      await inboxApi.replyThread(selectedInboxId, selectedThreadId, {
        body_text: replyText,
        from_address: replyFrom,
        cc: replyCC || undefined,
        scheduled_at: sendLater || undefined,
      });
      toast.success(sendLater ? 'Scheduled!' : 'Sent!');
      setReplyText(''); setReplyCC(''); setSendLater('');
      qc.invalidateQueries({ queryKey: ['inbox-thread', selectedInboxId, selectedThreadId] });
      qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] });
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSendingReply(false);
    }
  };

  const openThread = (tid: string) => setSelectedThreadId(tid);

  if (loadingInboxes) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" size={32} /></div>;
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">

      {/* ── Left sidebar: inbox list ──────────────────────────── */}
      <div className="w-52 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800">
        <div className="p-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Inboxes</span>
          {isAdmin && (
            <button
              onClick={() => navigate(`${basePath}/new`)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              title="Create new inbox"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {inboxes.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-gray-400">No inboxes yet.</p>
            </div>
          ) : inboxes.map(inbox => (
            <button
              key={inbox.id}
              onClick={() => { setSelectedInboxId(inbox.id); setSelectedThreadId(null); }}
              className={`w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selectedInboxId === inbox.id ? 'bg-violet-50 dark:bg-violet-900/20 border-r-2 border-violet-500' : ''}`}
            >
              <Inbox size={15} className={`mt-0.5 flex-shrink-0 ${selectedInboxId === inbox.id ? 'text-violet-600' : 'text-gray-400'}`} />
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${selectedInboxId === inbox.id ? 'text-violet-700 dark:text-violet-400' : 'text-gray-700 dark:text-gray-300'}`}>{inbox.name}</p>
                <p className="text-xs text-gray-400 truncate">{inbox.email_address}</p>
              </div>
            </button>
          ))}
        </div>
        {selectedInboxId && (
          <div className="border-t border-gray-100 dark:border-gray-700">
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Folders</span>
              {isAdmin && (
                <button onClick={() => setShowNewFolder(v => !v)}
                  className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                  <FolderPlus size={13} />
                </button>
              )}
            </div>
            {showNewFolder && (
              <div className="px-2 pb-2 flex gap-1">
                <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newFolderName.trim()) createFolderMut.mutate(newFolderName.trim()); if (e.key === 'Escape') setShowNewFolder(false); }}
                  placeholder="Folder name…"
                  className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                <button onClick={() => newFolderName.trim() && createFolderMut.mutate(newFolderName.trim())}
                  disabled={createFolderMut.isPending || !newFolderName.trim()}
                  className="px-2 py-1 bg-violet-600 text-white text-xs rounded hover:bg-violet-700 disabled:opacity-50">
                  Add
                </button>
              </div>
            )}
            <div className="pb-1">
              <button onClick={() => setSelectedFolderId(null)}
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!selectedFolderId ? 'text-violet-600 dark:text-violet-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                <FolderOpen size={12} />All threads
              </button>
              {folders.map(f => (
                <div key={f.id} className={`group flex items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selectedFolderId === f.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}>
                  <button onClick={() => setSelectedFolderId(f.id)}
                    className="flex-1 text-left px-3 py-1.5 flex items-center gap-2 text-xs min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: f.color }} />
                    <span className={`truncate ${selectedFolderId === f.id ? 'text-violet-700 dark:text-violet-300 font-medium' : 'text-gray-600 dark:text-gray-300'}`}>{f.name}</span>
                  </button>
                  {isAdmin && (
                    <button onClick={() => deleteFolderMut.mutate(f.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 mr-1 rounded text-gray-400 hover:text-red-500 transition-all">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Middle: thread list ───────────────────────────────── */}
      {selectedInbox && (
        <div className={`flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${selectedThreadId ? 'hidden lg:flex w-72 flex-shrink-0' : 'flex-1 max-w-sm'}`}>
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{selectedInbox.name}</h2>
                {selectedInbox.ai_followup_enabled ? <span title="AI follow-up on" className="text-emerald-500 flex-shrink-0"><Zap size={12} /></span> : null}
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending} title="Sync IMAP"
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                  <RefreshCw size={14} className={syncMut.isPending ? 'animate-spin' : ''} />
                </button>
                {isAdmin && <>
                  <button
                    onClick={() => navigate(`${basePath}/${selectedInbox.id}/settings`)}
                    title="Edit IMAP / SMTP settings"
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                    <Settings size={14} />
                  </button>
                  <button
                    onClick={() => navigate(`${basePath}/${selectedInbox.id}/members`)}
                    title="Manage senders & members"
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                    <UserPlus size={14} />
                  </button>
                  <button onClick={() => setShowNewThread(true)} title="New outbound email"
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                    <Plus size={14} />
                  </button>
                </>}
              </div>
            </div>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search threads…"
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400" />
            </div>
            {selectedFolderId && (
              <div className="flex items-center gap-1.5 px-1 py-0.5 mb-1">
                <span className="text-xs text-violet-600 dark:text-violet-400 flex items-center gap-1">
                  <FolderOpen size={11} />
                  {folders.find(f => f.id === selectedFolderId)?.name || 'Folder'}
                </span>
                <button onClick={() => setSelectedFolderId(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={11} />
                </button>
              </div>
            )}
            <div className="flex gap-1 flex-wrap">
              {['all', 'open', 'followup', 'closed'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${filterStatus === s ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              {isAdmin && (
                <button onClick={() => setShowUnassigned(!showUnassigned)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${showUnassigned ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  Unassigned
                </button>
              )}
              <button onClick={() => setShowDateFilter(v => !v)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors flex items-center gap-1 ${(dateFrom || dateTo) ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                <CalendarDays size={11} />Date
              </button>
              <button onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                title={sortOrder === 'desc' ? 'Showing newest first' : 'Showing oldest first'}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors flex items-center gap-1 ${sortOrder === 'asc' ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                <ArrowUpDown size={11} />{sortOrder === 'asc' ? 'Oldest' : 'Newest'}
              </button>
            </div>

            {/* ── Date filter panel ── */}
            {showDateFilter && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {DATE_PRESETS.map(p => (
                    <button key={p.key} onClick={() => applyPreset(p.key)}
                      className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${datePreset === p.key ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      {p.label}
                    </button>
                  ))}
                  {(dateFrom || dateTo) && (
                    <button onClick={clearDate}
                      className="px-2 py-0.5 text-xs rounded-full border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      Clear
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-xs text-gray-400 mb-0.5 block">From</label>
                    <input type="date" value={dateFrom}
                      onChange={e => { setDatePreset('custom'); setDateFrom(e.target.value); }}
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-0.5 block">To</label>
                    <input type="date" value={dateTo}
                      onChange={e => { setDatePreset('custom'); setDateTo(e.target.value); }}
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {loadingThreads ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Mail size={32} className="text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No threads{(dateFrom || dateTo) ? ' in this date range' : ''}</p>
              </div>
            ) : threads.map(thread => (
              <ThreadRow key={thread.id} thread={thread}
                selected={selectedThreadId === thread.id}
                isAdmin={isAdmin} members={members} folders={folders}
                onSelect={() => openThread(thread.id)}
                onStatusChange={status => patchThreadMut.mutate({ tid: thread.id, data: { status } })}
                onAssign={() => { setSelectedThreadId(thread.id); setShowAssign(true); }}
                onMoveFolder={() => { setMoveFolderThreadId(thread.id); setShowMoveFolder(true); }}
              />
            ))}
            <div className="border-t border-gray-100 dark:border-gray-700 p-3 space-y-2">
              {threads.length > 0 && (
                <p className="text-xs text-center text-gray-400">Showing {threads.length} of {total} threads</p>
              )}
              {hasNextPage && (
                <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border border-violet-200 dark:border-violet-700 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-600 dark:text-violet-400 disabled:opacity-50 transition-colors">
                  <ChevronDown size={12} className={isFetchingNextPage ? 'animate-bounce' : ''} />
                  {isFetchingNextPage ? 'Loading…' : 'Load older threads'}
                </button>
              )}
              <button onClick={() => pullOlderMut.mutate()} disabled={pullOlderMut.isPending}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-50 transition-colors">
                <RefreshCw size={12} className={pullOlderMut.isPending ? 'animate-spin' : ''} />
                {pullOlderMut.isPending ? 'Pulling from server…' : 'Pull older emails from mail server'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Right: thread detail or empty state ──────────────── */}
      {selectedThreadId && threadDetail ? (
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-800">
          <div className="flex items-start justify-between gap-4 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setSelectedThreadId(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 lg:hidden">
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-800 dark:text-gray-100 truncate">{threadDetail.thread.subject}</h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-500">{threadDetail.thread.client_email}</span>
                  <ThreadStatusBadge thread={threadDetail.thread} />
                  {threadDetail.thread.ai_sent_at && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      <Bot size={10} /> AI sent
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isAdmin && (
                <button onClick={() => setShowAssign(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <UserPlus size={13} />{threadDetail.thread.assignee_name || 'Assign'}
                </button>
              )}
              {isAdmin && threadDetail.thread.folder_id && (
                <button onClick={() => { setMoveFolderThreadId(selectedThreadId); setShowMoveFolder(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                  style={{ borderColor: threadDetail.thread.folder_color || undefined }}>
                  <FolderOpen size={13} />{threadDetail.thread.folder_name}
                </button>
              )}
              {isAdmin && !threadDetail.thread.folder_id && (
                <button onClick={() => { setMoveFolderThreadId(selectedThreadId); setShowMoveFolder(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <FolderPlus size={13} />Folder
                </button>
              )}
              <StatusDropdown status={threadDetail.thread.status}
                onChange={s => patchThreadMut.mutate({ tid: selectedThreadId, data: { status: s } })} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingThread ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
            ) : threadDetail.messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
          </div>
          {threadDetail.thread.status !== 'closed' && (
            <div className="border-t border-gray-100 dark:border-gray-700 p-4">
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400 flex-shrink-0">From:</span>
                    <select value={replyFrom} onChange={e => setReplyFrom(e.target.value)}
                      className="text-xs text-gray-700 dark:text-gray-200 bg-transparent border-none outline-none cursor-pointer">
                      {threadDetail.senders.map(s => (
                        <option key={s.id} value={s.email_address}>{s.display_name || s.email_address}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-xs text-gray-400 flex-shrink-0">CC:</span>
                    <input value={replyCC} onChange={e => setReplyCC(e.target.value)} placeholder="optional"
                      className="text-xs flex-1 bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400" />
                  </div>
                </div>
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="Write your reply…" rows={5}
                  className="w-full px-3 py-2 text-sm bg-transparent outline-none resize-none text-gray-700 dark:text-gray-200 placeholder-gray-400" />
                <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-gray-400" />
                    <input type="datetime-local" value={sendLater} onChange={e => setSendLater(e.target.value)}
                      className="text-xs bg-transparent outline-none text-gray-500 dark:text-gray-400 cursor-pointer"
                      title="Send later — leave blank to send now" />
                  </div>
                  <button onClick={sendReply} disabled={sendingReply || !replyText.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    {sendingReply ? <Loader2 size={14} className="animate-spin" /> : sendLater ? <Clock size={14} /> : <Send size={14} />}
                    {sendLater ? 'Schedule' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center text-gray-300 dark:text-gray-600">
          <div className="text-center">
            <Inbox size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{selectedInboxId ? 'Select a thread to read' : 'Select an inbox'}</p>
          </div>
        </div>
      )}

      {/* ── Small overlay modals ───────────────────────────────── */}
      {showNewThread && selectedInboxId && (
        <NewThreadModal inboxId={selectedInboxId} senders={senders}
          onClose={() => setShowNewThread(false)}
          onCreated={(tid) => { setShowNewThread(false); openThread(tid); qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] }); }} />
      )}

      {showAssign && selectedInboxId && selectedThreadId && (
        <AssignModal salesUsers={salesUsers} currentAssignee={threadDetail?.thread.assigned_to}
          onClose={() => setShowAssign(false)}
          onAssign={(uid) => assignMut.mutate({ tid: selectedThreadId, uid })} />
      )}

      {showMoveFolder && selectedInboxId && moveFolderThreadId && (
        <MoveFolderModal
          folders={folders}
          currentFolderId={threads.find(t => t.id === moveFolderThreadId)?.folder_id || threadDetail?.thread.folder_id}
          onClose={() => setShowMoveFolder(false)}
          onMove={(fid) => moveFolderMut.mutate({ tid: moveFolderThreadId, fid })}
        />
      )}
    </div>
  );
}

// ── ThreadRow ──────────────────────────────────────────────────────────────

function ThreadRow({ thread, selected, isAdmin, members, folders, onSelect, onStatusChange, onAssign, onMoveFolder }: {
  thread: Thread; selected: boolean; isAdmin: boolean; members: any[]; folders: any[];
  onSelect: () => void; onStatusChange: (s: string) => void; onAssign: () => void; onMoveFolder: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  return (
    <div onClick={onSelect}
      className={`relative flex items-start gap-2.5 px-3 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${selected ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}>
      <AvatarFallback name={thread.client_name || thread.client_email} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{thread.client_name || thread.client_email}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">{fmtDateTime(thread.last_inbound_at || thread.updated_at)}</span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300 truncate mt-0.5">{thread.subject}</p>
        <p className="text-xs text-gray-400 truncate mt-0.5">{thread.last_body?.slice(0, 80)}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <ThreadStatusBadge thread={thread} />
          {thread.assignee_name && <span className="text-xs text-gray-400 truncate">→ {thread.assignee_name}</span>}
          {thread.folder_name && (
            <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: (thread.folder_color || '#6366f1') + '22', color: thread.folder_color || '#6366f1' }}>
              <FolderOpen size={9} />{thread.folder_name}
            </span>
          )}
        </div>
      </div>
      <div ref={menuRef} className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400">
          <MoreVertical size={14} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-6 z-20 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 text-xs">
            {['open', 'followup', 'closed'].map(s => (
              <button key={s} onClick={() => { onStatusChange(s); setMenuOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 ${thread.status === s ? 'font-semibold' : ''}`}>
                {thread.status === s ? <Check size={12} className="text-violet-500" /> : <span className="w-3" />}
                Mark {s}
              </button>
            ))}
            {isAdmin && (
              <button onClick={() => { onAssign(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-t border-gray-100 dark:border-gray-700 mt-1 pt-2">
                <UserPlus size={12} /> Assign
              </button>
            )}
            {isAdmin && folders && folders.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                <p className="px-3 py-1 text-xs text-gray-400">Move to folder</p>
                <button onClick={() => { onMoveFolder(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs">
                  <FolderOpen size={12} /> Choose folder…
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MessageBubble ──────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === 'outbound';
  const isScheduled = msg.status === 'scheduled';
  return (
    <div className={`flex gap-3 ${isOut ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${isOut ? 'bg-violet-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
        {isOut ? (msg.is_ai_generated ? <Bot size={14} /> : <Send size={12} />) : (msg.from_name || msg.from_address || '?')[0].toUpperCase()}
      </div>
      <div className={`max-w-[75%] flex flex-col gap-1 ${isOut ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {isOut ? (msg.is_ai_generated ? 'AI Auto-reply' : 'You') : (msg.from_name || msg.from_address)}
          </span>
          <span className="text-xs text-gray-400">{fmtDateTime(msg.sent_at || msg.created_at)}</span>
          {isScheduled && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              <Clock size={10} /> Scheduled {fmtDateTime(msg.scheduled_at)}
            </span>
          )}
        </div>
        <div className={`rounded-2xl px-4 py-3 text-sm ${isOut ? 'bg-violet-600 text-white rounded-tr-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-sm'}`}>
          {msg.body_html ? (
            <div className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: msg.body_html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') }} />
          ) : (
            <pre className="whitespace-pre-wrap font-sans">{msg.body_text}</pre>
          )}
        </div>
        {msg.cc_addresses && <span className="text-xs text-gray-400">CC: {msg.cc_addresses}</span>}
      </div>
    </div>
  );
}

// ── StatusDropdown ─────────────────────────────────────────────────────────

function StatusDropdown({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const labels: Record<string, string> = { open: 'Open', followup: 'Follow-up', closed: 'Closed' };
  const colors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    followup: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  };
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${colors[status] || colors.open}`}>
        {labels[status] || status}<ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1">
          {Object.entries(labels).map(([k, v]) => (
            <button key={k} onClick={() => { onChange(k); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 ${status === k ? 'font-semibold' : ''}`}>
              {status === k ? <Check size={11} className="text-violet-500" /> : <span className="w-3" />}{v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AssignModal ────────────────────────────────────────────────────────────

function AssignModal({ salesUsers, currentAssignee, onClose, onAssign }: {
  salesUsers: any[]; currentAssignee?: string; onClose: () => void; onAssign: (uid: string | null) => void;
}) {
  const roleLabel: Record<string, string> = { sales_rep: 'Sales Rep', sales_manager: 'Sales Manager', pre_sales: 'Pre-Sales', marketing: 'Marketing' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-80 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Assign to Sales</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-2">
          <button onClick={() => onAssign(null)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-500">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center"><X size={14} /></div>
            Unassign
          </button>
          {salesUsers.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No sales users found.</p>
          )}
          {salesUsers.map(u => (
            <button key={u.id} onClick={() => onAssign(u.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm ${currentAssignee === u.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}>
              <AvatarFallback name={u.full_name} />
              <div className="text-left min-w-0">
                <p className="text-gray-800 dark:text-gray-100 font-medium truncate">{u.full_name}</p>
                <p className="text-xs text-gray-400">{roleLabel[u.role] || u.role}</p>
              </div>
              {currentAssignee === u.id && <Check size={14} className="ml-auto flex-shrink-0 text-violet-500" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MoveFolderModal ────────────────────────────────────────────────────────

function MoveFolderModal({ folders, currentFolderId, onClose, onMove }: {
  folders: any[]; currentFolderId?: string; onClose: () => void; onMove: (fid: string | null) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-72 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Move to folder</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-2">
          <button onClick={() => onMove(null)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm ${!currentFolderId ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center">
              <FolderOpen size={14} className="text-gray-500" />
            </div>
            <span className="text-gray-700 dark:text-gray-200">No folder</span>
            {!currentFolderId && <Check size={14} className="ml-auto text-violet-500" />}
          </button>
          {folders.map(f => (
            <button key={f.id} onClick={() => onMove(f.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm ${currentFolderId === f.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: (f.color || '#6366f1') + '22' }}>
                <FolderOpen size={14} style={{ color: f.color || '#6366f1' }} />
              </div>
              <span className="text-gray-700 dark:text-gray-200">{f.name}</span>
              {currentFolderId === f.id && <Check size={14} className="ml-auto text-violet-500" />}
            </button>
          ))}
          {folders.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No folders yet. Create one from the sidebar.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── NewThreadModal ─────────────────────────────────────────────────────────

function NewThreadModal({ inboxId, senders, onClose, onCreated }: {
  inboxId: string; senders: Sender[]; onClose: () => void; onCreated: (tid: string) => void;
}) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [from, setFrom] = useState(senders[0]?.email_address || '');
  const [cc, setCc] = useState('');
  const [sendLater, setSendLater] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!to || !subject || !body) { toast.error('To, Subject and Body are required'); return; }
    setSaving(true);
    try {
      const r = await inboxApi.newThread(inboxId, {
        to, subject, body_text: body, from_address: from,
        cc: cc || undefined, scheduled_at: sendLater || undefined,
      });
      toast.success(sendLater ? 'Scheduled!' : 'Email sent!');
      onCreated(r.data.thread_id);
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">New Email</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>From</label>
              <select value={from} onChange={e => setFrom(e.target.value)} className={INP}>
                {senders.map(s => <option key={s.id} value={s.email_address}>{s.display_name || s.email_address}</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>To</label>
              <input value={to} onChange={e => setTo(e.target.value)} placeholder="client@example.com" className={INP} />
            </div>
          </div>
          <div><label className={LBL}>Subject</label><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className={INP} /></div>
          <div><label className={LBL}>CC (optional)</label><input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com" className={INP} /></div>
          <div><label className={LBL}>Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="Write your email…" className={`${INP} resize-none`} />
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-400" />
            <label className="text-xs text-gray-500">Send later:</label>
            <input type="datetime-local" value={sendLater} onChange={e => setSendLater(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 focus:outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-4 pb-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : sendLater ? <Clock size={14} /> : <Send size={14} />}
            {sendLater ? 'Schedule' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
