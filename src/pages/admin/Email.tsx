import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Inbox, Send, FileText, Star, Archive, Trash2,
  Plus, RefreshCw, Search, Reply, MailOpen, Paperclip,
  Minus, X, PlugZap, CheckCircle2, XCircle, Loader2,
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
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  // ----- messages list -----
  const {
    data: msgData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['emails', activeFolder, activeAccountId, search],
    queryFn: () =>
      emailApi
        .getMessages({
          folder: activeFolder,
          account_id: activeAccountId || undefined,
          search: search || undefined,
          limit: 50,
        })
        .then((r) => r.data),
    enabled: accounts.length > 0,
  });
  const messages: any[] = msgData?.data || msgData || [];

  // ----- unread inbox count -----
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
    refetchInterval: 60_000,
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
      setSelectedId(null);
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });
  const trash = useMutation({
    mutationFn: () => emailApi.patchMessage(email!.id, { is_deleted: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] });
      setSelectedId(null);
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });
  const unread = useMutation({
    mutationFn: () => emailApi.patchMessage(email!.id, { is_read: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emails'] }),
    onError: (e: any) => toast.error(errMsg(e)),
  });

  // ----- compose form -----
  const composeForm = useForm({
    defaultValues: { to: '', cc: '', subject: '', body_html: '', account_id: '' },
  });
  useEffect(() => {
    if (activeAccountId) composeForm.setValue('account_id', activeAccountId);
  }, [activeAccountId]); // eslint-disable-line

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
            const active = activeFolder === f.key;
            return (
              <button
                key={f.key}
                onClick={() => {
                  setActiveFolder(f.key);
                  setSelectedId(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon size={16} />
                {f.label}
              </button>
            );
          })}
        </nav>

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
        <div className="px-3 py-3 border-b border-border flex items-center gap-2">
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
              const fromLabel = msg.from_name || msg.from_address || '?';
              return (
                <div
                  key={msg.id}
                  onClick={() => setSelectedId(msg.id)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-border transition-colors ${
                    sel ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/50'
                  } ${!msg.is_read ? 'font-semibold' : ''}`}
                >
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
                      {msg.is_starred && <Star size={11} className="text-primary fill-primary" />}
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
                <div
                  className="prose prose-sm max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.body_html) }}
                />
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
    </div>
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
}: {
  acc: any;
  active: boolean;
  onSelect: () => void;
}) {
  const [result, setResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

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

  return (
    <div
      className={`rounded-lg transition-colors ${
        active ? 'bg-muted' : 'hover:bg-muted/60'
      }`}
    >
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-left ${
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

      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setResult(null);
            testMut.mutate();
          }}
          disabled={testMut.isPending}
          className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
        >
          {testMut.isPending ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <PlugZap size={11} />
          )}
          {testMut.isPending ? 'Testing…' : 'Test Connection'}
        </button>

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
