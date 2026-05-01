import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Inbox, Send, FileText, Star, Archive, Trash2,
  Plus, RefreshCw, Search, Reply, MailOpen, Paperclip,
  Minus, X, PlugZap, CheckCircle2, XCircle, Loader2,
  Folder, FolderPlus, MoreVertical, Pencil, FolderInput, Check,
} from 'lucide-react';
import { emailApi } from '@/lib/api';

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

// Basic HTML sanitization — strip script/style tags and inline event handlers
const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
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
  const [activeFolder, setActiveFolder] = useState('INBOX');
  const [activeCustomFolderId, setActiveCustomFolderId] = useState<string | null>(null);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Multi-selection: tracks which messages are checked. Distinct from selectedId
  // (which is the single email open in the detail pane).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selection when folder/account/search changes — a fresh list shouldn't
  // carry over checkboxes from the previous list.
  useEffect(() => {
    setSelectedIds(new Set());
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

  // ----- messages list (auto-refresh every 30s for live inbox) -----
  const {
    data: msgData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['emails', activeFolder, activeCustomFolderId, activeAccountId, search],
    queryFn: () =>
      emailApi
        .getMessages({
          folder: activeCustomFolderId ? undefined : activeFolder,
          custom_folder_id: activeCustomFolderId || undefined,
          account_id: activeAccountId || undefined,
          search: search || undefined,
          limit: 50,
        })
        .then((r) => r.data),
    enabled: accounts.length > 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const messages: any[] = msgData?.data || msgData || [];

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
    refetchInterval: 30_000,
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
  // (only if body is empty so we don't clobber a reply quote)
  const activeAccount = useMemo(
    () => accounts.find((a: any) => a.id === activeAccountId) || null,
    [accounts, activeAccountId]
  );
  useEffect(() => {
    if (showCompose) {
      const current = composeForm.getValues('body_html') || '';
      const sig = activeAccount?.signature || '';
      if (!current.trim() && sig) {
        composeForm.setValue('body_html', `\n\n--\n${sig}`);
      }
    }
  }, [showCompose, activeAccount?.id]); // eslint-disable-line

  const sendMutation = useMutation({
    mutationFn: (d: any) => emailApi.send({ ...d, body_text: d.body_html }),
    onSuccess: () => {
      toast.success('Email sent!');
      composeForm.reset({ to: '', cc: '', subject: '', body_html: '', account_id: activeAccountId || '' });
      setShowCompose(false);
      qc.invalidateQueries({ queryKey: ['emails'] });
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const replyTo = () => {
    if (!email) return;
    composeForm.reset({
      to: email.from_address || '',
      cc: '',
      subject: email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject || ''}`,
      body_html: `\n\n---\nOn ${fmtDateTime(email.received_at || email.sent_at)}, ${email.from_name || email.from_address} wrote:\n${email.body_text || ''}`,
      account_id: activeAccountId || '',
    });
    setShowCompose(true);
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
    },
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

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* ───────── COL 1 — SIDEBAR ───────── */}
      <aside className="w-[240px] shrink-0 border-r border-border bg-card flex flex-col">
        <div className="p-3">
          <button
            onClick={() => setShowCompose(true)}
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
              <button
                key={f.key}
                onClick={() => {
                  setActiveFolder(f.key);
                  setActiveCustomFolderId(null);
                  setSelectedId(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon size={16} />
                <span className="flex-1 text-left">{f.label}</span>
                {f.key === 'INBOX' && unreadCount > 0 && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary'
                  }`}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ───────── CUSTOM FOLDERS (user categories) ───────── */}
        <div className="mt-4 px-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Folders
            </span>
            <button
              onClick={() => setShowCreateFolder(true)}
              className="text-muted-foreground hover:text-foreground"
              title="Create folder"
            >
              <FolderPlus size={14} />
            </button>
          </div>
          <div className="space-y-0.5">
            {customFolders.map((cf: any) => (
              <CustomFolderRow
                key={cf.id}
                folder={cf}
                active={activeCustomFolderId === cf.id}
                onSelect={() => {
                  setActiveCustomFolderId(cf.id);
                  setActiveFolder('');
                  setSelectedId(null);
                }}
                onChanged={() => {
                  qc.invalidateQueries({ queryKey: ['email-custom-folders'] });
                  qc.invalidateQueries({ queryKey: ['emails'] });
                }}
                onDeleted={(deletedId: string) => {
                  if (activeCustomFolderId === deletedId) {
                    setActiveCustomFolderId(null);
                    setActiveFolder('INBOX');
                  }
                  qc.invalidateQueries({ queryKey: ['email-custom-folders'] });
                  qc.invalidateQueries({ queryKey: ['emails'] });
                }}
              />
            ))}
            {customFolders.length === 0 && (
              <p className="text-[11px] text-muted-foreground/70 px-2 py-1.5 italic">
                No folders yet. Click + to create one.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 px-3 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Accounts
            </span>
            <button
              onClick={() => setShowAddAccount(true)}
              className="text-muted-foreground hover:text-foreground"
              title="Add account"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {accounts.map((acc: any) => (
              <AccountRow
                key={acc.id}
                acc={acc}
                active={activeAccountId === acc.id}
                onSelect={() => setActiveAccountId(acc.id)}
                onDeleted={(deletedId: string) => {
                  if (activeAccountId === deletedId) setActiveAccountId(null);
                }}
              />
            ))}
            {accounts.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-2">No accounts yet</p>
            )}
          </div>
        </div>
      </aside>

      {/* ───────── COL 2 — MESSAGE LIST ───────── */}
      <section className="w-[380px] shrink-0 border-r border-border bg-card flex flex-col">
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
          <div className="px-3 py-3 border-b border-border flex items-center gap-2">
            {/* Master "Select all" checkbox — visible whenever there are messages.
                Click → check all visible emails → opens the SelectionBar */}
            {messages.length > 0 && (
              <button
                onClick={() => setSelectedIds(new Set(messages.map((m: any) => m.id)))}
                title={`Select all ${messages.length} on this page`}
                className="shrink-0 w-5 h-5 flex items-center justify-center rounded border-2 border-muted-foreground/60 hover:border-primary hover:bg-primary/10 cursor-pointer transition-colors"
              >
                <span className="sr-only">Select all</span>
              </button>
            )}
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages…"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
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

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No messages in {activeFolder}</p>
              {accounts.length === 0 && (
                <button
                  onClick={() => setShowAddAccount(true)}
                  className="mt-2 text-xs text-primary underline"
                >
                  Add an email account to get started
                </button>
              )}
            </div>
          ) : (
            messages.map((msg: any) => {
              const sel = selectedId === msg.id;
              const checked = selectedIds.has(msg.id);
              const fromLabel = msg.from_name || msg.from_address || '?';
              const toggleChecked = (e: React.MouseEvent | React.ChangeEvent) => {
                e.stopPropagation();
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(msg.id)) next.delete(msg.id);
                  else next.add(msg.id);
                  return next;
                });
              };
              return (
                <div
                  key={msg.id}
                  onClick={() => setSelectedId(msg.id)}
                  className={`group flex items-start gap-2 px-3 py-3 cursor-pointer border-b border-border transition-colors ${
                    checked ? 'bg-primary/8' : sel ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/50'
                  } ${!msg.is_read ? 'font-semibold' : ''}`}
                >
                  {/* Checkbox: always visible (was hover-only — confusing). Border
                      uses muted-foreground/60 for both-theme contrast. */}
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className={`shrink-0 w-5 h-5 mt-1 flex items-center justify-center rounded border-2 cursor-pointer transition-colors ${
                      checked
                        ? 'bg-primary border-primary'
                        : 'border-muted-foreground/60 hover:border-primary hover:bg-primary/10'
                    }`}
                    title={checked ? 'Deselect' : 'Select'}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={toggleChecked}
                      className="sr-only"
                    />
                    {checked && <Check size={12} className="text-primary-foreground" strokeWidth={3} />}
                  </label>

                  <div className="w-8 h-8 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold uppercase">
                    {fromLabel[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground truncate">{fromLabel}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {fmtRelative(msg.received_at || msg.sent_at)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground truncate">
                      {msg.subject || '(no subject)'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate font-normal">
                      {(() => {
                        const p = msg.preview;
                        if (p == null || typeof p !== 'string' || !p.trim()) return '';
                        return p.length > 80 ? `${p.slice(0, 80)}...` : p;
                      })()}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {!msg.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      {!!msg.is_starred && <Star size={11} className="text-primary fill-primary" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ───────── COL 3 — DETAIL ───────── */}
      <section className="flex-1 bg-background flex flex-col overflow-hidden">
        {!selectedId || !email ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a message to read
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-foreground flex-1">
                {email.subject || '(no subject)'}
              </h2>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => star.mutate()}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                  title={email.is_starred ? 'Unstar' : 'Star'}
                >
                  <Star size={15} className={email.is_starred ? 'fill-primary text-primary' : ''} />
                </button>
                <button
                  onClick={replyTo}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                  title="Reply"
                >
                  <Reply size={15} />
                </button>
                <button
                  onClick={() => unread.mutate()}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                  title="Mark unread"
                >
                  <MailOpen size={15} />
                </button>
                <MoveToButton
                  emailId={email.id}
                  currentFolderId={email.custom_folder_id}
                  folders={customFolders}
                  onMoved={() => {
                    qc.invalidateQueries({ queryKey: ['emails'] });
                    qc.invalidateQueries({ queryKey: ['email-custom-folders'] });
                    setSelectedId(null);
                  }}
                />
                <button
                  onClick={() => archive.mutate()}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                  title="Archive"
                >
                  <Archive size={15} />
                </button>
                <button
                  onClick={() => trash.mutate()}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 border-b border-border flex items-start gap-3">
              <div className="w-10 h-10 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold uppercase">
                {(email.from_name || email.from_address || '?')[0]}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground font-normal">From: </span>
                  <span className="font-semibold">
                    {email.from_name ? `${email.from_name} ` : ''}
                  </span>
                  {email.from_address && (
                    <span className="text-muted-foreground">&lt;{email.from_address}&gt;</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span>To: </span>{formatAddresses(email.to_addresses)}
                </p>
                {email.cc_addresses && (formatAddresses(email.cc_addresses)) && (
                  <p className="text-xs text-muted-foreground">
                    <span>CC: </span>{formatAddresses(email.cc_addresses)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  <span>Date: </span>{fmtDateTime(email.received_at || email.sent_at)}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {email.body_html && String(email.body_html).trim() ? (
                <EmailBodyFrame html={sanitizeHtml(email.body_html)} />
              ) : email.body_text && String(email.body_text).trim() ? (
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">
                  {email.body_text}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  This email has no content
                </p>
              )}

              {email.attachments?.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    ATTACHMENTS ({email.attachments.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {email.attachments.map((att: any) => (
                      <a
                        key={att.id}
                        href={att.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary text-xs hover:bg-muted transition-colors"
                      >
                        <Paperclip size={12} />
                        {att.file_name}
                        <span className="text-muted-foreground">
                          ({Math.round((att.file_size || 0) / 1024)}KB)
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ───────── COMPOSE MODAL ───────── */}
      {showCompose && (
        <div
          className="fixed bottom-4 right-4 z-50 w-[560px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col"
          style={{ maxHeight: '80vh' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h3 className="text-sm font-semibold text-foreground">New Message</h3>
            <div className="flex gap-1">
              <button
                onClick={() => setShowCompose(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <Minus size={15} />
              </button>
              <button
                onClick={() => setShowCompose(false)}
                className="text-muted-foreground hover:text-foreground p-1"
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
            <textarea
              {...composeForm.register('body_html')}
              rows={12}
              className="flex-1 px-4 py-3 text-sm bg-transparent border-0 focus:outline-none resize-none text-foreground"
              placeholder="Write your message…"
            />
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
            <button
              type="button"
              onClick={() => setShowCompose(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Discard
            </button>
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

      {/* ───────── ADD ACCOUNT MODAL ───────── */}
      {showAddAccount && (
        <AddAccountModal
          form={accountForm}
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
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

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

  // Auto-size to content
  const handleLoad = () => {
    try {
      const doc = ref.current?.contentDocument;
      if (!doc) return;
      const h = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, 200);
      setHeight(h + 24);
    } catch {
      // Cross-origin or other access error — keep default height
    }
  };

  return (
    <iframe
      ref={ref}
      title="Email body"
      sandbox="allow-same-origin allow-popups"
      srcDoc={srcDoc}
      onLoad={handleLoad}
      style={{ width: '100%', height: `${height}px`, border: 0, background: '#ffffff', borderRadius: 8 }}
    />
  );
}

// ────────────────────────────────────────
// Add Account Modal
// ────────────────────────────────────────
function AddAccountModal({
  form,
  onClose,
  onSubmit,
  submitting,
}: {
  form: ReturnType<typeof useForm<any>>;
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
              Connect your <span className="font-semibold">personal work email</span>. This is only
              for your own inbox — system alerts and invoices use a separate company email
              configured in Settings.
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            SMTP is required to send emails. IMAP is optional — add it to sync received emails.
          </p>

          <div className="space-y-3">
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
  onSelect,
  onDeleted,
}: {
  acc: any;
  active: boolean;
  onSelect: () => void;
  onDeleted?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [result, setResult] = useState<
    { ok: boolean; message: string } | null
  >(null);
  const [showSig, setShowSig] = useState(false);
  const [sigDraft, setSigDraft] = useState<string>(acc.signature || '');

  useEffect(() => { setSigDraft(acc.signature || ''); }, [acc.signature]);

  const sigMut = useMutation({
    mutationFn: () => emailApi.updateAccount(acc.id, { signature: sigDraft }),
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
      </div>

      <div className="px-2 pb-2 space-y-1.5">
        <div className="flex gap-1.5">
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowSig((s) => !s);
            }}
            title="Edit signature"
            className="inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ✍︎ Signature
          </button>
        </div>

        {showSig && (
          <div onClick={(e) => e.stopPropagation()} className="rounded-md border border-border bg-card p-1.5 space-y-1.5">
            <textarea
              value={sigDraft}
              onChange={(e) => setSigDraft(e.target.value)}
              rows={4}
              placeholder={`Best regards,\nYour Name\nCompany`}
              className="w-full text-[11px] px-2 py-1.5 rounded bg-secondary border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y font-sans"
            />
            <div className="flex justify-end gap-1">
              <button
                onClick={() => { setSigDraft(acc.signature || ''); setShowSig(false); }}
                className="px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => sigMut.mutate()}
                disabled={sigMut.isPending}
                className="px-2 py-0.5 rounded text-[10px] bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {sigMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
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

      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={moveMut.isPending}
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
