import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Mail, Send, Star, Archive, Trash2, RefreshCw, Plus, Inbox, FileText, X, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import toast from 'react-hot-toast';

interface EmailAccount {
  id: string;
  email: string;
  provider?: string;
  is_connected?: boolean;
}

export default function EmailPage() {
  const qc = useQueryClient();
  const [activeFolder, setActiveFolder] = useState('INBOX');
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  // Fetch accounts
  const { data: accountsRaw } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => api.get('/email/accounts').then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || d?.accounts || [];
    }),
  });
  const accounts: EmailAccount[] = Array.isArray(accountsRaw) ? accountsRaw : [];
  const activeAccount = accounts[0];

  // Fetch folders
  const { data: foldersRaw } = useQuery({
    queryKey: ['email-folders', activeAccount?.id],
    queryFn: () => api.get(`/email/accounts/${activeAccount!.id}/folders`).then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || d?.folders || [];
    }),
    enabled: !!activeAccount?.id,
  });
  const folders = Array.isArray(foldersRaw) && foldersRaw.length > 0 ? foldersRaw : [
    { name: 'INBOX', icon: 'inbox' },
    { name: 'Sent', icon: 'send' },
    { name: 'Starred', icon: 'star' },
    { name: 'Archive', icon: 'archive' },
    { name: 'Drafts', icon: 'file' },
  ];

  // Fetch messages
  const { data: messagesRaw, isLoading: loadingMessages } = useQuery({
    queryKey: ['email-messages', activeFolder],
    queryFn: () => api.get('/email/messages', { params: { folder: activeFolder } }).then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || d?.messages || [];
    }),
    enabled: !!activeAccount,
  });
  const messages = Array.isArray(messagesRaw) ? messagesRaw : [];

  // Fetch single email
  const { data: emailDetail } = useQuery({
    queryKey: ['email-detail', selectedEmail?.id],
    queryFn: () => api.get(`/email/messages/${selectedEmail!.id}`).then(r => r.data?.data || r.data),
    enabled: !!selectedEmail?.id,
  });

  // Sync
  const syncMut = useMutation({
    mutationFn: () => api.post(`/email/accounts/${activeAccount!.id}/sync`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-messages'] }); toast.success('Synced'); },
    onError: () => toast.error('Sync failed'),
  });

  // Star / Archive / Delete
  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'star' | 'archive' | 'delete' }) => {
      if (action === 'star') return api.patch(`/email/messages/${id}`, { is_starred: true });
      if (action === 'archive') return api.patch(`/email/messages/${id}`, { is_archived: true });
      return api.delete(`/email/messages/${id}`);
    },
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ['email-messages'] });
      toast.success(action === 'delete' ? 'Deleted' : action === 'star' ? 'Starred' : 'Archived');
      if (selectedEmail) setSelectedEmail(null);
    },
  });

  const folderIcons: Record<string, React.ElementType> = { INBOX: Inbox, Sent: Send, Starred: Star, Archive: Archive, Drafts: FileText };

  if (!activeAccount && !showSetup) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center py-20">
          <Mail className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Set up your email</h2>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">Connect your email account to send and receive emails directly from this platform.</p>
          <button onClick={() => setShowSetup(true)} className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4 inline mr-1.5" /> Add Email Account
          </button>
        </div>
        {showSetup && <SetupModal onClose={() => setShowSetup(false)} onSuccess={() => { setShowSetup(false); qc.invalidateQueries({ queryKey: ['email-accounts'] }); }} />}
      </div>
    );
  }

  return (
    <div className="!p-0 h-[calc(100vh-3.5rem)] flex overflow-hidden">
      {/* Folder sidebar */}
      <div className="w-56 border-r border-border bg-card flex-shrink-0 flex flex-col">
        <div className="p-3 border-b border-border">
          <button onClick={() => setShowCompose(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" /> Compose
          </button>
        </div>
        <nav className="flex-1 py-2 px-2 space-y-0.5">
          {folders.map((f: any) => {
            const fname = typeof f === 'string' ? f : f.name;
            const Icon = folderIcons[fname] || FileText;
            return (
              <button key={fname} onClick={() => { setActiveFolder(fname); setSelectedEmail(null); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${activeFolder === fname ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                <Icon className="h-4 w-4" />
                <span className="truncate">{fname}</span>
                {f.unread_count > 0 && <span className="ml-auto text-[10px] bg-primary text-primary-foreground rounded-full px-1.5">{f.unread_count}</span>}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending || !activeAccount}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${syncMut.isPending ? 'animate-spin' : ''}`} /> Sync
          </button>
        </div>
      </div>

      {/* Email list */}
      <div className={`w-80 border-r border-border bg-card flex-shrink-0 flex flex-col ${selectedEmail ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-semibold">{activeFolder}</h3>
          <p className="text-xs text-muted-foreground">{messages.length} message{messages.length !== 1 ? 's' : ''}</p>
        </div>
        <ScrollArea className="flex-1">
          {loadingMessages ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />)}</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">No messages</p>
            </div>
          ) : (
            messages.map((msg: any) => (
              <button key={msg.id} onClick={() => setSelectedEmail(msg)}
                className={`w-full text-left px-4 py-3 border-b border-border hover:bg-secondary/50 transition-colors ${selectedEmail?.id === msg.id ? 'bg-secondary' : ''} ${!msg.is_read ? 'font-medium' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm truncate flex-1">{msg.from_name || msg.from || msg.sender}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                    {msg.date ? new Date(msg.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
                <div className="text-sm truncate">{msg.subject}</div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.preview || msg.snippet || ''}</p>
                <div className="flex items-center gap-1 mt-1">
                  {msg.is_starred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Email detail */}
      <div className={`flex-1 flex flex-col min-w-0 ${!selectedEmail ? 'hidden md:flex' : 'flex'}`}>
        {selectedEmail ? (
          <>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <button onClick={() => setSelectedEmail(null)} className="md:hidden p-1 rounded hover:bg-secondary mr-2">
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
              <h3 className="text-base font-semibold truncate flex-1">{emailDetail?.subject || selectedEmail.subject}</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => actionMut.mutate({ id: selectedEmail.id, action: 'star' })} className="p-2 rounded-md hover:bg-secondary text-muted-foreground">
                  <Star className={`h-4 w-4 ${selectedEmail.is_starred ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                </button>
                <button onClick={() => actionMut.mutate({ id: selectedEmail.id, action: 'archive' })} className="p-2 rounded-md hover:bg-secondary text-muted-foreground">
                  <Archive className="h-4 w-4" />
                </button>
                <button onClick={() => actionMut.mutate({ id: selectedEmail.id, action: 'delete' })} className="p-2 rounded-md hover:bg-secondary text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <ScrollArea className="flex-1 p-6">
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    {(emailDetail?.from_name || selectedEmail.from_name || selectedEmail.from || 'U')[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{emailDetail?.from_name || selectedEmail.from_name || selectedEmail.from}</div>
                    <div className="text-xs text-muted-foreground">{emailDetail?.from_email || selectedEmail.from_email || selectedEmail.from}</div>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {selectedEmail.date ? new Date(selectedEmail.date).toLocaleString() : ''}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mb-4">To: {emailDetail?.to || selectedEmail.to || '—'}</div>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: emailDetail?.body_html || emailDetail?.body || selectedEmail.body || selectedEmail.preview || '' }} />
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Mail className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Select an email</p>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} />}
      {showSetup && <SetupModal onClose={() => setShowSetup(false)} onSuccess={() => { setShowSetup(false); qc.invalidateQueries({ queryKey: ['email-accounts'] }); }} />}
    </div>
  );
}

function ComposeModal({ onClose }: { onClose: () => void }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const sendMut = useMutation({
    mutationFn: () => api.post('/email/send', { to, subject, body }),
    onSuccess: () => { toast.success('Email sent'); onClose(); },
    onError: () => toast.error('Failed to send'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-2xl p-6 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Email</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <input placeholder="To" value={to} onChange={e => setTo(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <textarea placeholder="Write your message..." value={body} onChange={e => setBody(e.target.value)} rows={10}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={() => sendMut.mutate()} disabled={!to || !subject || sendMut.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            <Send className="h-4 w-4" /> {sendMut.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SetupModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    email: '', smtp_host: '', smtp_port: '587', smtp_user: '', smtp_password: '',
    imap_host: '', imap_port: '993', imap_user: '', imap_password: '',
  });

  const setupMut = useMutation({
    mutationFn: () => api.post('/email/accounts', form),
    onSuccess: () => { toast.success('Email account added'); onSuccess(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Setup failed'),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const inputCls = "w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Email Account</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <input placeholder="Email address *" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} />
        <h3 className="text-sm font-medium text-muted-foreground">SMTP (Outgoing)</h3>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="SMTP Host *" value={form.smtp_host} onChange={e => set('smtp_host', e.target.value)} className={inputCls} />
          <input placeholder="Port" value={form.smtp_port} onChange={e => set('smtp_port', e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="SMTP Username" value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)} className={inputCls} />
          <input placeholder="SMTP Password" type="password" value={form.smtp_password} onChange={e => set('smtp_password', e.target.value)} className={inputCls} />
        </div>
        <h3 className="text-sm font-medium text-muted-foreground">IMAP (Incoming) — Optional</h3>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="IMAP Host" value={form.imap_host} onChange={e => set('imap_host', e.target.value)} className={inputCls} />
          <input placeholder="Port" value={form.imap_port} onChange={e => set('imap_port', e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="IMAP Username" value={form.imap_user} onChange={e => set('imap_user', e.target.value)} className={inputCls} />
          <input placeholder="IMAP Password" type="password" value={form.imap_password} onChange={e => set('imap_password', e.target.value)} className={inputCls} />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={() => setupMut.mutate()} disabled={!form.email || !form.smtp_host || setupMut.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {setupMut.isPending ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
