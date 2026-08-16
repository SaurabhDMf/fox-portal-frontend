import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalBase } from '@/hooks/usePortalBase';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Inbox, Plus, RefreshCw, Search, Send, Clock,
  X, Check, MoreVertical,
  Settings, Mail, Tag, Zap, Archive,
  ArrowLeft, UserPlus, Loader2, Bot, ChevronDown, CalendarDays,
  FolderOpen, FolderPlus, Trash2, ArrowUpDown, ShieldAlert, MoveRight,
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

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time — toISOString() would
// shift to UTC and silently pick the wrong hour for the preset.
const toLocalDateTimeValue = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function sendLaterPresets(): Array<{ label: string; value: string }> {
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const tomorrowMorning = new Date(tomorrow); tomorrowMorning.setHours(8, 0, 0, 0);
  const tomorrowAfternoon = new Date(tomorrow); tomorrowAfternoon.setHours(13, 0, 0, 0);
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  nextMonday.setHours(8, 0, 0, 0);
  return [
    { label: 'Tomorrow morning, 8:00 AM', value: toLocalDateTimeValue(tomorrowMorning) },
    { label: 'Tomorrow afternoon, 1:00 PM', value: toLocalDateTimeValue(tomorrowAfternoon) },
    { label: 'Monday morning, 8:00 AM', value: toLocalDateTimeValue(nextMonday) },
  ];
}

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

const INP = 'w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors';
const LBL = 'block text-xs font-medium text-muted-foreground mb-1';

// ── types ──────────────────────────────────────────────────────────────────

interface SharedInbox {
  id: string; name: string; email_address: string;
  ai_followup_enabled: number; ai_followup_delay_hr: number; ai_followup_tone: string;
  last_synced_at?: string; member_count?: number; thread_count?: number;
  imap_host: string; imap_port: number; imap_secure: number;
  imap_user: string; imap_password?: string;
  smtp_host: string; smtp_port: number; smtp_secure: number;
  smtp_user: string; smtp_password?: string;
  signature?: string | null;
  sla_hours?: number | null;
}

// Backend stores the signature as HTML or plain text. For the textarea we want
// plain text only — strip tags, decode the common entities, and collapse runs
// of blank lines down to one so the gap between the body and signature is one
// blank line that the user can adjust.
// ── per-thread reply drafts ───────────────────────────────────────────────
// Persisted in localStorage so an unfinished reply survives a page refresh or
// navigating away. A draft lives until the message is sent or the user empties
// the box — nothing here expires on its own except very old abandoned entries.
const DRAFTS_KEY = 'foxportal:inbox:reply-drafts:v1';
const DRAFT_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000; // prune after 60 days untouched

export type ReplyDraft = { subject?: string; body?: string; cc?: string; savedAt?: number };

function loadDrafts(): Record<string, ReplyDraft> {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    // Drop entries nobody has touched in months so the key can't grow forever.
    const cutoff = Date.now() - DRAFT_MAX_AGE_MS;
    return Object.fromEntries(
      Object.entries(parsed as Record<string, ReplyDraft>)
        .filter(([, d]) => d && (!d.savedAt || d.savedAt > cutoff))
    );
  } catch {
    return {}; // corrupt JSON / disabled storage — start clean rather than crash
  }
}

function persistDrafts(all: Record<string, ReplyDraft>) {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
  } catch {
    /* private mode or quota exceeded — drafts stay in memory for this session */
  }
}

// Strips a leading Gmail-style "-- " signature delimiter line, if present —
// common when a signature was copy-pasted from Gmail's own settings, which
// exports that marker as literal text. We control signature placement
// ourselves, so this redundant marker line should never show up.
function stripSigDelimiter(s: string): string {
  return s.replace(/^--\s*\r?\n+/, '');
}

