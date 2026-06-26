import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import RichTextEditor from '@/components/RichTextEditor';
import toast from 'react-hot-toast';
import {
  Inbox, Send, FileText, Star, Archive, Trash2,
  Plus, RefreshCw, Search, Reply, Forward, MailOpen, Paperclip, Download,
  Minus, X, PlugZap, CheckCircle2, XCircle, Loader2,
  Folder, FolderPlus, MoreVertical, Pencil, FolderInput, Check,
  Menu, ArrowLeft, PanelLeftOpen, PanelLeftClose, ChevronDown,
  Bot,
} from 'lucide-react';

// Tracks whether the viewport is mobile-sized. Updates on resize.
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < breakpoint
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}
import api, { emailApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------- helpers ----------
const fmtRelative = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString();
};
const fmtDateTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  // e.g. "23 Apr 2026, 9:05 PM"
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
};

// Sanitize email HTML — strip scripts and event handlers only.
// <style> tags are intentionally kept: email clients (Gmail, Outlook) rely on
// them for layout, and stripping them breaks visual ordering of elements.
// Safe because this content is rendered inside a sandboxed iframe.
const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
};

const formatAddresses = (addrs: any): string => {
  if (!addrs) return '';
  if (Array.isArray(addrs)) return addrs.join(', ');
  return String(addrs);
};

const FOLDERS = [
  { key: 'INBOX', label: 'Inbox', icon: Inbox },
  { key: 'Sent', label: 'Sent', icon: Send },
  { key: 'Drafts', label: 'Drafts', icon: FileText },
  { key: 'Starred', label: 'Starred', icon: Star },
  { key: 'Archive', label: 'Archive', icon: Archive },
  { key: 'Trash', label: 'Trash', icon: Trash2 },
];

const errMsg = (e: any) => e?.response?.data?.error || e?.response?.data?.message || 'Something went wrong';

