import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Inbox, Plus, RefreshCw, Search, Reply, Send, Clock,
  ChevronDown, ChevronRight, X, Check, MoreVertical,
  Settings, Users, Mail, Tag, Zap, AlertCircle, Archive,
  ArrowLeft, UserPlus, Trash2, Eye, Loader2, Bot,
} from 'lucide-react';
import { inboxApi } from '@/lib/api';
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

// ── types ──────────────────────────────────────────────────────────────────

interface SharedInbox {
  id: string;
  name: string;
  email_address: string;
  ai_followup_enabled: number;
  ai_followup_delay_hr: number;
  ai_followup_tone: string;
  last_synced_at?: string;
  member_count?: number;
  thread_count?: number;
  imap_host: string; imap_port: number; imap_secure: number;
  imap_user: string; imap_password?: string;
  smtp_host: string; smtp_port: number; smtp_secure: number;
  smtp_user: string; smtp_password?: string;
}

interface Thread {
  id: string;
  inbox_id: string;
  subject: string;
  client_email: string;
  client_name?: string;
  received_on?: string;
  assigned_to?: string;
  assignee_name?: string;
  assignee_avatar?: string;
  status: 'open' | 'followup' | 'closed';
  followup_count: number;
  last_inbound_at?: string;
  last_outbound_at?: string;
  ai_sent_at?: string;
  updated_at: string;
  message_count: number;
  last_body?: string;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  from_address: string;
  from_name?: string;
  to_addresses: string;
  cc_addresses?: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  sender_name?: string;
  is_ai_generated: number;
  scheduled_at?: string;
  sent_at?: string;
  status: string;
  created_at: string;
}

interface Sender {
  id: string;
  email_address: string;
  display_name?: string;
}

// ── sub-components ─────────────────────────────────────────────────────────