function signatureToPlain(sig: string | null | undefined): string {
  if (!sig) return '';
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(sig);
  if (!looksLikeHtml) return stripSigDelimiter(sig.replace(/\n{3,}/g, '\n\n').trim());
  return stripSigDelimiter(sig
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<\/?p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

interface Thread {
  id: string; inbox_id: string; subject: string;
  client_email: string; client_name?: string; received_on?: string;
  assigned_to?: string; assignee_name?: string; assignee_avatar?: string;
  status: 'open' | 'followup' | 'closed' | 'dead';
  followup_count: number; last_inbound_at?: string; last_outbound_at?: string;
  ai_sent_at?: string; updated_at: string; message_count: number; last_body?: string;
  folder_id?: string; folder_name?: string; folder_color?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  tags?: string[] | null;
  deal_value?: number | null; deal_currency?: string;
  ticket_ref?: string | null;
  client_phone?: string | null; client_country?: string | null;
  created_at?: string;
}

// Only shows a countdown/overdue label while the thread is actively awaiting
// our reply (last inbound after last outbound) — we don't track a separate
// "first replied at" timestamp, so once we've answered there's nothing to
// show rather than guessing a "met in Xm" figure we can't actually verify.
function slaStatus(thread: Thread, slaHours?: number | null): { text: string; overdue: boolean } | null {
  if (!slaHours || thread.status === 'closed' || thread.status === 'dead') return null;
  const inbound = thread.last_inbound_at ? new Date(thread.last_inbound_at).getTime() : null;
  if (!inbound) return null;
  const outbound = thread.last_outbound_at ? new Date(thread.last_outbound_at).getTime() : null;
  if (outbound && outbound >= inbound) return null;

  const diffMs = (inbound + slaHours * 3600_000) - Date.now();
  const mins = Math.round(Math.abs(diffMs) / 60_000);
  const h = Math.floor(mins / 60);
  const label = h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
  return diffMs >= 0
    ? { text: `First response in ${label}`, overdue: false }
    : { text: `Reply overdue by ${label}`, overdue: true };
}

interface Message {
  id: string; direction: 'inbound' | 'outbound';
  from_address: string; from_name?: string;
  to_addresses: string; cc_addresses?: string;
  subject: string; body_text?: string; body_html?: string;
  sender_name?: string; is_ai_generated: number;
  scheduled_at?: string; sent_at?: string; status: string; created_at: string;
  send_attempts?: number; last_send_error?: string;
}

interface Sender { id: string; email_address: string; display_name?: string; }

// ── StatusBadge ────────────────────────────────────────────────────────────

function ThreadStatusBadge({ thread }: { thread: Thread }) {
  if (thread.status === 'dead')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive ring-1 ring-destructive/25"><X size={10} /> Dead</span>;
  if (thread.status === 'closed')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground ring-1 ring-border"><Archive size={10} /> Closed</span>;
  if (thread.status === 'followup')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/25"><Tag size={10} /> Follow-up ({thread.followup_count}/5)</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary ring-1 ring-primary/25"><Mail size={10} /> Open</span>;
}

function AvatarFallback({ name, size = 8 }: { name?: string; size?: number }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={`w-${size} h-${size} rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function SharedInbox() {
  const user = useAuthStore(s => s.user);
  const permissions = useAuthStore(s => s.permissions);
  const isAdmin = ADMIN_ROLES.includes(user?.role || '');
  // Anyone whose inbox matrix has own_only OFF can also manage threads
  // (assign, see unassigned, etc.) — mirrors the backend canSeeAllInboxThreads helper.
  const canManageInbox = isAdmin ||
    (!!permissions?.inbox?.can_view && !permissions?.inbox?.own_only);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const basePath = `${usePortalBase()}/inbox`;

  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQ, setSearchQ] = useState('');
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [showAssignedToMe, setShowAssignedToMe] = useState(false);
  const [selectedFolderId, setSelectedFolderIdRaw] = useState<string | null>(null);
  const [showMoveFolder, setShowMoveFolder] = useState(false);
  const [moveFolderThreadId, setMoveFolderThreadId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showSpam, setShowSpam] = useState(false);
  const [slaAtRiskOnly, setSlaAtRiskOnly] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Persist folder selection per inbox in localStorage
  const setSelectedFolderId = (fid: string | null) => {
    setSelectedFolderIdRaw(fid);
    if (selectedInboxId) {
      if (fid) localStorage.setItem(`inbox_folder_${selectedInboxId}`, fid);
      else localStorage.removeItem(`inbox_folder_${selectedInboxId}`);
    }
  };

  // Restore folder selection when inbox changes; reset sort + folder UI state
  useEffect(() => {
    if (selectedInboxId) {
      const saved = localStorage.getItem(`inbox_folder_${selectedInboxId}`);
      setSelectedFolderIdRaw(saved || null);
      setSortOrder('desc');
      setShowNewFolder(false);
      setNewFolderName('');
      setShowSpam(false);
    }
  }, [selectedInboxId]);


  const [datePreset, setDatePreset] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  // Ticks every minute so SLA countdown/overdue text stays fresh without a full refetch.
  const [, setSlaTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSlaTick(t => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

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
    queryKey: ['inbox-threads', selectedInboxId, filterStatus, searchQ, showUnassigned, showAssignedToMe, dateFrom, dateTo, selectedFolderId, sortOrder],
    queryFn: ({ pageParam = 1 }) => inboxApi.getThreads(selectedInboxId!, {
      status: filterStatus === 'all' ? undefined : filterStatus,
      search: searchQ || undefined,
      unassigned: showUnassigned ? '1' : undefined,
      assigned_to_me: showAssignedToMe ? '1' : undefined,
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

  const slaAtRiskCount = threads.filter(t => slaStatus(t, selectedInbox?.sla_hours)?.overdue).length;
  const visibleThreads = threads
    .filter(t => !slaAtRiskOnly || slaStatus(t, selectedInbox?.sla_hours)?.overdue)
    .filter(t => !filterTag || (t.tags || []).includes(filterTag));

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

  // Shared with CRM — same tag vocabulary across both modules.
  const { data: allTags = [] } = useQuery<string[]>({
    queryKey: ['tags-all'],
    queryFn: () => api.get('/tags').then(r => r.data.tags).catch(() => []),
    staleTime: 30_000,
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

  const { data: spamData, isLoading: loadingSpam, refetch: refetchSpam } = useQuery<{ messages: any[] }>({
    queryKey: ['inbox-spam', selectedInboxId],
    queryFn: () => api.get(`/inbox/${selectedInboxId}/spam`).then(r => r.data),
    enabled: !!(selectedInboxId && showSpam),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Validate restored folder ID once folders load — clear it if it doesn't
  // belong to the current inbox (stale localStorage from a different inbox)
  useEffect(() => {
    if (!selectedFolderId || folders.length === 0) return;
    if (!folders.some((f: any) => f.id === selectedFolderId)) {
      setSelectedFolderIdRaw(null);
      if (selectedInboxId) localStorage.removeItem(`inbox_folder_${selectedInboxId}`);
    }
  }, [folders, selectedFolderId, selectedInboxId]);

  // ── Mutations ────────────────────────────────────────────────

  const moveToInboxMut = useMutation({
    mutationFn: (uid: number) => api.post(`/inbox/${selectedInboxId}/spam/move-to-inbox`, { uid }),
    onSuccess: () => {
      toast.success('Moved to inbox — sync to see it in threads');
      refetchSpam();
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  // Clears the server-side cool-down, then immediately retries. Offered when a
  // sync is paused so the admin isn't stuck waiting out the 30-minute window
  // after fixing whatever caused the failures.
  const retryAfterPause = async () => {
    if (!selectedInboxId) return;
    try {
      await inboxApi.resetSyncBackoff(selectedInboxId);
      syncMut.mutate();
    } catch (e: any) {
      toast.error(errMsg(e));
    }
  };

  const syncMut = useMutation({
    mutationFn: () => inboxApi.syncInbox(selectedInboxId!),
    onSuccess: (r) => {
      toast.success(`Synced — ${r.data.synced} new message(s)`);
      qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] });
    },
    onError: (e: any) => {
      // A 429 means the inbox is in its cool-down, not that the sync itself
      // failed — offer the override instead of a dead-end error toast.
      if (e?.response?.status === 429 && canManageInbox) {
        toast(
          (t) => (
            <div className="text-xs">
              <p className="mb-2">{errMsg(e)}</p>
              <button
                onClick={() => { toast.dismiss(t.id); retryAfterPause(); }}
                className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-medium">
                Retry now
              </button>
            </div>
          ),
          { duration: 10000 }
        );
        return;
      }
      toast.error(errMsg(e));
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] });
      qc.invalidateQueries({ queryKey: ['inbox-thread', selectedInboxId, selectedThreadId] });
    },
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

  const deleteThreadMut = useMutation({
    mutationFn: (tid: string) => inboxApi.deleteThread(selectedInboxId!, tid),
    onSuccess: (_d, tid) => {
      qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] });
      qc.invalidateQueries({ queryKey: ['shared-inboxes'] });
      if (selectedThreadId === tid) setSelectedThreadId(null);
      toast.success('Thread deleted');
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

  const deleteMsgMut = useMutation({
    mutationFn: (mid: string) => inboxApi.deleteMessage(selectedInboxId!, selectedThreadId!, mid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['thread', selectedThreadId] });
      toast.success('Message deleted');
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
  const [replySubject, setReplySubject] = useState('');
  const [sendLater, setSendLater] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiReplyOpen, setAiReplyOpen] = useState(false);
  const [aiReplyHints, setAiReplyHints] = useState('');
  const [showSendMenu, setShowSendMenu] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const sendMenuRef = useRef<HTMLDivElement>(null);
  const replyFromInitialised = useRef<string | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sendMenuRef.current && !sendMenuRef.current.contains(e.target as Node)) setShowSendMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Drafts keyed by thread id, hydrated from localStorage on mount. Lets each
  // thread remember the user's edits to subject / body / cc across a refresh or
  // leaving the page, instead of resetting to "Re: <thread.subject>".
  const draftsRef = useRef<Record<string, ReplyDraft>>(loadDrafts());
  // Bumped on every draft write so the thread list re-renders its Draft badges.
  const [draftTick, setDraftTick] = useState(0);

  const writeDraft = (tid: string, patch: Partial<ReplyDraft>) => {
    draftsRef.current[tid] = { ...draftsRef.current[tid], ...patch, savedAt: Date.now() };
    persistDrafts(draftsRef.current);
    setDraftTick(t => t + 1);
  };

  // Undo-send: when the user clicks Send we actually schedule the message
  // 30 seconds out and show a banner with a countdown. While it's pending the
  // sender can pull it back and tweak the body before it actually goes.
  const UNDO_WINDOW_MS = 30_000;
  const [pendingMsgId, setPendingMsgId] = useState<string | null>(null);
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);
  const [pendingBody, setPendingBody] = useState('');
  const [pendingCC, setPendingCC] = useState('');
  const [pendingFrom, setPendingFrom] = useState('');
  const [pendingSubject, setPendingSubject] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  // The banner is only relevant on the thread the message was sent from.
  const showPendingBanner = !!pendingMsgId && pendingThreadId === selectedThreadId;

  const signatureText = useMemo(
    () => signatureToPlain(selectedInbox?.signature),
    [selectedInbox?.signature]
  );

  // Reply-all: seed the CC box from the last inbound message so anyone who was
  // on the original thread stays on it. Previously CC started empty on every
  // reply, so third parties the client had CC'd were silently dropped unless
  // the sender retyped them by hand.
  //
  // Filtered out: our own inbox/sender addresses (never CC ourselves) and the
  // client, who is already the To recipient. Handles "Name <a@b.com>" wrappers
  // and both comma- and semicolon-separated lists.
  const replyAllCC = useMemo(() => {
    const inbound = (threadDetail?.messages || []).filter((m: any) => m.direction === 'inbound');
    const last = inbound[inbound.length - 1];
    if (!last) return '';

    const ours = new Set(
      [
        ...(threadDetail?.senders || []).map((s: any) => s.email_address),
        threadDetail?.thread?.received_on,
        threadDetail?.thread?.client_email,
        last.from_address,
      ]
        .filter(Boolean)
        .map((e: string) => e.toLowerCase().trim())
    );

    const seen = new Set<string>();
    return [last.to_addresses, last.cc_addresses]
      .filter(Boolean)
      .join(',')
      .split(/[,;]/)
      .map((raw: string) => {
        const angle = raw.match(/<([^>]+)>/);
        return (angle ? angle[1] : raw).trim();
      })
      .filter((addr: string) => {
        const key = addr.toLowerCase();
        if (!addr.includes('@') || ours.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join(', ');
  }, [threadDetail]);

  useEffect(() => {
    if (!threadDetail?.senders?.length || !selectedThreadId) return;
    const seed = signatureText ? `\n\n${signatureText}` : '';
    const threadSubject = threadDetail.thread.subject || '';
    const defaultSubject = threadSubject.toLowerCase().startsWith('re:')
      ? threadSubject
      : `Re: ${threadSubject}`;
    if (replyFromInitialised.current !== selectedThreadId) {
      replyFromInitialised.current = selectedThreadId;
      setReplyFrom(threadDetail.thread.received_on || threadDetail.senders[0].email_address);
      // Per-thread draft wins over the default so the user's edits stick when
      // they switch threads. The draft is populated by the onChange handlers
      // below and cleared on successful send.
      const draft = draftsRef.current[selectedThreadId] || {};
      setReplySubject(draft.subject ?? defaultSubject);
      setReplyText(draft.body ?? seed);
      setReplyCC(draft.cc ?? replyAllCC);
    } else if (seed && !replyText.trim() && draftsRef.current[selectedThreadId]?.body === undefined) {
      // The thread was opened before the inbox (and its signature) finished
      // loading — drop the signature in now since the composer is still blank
      // AND the user hasn't started editing this thread's draft.
      setReplyText(seed);
    }
  }, [threadDetail, selectedThreadId, signatureText, replyText, replyAllCC]);

  // onChange helpers that mirror the input into the per-thread draft so the
  // edit survives a thread switch, a refresh, or leaving the page entirely.
  const onChangeReplySubject = (v: string) => {
    setReplySubject(v);
    if (selectedThreadId) writeDraft(selectedThreadId, { subject: v });
  };
  const onChangeReplyText = (v: string) => {
    setReplyText(v);
    if (selectedThreadId) writeDraft(selectedThreadId, { body: v });
  };
  const onChangeReplyCC = (v: string) => {
    setReplyCC(v);
    if (selectedThreadId) writeDraft(selectedThreadId, { cc: v });
  };

  // A thread counts as having a draft only when there's something the user
  // actually typed. Every opened thread gets the signature seeded into the box,
  // so a body equal to just the signature is not a draft.
  const threadHasDraft = (tid: string) => {
    void draftTick; // re-evaluated whenever a draft is written
    const d = draftsRef.current[tid];
    if (!d) return false;
    const body = (d.body ?? '').trim();
    const sig = signatureText.trim();
    const bodyIsUserContent = !!body && (!sig || body !== sig);
    return bodyIsUserContent || !!(d.cc ?? '').trim();
  };
  const clearThreadDraft = (tid: string | null) => {
    if (!tid) return;
    delete draftsRef.current[tid];
    persistDrafts(draftsRef.current);
    setDraftTick(t => t + 1);
  };

  const aiDraftReply = async () => {
    if (!selectedInboxId || !selectedThreadId || aiDrafting) return;
    setAiDrafting(true);
    try {
      // Empty hints → AI generates from the thread context only. Anything in
      // the box gets sent as the steering instruction.
      const hints = aiReplyHints.trim() || undefined;
      const res = await inboxApi.aiDraftReply(selectedInboxId, selectedThreadId, hints);
      const draft = res.data?.draft;
      if (!draft) {
        toast.error('AI returned an empty draft');
        return;
      }
      // Drop the AI body above the signature so the user can read and tweak.
      const tail = signatureText ? `\n\n${signatureText}` : '';
      onChangeReplyText(`${draft}${tail}`);
      setAiReplyOpen(false);
      setAiReplyHints('');
      toast.success('Draft ready — read it through before sending');
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setAiDrafting(false);
    }
  };

  // Drive the countdown for the undo banner
  useEffect(() => {
    if (!pendingMsgId) { setSecondsLeft(0); return; }
    setSecondsLeft(Math.ceil(UNDO_WINDOW_MS / 1000));
    const tick = window.setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          window.clearInterval(tick);
          // Window closed — the cron will pick the scheduled message up
          // shortly. Clear the banner and refresh the thread so the sent
          // message shows up in place of the pending state.
          setPendingMsgId(null);
          setPendingThreadId(null);
          setPendingBody('');
          setPendingCC('');
          setPendingFrom('');
          setPendingSubject('');
          if (selectedInboxId && selectedThreadId) {
            qc.invalidateQueries({ queryKey: ['inbox-thread', selectedInboxId, selectedThreadId] });
            qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] });
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [pendingMsgId, qc, selectedInboxId, selectedThreadId]);

  const sendReply = async () => {
    if (!replyText.trim() || !selectedInboxId || !selectedThreadId) return;

    // "Send later" picks a specific date — bypass the undo flow in that case
    // because the user is explicitly scheduling, not sending now.
    if (sendLater) {
      setSendingReply(true);
      try {
        await inboxApi.replyThread(selectedInboxId, selectedThreadId, {
          body_text: replyText,
          from_address: replyFrom,
          cc: replyCC || undefined,
          subject: replySubject || undefined,
          scheduled_at: sendLater,
        });
        toast.success('Scheduled!');
        clearThreadDraft(selectedThreadId);
        setReplyText(''); setReplyCC(''); setSendLater('');
        // Reset the subject to the default for the next message in this thread
        const ts = threadDetail?.thread?.subject || '';
        setReplySubject(ts.toLowerCase().startsWith('re:') ? ts : `Re: ${ts}`);
        qc.invalidateQueries({ queryKey: ['inbox-thread', selectedInboxId, selectedThreadId] });
        qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] });
      } catch (e: any) {
        toast.error(errMsg(e));
      } finally {
        setSendingReply(false);
      }
      return;
    }

    setSendingReply(true);
    const bodyCopy = replyText;
    const ccCopy = replyCC;
    const fromCopy = replyFrom;
    const subjectCopy = replySubject;
    try {
      const scheduledAt = new Date(Date.now() + UNDO_WINDOW_MS).toISOString();
      const res = await inboxApi.replyThread(selectedInboxId, selectedThreadId, {
        body_text: bodyCopy,
        from_address: fromCopy,
        cc: ccCopy || undefined,
        subject: replySubject || undefined,
        scheduled_at: scheduledAt,
      });
      const newMsgId = res.data?.id;
      if (!newMsgId) throw new Error('Server did not return a message id');
      setPendingMsgId(newMsgId);
      setPendingThreadId(selectedThreadId);
      setPendingBody(bodyCopy);
      setPendingCC(ccCopy);
      setPendingFrom(fromCopy);
      setPendingSubject(subjectCopy);
      // Successful send — drop the draft for this thread so the next reply
      // starts fresh, and reset the subject back to the default.
      clearThreadDraft(selectedThreadId);
      const ts = threadDetail?.thread?.subject || '';
      setReplySubject(ts.toLowerCase().startsWith('re:') ? ts : `Re: ${ts}`);
      // Clear the composer so the user can write the next reply if they want
      setReplyText(signatureText ? `\n\n${signatureText}` : '');
      setReplyCC('');
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSendingReply(false);
    }
  };

  const undoPendingSend = async () => {
    if (!pendingMsgId || !selectedInboxId || !selectedThreadId) return;
    try {
      await inboxApi.deleteMessage(selectedInboxId, selectedThreadId, pendingMsgId);
      // Restore the composer so the user can edit and resend — also push the
      // restored values back into the per-thread draft so a thread switch
      // doesn't wipe them again.
      setReplyText(pendingBody);
      setReplyCC(pendingCC);
      setReplyFrom(pendingFrom);
      setReplySubject(pendingSubject);
      if (selectedThreadId) {
        writeDraft(selectedThreadId, {
          subject: pendingSubject,
          body: pendingBody,
          cc: pendingCC,
        });
      }
      setPendingMsgId(null);
      setPendingThreadId(null);
      setPendingBody('');
      setPendingCC('');
      setPendingFrom('');
      setPendingSubject('');
      toast.success('Send cancelled — you can edit and resend');
    } catch (e: any) {
      toast.error(errMsg(e));
    }
  };

  const openThread = (tid: string) => {
    setSelectedThreadId(tid);
    if (selectedInboxId) {
      inboxApi.markThreadRead(selectedInboxId, tid)
        .then(() => {
          qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] });
          qc.invalidateQueries({ queryKey: ['shared-inboxes'] });
        })
        .catch(() => {});
    }
  };

  if (loadingInboxes) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>;
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="dark flex h-full overflow-hidden bg-background text-foreground">

      {/* ── Left sidebar: inbox list ──────────────────────────── */}
      <div className="w-52 flex-shrink-0 border-r border-border flex flex-col bg-card">
        <div className="p-3 flex items-center justify-between border-b border-border">
          <span className="text-sm font-semibold text-foreground">Inboxes</span>
          {isAdmin && (
            <button
              onClick={() => navigate(`${basePath}/new`)}
              className="p-1 rounded hover:bg-secondary text-muted-foreground"
              title="Create new inbox"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {inboxes.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-muted-foreground">No inboxes yet.</p>
            </div>
          ) : inboxes.map(inbox => {
            const isSelected = selectedInboxId === inbox.id;
            return (
              <div key={inbox.id}>
                <button
                  onClick={() => { setSelectedInboxId(inbox.id); setSelectedThreadId(null); }}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-secondary/60 transition-colors ${isSelected ? 'bg-primary/10 border-r-2 border-primary' : ''}`}
                >
                  <Inbox size={15} className={`flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className={`text-xs font-medium truncate flex-1 ${isSelected ? 'text-primary' : 'text-foreground'}`}>{inbox.name}</p>
                  {Number(inbox.unread_count ?? inbox.thread_count ?? 0) > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      Number(inbox.unread_count) > 0
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : isSelected
                          ? 'bg-primary/20 text-primary'
                          : 'bg-secondary text-muted-foreground'
                    }`}>
                      {inbox.unread_count ?? inbox.thread_count}
                    </span>
                  )}
                </button>

                {/* Folders inline under selected inbox */}
                {isSelected && (
                  <div className="pl-5 pb-1">
                    <button onClick={() => { setSelectedFolderId(null); setShowSpam(false); }}
                      className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-secondary/60 transition-colors rounded ${!selectedFolderId && !showSpam ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                      <FolderOpen size={12} />All threads
                    </button>
                    <button onClick={() => { setShowSpam(true); setSelectedFolderId(null); setSelectedThreadId(null); }}
                      className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-secondary/60 transition-colors rounded ${showSpam ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      <ShieldAlert size={12} />Spam
                    </button>

                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Ticket Queues</p>
                    {canManageInbox && (
                      <button onClick={() => { setShowSpam(false); setSelectedFolderId(null); setShowUnassigned(!showUnassigned); setShowAssignedToMe(false); setSlaAtRiskOnly(false); }}
                        className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 text-xs hover:bg-secondary/60 transition-colors rounded ${showUnassigned ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                        <span className="flex items-center gap-2"><UserPlus size={12} />Unassigned</span>
                      </button>
                    )}
                    <button onClick={() => { setShowSpam(false); setSelectedFolderId(null); setSlaAtRiskOnly(!slaAtRiskOnly); }}
                      className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 text-xs hover:bg-secondary/60 transition-colors rounded ${slaAtRiskOnly ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      <span className="flex items-center gap-2"><Clock size={12} />SLA at risk</span>
                      {slaAtRiskCount > 0 && <span className="text-[10px] px-1.5 rounded-full bg-destructive/15 text-destructive">{slaAtRiskCount}</span>}
                    </button>
                    <button onClick={() => { setShowSpam(false); setSelectedFolderId(null); setShowAssignedToMe(!showAssignedToMe); setShowUnassigned(false); setSlaAtRiskOnly(false); }}
                      className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-secondary/60 transition-colors rounded ${showAssignedToMe ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                      <Inbox size={12} />My tickets
                    </button>

                    {allTags.length > 0 && (
                      <>
                        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Tags</p>
                        <div className="flex flex-wrap gap-1 px-3 pb-1">
                          {allTags.map(tag => (
                            <button key={tag} onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                              className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${filterTag === tag ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                              {tag}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {folders.map(f => (
                      <div key={f.id} className={`group flex items-center rounded hover:bg-secondary/60 transition-colors ${selectedFolderId === f.id ? 'bg-primary/10' : ''}`}>
                        <button onClick={() => setSelectedFolderId(f.id)}
                          className="flex-1 text-left px-3 py-1.5 flex items-center gap-2 text-xs min-w-0">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: f.color }} />
                          <span className={`truncate ${selectedFolderId === f.id ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{f.name}</span>
                        </button>
                        {isAdmin && (
                          <button onClick={() => deleteFolderMut.mutate(f.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 mr-1 rounded text-muted-foreground hover:text-destructive transition-all">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="px-2 pt-1">
                      {showNewFolder ? (
                        <div className="flex gap-1">
                          <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && newFolderName.trim()) createFolderMut.mutate(newFolderName.trim()); if (e.key === 'Escape') setShowNewFolder(false); }}
                            placeholder="Folder name…"
                            className="flex-1 text-xs border border-border rounded px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                          <button onClick={() => newFolderName.trim() && createFolderMut.mutate(newFolderName.trim())}
                            disabled={createFolderMut.isPending || !newFolderName.trim()}
                            className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded hover:opacity-90 disabled:opacity-50">Add</button>
                        </div>
                      ) : (
                        <button onClick={() => setShowNewFolder(true)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors py-0.5">
                          <FolderPlus size={11} /> New folder
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Middle: thread list ───────────────────────────────── */}
      {selectedInbox && (
        <div className={`flex flex-col border-r border-border bg-card/40 ${selectedThreadId ? 'hidden lg:flex w-72 flex-shrink-0' : 'flex-1 max-w-sm'}`}>
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-semibold text-foreground truncate">{selectedInbox.name}</h2>
                {selectedInbox.ai_followup_enabled ? <span title="AI follow-up on" className="text-emerald-500 flex-shrink-0"><Zap size={12} /></span> : null}
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending} title="Sync IMAP"
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                  <RefreshCw size={14} className={syncMut.isPending ? 'animate-spin' : ''} />
                </button>
                {isAdmin && <>
                  <button
                    onClick={() => navigate(`${basePath}/${selectedInbox.id}/settings`)}
                    title="Edit IMAP / SMTP settings"
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                    <Settings size={14} />
                  </button>
                  <button
                    onClick={() => navigate(`${basePath}/${selectedInbox.id}/members`)}
                    title="Manage senders & members"
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                    <UserPlus size={14} />
                  </button>
                  <button onClick={() => setShowNewThread(true)} title="New outbound email"
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                    <Plus size={14} />
                  </button>
                </>}
              </div>
            </div>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search threads…"
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            {selectedFolderId && (
              <div className="flex items-center gap-1.5 px-1 py-0.5 mb-1">
                <span className="text-xs text-primary flex items-center gap-1">
                  <FolderOpen size={11} />
                  {folders.find(f => f.id === selectedFolderId)?.name || 'Folder'}
                </span>
                <button onClick={() => setSelectedFolderId(null)} className="text-muted-foreground hover:text-foreground">
                  <X size={11} />
                </button>
              </div>
            )}
            <div className="flex gap-1 flex-wrap">
              {['all', 'open', 'followup', 'closed', 'dead'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${filterStatus === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              {canManageInbox && (
                <>
                  <button onClick={() => { setShowUnassigned(!showUnassigned); setShowAssignedToMe(false); }}
                    className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${showUnassigned ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                    Unassigned
                  </button>
                  <button onClick={() => { setShowAssignedToMe(!showAssignedToMe); setShowUnassigned(false); }}
                    className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${showAssignedToMe ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                    Mine
                  </button>
                </>
              )}
              <button onClick={() => setShowDateFilter(v => !v)}
                className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors flex items-center gap-1 ${(dateFrom || dateTo) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                <CalendarDays size={11} />Date
              </button>
              <button onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                title={sortOrder === 'desc' ? 'Showing newest first' : 'Showing oldest first'}
                className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors flex items-center gap-1 ${sortOrder === 'asc' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                <ArrowUpDown size={11} />{sortOrder === 'asc' ? 'Oldest' : 'Newest'}
              </button>
            </div>

            {/* ── Date filter panel ── */}
            {showDateFilter && (
              <div className="mt-2 pt-2 border-t border-border space-y-2">
                <div className="flex flex-wrap gap-1">
                  {DATE_PRESETS.map(p => (
                    <button key={p.key} onClick={() => applyPreset(p.key)}
                      className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${datePreset === p.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                      {p.label}
                    </button>
                  ))}
                  {(dateFrom || dateTo) && (
                    <button onClick={clearDate}
                      className="px-2 py-0.5 text-xs rounded-full font-medium text-destructive hover:bg-destructive/10 transition-colors">
                      Clear
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-xs text-muted-foreground mb-0.5 block">From</label>
                    <input type="date" value={dateFrom}
                      onChange={e => { setDatePreset('custom'); setDateFrom(e.target.value); }}
                      className="w-full text-xs border border-border rounded px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-0.5 block">To</label>
                    <input type="date" value={dateTo}
                      onChange={e => { setDatePreset('custom'); setDateTo(e.target.value); }}
                      className="w-full text-xs border border-border rounded px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {showSpam ? (
              loadingSpam ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
              ) : !spamData?.messages?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <ShieldAlert size={32} className="text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No spam emails in the last 30 days</p>
                </div>
              ) : spamData.messages.map((msg: any) => (
                <div key={msg.uid} className="px-4 py-3 hover:bg-muted/60 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {msg.from_name ? `${msg.from_name} <${msg.from}>` : msg.from}
                      </p>
                      <p className="text-xs text-foreground/80 truncate mt-0.5">{msg.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {msg.date ? new Date(msg.date).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'numeric', minute:'2-digit', hour12:true }) : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => moveToInboxMut.mutate(msg.uid)}
                      disabled={moveToInboxMut.isPending}
                      title="Move to Inbox"
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 ring-1 ring-primary/25 disabled:opacity-50 transition-colors">
                      <MoveRight size={11} />Inbox
                    </button>
                  </div>
                </div>
              ))
            ) : loadingThreads ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
            ) : visibleThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Mail size={32} className="text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No threads{(dateFrom || dateTo) ? ' in this date range' : ''}</p>
              </div>
            ) : visibleThreads.map(thread => (
              <ThreadRow key={thread.id} thread={thread}
                selected={selectedThreadId === thread.id}
                hasDraft={threadHasDraft(thread.id)}
                slaHours={selectedInbox?.sla_hours}
                isAdmin={canManageInbox} members={members} folders={folders}
                onSelect={() => openThread(thread.id)}
                onStatusChange={status => patchThreadMut.mutate({ tid: thread.id, data: { status } })}
                onAssign={() => { setSelectedThreadId(thread.id); setShowAssign(true); }}
                onMoveFolder={() => { setMoveFolderThreadId(thread.id); setShowMoveFolder(true); }}
                onDelete={canManageInbox ? () => deleteThreadMut.mutate(thread.id) : undefined}
              />
            ))}
            {!showSpam && (
              <div className="border-t border-border p-3 space-y-2">
                {threads.length > 0 && (
                  <p className="text-xs text-center text-muted-foreground">Showing {threads.length} of {total} threads</p>
                )}
                {hasNextPage && (
                  <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium ring-1 ring-primary/25 rounded-lg hover:bg-primary/10 text-primary disabled:opacity-50 transition-colors">
                    <ChevronDown size={12} className={isFetchingNextPage ? 'animate-bounce' : ''} />
                    {isFetchingNextPage ? 'Loading…' : 'Load older threads'}
                  </button>
                )}
                <button onClick={() => pullOlderMut.mutate()} disabled={pullOlderMut.isPending}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-secondary text-muted-foreground disabled:opacity-50 transition-colors">
                  <RefreshCw size={12} className={pullOlderMut.isPending ? 'animate-spin' : ''} />
                  {pullOlderMut.isPending ? 'Pulling from server…' : 'Pull older emails from mail server'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Right: thread detail or empty state ──────────────── */}
      {selectedThreadId && threadDetail ? (
        <div className="flex-1 flex flex-col min-w-0 bg-card/60">
          <div className="flex items-start justify-between gap-4 px-5 py-3 border-b border-border backdrop-blur">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setSelectedThreadId(null)} className="p-1 rounded hover:bg-secondary text-muted-foreground lg:hidden">
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  {threadDetail.thread.ticket_ref && (
                    <span className="text-xs font-semibold text-primary flex-shrink-0">{threadDetail.thread.ticket_ref}</span>
                  )}
                  <h2 className="font-semibold text-foreground truncate tracking-tight">{threadDetail.thread.subject}</h2>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <ThreadStatusBadge thread={threadDetail.thread} />
                  {canManageInbox ? (
                    <select value={threadDetail.thread.priority}
                      onChange={e => patchThreadMut.mutate({ tid: selectedThreadId, data: { priority: e.target.value } })}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border-none outline-none cursor-pointer ${PRIORITY_STYLES[threadDetail.thread.priority]}`}>
                      {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLES[threadDetail.thread.priority]}`}>{threadDetail.thread.priority}</span>
                  )}
                  {threadDetail.thread.ai_sent_at && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary ring-1 ring-primary/25">
                      <Bot size={10} /> AI sent
                    </span>
                  )}
                  {(() => {
                    const sla = slaStatus(threadDetail.thread, selectedInbox?.sla_hours);
                    return sla ? (
                      <span className={`inline-flex items-center gap-1 text-xs ${sla.overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                        <Clock size={11} />{sla.text}
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-muted-foreground/70 mr-1">From:</span>
                    {threadDetail.thread.client_name
                      ? <>{threadDetail.thread.client_name} &lt;{threadDetail.thread.client_email}&gt;</>
                      : threadDetail.thread.client_email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-muted-foreground/70 mr-1">To:</span>
                    {threadDetail.thread.received_on}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {(threadDetail.thread.tags || []).map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">
                      {tag}
                      <button onClick={() => patchThreadMut.mutate({ tid: selectedThreadId, data: { tags: (threadDetail.thread.tags || []).filter(t => t !== tag) } })}
                        className="hover:text-destructive">
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault();
                        const next = Array.from(new Set([...(threadDetail.thread.tags || []), tagInput.trim()]));
                        patchThreadMut.mutate({ tid: selectedThreadId, data: { tags: next } });
                        setTagInput('');
                      }
                    }}
                    placeholder="+ add tag"
                    className="text-xs w-20 bg-transparent outline-none text-foreground placeholder:text-muted-foreground border-b border-dashed border-border focus:border-primary" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {canManageInbox && (
                <button onClick={() => setShowAssign(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary text-muted-foreground">
                  <UserPlus size={13} />{threadDetail.thread.assignee_name || 'Assign'}
                </button>
              )}
              {threadDetail.thread.folder_id ? (
                <button onClick={() => { setMoveFolderThreadId(selectedThreadId); setShowMoveFolder(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary text-muted-foreground"
                  style={{ borderColor: threadDetail.thread.folder_color || undefined }}>
                  <FolderOpen size={13} />{threadDetail.thread.folder_name}
                </button>
              ) : (
                <button onClick={() => { setMoveFolderThreadId(selectedThreadId); setShowMoveFolder(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary text-muted-foreground">
                  <FolderPlus size={13} />Folder
                </button>
              )}
              <StatusDropdown status={threadDetail.thread.status}
                onChange={s => patchThreadMut.mutate({ tid: selectedThreadId, data: { status: s } })} />
            </div>
          </div>
          {/* Single scrollable column: messages followed inline by the reply box,
             so a short email doesn't leave a giant empty gap above the reply. */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-4 space-y-4">
              {loadingThread ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
              ) : threadDetail.messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg}
                  canDelete={isAdmin}
                  onDelete={() => deleteMsgMut.mutate(msg.id)} />
              ))}
            </div>
          {threadDetail.thread.status !== 'closed' && threadDetail.thread.status !== 'dead' && (
            <div className="border-t border-border p-4">
              <div className="border border-border rounded-xl overflow-hidden bg-card/70">
                <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1 border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground flex-shrink-0">From:</span>
                    <select value={replyFrom} onChange={e => setReplyFrom(e.target.value)}
                      className="text-xs text-foreground bg-transparent border-none outline-none cursor-pointer">
                      {threadDetail.thread.received_on &&
                        !threadDetail.senders.some((s: any) => s.email_address === threadDetail.thread.received_on) && (
                        <option value={threadDetail.thread.received_on}>{threadDetail.thread.received_on}</option>
                      )}
                      {threadDetail.senders.map((s: any) => (
                        <option key={s.id} value={s.email_address}>{s.display_name || s.email_address}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground flex-shrink-0">CC:</span>
                    <input value={replyCC} onChange={e => onChangeReplyCC(e.target.value)} placeholder="optional"
                      className="text-xs flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
                  <span className="text-xs text-muted-foreground flex-shrink-0">Subject:</span>
                  <input value={replySubject} onChange={e => onChangeReplySubject(e.target.value)}
                    placeholder={`Re: ${threadDetail.thread.subject || ''}`}
                    className="text-xs flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground" />
                </div>
                <textarea value={replyText} onChange={e => onChangeReplyText(e.target.value)}
                  placeholder="Write your reply…" rows={8}
                  className="w-full px-3 py-2 text-sm bg-transparent outline-none resize-none text-foreground placeholder:text-muted-foreground whitespace-pre-wrap" />
                {selectedThreadId && threadHasDraft(selectedThreadId) && (
                  <div className="flex items-center justify-between gap-3 px-3 pb-2 -mt-1">
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <Check size={11} /> Draft saved — it'll still be here after a refresh
                    </span>
                    <button
                      onClick={() => {
                        clearThreadDraft(selectedThreadId);
                        setReplyText(signatureText ? `\n\n${signatureText}` : '');
                        setReplyCC('');
                        const ts = threadDetail?.thread?.subject || '';
                        setReplySubject(ts.toLowerCase().startsWith('re:') ? ts : `Re: ${ts}`);
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                      Discard draft
                    </button>
                  </div>
                )}
                {showPendingBanner && (
                  <div className="flex items-center justify-between gap-3 px-3 py-2 mx-3 mb-2 rounded-lg ring-1 ring-primary/25 bg-primary/10">
                    <div className="flex items-center gap-2 text-xs text-primary">
                      <Clock size={13} />
                      Sending in {secondsLeft}s — you can still edit it.
                    </div>
                    <button onClick={undoPendingSend}
                      className="text-xs font-semibold text-primary hover:opacity-80">
                      Undo & Edit
                    </button>
                  </div>
                )}
                {aiReplyOpen && (
                  <div className="mx-3 mb-2 rounded-lg ring-1 ring-primary/25 bg-primary/5 p-2 space-y-2">
                    <input
                      autoFocus
                      value={aiReplyHints}
                      onChange={e => setAiReplyHints(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aiDraftReply(); } if (e.key === 'Escape') setAiReplyOpen(false); }}
                      placeholder="Any specific angle? Leave blank to reply from the client's email."
                      className="w-full text-xs px-2 py-1.5 rounded border border-primary/25 bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => { setAiReplyOpen(false); setAiReplyHints(''); }}
                        className="text-xs text-muted-foreground hover:text-foreground">
                        Cancel
                      </button>
                      <button type="button" onClick={aiDraftReply} disabled={aiDrafting}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs hover:opacity-90 disabled:opacity-50">
                        {aiDrafting ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                        {aiDrafting ? 'Drafting…' : 'Generate'}
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
                  <div className="flex items-center gap-2">
                    {sendLater && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded-md ring-1 ring-primary/25">
                        <Clock size={12} />{fmtDateTime(sendLater)}
                        <button onClick={() => setSendLater('')} className="hover:text-destructive"><X size={11} /></button>
                      </span>
                    )}
                    {showDateTimePicker && (
                      <input type="datetime-local" value={sendLater} autoFocus
                        onChange={e => { setSendLater(e.target.value); setShowDateTimePicker(false); }}
                        onBlur={() => setShowDateTimePicker(false)}
                        className="text-xs bg-transparent outline-none text-muted-foreground cursor-pointer" />
                    )}
                    <button
                      type="button"
                      onClick={() => setAiReplyOpen(v => !v)}
                      disabled={aiDrafting || showPendingBanner}
                      title="Let AI draft a reply based on this thread"
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-primary/40 text-xs font-medium text-primary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed">
                      <Bot size={12} />
                      {aiReplyOpen ? 'Hide AI' : 'AI draft'}
                    </button>
                  </div>
                  <div ref={sendMenuRef} className="relative flex items-stretch">
                    <button onClick={sendReply} disabled={sendingReply || !replyText.trim() || showPendingBanner}
                      className="flex items-center gap-1.5 pl-4 pr-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-l-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                      {sendingReply ? <Loader2 size={14} className="animate-spin" /> : sendLater ? <Clock size={14} /> : <Send size={14} />}
                      {sendLater ? 'Schedule' : 'Send'}
                    </button>
                    <button type="button" onClick={() => setShowSendMenu(v => !v)}
                      disabled={sendingReply || !replyText.trim() || showPendingBanner}
                      className="flex items-center px-1.5 bg-primary text-primary-foreground rounded-r-lg border-l border-primary-foreground/20 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                      <ChevronDown size={14} />
                    </button>
                    {showSendMenu && (
                      <div className="absolute bottom-full right-0 mb-2 w-56 rounded-lg border border-border bg-card shadow-lg py-1.5 z-10">
                        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Send Later</p>
                        {sendLaterPresets().map(p => (
                          <button key={p.label} onClick={() => { setSendLater(p.value); setShowSendMenu(false); }}
                            className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-secondary/60 transition-colors">
                            {p.label}
                          </button>
                        ))}
                        <button onClick={() => { setShowDateTimePicker(true); setShowSendMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-secondary/60 transition-colors">
                          Pick date &amp; time…
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center text-muted-foreground/40">
          <div className="text-center">
            <Inbox size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">{selectedInboxId ? 'Select a thread to read' : 'Select an inbox'}</p>
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

const PRIORITY_STYLES: Record<Thread['priority'], string> = {
  URGENT: 'bg-destructive/10 text-destructive ring-1 ring-destructive/25',
  HIGH:   'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/25',
  NORMAL: 'bg-muted text-muted-foreground ring-1 ring-border',
  LOW:    'bg-muted text-muted-foreground ring-1 ring-border',
};

function ThreadRow({ thread, selected, hasDraft, slaHours, isAdmin, members, folders, onSelect, onStatusChange, onAssign, onMoveFolder, onDelete }: {
  thread: Thread; selected: boolean; hasDraft?: boolean; slaHours?: number | null; isAdmin: boolean; members: any[]; folders: any[];
  onSelect: () => void; onStatusChange: (s: string) => void; onAssign: () => void; onMoveFolder: () => void;
  onDelete?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const unread = !!(thread as any).is_unread;
  return (
    <div onClick={onSelect}
      className={`relative flex items-start gap-2.5 px-4 py-3.5 cursor-pointer transition-colors ${
        selected
          ? 'bg-accent/60'
          : unread
            ? 'bg-card hover:bg-muted/60'
            : 'hover:bg-muted/60'
      }`}>
      {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
      {unread && !selected && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />}
      <AvatarFallback name={thread.client_name || thread.client_email} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {thread.ticket_ref && <span className="text-[11px] font-semibold text-primary flex-shrink-0">{thread.ticket_ref}</span>}
            <span className={`text-xs truncate text-foreground ${unread ? 'font-bold' : 'font-medium'}`}>{thread.client_name || thread.client_email}</span>
          </div>
          <span className={`text-[11px] flex-shrink-0 ${unread ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{fmtDateTime(thread.last_inbound_at || thread.updated_at)}</span>
        </div>
        <p className={`text-[13px] truncate mt-0.5 ${unread ? 'text-foreground font-semibold' : 'text-foreground/80'}`}>{thread.subject}</p>
        <p className={`text-xs truncate mt-0.5 leading-relaxed ${unread ? 'text-foreground/80' : 'text-muted-foreground'}`}>{thread.last_body?.slice(0, 80)}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <ThreadStatusBadge thread={thread} />
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLES[thread.priority]}`}>{thread.priority}</span>
          {hasDraft && (
            <span title="You have an unsent reply saved for this thread"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/25">
              <Mail size={10} /> Draft
            </span>
          )}
          {thread.assignee_name && <span className="text-xs text-muted-foreground truncate">→ {thread.assignee_name}</span>}
          {thread.folder_name && (
            <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: (thread.folder_color || '#6366f1') + '22', color: thread.folder_color || '#6366f1' }}>
              <FolderOpen size={9} />{thread.folder_name}
            </span>
          )}
          {(thread.tags || []).map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">{tag}</span>
          ))}
        </div>
        {(() => {
          const sla = slaStatus(thread, slaHours);
          return sla ? (
            <p className={`mt-1 inline-flex items-center gap-1 text-[11px] ${sla.overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
              <Clock size={11} />{sla.text}
            </p>
          ) : null;
        })()}
      </div>
      <div ref={menuRef} className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 rounded hover:bg-secondary text-muted-foreground">
          <MoreVertical size={14} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-6 z-20 w-40 bg-popover border border-border rounded-lg shadow-lg py-1 text-xs">
            {['open', 'followup', 'closed', 'dead'].map(s => (
              <button key={s} onClick={() => { onStatusChange(s); setMenuOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-popover-foreground ${thread.status === s ? 'font-semibold' : ''}`}>
                {thread.status === s ? <Check size={12} className="text-primary" /> : <span className="w-3" />}
                Mark {s}
              </button>
            ))}
            {isAdmin && (
              <button onClick={() => { onAssign(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-popover-foreground border-t border-border mt-1 pt-2">
                <UserPlus size={12} /> Assign
              </button>
            )}
            {isAdmin && folders && folders.length > 0 && (
              <div className="border-t border-border mt-1 pt-1">
                <p className="px-3 py-1 text-xs text-muted-foreground">Move to folder</p>
                <button onClick={() => { onMoveFolder(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-popover-foreground text-xs">
                  <FolderOpen size={12} /> Choose folder…
                </button>
              </div>
            )}
            {onDelete && (
              <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this thread? All messages will be removed.')) { onDelete(); } setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-destructive/10 text-destructive border-t border-border mt-1 pt-2 text-xs">
                <Trash2 size={12} /> Delete thread
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── EmailHtmlFrame — isolates email HTML/CSS in a sandboxed iframe ─────────

function EmailHtmlFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  // Real emails assume a white page and set little or no color of their own —
  // once the app shell went dark, Chrome's auto-dark-for-web-content heuristic
  // started repainting this unstyled iframe doc too, muddying contrast instead
  // of leaving it on its natural white background. Force light explicitly so
  // it's never auto-inverted, regardless of the surrounding page's theme.
  const sanitized = '<style>:root{color-scheme:light}body{background:#fff;color:#202124;margin:0;padding:16px;box-sizing:border-box}</style>' + html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/javascript:/gi, '');

  const onLoad = () => {
    const doc = ref.current?.contentDocument;
    if (doc?.body) {
      setHeight(Math.min(doc.body.scrollHeight + 24, 1200));
    }
  };

  return (
    <iframe
      ref={ref}
      srcDoc={sanitized}
      sandbox="allow-same-origin"
      onLoad={onLoad}
      title="email"
      className="w-full border-none rounded block"
      style={{ height, minHeight: 80 }}
    />
  );
}

// ── MessageBubble ──────────────────────────────────────────────────────────

function MessageBubble({ msg, canDelete, onDelete }: { msg: Message; canDelete?: boolean; onDelete?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isOut = msg.direction === 'outbound';
  const isScheduled = msg.status === 'scheduled';
  const isFailed = msg.status === 'failed';
  const hasHtml = !!msg.body_html && !isOut;

  const DeleteBtn = () => canDelete ? (
    confirmDelete ? (
      <div className="flex items-center gap-1">
        <span className="text-xs text-destructive">Delete?</span>
        <button onClick={() => { onDelete?.(); setConfirmDelete(false); }}
          className="text-xs text-destructive hover:opacity-80 font-medium px-1">Yes</button>
        <button onClick={() => setConfirmDelete(false)}
          className="text-xs text-muted-foreground hover:text-foreground px-1">No</button>
      </div>
    ) : (
      <button onClick={() => setConfirmDelete(true)}
        className={`p-1 rounded hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
        <Trash2 size={12} />
      </button>
    )
  ) : null;

  // Inbound HTML emails: full-width card
  if (hasHtml) {
    return (
      <div className="flex flex-col gap-1.5" onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setConfirmDelete(false); }}>
        <div className="flex items-center gap-2 px-1 flex-wrap">
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground flex-shrink-0">
            {(msg.from_name || msg.from_address || '?')[0].toUpperCase()}
          </div>
          <span className="text-xs font-medium text-foreground/90">{msg.from_name || msg.from_address}</span>
          {msg.from_name && <span className="text-xs text-muted-foreground">&lt;{msg.from_address}&gt;</span>}
          <span className="text-xs text-muted-foreground">{fmtDateTime(msg.sent_at || msg.created_at)}</span>
          <DeleteBtn />
        </div>
        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
          <EmailHtmlFrame html={msg.body_html!} />
        </div>
        {msg.cc_addresses && <span className="text-xs text-muted-foreground px-1">CC: {msg.cc_addresses}</span>}
      </div>
    );
  }

  // Outbound & plain-text inbound: chat bubble
  return (
    <div className={`flex gap-3 ${isOut ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setConfirmDelete(false); }}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${isOut ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
        {isOut ? (msg.is_ai_generated ? <Bot size={14} /> : <Send size={12} />) : (msg.from_name || msg.from_address || '?')[0].toUpperCase()}
      </div>
      <div className={`max-w-[75%] flex flex-col gap-1 ${isOut ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground/80">
            {isOut ? (msg.is_ai_generated ? 'AI Auto-reply' : 'You') : (msg.from_name || msg.from_address)}
          </span>
          {!isOut && msg.from_name && <span className="text-xs text-muted-foreground">&lt;{msg.from_address}&gt;</span>}
          {isOut && <span className="text-xs text-muted-foreground">&lt;{msg.from_address}&gt;</span>}
          <span className="text-xs text-muted-foreground">{fmtDateTime(msg.sent_at || msg.created_at)}</span>
          {isScheduled && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full ring-1 ring-amber-500/25">
              <Clock size={10} /> Scheduled {fmtDateTime(msg.scheduled_at)}
            </span>
          )}
          {isFailed && (
            <span
              title={msg.last_send_error || 'Send failed'}
              className="inline-flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full ring-1 ring-destructive/25">
              <X size={10} /> Not sent — delivery failed
            </span>
          )}
          <DeleteBtn />
        </div>
        <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${isOut ? 'bg-primary text-primary-foreground rounded-tr-md' : 'border border-border bg-card text-card-foreground rounded-tl-md'}`}>
          <pre className="whitespace-pre-wrap font-sans">{msg.body_text}</pre>
        </div>
        {/* Show the mail server's own words inline. Keeping this in a tooltip
            meant a failed client email looked unexplained unless you knew to hover. */}
        {isFailed && msg.last_send_error && (
          <div className="max-w-full text-xs rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
            <span className="font-medium">Mail server said:</span>{' '}
            <span className="break-words">{msg.last_send_error}</span>
            {typeof msg.send_attempts === 'number' && msg.send_attempts > 0 && (
              <span className="opacity-70"> (after {msg.send_attempts} attempts)</span>
            )}
          </div>
        )}
        {msg.cc_addresses && <span className="text-xs text-muted-foreground">CC: {msg.cc_addresses}</span>}
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
  const labels: Record<string, string> = { open: 'Open', followup: 'Follow-up', closed: 'Closed', dead: 'Dead' };
  const colors: Record<string, string> = {
    open: 'bg-primary/10 text-primary ring-1 ring-primary/25',
    followup: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/25',
    closed: 'bg-muted text-muted-foreground ring-1 ring-border',
    dead: 'bg-destructive/10 text-destructive ring-1 ring-destructive/25',
  };
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${colors[status] || colors.open}`}>
        {labels[status] || status}<ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-36 bg-popover border border-border rounded-lg shadow-lg py-1">
          {Object.entries(labels).map(([k, v]) => (
            <button key={k} onClick={() => { onChange(k); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-popover-foreground ${status === k ? 'font-semibold' : ''}`}>
              {status === k ? <Check size={11} className="text-primary" /> : <span className="w-3" />}{v}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-80 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Assign to Sales</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-2">
          <button onClick={() => onAssign(null)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary text-sm text-foreground font-medium">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-foreground"><X size={14} /></div>
            Unassign
          </button>
          {salesUsers.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No sales users found.</p>
          )}
          {salesUsers.map(u => (
            <button key={u.id} onClick={() => onAssign(u.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary text-sm ${currentAssignee === u.id ? 'bg-accent' : ''}`}>
              <AvatarFallback name={u.full_name} />
              <div className="text-left min-w-0">
                <p className="text-foreground font-medium truncate">{u.full_name}</p>
                <p className="text-xs text-muted-foreground">{roleLabel[u.role] || u.role}</p>
              </div>
              {currentAssignee === u.id && <Check size={14} className="ml-auto flex-shrink-0 text-primary" />}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-72 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Move to folder</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-2">
          <button onClick={() => onMove(null)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary text-sm ${!currentFolderId ? 'bg-accent' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <FolderOpen size={14} className="text-muted-foreground" />
            </div>
            <span className="text-foreground">No folder</span>
            {!currentFolderId && <Check size={14} className="ml-auto text-primary" />}
          </button>
          {folders.map(f => (
            <button key={f.id} onClick={() => onMove(f.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary text-sm ${currentFolderId === f.id ? 'bg-accent' : ''}`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: (f.color || '#6366f1') + '22' }}>
                <FolderOpen size={14} style={{ color: f.color || '#6366f1' }} />
              </div>
              <span className="text-foreground">{f.name}</span>
              {currentFolderId === f.id && <Check size={14} className="ml-auto text-primary" />}
            </button>
          ))}
          {folders.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No folders yet. Create one from the sidebar.</p>
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
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiDrafting, setAiDrafting] = useState(false);

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

  const runAiDraft = async () => {
    if (!aiTopic.trim()) { toast.error('Tell the AI what the email should cover'); return; }
    setAiDrafting(true);
    try {
      const r = await inboxApi.aiCompose(inboxId, {
        topic: aiTopic.trim(),
        to: to || undefined,
        subject: subject || undefined,
      });
      const draft = r.data?.draft;
      if (!draft) { toast.error('AI returned an empty draft'); return; }
      setBody(draft);
      setAiOpen(false);
      setAiTopic('');
      toast.success('Draft ready — read it through before sending');
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setAiDrafting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">New Email</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary"><X size={16} /></button>
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
          <div>
            <div className="flex items-center justify-between">
              <label className={LBL}>Message</label>
              <button type="button" onClick={() => setAiOpen(v => !v)}
                className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                <Bot size={12} /> {aiOpen ? 'Hide AI draft' : 'Write with AI'}
              </button>
            </div>
            {aiOpen && (
              <div className="mb-2 p-2 rounded-lg ring-1 ring-primary/25 bg-primary/5 space-y-2">
                <input value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                  placeholder="What should this email cover? (e.g. follow up on our quote, ask for a meeting)"
                  className="w-full text-xs px-2 py-1.5 rounded border border-primary/25 bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" />
                <div className="flex justify-end">
                  <button type="button" onClick={runAiDraft} disabled={aiDrafting}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs hover:opacity-90 disabled:opacity-50">
                    {aiDrafting ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                    {aiDrafting ? 'Drafting…' : 'Generate draft'}
                  </button>
                </div>
              </div>
            )}
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="Write your email…" className={`${INP} resize-none whitespace-pre-wrap`} />
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-muted-foreground" />
            <label className="text-xs text-muted-foreground">Send later:</label>
            <input type="datetime-local" value={sendLater} onChange={e => setSendLater(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground focus:outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-4 pb-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-secondary rounded-lg">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : sendLater ? <Clock size={14} /> : <Send size={14} />}
            {sendLater ? 'Schedule' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
