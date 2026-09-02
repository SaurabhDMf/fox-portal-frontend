import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Mail, Plus, X, Check, Loader2, Server, RefreshCw, Trash2,
  AlertTriangle, KeyRound, Star,
} from 'lucide-react';
import { emailApi, type EmailAccount, type EmailAccountForm } from '@/lib/api';

const errMsg = (e: any) => e?.response?.data?.error || e?.response?.data?.message || 'Something went wrong';

type ProviderPreset = {
  id: string; name: string; color: string;
  imap: { host: string; port: number; secure: boolean };
  smtp: { host: string; port: number; secure: boolean };
};

const PROVIDERS: ProviderPreset[] = [
  { id: 'google',    name: 'Gmail / Google Workspace', color: 'bg-red-500/15 text-red-500',
    imap: { host: 'imap.gmail.com', port: 993, secure: true }, smtp: { host: 'smtp.gmail.com', port: 465, secure: true } },
  { id: 'microsoft', name: 'Outlook / Microsoft 365',  color: 'bg-blue-500/15 text-blue-500',
    imap: { host: 'outlook.office365.com', port: 993, secure: true }, smtp: { host: 'smtp.office365.com', port: 587, secure: false } },
  { id: 'zoho',      name: 'Zoho Mail',                 color: 'bg-amber-500/15 text-amber-600',
    imap: { host: 'imap.zoho.com', port: 993, secure: true }, smtp: { host: 'smtp.zoho.com', port: 465, secure: true } },
  { id: 'yahoo',     name: 'Yahoo Mail',                 color: 'bg-violet-500/15 text-violet-500',
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true }, smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true } },
  { id: 'custom',    name: 'Other provider (IMAP / SMTP)', color: 'bg-primary/15 text-primary',
    imap: { host: '', port: 993, secure: true }, smtp: { host: '', port: 587, secure: true } },
];

const providerOf = (id: string) => PROVIDERS.find(p => p.id === id) ?? PROVIDERS[4];

function Field({ label, value, onChange, placeholder, type = 'text', width = 'w-full' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; width?: string;
}) {
  return (
    <label className={`block ${width}`}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary"
      />
    </label>
  );
}

function MiniToggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label}
      onClick={() => onChange(!on)}
      className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${on ? 'bg-primary' : 'bg-muted ring-1 ring-border'}`}
    >
      <span className={`size-4 rounded-full bg-white shadow transition-all ${on ? 'ml-auto' : 'mr-auto'}`} />
    </button>
  );
}

function ConnectModal({ onClose, onAdd, saving }: {
  onClose: () => void; onAdd: (f: EmailAccountForm) => void; saving: boolean;
}) {
  const [step, setStep] = useState<'provider' | 'manual'>('provider');
  const [provider, setProvider] = useState<ProviderPreset>(PROVIDERS[0]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [imapSsl, setImapSsl] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSsl, setSmtpSsl] = useState(true);
  const [smtpUser, setSmtpUser] = useState('');

  const pick = (p: ProviderPreset) => {
    setProvider(p);
    setImapHost(p.imap.host); setImapPort(String(p.imap.port)); setImapSsl(p.imap.secure);
    setSmtpHost(p.smtp.host); setSmtpPort(String(p.smtp.port)); setSmtpSsl(p.smtp.secure);
    setStep('manual');
  };

  const canSubmit = email.trim() && password && imapHost.trim() && smtpHost.trim();

  const submit = () => {
    if (!canSubmit) return;
    onAdd({
      email: email.trim(), provider: provider.id,
      imap_host: imapHost.trim(), imap_port: Number(imapPort) || 993, imap_secure: imapSsl, imap_user: email.trim(), imap_password: password,
      smtp_host: smtpHost.trim(), smtp_port: Number(smtpPort) || 587, smtp_secure: smtpSsl, smtp_user: smtpUser.trim() || email.trim(), smtp_password: password,
      sync_folders: true, send_as: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl ring-1 ring-border">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Connect a mailbox</h3>
            <p className="text-[13px] text-muted-foreground">Link any email account via IMAP/SMTP so you can read and reply from inside the portal.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-md hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        {step === 'provider' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => pick(p)}
                className="flex items-start gap-3 rounded-xl border border-border p-3 text-left transition hover:border-primary hover:bg-primary/5"
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${p.color}`}>
                  <Mail className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{p.name}</span>
                  <span className="block text-[12px] text-muted-foreground">
                    {p.id === 'custom' ? 'Any mail host — cPanel, Rackspace, self-hosted, Fastmail…' : 'Connect with an app password'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 'manual' && (
          <div className="space-y-3">
            <p className="text-[12px] text-muted-foreground">{provider.name} — enter your email and an app password.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email address" value={email} onChange={setEmail} placeholder="you@company.com" type="email" />
              <Field label="Password / app password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />
            </div>

            <div className="rounded-xl border border-border p-3">
              <p className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <Server className="size-3.5" /> Incoming — IMAP
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
                <Field label="Host" value={imapHost} onChange={setImapHost} placeholder="imap.yourhost.com" />
                <Field label="Port" value={imapPort} onChange={setImapPort} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <MiniToggle on={imapSsl} onChange={setImapSsl} label="IMAP SSL/TLS" />
                <span className="text-[12px] text-muted-foreground">Use SSL/TLS</span>
              </div>
            </div>

            <div className="rounded-xl border border-border p-3">
              <p className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <Server className="size-3.5" /> Outgoing — SMTP
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
                <Field label="Host" value={smtpHost} onChange={setSmtpHost} placeholder="smtp.yourhost.com" />
                <Field label="Port" value={smtpPort} onChange={setSmtpPort} />
              </div>
              <div className="mt-3">
                <Field label="SMTP username (optional)" value={smtpUser} onChange={setSmtpUser} placeholder="Same as email address" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <MiniToggle on={smtpSsl} onChange={setSmtpSsl} label="SMTP SSL/TLS" />
                <span className="text-[12px] text-muted-foreground">Use SSL/STARTTLS</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button onClick={() => setStep('provider')} className="text-[12px] text-muted-foreground hover:text-foreground">
                ← Back to providers
              </button>
              <button
                onClick={submit}
                disabled={!canSubmit || saving}
                className="flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {saving ? 'Connecting…' : 'Test & add mailbox'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmailAccountsSettings() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => emailApi.getAccounts().then(r => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: (data: EmailAccountForm) => emailApi.createAccount(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-accounts'] });
      setOpen(false);
      toast.success('Mailbox connected');
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EmailAccountForm> }) => emailApi.updateAccount(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-accounts'] }),
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => emailApi.deleteAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-accounts'] });
      toast.success('Mailbox disconnected');
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  const resync = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await emailApi.syncAccount(id);
      toast.success(`Synced — ${res.data?.synced ?? 0} new message(s)`);
      qc.invalidateQueries({ queryKey: ['email-accounts'] });
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <section className="rounded-xl bg-card p-5 border border-border">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Connected mailboxes</h3>
          <p className="text-[13px] text-muted-foreground">
            Link your own email via IMAP/SMTP with an app password to read and send from inside the portal.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="size-4" /> Connect mailbox
        </button>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          [...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-secondary animate-pulse" />)
        ) : (accounts as EmailAccount[]).map(a => {
          const p = providerOf(a.provider);
          return (
            <div key={a.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-start gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${p.color}`}>
                  <Mail className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium">{a.email}</span>
                    {a.is_primary && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                        <Star className="size-2.5" /> Primary
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">IMAP / SMTP</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    {p.name} · last sync {a.last_synced_at ? new Date(a.last_synced_at).toLocaleString() : 'never'}
                  </p>
                  {a.status === 'error' && (
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-destructive">
                      <AlertTriangle className="size-3.5" /> {a.last_error || 'Connection error'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {!a.is_primary && (
                    <button
                      onClick={() => updateMut.mutate({ id: a.id, data: { is_primary: true } })}
                      className="h-8 rounded-md border border-border px-2 text-[12px] transition hover:bg-muted"
                      title="Set as primary send-from address"
                    >
                      Make primary
                    </button>
                  )}
                  <button
                    onClick={() => resync(a.id)}
                    aria-label={`Resync ${a.email}`}
                    className="grid size-8 place-items-center rounded-md border border-border transition hover:bg-muted"
                  >
                    <RefreshCw className={`size-3.5 ${syncingId === a.id ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
                  </button>
                  <button
                    onClick={() => deleteMut.mutate(a.id)}
                    aria-label={`Disconnect ${a.email}`}
                    className="grid size-8 place-items-center rounded-md border border-border transition hover:bg-muted"
                  >
                    <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-2.5">
                <span className="inline-flex items-center gap-2.5 text-[12px] text-muted-foreground">
                  <MiniToggle on={a.sync_folders} onChange={v => updateMut.mutate({ id: a.id, data: { sync_folders: v } })} label="Sync folders" />
                  Sync all folders
                </span>
                <span className="inline-flex items-center gap-2.5 text-[12px] text-muted-foreground">
                  <MiniToggle on={a.send_as} onChange={v => updateMut.mutate({ id: a.id, data: { send_as: v } })} label="Send as" />
                  Allow sending as this address
                </span>
              </div>
            </div>
          );
        })}
        {!isLoading && accounts.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
            No mailbox connected yet — connect one to start reading and replying inside the portal.
          </p>
        )}
      </div>

      {open && (
        <ConnectModal
          onClose={() => setOpen(false)}
          onAdd={(f) => createMut.mutate(f)}
          saving={createMut.isPending}
        />
      )}
    </section>
  );
}