function ThreadStatusBadge({ thread }: { thread: Thread }) {
  if (thread.status === 'closed')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        <Archive size={10} /> Closed
      </span>
    );
  if (thread.status === 'followup')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <Tag size={10} /> Follow-up ({thread.followup_count}/5)
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      <Mail size={10} /> Open
    </span>
  );
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

  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [view, setView] = useState<'threads' | 'settings'>('threads');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQ, setSearchQ] = useState('');
  const [showUnassigned, setShowUnassigned] = useState(false);

  // Modals
  const [showNewInbox, setShowNewInbox] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showSettings, setShowSettings] = useState<SharedInbox | null>(null);

  // ── Queries ──────────────────────────────────────────────────

  const { data: inboxes = [], isLoading: loadingInboxes } = useQuery<SharedInbox[]>({
    queryKey: ['shared-inboxes'],
    queryFn: () => inboxApi.getInboxes().then(r => r.data),
    refetchInterval: 30_000,
  });

  const selectedInbox = inboxes.find(i => i.id === selectedInboxId) ?? null;

  const { data: threads = [], isLoading: loadingThreads, refetch: refetchThreads } = useQuery<Thread[]>({
    queryKey: ['inbox-threads', selectedInboxId, filterStatus, searchQ, showUnassigned],
    queryFn: () => inboxApi.getThreads(selectedInboxId!, {
      status: filterStatus === 'all' ? undefined : filterStatus,
      search: searchQ || undefined,
      unassigned: showUnassigned ? '1' : undefined,
    }).then(r => r.data),
    enabled: !!selectedInboxId,
    refetchInterval: 15_000,
  });

  const { data: threadDetail, isLoading: loadingThread } = useQuery<{ thread: Thread; messages: Message[]; senders: Sender[] }>({
    queryKey: ['inbox-thread', selectedInboxId, selectedThreadId],
    queryFn: () => inboxApi.getThread(selectedInboxId!, selectedThreadId!).then(r => r.data),
    enabled: !!(selectedInboxId && selectedThreadId),
    refetchInterval: 10_000,
  });

  const { data: members = [] } = useQuery<any[]>({
    queryKey: ['inbox-members', selectedInboxId],
    queryFn: () => inboxApi.getMembers(selectedInboxId!).then(r => r.data),
    enabled: !!selectedInboxId,
  });

  const { data: senders = [] } = useQuery<Sender[]>({
    queryKey: ['inbox-senders', selectedInboxId],
    queryFn: () => inboxApi.getSenders(selectedInboxId!).then(r => r.data),
    enabled: !!selectedInboxId,
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

  // Auto-select first inbox
  useEffect(() => {
    if (inboxes.length > 0 && !selectedInboxId) {
      setSelectedInboxId(inboxes[0].id);
    }
  }, [inboxes]);

  // ── Reply panel state ────────────────────────────────────────

  const [replyText, setReplyText] = useState('');
  const [replyFrom, setReplyFrom] = useState('');
  const [replyCC, setReplyCC] = useState('');
  const [sendLater, setSendLater] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    if (threadDetail?.senders?.length) {
      setReplyFrom(threadDetail.thread.received_on || threadDetail.senders[0].email_address);
    }
  }, [threadDetail]);

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
      setReplyText('');
      setReplyCC('');
      setSendLater('');
      qc.invalidateQueries({ queryKey: ['inbox-thread', selectedInboxId, selectedThreadId] });
      qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] });
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSendingReply(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────

  if (loadingInboxes) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (inboxes.length === 0 && isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <Inbox size={48} className="text-gray-300" />
        <div>
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">No shared inboxes yet</p>
          <p className="text-sm text-gray-500 mt-1">Create your first shared inbox to start managing client emails.</p>
        </div>
        <button onClick={() => setShowNewInbox(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">
          <Plus size={16} /> New Inbox
        </button>
        {showNewInbox && <NewInboxModal onClose={() => setShowNewInbox(false)} onCreated={(id) => { setSelectedInboxId(id); setShowNewInbox(false); qc.invalidateQueries({ queryKey: ['shared-inboxes'] }); }} />}
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">

      {/* ── Sidebar: inbox list ───────────────────────────────── */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800">
        <div className="p-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Shared Inboxes</span>
          {isAdmin && (
            <button onClick={() => setShowNewInbox(true)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
              <Plus size={16} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {inboxes.map(inbox => (
            <button
              key={inbox.id}
              onClick={() => { setSelectedInboxId(inbox.id); setSelectedThreadId(null); setView('threads'); }}
              className={`w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selectedInboxId === inbox.id ? 'bg-violet-50 dark:bg-violet-900/20 border-r-2 border-violet-500' : ''}`}
            >
              <Inbox size={15} className={`mt-0.5 flex-shrink-0 ${selectedInboxId === inbox.id ? 'text-violet-600' : 'text-gray-400'}`} />
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${selectedInboxId === inbox.id ? 'text-violet-700 dark:text-violet-400' : 'text-gray-700 dark:text-gray-300'}`}>{inbox.name}</p>
                <p className="text-xs text-gray-400 truncate">{inbox.email_address}</p>
                {inbox.thread_count != null && <p className="text-xs text-gray-400">{inbox.thread_count} threads</p>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Thread list ───────────────────────────────────────── */}
      {selectedInbox && (
        <div className={`flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${selectedThreadId ? 'hidden lg:flex w-72 flex-shrink-0' : 'flex-1 max-w-sm'}`}>
          {/* Header */}
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{selectedInbox.name}</h2>
                {selectedInbox.ai_followup_enabled ? (
                  <span title="AI follow-up enabled" className="text-emerald-500"><Zap size={12} /></span>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" title="Sync IMAP">
                  <RefreshCw size={14} className={syncMut.isPending ? 'animate-spin' : ''} />
                </button>
                {isAdmin && (
                  <button onClick={() => setShowSettings(selectedInbox)}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" title="Settings">
                    <Settings size={14} />
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => setShowNewThread(true)}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" title="New email">
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search threads…"
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            </div>

            {/* Filters */}
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
            </div>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {loadingThreads ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-gray-300" size={24} />
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Mail size={32} className="text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No threads found</p>
              </div>
            ) : threads.map(thread => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                selected={selectedThreadId === thread.id}
                isAdmin={isAdmin}
                members={members}
                onSelect={() => setSelectedThreadId(thread.id)}
                onStatusChange={(status) => patchThreadMut.mutate({ tid: thread.id, data: { status } })}
                onAssign={() => { setSelectedThreadId(thread.id); setShowAssign(true); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Thread detail ─────────────────────────────────────── */}
      {selectedThreadId && threadDetail ? (
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-800">
          {/* Thread header */}
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
                  <UserPlus size={13} />
                  {threadDetail.thread.assignee_name || 'Assign'}
                </button>
              )}
              <StatusDropdown
                status={threadDetail.thread.status}
                onChange={(s) => patchThreadMut.mutate({ tid: selectedThreadId, data: { status: s } })}
              />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingThread ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
            ) : threadDetail.messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </div>

          {/* Reply composer */}
          {threadDetail.thread.status !== 'closed' && (
            <div className="border-t border-gray-100 dark:border-gray-700 p-4">
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                {/* From + CC row */}
                <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs text-gray-400 flex-shrink-0">From:</span>
                    <select
                      value={replyFrom}
                      onChange={e => setReplyFrom(e.target.value)}
                      className="text-xs text-gray-700 dark:text-gray-200 bg-transparent border-none outline-none cursor-pointer"
                    >
                      {threadDetail.senders.map(s => (
                        <option key={s.id} value={s.email_address}>{s.display_name || s.email_address}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-xs text-gray-400 flex-shrink-0">CC:</span>
                    <input
                      value={replyCC}
                      onChange={e => setReplyCC(e.target.value)}
                      placeholder="optional"
                      className="text-xs flex-1 bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
                    />
                  </div>
                </div>
                {/* Body */}
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Write your reply…"
                  rows={5}
                  className="w-full px-3 py-2 text-sm bg-transparent outline-none resize-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
                />
                {/* Footer */}
                <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-gray-400" />
                    <input
                      type="datetime-local"
                      value={sendLater}
                      onChange={e => setSendLater(e.target.value)}
                      className="text-xs bg-transparent outline-none text-gray-500 dark:text-gray-400 cursor-pointer"
                      title="Send later — leave empty to send now"
                    />
                  </div>
                  <button
                    onClick={sendReply}
                    disabled={sendingReply || !replyText.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingReply ? <Loader2 size={14} className="animate-spin" /> : sendLater ? <Clock size={14} /> : <Send size={14} />}
                    {sendLater ? 'Schedule' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        !selectedThreadId && selectedInboxId && (
          <div className="hidden lg:flex flex-1 items-center justify-center text-gray-300 dark:text-gray-600">
            <div className="text-center">
              <Inbox size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a thread to read</p>
            </div>
          </div>
        )
      )}

      {/* ── Modals ────────────────────────────────────────────── */}
      {showNewInbox && (
        <NewInboxModal
          onClose={() => setShowNewInbox(false)}
          onCreated={(id) => { setSelectedInboxId(id); setShowNewInbox(false); qc.invalidateQueries({ queryKey: ['shared-inboxes'] }); }}
        />
      )}

      {showNewThread && selectedInboxId && (
        <NewThreadModal
          inboxId={selectedInboxId}
          senders={senders}
          onClose={() => setShowNewThread(false)}
          onCreated={(tid) => { setShowNewThread(false); setSelectedThreadId(tid); qc.invalidateQueries({ queryKey: ['inbox-threads', selectedInboxId] }); }}
        />
      )}

      {showAssign && selectedInboxId && selectedThreadId && (
        <AssignModal
          members={members}
          currentAssignee={threadDetail?.thread.assigned_to}
          onClose={() => setShowAssign(false)}
          onAssign={(uid) => assignMut.mutate({ tid: selectedThreadId, uid })}
        />
      )}

      {showSettings && (
        <InboxSettingsModal
          inbox={showSettings}
          onClose={() => { setShowSettings(null); qc.invalidateQueries({ queryKey: ['shared-inboxes'] }); }}
        />
      )}
    </div>
  );
}

// ── ThreadRow ──────────────────────────────────────────────────────────────

function ThreadRow({ thread, selected, isAdmin, members, onSelect, onStatusChange, onAssign }: {
  thread: Thread; selected: boolean; isAdmin: boolean;
  members: any[]; onSelect: () => void;
  onStatusChange: (s: string) => void; onAssign: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      onClick={onSelect}
      className={`relative flex items-start gap-2.5 px-3 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${selected ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}
    >
      <AvatarFallback name={thread.client_name || thread.client_email} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
            {thread.client_name || thread.client_email}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0">{fmtRelative(thread.updated_at)}</span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300 truncate mt-0.5">{thread.subject}</p>
        <p className="text-xs text-gray-400 truncate mt-0.5">{thread.last_body?.slice(0, 80)}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <ThreadStatusBadge thread={thread} />
          {thread.assignee_name && (
            <span className="text-xs text-gray-400 truncate">→ {thread.assignee_name}</span>
          )}
        </div>
      </div>

      {/* Kebab menu */}
      <div ref={menuRef} className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400">
          <MoreVertical size={14} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-6 z-20 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 text-xs">
            {['open', 'followup', 'closed'].map(s => (
              <button key={s} onClick={() => { onStatusChange(s); setMenuOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 ${thread.status === s ? 'font-semibold' : ''}`}>
                {thread.status === s && <Check size={12} className="text-violet-500" />}
                {thread.status !== s && <span className="w-3" />}
                Mark {s}
              </button>
            ))}
            {isAdmin && (
              <button onClick={() => { onAssign(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-t border-gray-100 dark:border-gray-700 mt-1 pt-2">
                <UserPlus size={12} /> Assign
              </button>
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
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: msg.body_html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans">{msg.body_text}</pre>
          )}
        </div>
        {msg.cc_addresses && (
          <span className="text-xs text-gray-400">CC: {msg.cc_addresses}</span>
        )}
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
        {labels[status] || status}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1">
          {Object.entries(labels).map(([k, v]) => (
            <button key={k} onClick={() => { onChange(k); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 ${status === k ? 'font-semibold' : ''}`}>
              {status === k && <Check size={11} className="text-violet-500" />}
              {status !== k && <span className="w-3" />}
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AssignModal ────────────────────────────────────────────────────────────

function AssignModal({ members, currentAssignee, onClose, onAssign }: {
  members: any[]; currentAssignee?: string;
  onClose: () => void; onAssign: (uid: string | null) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-80 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Assign thread</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-2">
          <button onClick={() => onAssign(null)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-500">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
              <X size={14} />
            </div>
            Unassign
          </button>
          {members.map(m => (
            <button key={m.user_id} onClick={() => onAssign(m.user_id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm ${currentAssignee === m.user_id ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}>
              <AvatarFallback name={m.full_name} />
              <div className="text-left">
                <p className="text-gray-800 dark:text-gray-100 font-medium">{m.full_name}</p>
                <p className="text-xs text-gray-400">{m.email}</p>
              </div>
              {currentAssignee === m.user_id && <Check size={14} className="ml-auto text-violet-500" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── NewThreadModal ─────────────────────────────────────────────────────────

function NewThreadModal({ inboxId, senders, onClose, onCreated }: {
  inboxId: string; senders: Sender[];
  onClose: () => void; onCreated: (tid: string) => void;
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
        to, subject, body_text: body, from_address: from, cc: cc || undefined,
        scheduled_at: sendLater || undefined,
      });
      toast.success(sendLater ? 'Scheduled!' : 'Email sent!');
      onCreated(r.data.thread_id);
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
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
              <label className="text-xs text-gray-500 mb-1 block">From</label>
              <select value={from} onChange={e => setFrom(e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400">
                {senders.map(s => <option key={s.id} value={s.email_address}>{s.display_name || s.email_address}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">To</label>
              <input value={to} onChange={e => setTo(e.target.value)} placeholder="client@example.com"
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">CC (optional)</label>
            <input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com"
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="Write your email…"
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none" />
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-400" />
            <label className="text-xs text-gray-500">Send later:</label>
            <input type="datetime-local" value={sendLater} onChange={e => setSendLater(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-400" />
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

// ── NewInboxModal ──────────────────────────────────────────────────────────

function NewInboxModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({
    name: '', email_address: '',
    imap_host: 'imap.gmail.com', imap_port: 993, imap_secure: 1,
    imap_user: '', imap_password: '',
    smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_secure: 0,
    smtp_user: '', smtp_password: '',
    ai_followup_enabled: 1, ai_followup_delay_hr: 2, ai_followup_tone: 'professional',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.email_address) { toast.error('Name and email are required'); return; }
    setSaving(true);
    try {
      const r = await inboxApi.createInbox(form);
      toast.success('Inbox created');
      onCreated(r.data.id);
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400';
  const lbl = 'text-xs text-gray-500 mb-1 block';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-lg">New Shared Inbox</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Inbox name *</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Sales Inbox" className={inp} /></div>
            <div><label className={lbl}>Collection email *</label><input value={form.email_address} onChange={e => set('email_address', e.target.value)} placeholder="inbox@yourdomain.com" className={inp} /></div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">IMAP Settings (incoming)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><label className={lbl}>Host</label><input value={form.imap_host} onChange={e => set('imap_host', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Port</label><input type="number" value={form.imap_port} onChange={e => set('imap_port', +e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Username</label><input value={form.imap_user} onChange={e => set('imap_user', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>App Password</label><input type="password" value={form.imap_password} onChange={e => set('imap_password', e.target.value)} className={inp} /></div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={!!form.imap_secure} onChange={e => set('imap_secure', e.target.checked ? 1 : 0)} className="rounded" />
                  SSL/TLS
                </label>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">SMTP Settings (outgoing)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><label className={lbl}>Host</label><input value={form.smtp_host} onChange={e => set('smtp_host', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Port</label><input type="number" value={form.smtp_port} onChange={e => set('smtp_port', +e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Username</label><input value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>App Password</label><input type="password" value={form.smtp_password} onChange={e => set('smtp_password', e.target.value)} className={inp} /></div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={!!form.smtp_secure} onChange={e => set('smtp_secure', e.target.checked ? 1 : 0)} className="rounded" />
                  SSL/TLS
                </label>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">AI Follow-up</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2 col-span-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={!!form.ai_followup_enabled} onChange={e => set('ai_followup_enabled', e.target.checked ? 1 : 0)} className="rounded" />
                  Enable AI auto-follow-up
                </label>
              </div>
              <div><label className={lbl}>Delay (hours)</label><input type="number" min={1} max={48} value={form.ai_followup_delay_hr} onChange={e => set('ai_followup_delay_hr', +e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Tone</label>
                <select value={form.ai_followup_tone} onChange={e => set('ai_followup_tone', e.target.value)} className={inp}>
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create Inbox
          </button>
        </div>
      </div>
    </div>
  );
}

// ── InboxSettingsModal ─────────────────────────────────────────────────────

function InboxSettingsModal({ inbox, onClose }: { inbox: SharedInbox; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'general' | 'senders' | 'members'>('general');

  const { data: senders = [], refetch: refetchSenders } = useQuery<Sender[]>({
    queryKey: ['inbox-senders-settings', inbox.id],
    queryFn: () => inboxApi.getSenders(inbox.id).then(r => r.data),
  });

  const { data: members = [], refetch: refetchMembers } = useQuery<any[]>({
    queryKey: ['inbox-members-settings', inbox.id],
    queryFn: () => inboxApi.getMembers(inbox.id).then(r => r.data),
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ['users-active'],
    queryFn: () => import('@/lib/api').then(m => m.default.get('/users/active').then(r => r.data)),
  });

  // General settings form
  const [form, setForm] = useState({
    name: inbox.name,
    ai_followup_enabled: inbox.ai_followup_enabled,
    ai_followup_delay_hr: inbox.ai_followup_delay_hr,
    ai_followup_tone: inbox.ai_followup_tone,
    imap_host: inbox.imap_host, imap_port: inbox.imap_port, imap_secure: inbox.imap_secure,
    imap_user: inbox.imap_user, imap_password: '',
    smtp_host: inbox.smtp_host, smtp_port: inbox.smtp_port, smtp_secure: inbox.smtp_secure,
    smtp_user: inbox.smtp_user, smtp_password: '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);

  const saveGeneral = async () => {
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (!payload.imap_password) delete payload.imap_password;
      if (!payload.smtp_password) delete payload.smtp_password;
      await inboxApi.updateInbox(inbox.id, payload);
      toast.success('Saved');
      qc.invalidateQueries({ queryKey: ['shared-inboxes'] });
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setSaving(false); }
  };

  // New sender
  const [newSender, setNewSender] = useState({ email_address: '', display_name: '' });
  const [addingSender, setAddingSender] = useState(false);
  const addSender = async () => {
    if (!newSender.email_address) return;
    setAddingSender(true);
    try {
      await inboxApi.addSender(inbox.id, newSender);
      setNewSender({ email_address: '', display_name: '' });
      refetchSenders();
      qc.invalidateQueries({ queryKey: ['inbox-senders', inbox.id] });
      toast.success('Sender added');
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setAddingSender(false); }
  };

  const removeSender = async (sid: string) => {
    try {
      await inboxApi.deleteSender(inbox.id, sid);
      refetchSenders();
      qc.invalidateQueries({ queryKey: ['inbox-senders', inbox.id] });
      toast.success('Removed');
    } catch (e: any) { toast.error(errMsg(e)); }
  };

  // Members
  const [selectedUser, setSelectedUser] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const addMember = async () => {
    if (!selectedUser) return;
    setAddingMember(true);
    try {
      await inboxApi.addMember(inbox.id, { user_id: selectedUser, role: 'member' });
      setSelectedUser('');
      refetchMembers();
      qc.invalidateQueries({ queryKey: ['inbox-members', inbox.id] });
      toast.success('Member added');
    } catch (e: any) { toast.error(errMsg(e)); }
    finally { setAddingMember(false); }
  };

  const removeMember = async (uid: string) => {
    try {
      await inboxApi.removeMember(inbox.id, uid);
      refetchMembers();
      qc.invalidateQueries({ queryKey: ['inbox-members', inbox.id] });
    } catch (e: any) { toast.error(errMsg(e)); }
  };

  const inp = 'w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400';
  const lbl = 'text-xs text-gray-500 mb-1 block';

  const existingMemberIds = new Set(members.map((m: any) => m.user_id));
  const availableUsers = allUsers.filter((u: any) => !existingMemberIds.has(u.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">{inbox.name} — Settings</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-5">
          {(['general', 'senders', 'members'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'general' && (
            <div className="space-y-4">
              <div><label className={lbl}>Inbox name</label><input value={form.name} onChange={e => set('name', e.target.value)} className={inp} /></div>

              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">IMAP Settings</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><label className={lbl}>Host</label><input value={form.imap_host} onChange={e => set('imap_host', e.target.value)} className={inp} /></div>
                  <div><label className={lbl}>Port</label><input type="number" value={form.imap_port} onChange={e => set('imap_port', +e.target.value)} className={inp} /></div>
                  <div><label className={lbl}>Username</label><input value={form.imap_user} onChange={e => set('imap_user', e.target.value)} className={inp} /></div>
                  <div><label className={lbl}>New password (leave blank to keep)</label><input type="password" value={form.imap_password} onChange={e => set('imap_password', e.target.value)} placeholder="••••••••" className={inp} /></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">SMTP Settings</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><label className={lbl}>Host</label><input value={form.smtp_host} onChange={e => set('smtp_host', e.target.value)} className={inp} /></div>
                  <div><label className={lbl}>Port</label><input type="number" value={form.smtp_port} onChange={e => set('smtp_port', +e.target.value)} className={inp} /></div>
                  <div><label className={lbl}>Username</label><input value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)} className={inp} /></div>
                  <div><label className={lbl}>New password (leave blank to keep)</label><input type="password" value={form.smtp_password} onChange={e => set('smtp_password', e.target.value)} placeholder="••••••••" className={inp} /></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">AI Follow-up</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={!!form.ai_followup_enabled} onChange={e => set('ai_followup_enabled', e.target.checked ? 1 : 0)} className="rounded" />
                    Enable AI auto-follow-up
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Delay (hours)</label><input type="number" min={1} max={48} value={form.ai_followup_delay_hr} onChange={e => set('ai_followup_delay_hr', +e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Tone</label>
                      <select value={form.ai_followup_tone} onChange={e => set('ai_followup_tone', e.target.value)} className={inp}>
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="casual">Casual</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={saveGeneral} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save
                </button>
              </div>
            </div>
          )}

          {tab === 'senders' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">Add the sending email addresses linked to this inbox. Each one will appear as a "From" option when composing replies.</p>

              {/* Add sender */}
              <div className="flex gap-2">
                <input value={newSender.email_address} onChange={e => setNewSender(s => ({ ...s, email_address: e.target.value }))}
                  placeholder="email@domain.com" className={`flex-1 ${inp}`} />
                <input value={newSender.display_name} onChange={e => setNewSender(s => ({ ...s, display_name: e.target.value }))}
                  placeholder="Display name" className={`flex-1 ${inp}`} />
                <button onClick={addSender} disabled={addingSender || !newSender.email_address}
                  className="px-3 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 flex-shrink-0">
                  {addingSender ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                </button>
              </div>

              {/* Sender list */}
              <div className="space-y-2">
                {senders.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">{s.email_address}</p>
                      {s.display_name && <p className="text-xs text-gray-400">{s.display_name}</p>}
                    </div>
                    <button onClick={() => removeSender(s.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {senders.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No senders added yet</p>}
              </div>
            </div>
          )}

          {tab === 'members' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">Team members who can access and reply to threads in this inbox.</p>

              {/* Add member */}
              <div className="flex gap-2">
                <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className={`flex-1 ${inp}`}>
                  <option value="">Select a team member…</option>
                  {availableUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name} — {u.email}</option>
                  ))}
                </select>
                <button onClick={addMember} disabled={addingMember || !selectedUser}
                  className="px-3 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 flex-shrink-0">
                  {addingMember ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                </button>
              </div>

              {/* Member list */}
              <div className="space-y-2">
                {members.map((m: any) => (
                  <div key={m.user_id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <AvatarFallback name={m.full_name} />
                      <div>
                        <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">{m.full_name}</p>
                        <p className="text-xs text-gray-400">{m.email} · {m.role}</p>
                      </div>
                    </div>
                    <button onClick={() => removeMember(m.user_id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {members.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No members yet</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
