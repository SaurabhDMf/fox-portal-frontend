import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Inbox, Send, FileText, Star, Archive, Trash2, Plus, Search,
  Reply, Forward, Paperclip, CornerUpLeft, X, Check, Folder,
  RefreshCw, Loader2, Mail, Settings as SettingsIcon,
} from 'lucide-react';
import { emailApi, type EmailAccount, type EmailMessage } from '@/lib/api';
import { usePortalBase } from '@/hooks/usePortalBase';

const errMsg = (e: any) => e?.response?.data?.error || e?.response?.data?.message || 'Something went wrong';

type SystemFolder = 'INBOX' | 'SENT' | 'DRAFTS' | 'ARCHIVE' | 'TRASH';

const SYSTEM_FOLDERS: { key: SystemFolder; label: string; icon: any }[] = [
  { key: 'INBOX',   label: 'Inbox',   icon: Inbox },
  { key: 'SENT',    label: 'Sent',    icon: Send },
  { key: 'DRAFTS',  label: 'Drafts',  icon: FileText },
  { key: 'ARCHIVE', label: 'Archive', icon: Archive },
  { key: 'TRASH',   label: 'Trash',   icon: Trash2 },
];

const fmtTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 86400) return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const fmtSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

export default function EmailPage() {
  const qc = useQueryClient();
  const basePath = usePortalBase();

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => emailApi.getAccounts().then(r => r.data.data),
    staleTime: 60_000,
  });

  const [accountId, setAccountId] = useState<string | null>(null);
  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      const primary = (accounts as EmailAccount[]).find(a => a.is_primary) || accounts[0];
      setAccountId(primary.id);
    }
  }, [accounts, accountId]);

  const [folder, setFolder] = useState<SystemFolder>('INBOX');
  const [customFolderId, setCustomFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [composer, setComposer] = useState<{ mode: 'reply' | 'forward' } | null>(null);
  const [draft, setDraft] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: customFolders = [] } = useQuery({
    queryKey: ['email-folders'],
    queryFn: () => emailApi.getFolders().then(r => r.data.data),
    staleTime: 60_000,
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['email-messages', accountId, folder, customFolderId, query],
    queryFn: () => emailApi.getMessages({
      account_id: accountId!, folder: customFolderId ? undefined : folder,
      custom_folder_id: customFolderId || undefined, search: query || undefined, limit: 100,
    }).then(r => r.data.data),
    enabled: !!accountId,
    staleTime: 15_000,
  });

  const selected = (messages as EmailMessage[]).find(m => m.id === selectedId) || null;

  useEffect(() => {
    setSelectedId(null);
    setComposer(null);
  }, [accountId, folder, customFolderId]);

  useEffect(() => {
    setComposer(null);
    setDraft('');
    setAttachments([]);
  }, [selectedId]);

  const patchMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, any> }) => emailApi.patchMessage(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-messages'] }),
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const createFolderMut = useMutation({
    mutationFn: (name: string) => emailApi.createFolder(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-folders'] });
      setNewFolderName('');
      setShowAddFolder(false);
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const openMessage = (m: EmailMessage) => {
    setSelectedId(m.id);
    if (!m.is_read) patchMut.mutate({ id: m.id, patch: { is_read: true } });
  };

  const doSync = async () => {
    if (!accountId) return;
    setSyncing(true);
    try {
      const res = await emailApi.syncAccount(accountId, folder);
      toast.success(`Synced — ${res.data?.synced ?? 0} new message(s)`);
      qc.invalidateQueries({ queryKey: ['email-messages'] });
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSyncing(false);
    }
  };

  const openComposer = (mode: 'reply' | 'forward') => {
    if (!selected) return;
    setComposer({ mode });
    setDraftSubject(`${mode === 'forward' ? 'Fwd: ' : 'Re: '}${selected.subject || ''}`);
    setDraft(mode === 'forward'
      ? `\n\n---------- Forwarded message ----------\nFrom: ${selected.from_name || selected.from_address}\nSubject: ${selected.subject}\n\n${selected.body_text || ''}`
      : '');
    setAttachments([]);
  };

  const sendComposer = async () => {
    if (!selected || !accountId) return;
    const to = composer?.mode === 'forward' ? '' : selected.from_address;
    if (composer?.mode === 'forward' && !to) { toast.error('Enter a recipient'); return; }
    setSending(true);
    try {
      await emailApi.send({
        account_id: accountId,
        to: to || selected.from_address,
        subject: draftSubject,
        body_text: draft,
        attachments: attachments.length ? attachments : undefined,
      });
      toast.success(composer?.mode === 'forward' ? 'Message forwarded' : 'Reply sent');
      setComposer(null);
      setDraft('');
      setAttachments([]);
      qc.invalidateQueries({ queryKey: ['email-messages'] });
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSending(false);
    }
  };

  const filtered = useMemo(() => messages as EmailMessage[], [messages]);
  const unreadCount = (key: SystemFolder) =>
    key === 'INBOX' ? (messages as EmailMessage[]).filter(m => m.folder === 'INBOX' && !m.is_read).length : undefined;

  if (!loadingAccounts && accounts.length === 0) {
    return (
      <div className="page-container flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <Mail className="h-7 w-7 opacity-40" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">No mailbox connected yet</h2>
          <p className="text-sm text-muted-foreground mt-1">Connect your email account to read and send from inside Fox Portal.</p>
        </div>
        <Link
          to={`${basePath}/settings?tab=email-accounts`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          <SettingsIcon className="h-4 w-4" /> Connect a mailbox
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="page-header flex-shrink-0">
        <div>
          <h1 className="page-title">Email</h1>
          <p className="page-subtitle">Your personal inbox — connected via IMAP/SMTP</p>
        </div>
        <div className="flex items-center gap-2">
          {accounts.length > 1 && (
            <select
              value={accountId || ''}
              onChange={e => setAccountId(e.target.value)}
              className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background"
            >
              {(accounts as EmailAccount[]).map(a => <option key={a.id} value={a.id}>{a.email}</option>)}
            </select>
          )}
          <button
            onClick={doSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Sync
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Folder sidebar */}
        <aside className="hidden w-52 shrink-0 flex-col border-r border-border overflow-y-auto py-3 lg:flex">
          <nav className="space-y-0.5 px-2">
            {SYSTEM_FOLDERS.map(f => {
              const active = folder === f.key && !customFolderId;
              const count = unreadCount(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => { setFolder(f.key); setCustomFolderId(null); }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <span className="flex items-center gap-2.5"><f.icon className="h-4 w-4" /> {f.label}</span>
                  {!!count && <span className="text-xs font-semibold">{count}</span>}
                </button>
              );
            })}
          </nav>

          {customFolders.length > 0 && (
            <>
              <p className="px-5 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Folders</p>
              <nav className="space-y-0.5 px-2">
                {customFolders.map((f: any) => (
                  <button
                    key={f.id}
                    onClick={() => setCustomFolderId(f.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      customFolderId === f.id ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    <Folder className="h-4 w-4" /> <span className="truncate">{f.name}</span>
                  </button>
                ))}
              </nav>
            </>
          )}

          <div className="px-2 pt-3">
            {showAddFolder ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newFolderName.trim()) createFolderMut.mutate(newFolderName.trim());
                    if (e.key === 'Escape') { setShowAddFolder(false); setNewFolderName(''); }
                  }}
                  placeholder="Folder name…"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button onClick={() => newFolderName.trim() && createFolderMut.mutate(newFolderName.trim())} className="grid size-8 place-items-center rounded-lg text-primary hover:bg-secondary">
                  <Check className="size-4" />
                </button>
                <button onClick={() => { setShowAddFolder(false); setNewFolderName(''); }} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAddFolder(true)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary">
                <Plus className="h-4 w-4" /> New Folder
              </button>
            )}
          </div>
        </aside>

        {/* Message list */}
        <section className="flex w-full max-w-[300px] shrink-0 flex-col border-r border-border">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search messages…"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingMessages ? (
              [...Array(5)].map((_, i) => <div key={i} className="m-2 h-16 rounded-xl bg-secondary animate-pulse" />)
            ) : filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No messages here.</p>
            ) : filtered.map(m => {
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  onClick={() => openMessage(m)}
                  className={`w-full border-b border-border p-4 text-left transition-colors ${
                    active ? 'border-l-4 border-l-primary bg-primary/5' : 'border-l-4 border-l-transparent hover:bg-secondary/60'
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className={`truncate text-sm ${!m.is_read ? 'font-bold' : 'font-medium text-foreground/80'}`}>
                      {m.direction === 'outbound' ? m.to_addresses : (m.from_name || m.from_address)}
                    </span>
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{fmtTime(m.received_at)}</span>
                  </div>
                  <h4 className={`mb-1 truncate text-sm ${!m.is_read ? 'font-semibold' : 'font-medium text-foreground/80'}`}>{m.subject || '(no subject)'}</h4>
                  <div className="flex items-center gap-1.5">
                    {m.is_starred && <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />}
                    {m.has_attachments && <Paperclip className="size-3 shrink-0 text-muted-foreground" />}
                    <p className="truncate text-xs text-muted-foreground">{(m.body_text || '').slice(0, 80)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Reader */}
        <main className="flex min-w-0 flex-1 flex-col bg-background">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">Select a message to read</div>
          ) : (
            <>
              <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
                <div className="flex items-center gap-1">
                  <button onClick={() => openComposer('reply')} title="Reply" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <Reply className="size-4" />
                  </button>
                  <button onClick={() => openComposer('forward')} title="Forward" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <Forward className="size-4" />
                  </button>
                  <button onClick={() => patchMut.mutate({ id: selected.id, patch: { is_archived: !selected.is_archived } })} title="Archive" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <Archive className="size-4" />
                  </button>
                  <button onClick={() => patchMut.mutate({ id: selected.id, patch: { is_trashed: true } })} title="Delete" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="px-8 py-8">
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-base font-bold truncate">{selected.from_name || selected.from_address}</h2>
                      <p className="text-sm text-muted-foreground truncate">{selected.from_address}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{fmtTime(selected.received_at)}</p>
                    </div>
                  </div>

                  <div className="mb-6 flex items-start justify-between gap-4">
                    <h1 className="text-2xl font-bold leading-tight tracking-tight">{selected.subject || '(no subject)'}</h1>
                    <button
                      onClick={() => patchMut.mutate({ id: selected.id, patch: { is_starred: !selected.is_starred } })}
                      className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors ${
                        selected.is_starred ? 'text-amber-400 hover:bg-amber-400/10' : 'text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      <Star className={`size-5 ${selected.is_starred ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <article className="rounded-2xl border border-border bg-card p-6 leading-relaxed">
                    {selected.body_html ? (
                      <div dangerouslySetInnerHTML={{ __html: selected.body_html }} />
                    ) : (
                      (selected.body_text || '').split('\n\n').map((para, i) => (
                        <p key={i} className="mb-4 last:mb-0 text-[14px] whitespace-pre-wrap">{para}</p>
                      ))
                    )}
                  </article>

                  {!!selected.attachments?.length && (
                    <div className="mt-6">
                      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Attachments ({selected.attachments.length})
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selected.attachments.map(a => (
                          <a
                            key={a.id} href={a.url} target="_blank" rel="noreferrer" download
                            className="inline-flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50"
                          >
                            <div className="grid size-9 place-items-center rounded-lg bg-secondary">
                              <Paperclip className="size-4" />
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-semibold truncate max-w-[160px]">{a.file_name}</div>
                              <div className="text-[11px] text-muted-foreground">{fmtSize(a.file_size)}</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {composer ? (
                <div className="flex shrink-0 flex-col border-t border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-4 py-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {composer.mode === 'forward' ? <Forward className="size-3.5" /> : <CornerUpLeft className="size-3.5" />}
                      {composer.mode === 'forward' ? 'Forward' : 'Reply'}
                    </div>
                    <button onClick={() => setComposer(null)} className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="border-b border-border text-sm">
                    <div className="flex items-center gap-3 px-4 py-2">
                      <span className="w-14 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">To</span>
                      {composer.mode === 'forward' ? (
                        <input placeholder="recipient@example.com" id="fwd-to" className="flex-1 bg-transparent text-sm outline-none" />
                      ) : (
                        <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium">{selected.from_address}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 border-t border-border px-4 py-2">
                      <span className="w-14 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">Subject</span>
                      <input
                        value={draftSubject}
                        onChange={e => setDraftSubject(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none"
                      />
                    </div>
                  </div>

                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder={composer.mode === 'forward' ? 'Add a note before forwarding…' : 'Write your reply…'}
                    rows={6}
                    className="resize-none bg-transparent px-4 py-3 text-sm leading-relaxed outline-none"
                  />

                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-4 pb-2">
                      {attachments.map((f, i) => (
                        <span key={i} className="flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-xs">
                          {f.name}
                          <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}><X className="size-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-border px-3 py-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Attach files"
                    >
                      <Paperclip className="size-4" />
                    </button>
                    <input
                      ref={fileInputRef} type="file" multiple hidden
                      onChange={e => setAttachments(prev => [...prev, ...Array.from(e.target.files || [])])}
                    />
                    <div className="flex items-center gap-2">
                      <button onClick={() => setComposer(null)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary">
                        Discard
                      </button>
                      <button
                        onClick={() => {
                          if (composer.mode === 'forward') {
                            const to = (document.getElementById('fwd-to') as HTMLInputElement | null)?.value || '';
                            if (!to) { toast.error('Enter a recipient'); return; }
                            emailApi.send({ account_id: accountId!, to, subject: draftSubject, body_text: draft, attachments: attachments.length ? attachments : undefined })
                              .then(() => { toast.success('Message forwarded'); setComposer(null); setDraft(''); setAttachments([]); qc.invalidateQueries({ queryKey: ['email-messages'] }); })
                              .catch((e: any) => toast.error(errMsg(e)));
                          } else {
                            sendComposer();
                          }
                        }}
                        disabled={sending}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <footer className="flex shrink-0 gap-3 border-t border-border bg-card p-4">
                  <button
                    onClick={() => openComposer('reply')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary py-2.5 text-sm font-medium hover:border-primary/50"
                  >
                    <CornerUpLeft className="size-4" /> Reply
                  </button>
                  <button
                    onClick={() => openComposer('forward')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary py-2.5 text-sm font-medium hover:border-primary/50"
                  >
                    <Forward className="size-4" /> Forward
                  </button>
                </footer>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