export default function EmailPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isEmailAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  // Lock body scroll while on the email page so the page itself can never
  // overflow past the viewport (the email layout is fixed-viewport-height
  // with internal-only scrolling).
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  const [activeFolder, setActiveFolder] = useState('INBOX');
  const [activeCustomFolderId, setActiveCustomFolderId] = useState<string | null>(null);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  // When the user clicks the minus button the modal collapses into a small
  // bar at the bottom-right instead of being torn down — clicking the bar
  // brings the draft back. Closing the bar (X) discards the draft.
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiDrafting, setAiDrafting] = useState(false);
  const [replyContextId, setReplyContextId] = useState<string | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Sidebar is now fixed-expanded to match the Shared Inbox layout.
  // The setter is kept (always a no-op) so existing collapse-toggle calls
  // remain compile-safe without functional change.
  const sidebarExpanded = true;
  const setSidebarExpanded = (_: boolean | ((v: boolean) => boolean)) => {};
  const [mailFoldersOpen, setMailFoldersOpen] = useState(true);

  // Auto-close the mobile sidebar drawer whenever an email opens, a folder
  // is picked, etc. — anything that changes context.
  useEffect(() => {
    if (isMobile) setMobileSidebarOpen(false);
  }, [selectedId, activeFolder, activeCustomFolderId, activeAccountId, isMobile]);
  // Multi-selection: tracks which messages are checked. Distinct from selectedId
  // (which is the single email open in the detail pane).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  // Clear selection when folder/account/search changes — a fresh list shouldn't
  // carry over checkboxes from the previous list.
  useEffect(() => {
    setSelectedIds(new Set());
    setExpandedThreads(new Set());
  }, [activeFolder, activeCustomFolderId, activeAccountId, search]);

  // ----- custom folders (user-defined categories) -----
  const { data: customFoldersData } = useQuery({
    queryKey: ['email-custom-folders'],
    queryFn: () => emailApi.getCustomFolders().then((r) => r.data?.data ?? r.data ?? []),
    refetchInterval: 60_000,
  });
  const customFolders: any[] = Array.isArray(customFoldersData) ? customFoldersData : [];

  // ----- accounts -----
  const { data: accountsData } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => emailApi.getAccounts().then((r) => r.data?.data ?? r.data ?? []),
  });
  const accounts: any[] = Array.isArray(accountsData) ? accountsData : [];

  useEffect(() => {
    if (!activeAccountId && accounts.length > 0) {
      const def = accounts.find((a) => a.is_default) || accounts[0];
      setActiveAccountId(def.id);
    }
  }, [accounts, activeAccountId]);

  // ----- IMAP folders (all Gmail labels + custom IMAP folders, with unread counts) -----
  const { data: imapFoldersData } = useQuery({
    queryKey: ['email-imap-folders', activeAccountId],
    queryFn: () => api.get(`/email/accounts/${activeAccountId}/imap-folders`).then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!activeAccountId,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const imapFolders: any[] = Array.isArray(imapFoldersData) ? imapFoldersData : [];

  // ----- messages list (paginated 50 at a time, auto-refresh every 30s) -----
  const PAGE_SIZE = 50;
  const {
    data: msgData,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['emails', activeFolder, activeCustomFolderId, activeAccountId, search],
    queryFn: async ({ pageParam = 0 }) => {
      const r = await emailApi.getMessages({
        folder: activeCustomFolderId ? undefined : activeFolder,
        custom_folder_id: activeCustomFolderId || undefined,
        account_id: activeAccountId || undefined,
        search: search || undefined,
        limit: PAGE_SIZE,
        offset: pageParam,
      });
      return r.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any, allPages: any[]) => {
      // Backend returns { data, total, has_more }. Stop if has_more=false or
      // if we've already fetched everything.
      if (!lastPage?.has_more) return undefined;
      const fetched = allPages.reduce((sum, p: any) => sum + (p?.data?.length || 0), 0);
      return fetched;
    },
    enabled: accounts.length > 0,
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  // Flatten pages into a single array. Older queries may return data in
  // different shapes (data array directly, or {data: []}) — handle both.
  const messages: any[] = useMemo(() => {
    if (!msgData?.pages) return [];
    return msgData.pages.flatMap((p: any) => p?.data || (Array.isArray(p) ? p : []));
  }, [msgData]);
  const totalMessages: number = (msgData?.pages?.[0] as any)?.total ?? messages.length;

  // Thread key: normalized subject only (strips Re:/Fwd:/Fw:) so back-and-forth
  // conversations with different senders are correctly grouped together.
  const normalizeSubject = (s: string) =>
    (s || '').replace(/^((re|fwd?|fw)\s*:\s*)*/gi, '').trim().toLowerCase() || '(no subject)';

  const threads = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const msg of messages) {
      const key = normalizeSubject(msg.subject);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(msg);
    }
    const groups: Array<{ key: string; msgs: any[] }> = [];
    map.forEach((msgs, key) => {
      msgs.sort((a, b) =>
        new Date(b.received_at || b.sent_at || 0).getTime() -
        new Date(a.received_at || a.sent_at || 0).getTime()
      );
      groups.push({ key, msgs });
    });
    groups.sort((a, b) =>
      new Date(b.msgs[0].received_at || b.msgs[0].sent_at || 0).getTime() -
      new Date(a.msgs[0].received_at || a.msgs[0].sent_at || 0).getTime()
    );
    return groups;
  }, [messages]); // eslint-disable-line

  // ----- unread inbox count (auto-refresh every 30s) -----
  const { data: unreadData } = useQuery({
    queryKey: ['email-unread', activeAccountId],
    queryFn: () =>
      emailApi
        .getMessages({
          folder: 'INBOX',
          account_id: activeAccountId || undefined,
          is_read: false,
          limit: 1,
        })
        .then((r) => r.data),
    enabled: !!activeAccountId,
    staleTime: 0,
    refetchInterval: 15_000,
  });
  const unreadCount: number = (() => {
    if (!unreadData) return 0;
    if (typeof unreadData.total === 'number') return unreadData.total;
    if (typeof unreadData.count === 'number') return unreadData.count;
    if (Array.isArray(unreadData)) return unreadData.length;
    if (Array.isArray(unreadData.data)) {
      // If meta has total, prefer it
      if (unreadData.meta?.total != null) return unreadData.meta.total;
      return unreadData.data.length;
    }
    return 0;
  })();

  // ----- selected message -----
  const { data: emailData } = useQuery({
    queryKey: ['email-message', selectedId],
    queryFn: () => emailApi.getMessage(selectedId!).then((r) => r.data?.data ?? r.data),
    enabled: !!selectedId,
  });
  const email: any = emailData;

  // The thread the selected email belongs to (for conversation view)
  const selectedThread = useMemo(() => {
    if (!selectedId) return null;
    return threads.find(t => t.msgs.some(m => m.id === selectedId)) || null;
  }, [selectedId, threads]); // eslint-disable-line

  // Tracks which emails in the conversation have their full body expanded.
  const [expandedInThread, setExpandedInThread] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (selectedId) setExpandedInThread(new Set([selectedId]));
  }, [selectedId]);

  // Cache full email bodies fetched on-demand in conversation view.
  // Clear on folder/account change so stale content doesn't linger.
  const [threadEmailCache, setThreadEmailCache] = useState<Record<string, any>>({});
  useEffect(() => {
    setThreadEmailCache({});
  }, [activeFolder, activeCustomFolderId, activeAccountId]);

  const fetchThreadEmail = async (id: string) => {
    if (threadEmailCache[id]) return;
    try {
      const r = await emailApi.getMessage(id);
      const data = r.data?.data ?? r.data;
      if (data?.id) setThreadEmailCache(prev => ({ ...prev, [id]: data }));
    } catch {
      // Mark as failed so we don't retry infinitely
      setThreadEmailCache(prev => ({ ...prev, [id]: { _failed: true } }));
    }
  };

  // When an email is opened, it's auto-marked read server-side — refresh unread count + list
  useEffect(() => {
    if (email?.id) {
      qc.invalidateQueries({ queryKey: ['email-unread'] });
      qc.invalidateQueries({ queryKey: ['emails'] });
    }
  }, [email?.id]); // eslint-disable-line

  // ----- mutations -----
  const syncMutation = useMutation({
    mutationFn: () => emailApi.syncAccount(activeAccountId!, activeFolder),
    onSuccess: (r: any) => {
      toast.success(r.data?.message || 'Synced');
      qc.invalidateQueries({ queryKey: ['email-unread'] });
      refetch();
    },
    onError: () => toast.error('Could not reach mail server — check your IMAP settings'),
  });

  // Background IMAP poll — every 60s, silently fetch new emails from the mail
  // server into our local DB so the 30s message-list refetch can pick them up.
  // No toasts on success/failure — runs invisibly. Skips if already syncing.
  useEffect(() => {
    if (!activeAccountId) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || syncMutation.isPending) return;
      try {
        await emailApi.syncAccount(activeAccountId, activeFolder);
        if (cancelled) return;
        qc.invalidateQueries({ queryKey: ['email-unread'] });
        qc.invalidateQueries({ queryKey: ['emails'] });
      } catch {
        // Silent — IMAP outages shouldn't bug the user with a toast every minute
      }
    };
    // First tick after 30s, then every 60s — keeps local DB fresh for the 15s UI refetch
    const initial = window.setTimeout(tick, 30_000);
    const interval = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [activeAccountId, activeFolder]); // eslint-disable-line

  const star = useMutation({
    mutationFn: () => emailApi.patchMessage(email!.id, { is_starred: !email!.is_starred }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-message', selectedId] }),
    onError: (e: any) => toast.error(errMsg(e)),
  });
  const archive = useMutation({
    mutationFn: () => emailApi.patchMessage(email!.id, { is_archived: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] });
      qc.invalidateQueries({ queryKey: ['email-unread'] });
      setSelectedId(null);
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });
  const trash = useMutation({
    mutationFn: () => emailApi.patchMessage(email!.id, { is_deleted: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] });
      qc.invalidateQueries({ queryKey: ['email-unread'] });
      setSelectedId(null);
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });
  const unread = useMutation({
    mutationFn: () => emailApi.patchMessage(email!.id, { is_read: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] });
      qc.invalidateQueries({ queryKey: ['email-unread'] });
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  // ----- compose form -----
  const composeForm = useForm({
    defaultValues: { to: '', cc: '', subject: '', body_html: '', account_id: '' },
  });
  useEffect(() => {
    if (activeAccountId) composeForm.setValue('account_id', activeAccountId);
  }, [activeAccountId]); // eslint-disable-line

  // When opening compose, prefill body with the active account's signature
  // (only if body is empty so we don't clobber a reply quote). Wrap in <p>
  // tags so the rich editor renders it as paragraphs, not a literal text blob.
  const activeAccount = useMemo(
    () => accounts.find((a: any) => a.id === activeAccountId) || null,
    [accounts, activeAccountId]
  );

  // Convert plain-text signature into HTML paragraphs. Returns empty string
  // if no signature is set. Used by new-compose, reply, and forward.
  const buildSignatureHtml = (sig: string | undefined | null): string => {
    if (!sig || !sig.trim()) return '';
    const sigHtml = sig
      .split('\n')
      .map((line: string) => {
        const safe = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<p>${safe || '<br>'}</p>`;
      })
      .join('');
    // Two blank lines + "--" separator + signature paragraphs.
    return `<p><br></p><p>--</p>${sigHtml}`;
  };

  useEffect(() => {
    if (showCompose) {
      const current = composeForm.getValues('body_html') || '';
      const sigHtml = buildSignatureHtml(activeAccount?.signature);
      if (!current.trim() && sigHtml) {
        composeForm.setValue('body_html', sigHtml);
      }
    }
  }, [showCompose, activeAccount?.id]); // eslint-disable-line

  const sendMutation = useMutation({
    mutationFn: (d: any) => {
      // Derive a plain-text version from the rich HTML so recipients without
      // HTML support still see something readable.
      const stripHtml = (html: string) => {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return (div.textContent || div.innerText || '').trim();
      };
      return emailApi.send({ ...d, body_text: stripHtml(d.body_html || '') });
    },
    onSuccess: () => {
      toast.success('Email sent!');
      composeForm.reset({ to: '', cc: '', subject: '', body_html: '', account_id: activeAccountId || '' });
      setShowCompose(false);
      setComposeMinimized(false);
      setReplyContextId(null);
      qc.invalidateQueries({ queryKey: ['emails'] });
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Run the server-side AI draft and replace the compose body with the result.
  // Reply mode is automatic — if the composer was opened via Reply we pass the
  // original message id so the AI has the thread context.
  const runAiDraft = async () => {
    if (!aiTopic.trim() && !replyContextId) {
      toast.error('Tell the AI what the email should cover');
      return;
    }
    setAiDrafting(true);
    try {
      const r = await emailApi.aiDraft({
        topic: aiTopic.trim() || undefined,
        to: composeForm.getValues('to') || undefined,
        subject: composeForm.getValues('subject') || undefined,
        reply_to_id: replyContextId || undefined,
      });
      const draft = r.data?.draft as string | undefined;
      if (!draft) { toast.error('AI returned an empty draft'); return; }
      // Convert plain text → HTML paragraphs and drop it above the existing
      // signature/quote block so the user can read through.
      const draftHtml = draft.split('\n').map(line =>
        line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>'
      ).join('');
      const existing = composeForm.getValues('body_html') || '';
      composeForm.setValue('body_html', `${draftHtml}${existing}`);
      setAiOpen(false);
      setAiTopic('');
      toast.success('Draft ready — read it through before sending');
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setAiDrafting(false);
    }
  };

  const replyTo = () => {
    if (!email) return;
    // Body layout: blank lines for typing → signature → blockquote of original
    const sigHtml = buildSignatureHtml(activeAccount?.signature);
    const quoteLines = (email.body_text || '')
      .split('\n')
      .map((l: string) => escapeHtml(l) || '<br>')
      .join('<br>');
    const quoteHeader = `On ${fmtDateTime(email.received_at || email.sent_at)}, ${escapeHtml(email.from_name || email.from_address || 'sender')} wrote:`;

    const replyBody = `<p><br></p><p><br></p>${sigHtml}<blockquote>${quoteHeader}<br>${quoteLines}</blockquote>`;

    composeForm.reset({
      to: email.from_address || '',
      cc: '',
      subject: email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject || ''}`,
      body_html: replyBody,
      account_id: activeAccountId || '',
    });
    setReplyContextId(email.id);
    setShowCompose(true);
    setComposeMinimized(false);
  };

  const forwardEmail = () => {
    if (!email) return;
    // Forwarded message header (Outlook/Gmail style) + original email body
    const sigHtml = buildSignatureHtml(activeAccount?.signature);
    const quoteLines = (email.body_text || '')
      .split('\n')
      .map((l: string) => escapeHtml(l) || '<br>')
      .join('<br>');
    const fwdHeader =
      `<p><strong>---------- Forwarded message ----------</strong></p>` +
      `<p><strong>From:</strong> ${escapeHtml(email.from_name || '')} &lt;${escapeHtml(email.from_address || '')}&gt;</p>` +
      `<p><strong>Date:</strong> ${escapeHtml(fmtDateTime(email.received_at || email.sent_at))}</p>` +
      `<p><strong>Subject:</strong> ${escapeHtml(email.subject || '')}</p>` +
      (email.to_addresses ? `<p><strong>To:</strong> ${escapeHtml(formatAddresses(email.to_addresses))}</p>` : '');

    const forwardBody = `<p><br></p><p><br></p>${sigHtml}<blockquote>${fwdHeader}<p><br></p>${quoteLines}</blockquote>`;

    composeForm.reset({
      to: '',
      cc: '',
      subject: email.subject?.toLowerCase().startsWith('fwd:') ? email.subject : `Fwd: ${email.subject || ''}`,
      body_html: forwardBody,
      account_id: activeAccountId || '',
    });
    setReplyContextId(null);
    setShowCompose(true);
    setComposeMinimized(false);
  };

  // ----- add-account form -----
  const accountForm = useForm({
    defaultValues: {
      label: '',
      email_address: '',
      smtp_host: '',
      smtp_port: 587,
      smtp_secure: false,
      smtp_user: '',
      smtp_password: '',
      imap_host: '',
      imap_port: 993,
      imap_secure: true,
      imap_user: '',
      imap_password: '',
      is_default: false,
      signature: '',
      for_user_id: '',
    },
  });
  const { data: activeUsers = [] } = useQuery({
    queryKey: ['users-active'],
    queryFn: () => api.get('/users/active').then(r => {
      const d = r.data;
      if (Array.isArray(d)) return d;
      if (Array.isArray(d?.users)) return d.users;
      if (Array.isArray(d?.data)) return d.data;
      return [];
    }),
    enabled: isEmailAdmin,
  });
  const addMutation = useMutation({
    mutationFn: (d: any) => emailApi.addAccount(d),
    onSuccess: () => {
      toast.success('Account added. Click Test Connection to verify your credentials.');
      accountForm.reset();
      setShowAddAccount(false);
      qc.invalidateQueries({ queryKey: ['email-accounts'] });
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const filteredFolders = useMemo(() => FOLDERS, []);

  // Mobile drawer sidebar (full expanded with labels)
  const mobileSidebarContent = (
    <>
      <div className="p-3">
        <button
          onClick={() => { setShowCompose(true); setComposeMinimized(false); setMobileSidebarOpen(false); }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition"
        >
          <Plus size={16} /> Compose
        </button>
      </div>
      <nav className="px-2 space-y-0.5">
        {filteredFolders.map((f) => {
          const Icon = f.icon;
          const active = !activeCustomFolderId && activeFolder === f.key;
          return (
            <button key={f.key} onClick={() => { setActiveFolder(f.key); setActiveCustomFolderId(null); setSelectedId(null); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Icon size={16} />
              <span className="flex-1 text-left">{f.label}</span>
              {f.key === 'INBOX' && unreadCount > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${active ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary'}`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="mt-4 px-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Folders</span>
          <button onClick={() => setShowCreateFolder(true)} className="text-muted-foreground hover:text-foreground" title="Create folder"><FolderPlus size={14} /></button>
        </div>
        <div className="space-y-0.5">
          {customFolders.map((cf: any) => (
            <CustomFolderRow key={cf.id} folder={cf} active={activeCustomFolderId === cf.id}
              onSelect={() => { setActiveCustomFolderId(cf.id); setActiveFolder(''); setSelectedId(null); setMobileSidebarOpen(false); }}
              onChanged={() => { qc.invalidateQueries({ queryKey: ['email-custom-folders'] }); qc.invalidateQueries({ queryKey: ['emails'] }); }}
              onDeleted={(deletedId: string) => { if (activeCustomFolderId === deletedId) { setActiveCustomFolderId(null); setActiveFolder('INBOX'); } qc.invalidateQueries({ queryKey: ['email-custom-folders'] }); qc.invalidateQueries({ queryKey: ['emails'] }); }} />
          ))}
          {customFolders.length === 0 && <p className="text-[11px] text-muted-foreground/70 px-2 py-1.5 italic">No folders yet.</p>}
        </div>
      </div>
      <div className="mt-4 px-3 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accounts</span>
          {isEmailAdmin && <button onClick={() => setShowAddAccount(true)} className="text-muted-foreground hover:text-foreground" title="Add account"><Plus size={14} /></button>}
        </div>
        <div className="space-y-1">
          {accounts.map((acc: any) => (
            <AccountRow key={acc.id} acc={acc} active={activeAccountId === acc.id} isEmailAdmin={isEmailAdmin}
              onSelect={() => setActiveAccountId(acc.id)}
              onDeleted={(deletedId: string) => { if (activeAccountId === deletedId) setActiveAccountId(null); }} />
          ))}
          {accounts.length === 0 && <p className="text-xs text-muted-foreground px-2 py-2">{isEmailAdmin ? 'No accounts yet' : 'No email accounts configured'}</p>}
        </div>
      </div>
    </>
  );

  // Active folder label for display
  const activeFolderLabel = activeCustomFolderId
    ? customFolders.find((f: any) => f.id === activeCustomFolderId)?.name || 'Folder'
    : FOLDERS.find((f) => f.key === activeFolder)?.label || activeFolder;
  const activeFolderTotal = totalMessages;

  return (
    <div className="h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {!isMobile && (
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ───────── COL 1 — SIDEBAR (collapsible) ───────── */}
      <aside className="flex-none w-[220px] border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col py-3 px-2 items-stretch overflow-hidden">

        {/* Compose row */}
        <div className="flex items-center mb-2 px-1">
          <button
            onClick={() => { setShowCompose(true); setComposeMinimized(false); }}
            title="Compose"
            className="h-9 flex-1 rounded-xl bg-primary text-primary-foreground flex items-center justify-center gap-2 px-3 text-sm font-semibold hover:opacity-90 transition shadow-sm shrink-0"
          >
            <Plus size={16} />
            <span>Compose</span>
          </button>
        </div>

        {/* System folders */}
        {filteredFolders.map((f) => {
          const Icon = f.icon;
          const active = !activeCustomFolderId && activeFolder === f.key;
          return (
            <button
              key={f.key}
              title={sidebarExpanded ? undefined : f.label + (f.key === 'INBOX' && unreadCount > 0 ? ` (${unreadCount})` : '')}
              onClick={() => { setActiveFolder(f.key); setActiveCustomFolderId(null); setSelectedId(null); }}
              className={`relative flex items-center gap-3 rounded-xl transition-colors ${
                sidebarExpanded ? 'w-full px-3 py-2' : 'w-10 h-10 justify-center'
              } ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              <Icon size={17} className="shrink-0" />
              {sidebarExpanded && <span className="flex-1 text-left text-sm font-medium">{f.label}</span>}
              {f.key === 'INBOX' && unreadCount > 0 && (
                sidebarExpanded
                  ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary'}`}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                  : <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div className="bg-gray-200 dark:bg-gray-700 my-2 shrink-0 h-px mx-1" />

        {/* Everything below the divider scrolls independently so the top
           (Compose + system folders) stays pinned in view. */}
        <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col ${sidebarExpanded ? 'items-stretch' : 'items-center'}`}>

        {/* IMAP / Mail server folders — only render when sidebar is expanded so the
           collapsed rail stays clean. When collapsed, a single chevron expands the
           sidebar instead of stacking generic folder icons. */}
        {sidebarExpanded && imapFolders.length > 0 && (
          <>
            <button
              onClick={() => setMailFoldersOpen((v) => !v)}
              className="flex items-center justify-between px-2 mb-1 w-full text-muted-foreground hover:text-foreground"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">Mail Folders</span>
              <ChevronDown size={12} className={`transition-transform ${mailFoldersOpen ? '' : '-rotate-90'}`} />
            </button>
            {mailFoldersOpen && imapFolders
              .filter((f: any) => !f.no_select && f.path !== 'INBOX')
              .map((f: any) => {
                const active = !activeCustomFolderId && activeFolder === f.path;
                return (
                  <button
                    key={f.path}
                    onClick={() => { setActiveFolder(f.path); setActiveCustomFolderId(null); setSelectedId(null); }}
                    className={`relative flex items-center gap-3 rounded-xl transition-colors w-full px-3 py-2 ${
                      active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Folder size={17} className="shrink-0" />
                    <span className="flex-1 text-left text-sm font-medium truncate">{f.name}</span>
                    {f.unread > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary'}`}>
                        {f.unread > 99 ? '99+' : f.unread}
                      </span>
                    )}
                  </button>
                );
              })}
            <div className="bg-gray-200 dark:bg-gray-700 my-2 h-px mx-1" />
          </>
        )}

        {/* "More folders" hint when sidebar is collapsed but mail folders exist */}
        {!sidebarExpanded && imapFolders.filter((f: any) => !f.no_select && f.path !== 'INBOX').length > 0 && (
          <button
            onClick={() => setSidebarExpanded(true)}
            title={`${imapFolders.filter((f: any) => !f.no_select && f.path !== 'INBOX').length} more folders`}
            className="w-10 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronDown size={14} className="-rotate-90" />
          </button>
        )}

        {/* Custom folders header */}
        {sidebarExpanded && (
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Folders</span>
            <button onClick={() => setShowCreateFolder(true)} className="text-muted-foreground hover:text-foreground" title="New folder"><FolderPlus size={13} /></button>
          </div>
        )}

        {/* Custom folders */}
        {customFolders.map((cf: any) => (
          <button
            key={cf.id}
            title={sidebarExpanded ? undefined : cf.name}
            onClick={() => { setActiveCustomFolderId(cf.id); setActiveFolder(''); setSelectedId(null); }}
            className={`relative flex items-center gap-3 rounded-xl transition-colors ${
              sidebarExpanded ? 'w-full px-3 py-2' : 'w-10 h-10 justify-center'
            } ${activeCustomFolderId === cf.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Folder size={17} className="shrink-0" />
            {sidebarExpanded && <span className="flex-1 text-left text-sm truncate">{cf.name}</span>}
          </button>
        ))}
        {!sidebarExpanded && (
          <button onClick={() => setShowCreateFolder(true)} title="New folder" className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <FolderPlus size={16} />
          </button>
        )}

        {/* Divider + accounts */}
        <div className="bg-gray-200 dark:bg-gray-700 my-2 h-px mx-1" />

        {/* Accounts header */}
        {sidebarExpanded && (
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Accounts</span>
            {isEmailAdmin && <button onClick={() => setShowAddAccount(true)} className="text-muted-foreground hover:text-foreground" title="Add account"><Plus size={13} /></button>}
          </div>
        )}

        {accounts.map((acc: any) => {
          const initial = (acc.email_address || acc.email || '?')[0].toUpperCase();
          const isActive = activeAccountId === acc.id;
          return (
            <button
              key={acc.id}
              title={sidebarExpanded ? undefined : (acc.email_address || acc.email)}
              onClick={() => setActiveAccountId(acc.id)}
              className={`flex items-center gap-3 rounded-xl transition-all ${
                sidebarExpanded ? 'w-full px-2 py-1.5' : 'w-10 h-10 justify-center'
              } ${isActive ? 'bg-primary/10' : 'hover:bg-muted'}`}
            >
              <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                isActive ? 'bg-primary text-primary-foreground ring-2 ring-primary/40' : 'bg-muted text-muted-foreground'
              }`}>{initial}</span>
              {sidebarExpanded && (
                <span className="flex-1 min-w-0 text-left">
                  <span className="block text-xs font-medium text-foreground truncate">{acc.email_address || acc.email}</span>
                  {acc.is_default && <span className="text-[9px] text-primary font-semibold">Default</span>}
                </span>
              )}
            </button>
          );
        })}
        {!sidebarExpanded && isEmailAdmin && (
          <button onClick={() => setShowAddAccount(true)} title="Add email account" className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors border-2 border-dashed border-muted-foreground/30 hover:border-primary/40">
            <Plus size={14} />
          </button>
        )}
        </div>
      </aside>

      {/* ───────── COL 2 + 3 — LIST + DETAIL (resizable) ───────── */}
      <PanelGroup direction="horizontal" autoSaveId="email-list-detail" className="flex-1 min-h-0">
      <Panel defaultSize={35} minSize={24} maxSize={55} order={2} id="list">
      <section className="h-full border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">

        {/* Top search + compose bar */}
        <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 shrink-0">
          {messages.length > 0 && selectedIds.size === 0 && (
            <button
              onClick={() => setSelectedIds(new Set(messages.map((m: any) => m.id)))}
              title="Select all"
              className="shrink-0 w-4 h-4 flex items-center justify-center rounded border border-muted-foreground/50 hover:border-primary hover:bg-primary/10 cursor-pointer transition-colors"
            >
              <span className="sr-only">Select all</span>
            </button>
          )}
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSearch(''); }}
              placeholder="Search messages…"
              className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground">
                <X size={11} />
              </button>
            )}
          </div>
          <button onClick={() => syncMutation.mutate()} disabled={!activeAccountId || syncMutation.isPending} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors disabled:opacity-40" title="Sync">
            <RefreshCw size={13} className={syncMutation.isPending ? 'animate-spin' : ''} />
          </button>
        </div>

        {selectedIds.size > 0 && (
          <SelectionBar
            count={selectedIds.size}
            allOnPage={messages.length}
            folders={customFolders}
            onSelectAll={() => setSelectedIds(new Set(messages.map((m: any) => m.id)))}
            onClear={() => setSelectedIds(new Set())}
            onMoved={() => { qc.invalidateQueries({ queryKey: ['emails'] }); qc.invalidateQueries({ queryKey: ['email-custom-folders'] }); qc.invalidateQueries({ queryKey: ['email-unread'] }); setSelectedIds(new Set()); }}
            ids={Array.from(selectedIds)}
          />
        )}

        {/* Folder section header */}
        {selectedIds.size === 0 && (
          <div className="px-4 pt-3 pb-1 shrink-0">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              {(() => { const f = filteredFolders.find(f => f.key === activeFolder); return f ? <f.icon size={16} className="text-muted-foreground" /> : <Folder size={16} className="text-muted-foreground" />; })()}
              {activeFolderLabel}
              {activeFolderTotal > 0 && <span className="text-sm font-normal text-muted-foreground">{activeFolderTotal}</span>}
            </h2>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No messages in {activeFolderLabel}</p>
              {accounts.length === 0 && isEmailAdmin && (
                <button onClick={() => setShowAddAccount(true)} className="mt-2 text-xs text-primary underline">Add an email account to get started</button>
              )}
            </div>
          ) : (
            threads.map(({ key, msgs }) => {
              const latest = msgs[0];
              const hasThread = msgs.length > 1;
              const isExpanded = expandedThreads.has(key);
              const sel = selectedId === latest.id;
              const anyUnread = msgs.some(m => !m.is_read);
              const allChecked = msgs.every(m => selectedIds.has(m.id));
              const someChecked = msgs.some(m => selectedIds.has(m.id));
              const fromLabel = latest.from_name || latest.from_address || '?';
              const avatarColors = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-orange-500','bg-pink-500','bg-cyan-500','bg-rose-500','bg-amber-500'];
              const avatarColor = avatarColors[(fromLabel.charCodeAt(0) || 0) % avatarColors.length];
              const toggleAllChecked = (e: React.MouseEvent | React.ChangeEvent) => {
                e.stopPropagation();
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (allChecked) msgs.forEach(m => next.delete(m.id));
                  else msgs.forEach(m => next.add(m.id));
                  return next;
                });
              };
              const toggleThread = (e: React.MouseEvent) => {
                e.stopPropagation();
                setExpandedThreads(prev => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key); else next.add(key);
                  return next;
                });
              };
              const preview = (() => { const p = latest.preview; if (!p || typeof p !== 'string' || !p.trim()) return ''; return p.length > 120 ? `${p.slice(0, 120)}…` : p; })();
              const folderForRow = latest.custom_folder_id
                ? customFolders.find((cf: any) => cf.id === latest.custom_folder_id)
                : null;
              return (
                <div key={key}>
                  {/* Thread header row — detailed multi-line layout */}
                  <div
                    onClick={() => setSelectedId(latest.id)}
                    className={`group flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-border/60 transition-colors ${
                      someChecked ? 'bg-primary/8' : sel ? 'bg-primary/6 border-l-2 border-l-primary' : 'hover:bg-muted/40'
                    }`}
                  >
                    {/* Avatar with unread dot */}
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-sm font-bold text-white uppercase`}>
                        {fromLabel[0]}
                      </div>
                      {anyUnread && <span className="absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-white dark:ring-gray-800" />}
                    </div>

                    {/* Right: vertical content block */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {/* Line 1: Sender + Date */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${anyUnread ? 'font-bold text-foreground' : 'font-semibold text-foreground/80'}`}>
                          {fromLabel}
                        </span>
                        <span className="text-xs text-primary shrink-0 font-medium">
                          {fmtDateTime(latest.received_at || latest.sent_at)}
                        </span>
                      </div>

                      {/* Line 2: Subject */}
                      <p className={`text-sm truncate ${anyUnread ? 'font-semibold text-foreground' : 'text-foreground/90'}`}>
                        {latest.subject || '(no subject)'}
                      </p>

                      {/* Line 3: Preview snippet */}
                      {preview && (
                        <p className="text-xs text-muted-foreground truncate">
                          {preview}
                        </p>
                      )}

                      {/* Line 4: Badges (folder, attachments, thread count, starred) */}
                      {(folderForRow || latest.attachment_count > 0 || hasThread || latest.is_starred) && (
                        <div className="flex items-center flex-wrap gap-2 pt-1.5">
                          {folderForRow && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-md px-2 py-0.5">
                              <Folder size={11} /> {folderForRow.name}
                            </span>
                          )}
                          {hasThread && (
                            <span className="inline-flex items-center text-xs text-muted-foreground bg-muted rounded-md px-2 py-0.5 font-medium">
                              {msgs.length} messages
                            </span>
                          )}
                          {latest.attachment_count > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Paperclip size={11} /> {latest.attachment_count}
                            </span>
                          )}
                          {!!latest.is_starred && (
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Far right: checkbox + thread expand */}
                    <div className="flex flex-col items-center gap-2 shrink-0 pt-0.5">
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className={`shrink-0 w-5 h-5 flex items-center justify-center rounded border-2 cursor-pointer transition-all ${
                          allChecked ? 'bg-primary border-primary opacity-100' : someChecked ? 'bg-primary/50 border-primary opacity-100' : 'border-muted-foreground/40 opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <input type="checkbox" checked={allChecked} onChange={toggleAllChecked} className="sr-only" />
                        {(allChecked || someChecked) && <Check size={11} className="text-primary-foreground" strokeWidth={3} />}
                      </label>
                      {hasThread && (
                        <button onClick={toggleThread} className="p-0.5 rounded text-muted-foreground hover:text-foreground shrink-0" title={isExpanded ? 'Collapse thread' : 'Expand thread'}>
                          <ChevronDown size={14} className={`transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded thread: individual emails */}
                  {hasThread && isExpanded && msgs.map((msg) => {
                    const msgSel = selectedId === msg.id;
                    const msgChecked = selectedIds.has(msg.id);
                    const msgLabel = msg.from_name || msg.from_address || '?';
                    const toggleMsg = (e: React.MouseEvent | React.ChangeEvent) => {
                      e.stopPropagation();
                      setSelectedIds(prev => { const next = new Set(prev); if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id); return next; });
                    };
                    const msgPreview = (() => { const p = msg.preview; if (!p || typeof p !== 'string' || !p.trim()) return msg.subject || ''; return p.length > 55 ? `${p.slice(0, 55)}…` : p; })();
                    return (
                      <div
                        key={msg.id}
                        onClick={() => setSelectedId(msg.id)}
                        className={`flex items-center gap-2 pl-12 pr-3 py-1.5 cursor-pointer border-b border-border/30 transition-colors ${
                          msgChecked ? 'bg-primary/8' : msgSel ? 'bg-primary/6 border-l-2 border-l-primary' : 'bg-muted/20 hover:bg-muted/40'
                        }`}
                      >
                        <div className="w-1.5 shrink-0">
                          {!msg.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary block" />}
                        </div>
                        <label onClick={(e) => e.stopPropagation()} className={`shrink-0 w-4 h-4 flex items-center justify-center rounded border cursor-pointer transition-all ${msgChecked ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                          <input type="checkbox" checked={msgChecked} onChange={toggleMsg} className="sr-only" />
                          {msgChecked && <Check size={9} className="text-primary-foreground" strokeWidth={3} />}
                        </label>
                        <span className="w-[110px] shrink-0 text-xs text-muted-foreground truncate">{msgLabel}</span>
                        <span className={`flex-1 text-xs truncate ${!msg.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{msgPreview}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{fmtRelative(msg.received_at || msg.sent_at)}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
          {messages.length > 0 && (
            <InfiniteScrollSentinel
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
              loaded={messages.length}
              total={totalMessages}
              activeAccountId={activeAccountId}
              activeFolder={activeFolder}
              onResynced={() => refetch()}
            />
          )}
        </div>
      </section>
      </Panel>

      <PanelResizeHandle className="w-px bg-border data-[resize-handle-state=hover]:w-1 data-[resize-handle-state=hover]:bg-primary/40 data-[resize-handle-state=drag]:w-1 data-[resize-handle-state=drag]:bg-primary transition-all" />

      {/* ───────── COL 3 — DETAIL / CONVERSATION ───────── */}
      <Panel minSize={30} order={3}>
      <section className="h-full bg-background flex flex-col overflow-hidden">
        {!selectedId || !email ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a message to read
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Conversation subject header + actions */}
            <div className="px-6 py-3 border-b border-border flex items-center justify-between gap-4 shrink-0">
              <h2 className="text-base font-bold text-foreground flex-1 truncate">
                {email.subject || '(no subject)'}
                {selectedThread && selectedThread.msgs.length > 1 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {selectedThread.msgs.length} messages
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => star.mutate()} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title={email.is_starred ? 'Unstar' : 'Star'}>
                  <Star size={14} className={email.is_starred ? 'fill-primary text-primary' : ''} />
                </button>
                <button onClick={replyTo} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Reply"><Reply size={14} /></button>
                <button onClick={forwardEmail} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Forward"><Forward size={14} /></button>
                <button onClick={() => unread.mutate()} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Mark unread"><MailOpen size={14} /></button>
                <MoveToButton emailId={email.id} currentFolderId={email.custom_folder_id} folders={customFolders}
                  onMoved={() => { qc.invalidateQueries({ queryKey: ['emails'] }); qc.invalidateQueries({ queryKey: ['email-custom-folders'] }); setSelectedId(null); }} />
                <button onClick={() => archive.mutate()} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Archive"><Archive size={14} /></button>
                <button onClick={() => trash.mutate()} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive" title="Delete"><Trash2 size={14} /></button>
              </div>
            </div>

            {/* Conversation thread — scrollable, oldest → newest */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {(selectedThread ? [...selectedThread.msgs].reverse() : (email ? [email] : [])).map((msg: any) => {
                const isCurrentSelected = msg.id === email?.id;
                const cachedFull = threadEmailCache[msg.id];
                const fullMsg: any = isCurrentSelected ? email : (cachedFull && !cachedFull._failed ? cachedFull : null);
                const isFetchFailed = cachedFull?._failed;
                const isLoading = expandedInThread.has(msg.id) && !fullMsg && !isCurrentSelected && !isFetchFailed;
                const isExpanded = expandedInThread.has(msg.id);
                const fromLabel = msg.from_name || msg.from_address || '?';
                const avatarColors = ['bg-violet-500','bg-rose-500','bg-emerald-500','bg-orange-500','bg-pink-500','bg-cyan-500','bg-blue-500','bg-amber-500'];
                const avatarColor = avatarColors[(fromLabel.charCodeAt(0) || 0) % avatarColors.length];
                const preview = (() => { const p = msg.preview; if (!p || typeof p !== 'string' || !p.trim()) return ''; return p.length > 100 ? `${p.slice(0, 100)}…` : p; })();

                const toggleExpand = () => {
                  setExpandedInThread(prev => {
                    const next = new Set(prev);
                    if (next.has(msg.id)) {
                      next.delete(msg.id);
                    } else {
                      next.add(msg.id);
                      if (!fullMsg && !isCurrentSelected) fetchThreadEmail(msg.id);
                    }
                    return next;
                  });
                };

                return (
                  <div key={msg.id} className={`rounded-xl border transition-all ${isExpanded ? 'border-border bg-card shadow-sm' : 'border-border/40 bg-card/50 hover:bg-card/80 cursor-pointer'}`}>
                    {/* Card header */}
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" onClick={toggleExpand}>
                      <div className={`w-9 h-9 shrink-0 rounded-full ${avatarColor} flex items-center justify-center text-sm font-bold text-white uppercase`}>
                        {fromLabel[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="text-sm font-semibold text-foreground shrink-0">{fromLabel}</span>
                          {!isExpanded && preview && (
                            <span className="text-xs text-muted-foreground truncate">{preview}</span>
                          )}
                        </div>
                        {isExpanded && msg.from_address && (
                          <p className="text-xs text-muted-foreground truncate">&lt;{msg.from_address}&gt;</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {msg.attachment_count > 0 && <Paperclip size={12} className="text-muted-foreground" />}
                        {!!msg.is_starred && <Star size={12} className="text-amber-400 fill-amber-400" />}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(msg.received_at || msg.sent_at)}</span>
                        <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* Expanded body */}
                    {isExpanded && (
                      <div className="border-t border-border">
                        {isLoading ? (
                          <div className="py-8 flex justify-center"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
                        ) : isFetchFailed ? (
                          <p className="px-4 py-4 text-sm text-muted-foreground italic">Could not load this message.</p>
                        ) : fullMsg ? (
                          <div className="px-4 py-3">
                            {fullMsg.body_html && String(fullMsg.body_html).trim() ? (
                              <div style={{ height: 420 }}><EmailBodyFrame html={sanitizeHtml(fullMsg.body_html)} /></div>
                            ) : fullMsg.body_text && String(fullMsg.body_text).trim() ? (
                              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-[420px] overflow-y-auto">{fullMsg.body_text}</pre>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">No content</p>
                            )}
                            {fullMsg.attachments?.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2">
                                {fullMsg.attachments.map((att: any) => (
                                  <a key={att.id} href={att.file_url} download={att.file_name} target="_blank" rel="noreferrer"
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs hover:bg-muted transition-colors">
                                    <Paperclip size={11} /> {att.file_name}
                                    <span className="text-muted-foreground">({Math.round((att.file_size || 0) / 1024)}KB)</span>
                                    <Download size={11} className="text-muted-foreground" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                        <div className="flex gap-2 px-4 py-2 border-t border-border/50">
                          <button onClick={replyTo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted border border-border transition-colors">
                            <Reply size={12} /> Reply
                          </button>
                          <button onClick={forwardEmail} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted border border-border transition-colors">
                            <Forward size={12} /> Forward
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
      </Panel>

      </PanelGroup>
      </div>
      )}

      {/* ═════════════════════════════════════════════════════════
           MOBILE LAYOUT — single pane at a time + slide-out sidebar drawer
           ═════════════════════════════════════════════════════════ */}
      {isMobile && (
        <div className="flex-1 min-h-0 flex flex-col bg-background">
          {/* Mobile sidebar drawer (slides in from left) */}
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-40 flex">
              <aside className="w-72 max-w-[85vw] h-full bg-card overflow-y-auto border-r border-border flex flex-col shadow-xl">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                  <span className="text-sm font-semibold">Folders & Accounts</span>
                  <button
                    onClick={() => setMobileSidebarOpen(false)}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label="Close menu"
                  >
                    <X size={16} />
                  </button>
                </div>
                {mobileSidebarContent}
              </aside>
              {/* Backdrop */}
              <div
                className="flex-1 bg-black/50"
                onClick={() => setMobileSidebarOpen(false)}
              />
            </div>
          )}

          {/* List view (when no email selected) OR Detail view */}
          {!selectedId ? (
            <section className="flex-1 min-h-0 flex flex-col bg-card">
              {/* Mobile toolbar — hamburger + folder name */}
              <div className="px-3 py-2.5 border-b border-border flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Open menu"
                >
                  <Menu size={18} />
                </button>
                <span className="text-sm font-semibold flex-1 truncate">
                  {activeCustomFolderId
                    ? customFolders.find((f: any) => f.id === activeCustomFolderId)?.name || 'Folder'
                    : (FOLDERS.find((f) => f.key === activeFolder)?.label || activeFolder)}
                </span>
                <button
                  onClick={() => { setShowCompose(true); setComposeMinimized(false); }}
                  className="p-1.5 rounded-md bg-primary text-primary-foreground"
                  aria-label="Compose"
                  title="Compose"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Search/sync OR selection bar */}
              {selectedIds.size > 0 ? (
                <SelectionBar
                  count={selectedIds.size}
                  allOnPage={messages.length}
                  folders={customFolders}
                  onSelectAll={() => setSelectedIds(new Set(messages.map((m: any) => m.id)))}
                  onClear={() => setSelectedIds(new Set())}
                  onMoved={() => {
                    qc.invalidateQueries({ queryKey: ['emails'] });
                    qc.invalidateQueries({ queryKey: ['email-custom-folders'] });
                    qc.invalidateQueries({ queryKey: ['email-unread'] });
                    setSelectedIds(new Set());
                  }}
                  ids={Array.from(selectedIds)}
                />
              ) : (
                <div className="px-3 py-2 border-b border-border flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setSearch(''); }}
                      placeholder="Search messages…"
                      className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => syncMutation.mutate()}
                    disabled={!activeAccountId || syncMutation.isPending}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                    title="Sync"
                  >
                    <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
                  </button>
                </div>
              )}

              {/* Message list (mobile) — same body as desktop, just full-width */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
                ) : messages.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">No messages in {activeFolder}</p>
                  </div>
                ) : (
                  threads.map(({ key, msgs }) => {
                    const latest = msgs[0];
                    const hasThread = msgs.length > 1;
                    const isExpanded = expandedThreads.has(key);
                    const anyUnread = msgs.some(m => !m.is_read);
                    const allChecked = msgs.every(m => selectedIds.has(m.id));
                    const someChecked = msgs.some(m => selectedIds.has(m.id));
                    const fromLabel = latest.from_name || latest.from_address || '?';
                    const toggleAllChecked = (e: React.MouseEvent | React.ChangeEvent) => {
                      e.stopPropagation();
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (allChecked) msgs.forEach(m => next.delete(m.id));
                        else msgs.forEach(m => next.add(m.id));
                        return next;
                      });
                    };
                    const toggleThread = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setExpandedThreads(prev => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key); else next.add(key);
                        return next;
                      });
                    };
                    return (
                      <div key={key}>
                        <div
                          onClick={() => setSelectedId(latest.id)}
                          className={`flex items-start gap-2 px-3 py-3 cursor-pointer border-b border-border transition-colors ${
                            someChecked ? 'bg-primary/10' : 'hover:bg-muted/50'
                          } ${anyUnread ? 'font-semibold' : ''}`}
                        >
                          <label
                            onClick={(e) => e.stopPropagation()}
                            className={`shrink-0 w-5 h-5 mt-1 flex items-center justify-center rounded border-2 cursor-pointer transition-colors ${
                              allChecked ? 'bg-primary border-primary' : someChecked ? 'bg-primary/50 border-primary' : 'border-muted-foreground/60'
                            }`}
                          >
                            <input type="checkbox" checked={allChecked} onChange={toggleAllChecked} className="sr-only" />
                            {(allChecked || someChecked) && <Check size={12} className="text-primary-foreground" strokeWidth={3} />}
                          </label>
                          <div className="w-8 h-8 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold uppercase">
                            {fromLabel[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-foreground truncate">{fromLabel}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {hasThread && (
                                  <span className="text-[10px] font-bold bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">
                                    {msgs.length}
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground">
                                  {fmtRelative(latest.received_at || latest.sent_at)}
                                </span>
                                {hasThread && (
                                  <button onClick={toggleThread} className="p-0.5 text-muted-foreground">
                                    <ChevronDown size={12} className={`transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-foreground truncate">{latest.subject || '(no subject)'}</p>
                            <p className="text-xs text-muted-foreground truncate font-normal">
                              {(() => {
                                const p = latest.preview;
                                if (!p || typeof p !== 'string' || !p.trim()) return '';
                                return p.length > 80 ? `${p.slice(0, 80)}...` : p;
                              })()}
                            </p>
                          </div>
                        </div>
                        {/* Expanded thread rows */}
                        {hasThread && isExpanded && msgs.map((msg) => {
                          const msgSel = selectedId === msg.id;
                          const msgChecked = selectedIds.has(msg.id);
                          const msgLabel = msg.from_name || msg.from_address || '?';
                          const toggleMsg = (e: React.MouseEvent | React.ChangeEvent) => {
                            e.stopPropagation();
                            setSelectedIds(prev => { const next = new Set(prev); if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id); return next; });
                          };
                          return (
                            <div
                              key={msg.id}
                              onClick={() => setSelectedId(msg.id)}
                              className={`flex items-start gap-2 pl-10 pr-3 py-2 cursor-pointer border-b border-border/40 transition-colors ${
                                msgChecked ? 'bg-primary/10' : msgSel ? 'bg-primary/8' : 'bg-muted/20 hover:bg-muted/40'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-xs truncate ${!msg.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{msgLabel}</span>
                                  <span className="text-[10px] text-muted-foreground shrink-0">{fmtRelative(msg.received_at || msg.sent_at)}</span>
                                </div>
                                <p className={`text-xs truncate ${!msg.is_read ? 'text-foreground' : 'text-muted-foreground font-normal'}`}>
                                  {(() => { const p = msg.preview; if (!p || typeof p !== 'string' || !p.trim()) return msg.subject || ''; return p.length > 70 ? `${p.slice(0, 70)}...` : p; })()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
                {messages.length > 0 && (
                  <InfiniteScrollSentinel
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    fetchNextPage={fetchNextPage}
                    loaded={messages.length}
                    total={totalMessages}
                    activeAccountId={activeAccountId}
                    activeFolder={activeFolder}
                    onResynced={() => refetch()}
                  />
                )}
              </div>
            </section>
          ) : (
            <section className="flex-1 min-h-0 flex flex-col bg-background">
              {/* Mobile detail toolbar */}
              <div className="px-2 py-2 border-b border-border flex items-center gap-1 shrink-0">
                <button onClick={() => setSelectedId(null)} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1" aria-label="Back to list">
                  <ArrowLeft size={18} />
                </button>
                <span className="text-sm font-semibold flex-1 truncate px-1">
                  {email?.subject || '(no subject)'}
                  {selectedThread && selectedThread.msgs.length > 1 && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{selectedThread.msgs.length}</span>
                  )}
                </span>
                {email && (
                  <>
                    <button onClick={() => star.mutate()} className="p-2 rounded-md hover:bg-muted text-muted-foreground"><Star size={16} className={email.is_starred ? 'fill-primary text-primary' : ''} /></button>
                    <button onClick={replyTo} className="p-2 rounded-md hover:bg-muted text-muted-foreground"><Reply size={16} /></button>
                    <button onClick={() => trash.mutate()} className="p-2 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 size={16} /></button>
                  </>
                )}
              </div>

              {/* Conversation thread */}
              {!email ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                  {(selectedThread ? [...selectedThread.msgs].reverse() : [email]).map((msg: any) => {
                    const isCurrentSelected = msg.id === email?.id;
                    const cachedFull = threadEmailCache[msg.id];
                    const fullMsg: any = isCurrentSelected ? email : (cachedFull && !cachedFull._failed ? cachedFull : null);
                    const isFetchFailed = cachedFull?._failed;
                    const isLoading = expandedInThread.has(msg.id) && !fullMsg && !isCurrentSelected && !isFetchFailed;
                    const isExpanded = expandedInThread.has(msg.id);
                    const fromLabel = msg.from_name || msg.from_address || '?';
                    const avatarColors = ['bg-violet-500','bg-rose-500','bg-emerald-500','bg-orange-500','bg-pink-500','bg-cyan-500','bg-blue-500','bg-amber-500'];
                    const avatarColor = avatarColors[(fromLabel.charCodeAt(0) || 0) % avatarColors.length];
                    const preview = (() => { const p = msg.preview; if (!p || typeof p !== 'string' || !p.trim()) return ''; return p.length > 70 ? `${p.slice(0, 70)}…` : p; })();
                    const toggleExpand = () => {
                      setExpandedInThread(prev => {
                        const next = new Set(prev);
                        if (next.has(msg.id)) next.delete(msg.id);
                        else { next.add(msg.id); if (!fullMsg && !isCurrentSelected) fetchThreadEmail(msg.id); }
                        return next;
                      });
                    };
                    return (
                      <div key={msg.id} className={`rounded-xl border transition-all ${isExpanded ? 'border-border bg-card' : 'border-border/40 bg-card/50 hover:bg-card/80'}`}>
                        <div className="flex items-center gap-3 px-3 py-3 cursor-pointer" onClick={toggleExpand}>
                          <div className={`w-9 h-9 shrink-0 rounded-full ${avatarColor} flex items-center justify-center text-sm font-bold text-white uppercase`}>
                            {fromLabel[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-foreground block truncate">{fromLabel}</span>
                            {!isExpanded && <span className="text-xs text-muted-foreground truncate block">{preview}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-muted-foreground">{fmtRelative(msg.received_at || msg.sent_at)}</span>
                            <ChevronDown size={13} className={`text-muted-foreground transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-border">
                            {isLoading ? (
                              <div className="py-6 flex justify-center"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
                            ) : isFetchFailed ? (
                              <p className="px-3 py-3 text-sm text-muted-foreground italic">Could not load this message.</p>
                            ) : fullMsg ? (
                              <div className="px-3 py-3">
                                {fullMsg.body_html && String(fullMsg.body_html).trim() ? (
                                  <div style={{ height: 320 }}><EmailBodyFrame html={sanitizeHtml(fullMsg.body_html)} /></div>
                                ) : fullMsg.body_text && String(fullMsg.body_text).trim() ? (
                                  <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-80 overflow-y-auto">{fullMsg.body_text}</pre>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">No content</p>
                                )}
                              </div>
                            ) : null}
                            <div className="flex gap-2 px-3 py-2 border-t border-border/50">
                              <button onClick={replyTo} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted border border-border"><Reply size={11} /> Reply</button>
                              <button onClick={forwardEmail} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted border border-border"><Forward size={11} /> Forward</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ───────── COMPOSE — minimized bar ───────── */}
      {showCompose && composeMinimized && (
        <div
          className="fixed z-50 bottom-4 right-4 bg-card border border-border shadow-xl
                     rounded-xl flex items-center gap-2 px-3 py-2 w-[280px] md:w-[320px]"
          role="button"
          tabIndex={0}
          onClick={() => setComposeMinimized(false)}
          onKeyDown={(e) => { if (e.key === 'Enter') setComposeMinimized(false); }}
          title="Click to expand draft"
        >
          <span className="text-xs font-medium text-muted-foreground shrink-0">Draft</span>
          <span className="text-sm flex-1 truncate text-foreground">
            {composeForm.getValues('subject')?.trim() || '(no subject)'}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setComposeMinimized(false); }}
            className="text-muted-foreground hover:text-foreground p-1"
            title="Reopen draft"
          >
            <PanelLeftOpen size={14} className="rotate-180" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCompose(false); setComposeMinimized(false); setReplyContextId(null);
              composeForm.reset({ to: '', cc: '', subject: '', body_html: '', account_id: activeAccountId || '' });
            }}
            className="text-muted-foreground hover:text-destructive p-1"
            title="Discard draft"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ───────── COMPOSE MODAL ───────── */}
      {showCompose && !composeMinimized && (
        <div
          className="fixed z-50 bg-card border border-border shadow-2xl flex flex-col
                     inset-2 rounded-xl
                     md:inset-auto md:bottom-4 md:right-4 md:w-[560px] md:rounded-2xl"
          style={{ maxHeight: isMobile ? 'calc(100vh - 1rem)' : '80vh' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h3 className="text-sm font-semibold text-foreground">New Message</h3>
            <div className="flex gap-1">
              <button
                onClick={() => setComposeMinimized(true)}
                className="text-muted-foreground hover:text-foreground p-1"
                title="Minimize — your draft stays open"
              >
                <Minus size={15} />
              </button>
              <button
                onClick={() => {
                  setShowCompose(false); setComposeMinimized(false); setReplyContextId(null);
                  composeForm.reset({ to: '', cc: '', subject: '', body_html: '', account_id: activeAccountId || '' });
                }}
                className="text-muted-foreground hover:text-foreground p-1"
                title="Discard draft"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="flex flex-col flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <span className="text-xs text-muted-foreground w-12 shrink-0">From</span>
              <select
                {...composeForm.register('account_id')}
                className="flex-1 text-sm bg-transparent border-0 focus:outline-none text-foreground"
              >
                {accounts.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.email_address || a.email}
                  </option>
                ))}
              </select>
            </div>
            {(['to', 'cc'] as const).map((field) => (
              <div key={field} className="flex items-center gap-2 px-4 py-2 border-b border-border">
                <span className="text-xs text-muted-foreground w-12 shrink-0 capitalize">
                  {field}
                </span>
                <input
                  {...composeForm.register(field)}
                  className="flex-1 text-sm bg-transparent border-0 focus:outline-none text-foreground"
                  placeholder={field === 'to' ? 'Recipients' : 'CC (optional)'}
                />
              </div>
            ))}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <span className="text-xs text-muted-foreground w-12 shrink-0">Subject</span>
              <input
                {...composeForm.register('subject')}
                className="flex-1 text-sm bg-transparent border-0 focus:outline-none text-foreground"
                placeholder="Subject"
              />
            </div>
            <div className="flex-1 px-3 py-2 overflow-y-auto">
              <Controller
                control={composeForm.control}
                name="body_html"
                render={({ field }) => (
                  <RichTextEditor
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="Write your message… (paste an image to embed it)"
                    minHeight={240}
                    mentionUsers={activeUsers.map((u: any) => ({ id: String(u.id), name: u.name || u.username || u.email }))}
                  />
                )}
              />
            </div>
          </div>

          {aiOpen && (
            <div className="px-4 py-2 border-t border-border bg-violet-50 dark:bg-violet-900/20 shrink-0 space-y-2">
              <input
                value={aiTopic}
                onChange={e => setAiTopic(e.target.value)}
                placeholder={replyContextId
                  ? 'Any specific angle? (optional — AI already has the original message)'
                  : 'What should this email cover?'}
                className="w-full text-xs px-2 py-1.5 rounded border border-violet-200 dark:border-violet-700 bg-card text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-violet-400"
              />
              <div className="flex justify-end">
                <button type="button" onClick={runAiDraft} disabled={aiDrafting}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-violet-600 text-white text-xs hover:bg-violet-700 disabled:opacity-50">
                  {aiDrafting ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                  {aiDrafting ? 'Drafting…' : 'Generate draft'}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setShowCompose(false); setAiOpen(false); setReplyContextId(null); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => setAiOpen(v => !v)}
                className="flex items-center gap-1 text-xs text-violet-700 dark:text-violet-300 hover:underline"
              >
                <Bot size={12} /> {aiOpen ? 'Hide AI' : 'Write with AI'}
              </button>
            </div>
            <button
              onClick={composeForm.handleSubmit((d) => sendMutation.mutate(d))}
              disabled={sendMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
            >
              <Send size={13} />
              {sendMutation.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* ───────── ADD ACCOUNT MODAL — admin only ───────── */}
      {showAddAccount && isEmailAdmin && (
        <AddAccountModal
          form={accountForm}
          users={activeUsers}
          onClose={() => setShowAddAccount(false)}
          onSubmit={(d) => addMutation.mutate(d)}
          submitting={addMutation.isPending}
        />
      )}

      {/* ───────── CREATE FOLDER MODAL ───────── */}
      {showCreateFolder && (
        <CreateFolderModal
          onClose={() => setShowCreateFolder(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['email-custom-folders'] });
            setShowCreateFolder(false);
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────
// Email body iframe — always renders with white bg + dark text so inbound
// HTML emails (which have their own inline styling assuming a light client)
// stay readable when the app is in dark mode. Auto-resizes to content height.
// ────────────────────────────────────────
function EmailBodyFrame({ html }: { html: string }) {
  // Iframe fills its parent's height and scrolls internally. The parent gives
  // it height via `flex: 1` + `min-h-0`. This avoids the "dark blank area
  // below short emails" issue caused by the previous auto-resize approach.
  const srcDoc = useMemo(() => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<base target="_blank" />
<style>
  html, body {
    margin: 0;
    padding: 16px;
    background: #ffffff !important;
    color: #1f2937 !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  html, body { height: 100%; }
  body * { max-width: 100%; }
  img, video { max-width: 100%; height: auto; }
  a { color: #2563eb; }
  table { border-collapse: collapse; }
  blockquote {
    border-left: 3px solid #e5e7eb;
    margin: 0;
    padding-left: 12px;
    color: #4b5563;
  }
  pre, code {
    background: #f3f4f6;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: ui-monospace, SFMono-Regular, monospace;
  }
</style>
</head>
<body>${html}</body>
</html>`, [html]);

  return (
    <iframe
      title="Email body"
      sandbox="allow-same-origin allow-popups"
      srcDoc={srcDoc}
      style={{
        width: '100%',
        height: '100%',
        border: 0,
        background: '#ffffff',
        borderRadius: 8,
        display: 'block',
      }}
    />
  );
}

// ────────────────────────────────────────
// Add Account Modal
// ────────────────────────────────────────
function AddAccountModal({
  form,
  users,
  onClose,
  onSubmit,
  submitting,
}: {
  form: ReturnType<typeof useForm<any>>;
  users: Array<{ id: string; name: string; email?: string }>;
  onClose: () => void;
  onSubmit: (d: any) => void;
  submitting: boolean;
}) {
  const { register, handleSubmit } = form;
  const inputCls =
    'w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';
  const labelCls = 'text-xs font-medium text-muted-foreground mb-1 block';

  return (
    <div
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Add Email Account</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-foreground">
              As an admin, you can add an email account for any team member. Leave "For User"
              blank to add to your own inbox.
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            SMTP is required to send emails. IMAP is optional — add it to sync received emails.
          </p>

          <div className="space-y-3">
            {users.length > 0 && (
              <div>
                <label className={labelCls}>For User (optional — leave blank for yourself)</label>
                <select {...register('for_user_id')} className={inputCls}>
                  <option value="">— My own account —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.email ? ` (${u.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Account Label</label>
                <input {...register('label')} className={inputCls} placeholder="Work, Personal…" />
              </div>
              <div>
                <label className={labelCls}>Email Address *</label>
                <input
                  {...register('email_address', { required: true })}
                  type="email"
                  className={inputCls}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">
              SMTP (Outgoing) *
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>SMTP Host *</label>
                <input
                  {...register('smtp_host', { required: true })}
                  className={inputCls}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div>
                <label className={labelCls}>Port</label>
                <input
                  {...register('smtp_port', { valueAsNumber: true })}
                  type="number"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>SMTP Username *</label>
                <input
                  {...register('smtp_user', { required: true })}
                  className={inputCls}
                  placeholder="you@gmail.com"
                />
              </div>
              <div>
                <label className={labelCls}>App Password *</label>
                <input
                  {...register('smtp_password', { required: true })}
                  type="password"
                  className={inputCls}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" {...register('smtp_secure')} />
              Use SSL/TLS (port 465)
            </label>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-3">
              IMAP (Incoming — optional)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>IMAP Host</label>
                <input
                  {...register('imap_host')}
                  className={inputCls}
                  placeholder="imap.gmail.com"
                />
              </div>
              <div>
                <label className={labelCls}>Port</label>
                <input
                  {...register('imap_port', { valueAsNumber: true })}
                  type="number"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>IMAP Username</label>
                <input
                  {...register('imap_user')}
                  className={inputCls}
                  placeholder="you@gmail.com"
                />
              </div>
              <div>
                <label className={labelCls}>IMAP Password</label>
                <input {...register('imap_password')} type="password" className={inputCls} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" {...register('imap_secure')} defaultChecked />
              Use SSL/TLS (port 993)
            </label>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-3">
              Signature (optional)
            </p>
            <div>
              <label className={labelCls}>Auto-appended to new messages</label>
              <textarea
                {...register('signature')}
                className={inputCls + ' min-h-[80px] resize-y'}
                placeholder={`Best regards,\nYour Name\nCompany`}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border mt-3">
              <input type="checkbox" {...register('is_default')} />
              Set as default sending account
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            Add Account
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────
// Account row with inline Test Connection
// ────────────────────────────────────────
function AccountRow({
  acc,
  active,
  isEmailAdmin,
  onSelect,
  onDeleted,
}: {
  acc: any;
  active: boolean;
  isEmailAdmin: boolean;
  onSelect: () => void;
  onDeleted?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [result, setResult] = useState<
    { ok: boolean; message: string } | null
  >(null);
  const [showSig, setShowSig] = useState(false);

  const sigMut = useMutation({
    mutationFn: (value: string) => emailApi.updateAccount(acc.id, { signature: value }),
    onSuccess: () => {
      toast.success('Signature saved');
      qc.invalidateQueries({ queryKey: ['email-accounts'] });
      setShowSig(false);
    },
    onError: (e: any) => toast.error(errMsg(e) || 'Failed to save signature'),
  });

  const testMut = useMutation({
    mutationFn: () => emailApi.testAccount(acc.id),
    onSuccess: (r: any) => {
      const payload = r?.data?.data ?? r?.data ?? {};
      const ok = payload.ok ?? payload.success ?? true;
      setResult({
        ok,
        message:
          payload.message ||
          (ok ? 'Connection successful' : 'Connection failed'),
      });
    },
    onError: (e: any) => {
      setResult({ ok: false, message: errMsg(e) });
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => emailApi.deleteAccount(acc.id),
    onSuccess: () => {
      toast.success('Email account removed');
      onDeleted?.(acc.id);
      qc.invalidateQueries({ queryKey: ['email-accounts'] });
      qc.invalidateQueries({ queryKey: ['emails'] });
      qc.invalidateQueries({ queryKey: ['email-unread'] });
    },
    onError: (e: any) => {
      toast.error(errMsg(e) || 'Failed to remove account');
    },
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const label = acc.email_address || acc.email || 'this account';
    if (
      window.confirm(
        `Remove ${label}? This will also delete all synced emails for this account.`
      )
    ) {
      deleteMut.mutate();
    }
  };

  return (
    <div
      className={`rounded-lg transition-colors ${
        active ? 'bg-muted' : 'hover:bg-muted/60'
      }`}
    >
      <div className="flex items-center gap-1 pr-1">
        <button
          onClick={onSelect}
          className={`flex-1 min-w-0 flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-left ${
            active ? 'text-foreground font-semibold' : 'text-muted-foreground'
          }`}
        >
          <span className="w-6 h-6 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold uppercase">
            {(acc.email_address || acc.email || '?')[0]}
          </span>
          <span className="truncate flex-1">{acc.email_address || acc.email}</span>
          {acc.is_default && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              Default
            </span>
          )}
        </button>
        {isEmailAdmin && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            title="Remove account"
            aria-label={`Remove ${acc.email_address || acc.email || 'account'}`}
            className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            {deleteMut.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
          </button>
        )}
      </div>

      <div className="px-2 pb-2 space-y-1.5">
        <div className="flex gap-1.5">
          {isEmailAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setResult(null);
                testMut.mutate();
              }}
              disabled={testMut.isPending}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
            >
              {testMut.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <PlugZap size={11} />
              )}
              {testMut.isPending ? 'Testing…' : 'Test'}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowSig((s) => !s);
            }}
            title="Edit signature"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ✍︎ Signature
          </button>
        </div>

        {showSig && (
          <SignatureEditModal
            email={acc.email_address || acc.email}
            initial={acc.signature || ''}
            saving={sigMut.isPending}
            onCancel={() => setShowSig(false)}
            onSave={(value) => sigMut.mutate(value)}
          />
        )}

        {result && (
          <div
            className={`mt-1.5 flex items-start gap-1.5 px-2 py-1 rounded-md text-[10px] leading-tight ${
              result.ok
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {result.ok ? (
              <CheckCircle2 size={11} className="shrink-0 mt-0.5" />
            ) : (
              <XCircle size={11} className="shrink-0 mt-0.5" />
            )}
            <span className="break-words">{result.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────
// Custom folder row in sidebar (with rename + delete on hover)
// ────────────────────────────────────────
function CustomFolderRow({
  folder,
  active,
  onSelect,
  onChanged,
  onDeleted,
}: {
  folder: any;
  active: boolean;
  onSelect: () => void;
  onChanged: () => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(folder.name);

  useEffect(() => { setDraft(folder.name); }, [folder.name]);

  const renameMut = useMutation({
    mutationFn: () => emailApi.updateCustomFolder(folder.id, { name: draft.trim() }),
    onSuccess: () => { toast.success('Folder renamed'); setEditing(false); onChanged(); },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const deleteMut = useMutation({
    mutationFn: () => emailApi.deleteCustomFolder(folder.id),
    onSuccess: () => { toast.success('Folder deleted; emails returned to inbox'); onDeleted(folder.id); },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-muted">
        <Folder size={14} className="text-muted-foreground shrink-0" />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) renameMut.mutate();
            if (e.key === 'Escape') { setEditing(false); setDraft(folder.name); }
          }}
          className="flex-1 min-w-0 bg-transparent text-sm text-foreground focus:outline-none"
        />
        <button
          onClick={() => draft.trim() && renameMut.mutate()}
          disabled={renameMut.isPending || !draft.trim()}
          className="text-success hover:text-success/80 disabled:opacity-40"
          title="Save"
        >
          <Check size={13} />
        </button>
        <button
          onClick={() => { setEditing(false); setDraft(folder.name); }}
          className="text-muted-foreground hover:text-foreground"
          title="Cancel"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-1 rounded-lg ${
      active ? 'bg-primary/10' : 'hover:bg-muted'
    }`}>
      <button
        onClick={onSelect}
        className={`flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-sm text-left ${
          active ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Folder size={14} style={folder.color ? { color: folder.color } : undefined} className="shrink-0" />
        <span className="truncate flex-1">{folder.name}</span>
        {folder.unread_count > 0 && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            active ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary'
          }`}>
            {folder.unread_count > 99 ? '99+' : folder.unread_count}
          </span>
        )}
      </button>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pr-1 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="p-1 text-muted-foreground hover:text-foreground"
          title="Rename"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete "${folder.name}"? Emails inside will return to Inbox.`)) {
              deleteMut.mutate();
            }
          }}
          className="p-1 text-muted-foreground hover:text-destructive"
          title="Delete"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────
// Signature edit modal — large textarea + live preview. Replaces the cramped
// inline signature editor that used to live inside the AccountRow sidebar.
// ────────────────────────────────────────
function SignatureEditModal({
  email,
  initial,
  saving,
  onCancel,
  onSave,
}: {
  email: string;
  initial: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(initial);

  // Convert the plain-text draft into preview HTML so the user can see what
  // the signature will actually look like in their sent emails.
  const previewHtml = useMemo(() => {
    if (!draft.trim()) return '';
    return draft
      .split('\n')
      .map((line) => {
        const safe = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `<p style="margin:0">${safe || '<br>'}</p>`;
      })
      .join('');
  }, [draft]);

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              ✍︎ Edit Signature
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{email}</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — split into editor (top) + preview (bottom) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Signature text
            </label>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Best regards,\nYour Name\nCompany Name\n+91 XXXXX XXXXX\nwww.example.com`}
              className="w-full min-h-[200px] resize-y px-3 py-2.5 rounded-lg bg-secondary/40 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-sans leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Tip: each line becomes a paragraph in your sent email. The signature is
              auto-included on new compose, replies, and forwards.
            </p>
          </div>

          {previewHtml && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Preview (how it appears in sent emails)
              </label>
              <div className="rounded-lg border border-border bg-white text-gray-900 px-4 py-3 text-sm">
                <p className="text-xs text-gray-500 mb-2">— signature separator below —</p>
                <p className="text-gray-500 mb-1">--</p>
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save signature'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────
// Infinite-scroll sentinel — auto-fetches next page when scrolled into view.
// Shows a "Load more" button as fallback if user prefers not to scroll, plus
// a status line ("Showing 50 of 200" or "All caught up").
// ────────────────────────────────────────
function InfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  loaded,
  total,
  activeAccountId,
  activeFolder,
  onResynced,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  loaded: number;
  total: number;
  activeAccountId: string | null;
  activeFolder: string;
  onResynced: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Full historical sync — fetches all-time emails from IMAP, non-destructive
  const hardResyncMut = useMutation({
    mutationFn: () => emailApi.syncAccount(activeAccountId!, activeFolder, true),
    onSuccess: (r: any) => {
      const n = r?.data?.saved ?? 0;
      toast.success(n > 0 ? `Imported ${n} historical email${n !== 1 ? 's' : ''} from server` : 'No new emails found on server');
      qc.invalidateQueries({ queryKey: ['email-unread'] });
      onResynced();
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.error ||
        e?.message ||
        'Could not pull from mail server — check IMAP settings'
      ),
  });

  // IntersectionObserver — when sentinel becomes 100px visible, fetch next page
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage();
      },
      { rootMargin: '100px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div ref={ref} className="px-4 py-4 text-center space-y-2 border-t border-border bg-card/50">
      {/* Local DB pagination (fast — already synced) */}
      {isFetchingNextPage ? (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" />
          Loading older emails…
        </div>
      ) : hasNextPage ? (
        <button
          onClick={fetchNextPage}
          className="block w-full px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 transition-colors"
        >
          Load more — showing {loaded} of {total}
        </button>
      ) : (
        <p className="text-[11px] text-muted-foreground/70">
          {total > 0 ? `All ${total} loaded from local cache` : 'No more in cache'}
        </p>
      )}

      {/* IMAP resync (slower — pulls older emails from mail server) */}
      {activeAccountId && (
        <button
          onClick={() => hardResyncMut.mutate()}
          disabled={hardResyncMut.isPending}
          className="block w-full px-3 py-2 rounded-lg border border-border bg-secondary/40 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        >
          {hardResyncMut.isPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              Pulling full history from mail server…
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 justify-center">
              <RefreshCw size={12} />
              Pull older emails from mail server
            </span>
          )}
        </button>
      )}
      <p className="text-[10px] text-muted-foreground/60 italic">
        Local pagination is instant. Pulling from server imports only emails not already in your local cache.
      </p>
    </div>
  );
}

// ────────────────────────────────────────
// Selection bar — replaces the search/sync row when 1+ emails are checked.
// Shows count, "Select all on page", "Move to ▼" dropdown, and Clear button.
// ────────────────────────────────────────
function SelectionBar({
  count,
  allOnPage,
  folders,
  ids,
  onSelectAll,
  onClear,
  onMoved,
}: {
  count: number;
  allOnPage: number;
  folders: any[];
  ids: string[];
  onSelectAll: () => void;
  onClear: () => void;
  onMoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const moveMut = useMutation({
    mutationFn: (target: string | null) => emailApi.bulkMoveMessages(ids, target),
    onSuccess: (r: any) => {
      const moved = r?.data?.moved ?? count;
      toast.success(`${moved} email${moved === 1 ? '' : 's'} moved`);
      setOpen(false);
      onMoved();
    },
    onError: (e: any) => toast.error(errMsg(e) || 'Failed to move emails'),
  });

  const deleteMut = useMutation({
    mutationFn: () => emailApi.bulkDeleteMessages(ids, false),
    onSuccess: (r: any) => {
      const n = r?.data?.affected ?? count;
      toast.success(`${n} email${n === 1 ? '' : 's'} moved to trash`);
      onMoved(); // re-uses the same invalidation/clear-selection callback
    },
    onError: (e: any) => toast.error(errMsg(e) || 'Failed to delete emails'),
  });

  const handleBulkDelete = () => {
    if (!window.confirm(`Move ${count} email${count === 1 ? '' : 's'} to trash?`)) return;
    deleteMut.mutate();
  };

  const busy = moveMut.isPending || deleteMut.isPending;
  const allSelected = count >= allOnPage && allOnPage > 0;

  return (
    <div className="px-3 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
      <button
        onClick={onClear}
        className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Clear selection"
      >
        <X size={15} />
      </button>

      <span className="text-sm font-semibold text-foreground">
        {count} selected
      </span>

      {!allSelected && (
        <button
          onClick={onSelectAll}
          className="text-xs text-primary hover:underline"
        >
          Select all {allOnPage}
        </button>
      )}

      <div className="flex-1" />

      <button
        onClick={handleBulkDelete}
        disabled={busy}
        title={`Delete ${count} email${count === 1 ? '' : 's'}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 disabled:opacity-50 transition-colors"
      >
        {deleteMut.isPending ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Trash2 size={12} />
        )}
        {deleteMut.isPending ? 'Deleting…' : 'Delete'}
      </button>

      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {moveMut.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <FolderInput size={12} />
          )}
          {moveMut.isPending ? 'Moving…' : 'Move to'}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 z-30 w-56 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              Move {count} email{count === 1 ? '' : 's'} to
            </div>
            <div className="max-h-64 overflow-y-auto">
              <button
                onClick={() => moveMut.mutate(null)}
                disabled={moveMut.isPending}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
              >
                <Inbox size={14} className="text-muted-foreground" />
                <span>Inbox</span>
              </button>
              {folders.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground italic border-t border-border">
                  No folders yet — create one in the sidebar.
                </p>
              ) : (
                <>
                  <div className="border-t border-border" />
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => moveMut.mutate(f.id)}
                      disabled={moveMut.isPending}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                    >
                      <Folder
                        size={14}
                        style={f.color ? { color: f.color } : undefined}
                      />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────
// Move-to-folder dropdown for the email detail toolbar
// ────────────────────────────────────────
function MoveToButton({
  emailId,
  currentFolderId,
  folders,
  onMoved,
}: {
  emailId: string;
  currentFolderId: string | null;
  folders: any[];
  onMoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const moveMut = useMutation({
    mutationFn: (target: string | null) => emailApi.moveMessage(emailId, target),
    onSuccess: () => { toast.success('Email moved'); setOpen(false); onMoved(); },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
        title="Move to folder"
      >
        <FolderInput size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-56 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
            Move to folder
          </div>
          <div className="max-h-64 overflow-y-auto">
            {currentFolderId && (
              <button
                onClick={() => moveMut.mutate(null)}
                disabled={moveMut.isPending}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
              >
                <Inbox size={14} className="text-muted-foreground" />
                <span>Move back to Inbox</span>
              </button>
            )}
            {folders.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground italic">
                No folders yet — create one in the sidebar.
              </p>
            ) : (
              folders.map((f) => {
                const isCurrent = f.id === currentFolderId;
                return (
                  <button
                    key={f.id}
                    onClick={() => !isCurrent && moveMut.mutate(f.id)}
                    disabled={moveMut.isPending || isCurrent}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${
                      isCurrent ? 'bg-primary/10 text-primary cursor-default' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <Folder size={14} style={f.color ? { color: f.color } : undefined} />
                    <span className="flex-1 truncate">{f.name}</span>
                    {isCurrent && <Check size={12} className="text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────
// Create-folder modal
// ────────────────────────────────────────
function CreateFolderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>('#6c63fa');

  const PRESET_COLORS = ['#6c63fa', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#64748b'];

  const mut = useMutation({
    mutationFn: () => emailApi.createCustomFolder({ name: name.trim(), color }),
    onSuccess: () => { toast.success('Folder created'); onCreated(); },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FolderPlus size={16} className="text-primary" />
            New Folder
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Folder name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) mut.mutate();
              }}
              maxLength={100}
              placeholder="Clients, Newsletters, Receipts…"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={!name.trim() || mut.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            {mut.isPending ? 'Creating…' : 'Create Folder'}
          </button>
        </div>
      </div>
    </div>
  );
}
