import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { inboxApi } from '@/lib/api';

const INP = 'w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400/50 transition-colors';
const LBL = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';

const errMsg = (e: any) =>
  e?.response?.data?.error || e?.response?.data?.message || 'Something went wrong';

const DEFAULTS = {
  name: '', email_address: '',
  imap_host: 'imap.gmail.com', imap_port: 993, imap_secure: 1, imap_user: '', imap_password: '',
  smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_secure: 0, smtp_user: '', smtp_password: '',
  ai_followup_enabled: 1, ai_followup_delay_hr: 2, ai_followup_tone: 'professional',
  sync_history_days: 90,
};

export default function InboxFormPage() {
  const navigate = useNavigate();
  const { inboxId } = useParams<{ inboxId: string }>();
  const { pathname } = useLocation();
  const isEdit = !!inboxId;
  const basePath = pathname.startsWith('/emp') ? '/emp/inbox' : '/admin/inbox';
  const qc = useQueryClient();

  // No refetchInterval — this is a form page, no background polling
  const { data: inboxes = [], isLoading } = useQuery<any[]>({
    queryKey: ['shared-inboxes'],
    queryFn: () => inboxApi.getInboxes().then(r => r.data),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const inbox = inboxes.find(i => i.id === inboxId);

  const [form, setForm] = useState({ ...DEFAULTS });
  const [initialised, setInitialised] = useState(!isEdit);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (isEdit && inbox && !initialised) {
      setForm({
        ...DEFAULTS,
        name:               inbox.name              ?? '',
        email_address:      inbox.email_address     ?? '',
        imap_host:          inbox.imap_host         ?? 'imap.gmail.com',
        imap_port:          inbox.imap_port         ?? 993,
        imap_secure:        inbox.imap_secure       ?? 1,
        imap_user:          inbox.imap_user         ?? '',
        imap_password:      '',
        smtp_host:          inbox.smtp_host         ?? 'smtp.gmail.com',
        smtp_port:          inbox.smtp_port         ?? 587,
        smtp_secure:        inbox.smtp_secure       ?? 0,
        smtp_user:          inbox.smtp_user         ?? '',
        smtp_password:      '',
        ai_followup_enabled:  inbox.ai_followup_enabled  ?? 1,
        ai_followup_delay_hr: inbox.ai_followup_delay_hr ?? 2,
        ai_followup_tone:     inbox.ai_followup_tone     ?? 'professional',
        sync_history_days:    inbox.sync_history_days    ?? 90,
      });
      setInitialised(true);
    }
  }, [inbox, isEdit, initialised]);

  const submit = async () => {
    if (!form.name.trim() || (!isEdit && !form.email_address.trim())) {
      toast.error('Inbox name and collection email are required');
      return;
    }
    setSaving(true);
    try {
      let savedId: string;
      if (isEdit) {
        const payload: any = { ...form };
        if (!payload.imap_password) delete payload.imap_password;
        if (!payload.smtp_password) delete payload.smtp_password;
        await inboxApi.updateInbox(inbox!.id, payload);
        savedId = inbox!.id;
        toast.success('Inbox updated');
      } else {
        const r = await inboxApi.createInbox(form);
        savedId = r.data.id;
        toast.success('Inbox created — now add senders and team members');
      }
      qc.invalidateQueries({ queryKey: ['shared-inboxes'] });
      navigate(isEdit ? basePath : `${basePath}/${savedId}/members`);
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(basePath)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">
              {isEdit ? `Settings — ${inbox?.name || ''}` : 'New Shared Inbox'}
            </h1>
            <p className="page-subtitle">
              {isEdit
                ? 'Update connection settings and AI behaviour'
                : 'Connect a Gmail or Google Workspace inbox for your team'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* ── Basic info ── */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Basic Info</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LBL}>Inbox name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Sales Inbox" className={INP} />
            </div>
            <div>
              <label className={LBL}>Collection email {!isEdit && '*'}</label>
              <input value={form.email_address}
                onChange={e => set('email_address', e.target.value)}
                placeholder="inbox@yourdomain.com"
                disabled={isEdit}
                className={`${INP} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`} />
              {!isEdit && (
                <p className="text-xs text-gray-400 mt-1">
                  The Gmail inbox where all your sender addresses forward their mail.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── IMAP ── */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">IMAP — Incoming Mail</h3>
          <p className="text-xs text-gray-400 mb-4">
            Used to pull new emails from your Gmail inbox.
            Use an <strong>App Password</strong> — not your account password.{' '}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer"
              className="text-violet-500 hover:underline">
              Create App Password →
            </a>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={LBL}>Host</label>
              <input value={form.imap_host} onChange={e => set('imap_host', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Port</label>
              <input type="number" value={form.imap_port}
                onChange={e => set('imap_port', +e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>IMAP Username</label>
              <input value={form.imap_user} onChange={e => set('imap_user', e.target.value)}
                placeholder="inbox@yourdomain.com" className={INP} />
            </div>
            <div>
              <label className={LBL}>{isEdit ? 'App Password (leave blank to keep)' : 'App Password'}</label>
              <input type="password" value={form.imap_password}
                onChange={e => set('imap_password', e.target.value)}
                placeholder={isEdit ? '••••••••' : 'xxxx xxxx xxxx xxxx'} className={INP} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                <input type="checkbox" checked={!!form.imap_secure}
                  onChange={e => set('imap_secure', e.target.checked ? 1 : 0)}
                  className="rounded border-gray-300 text-violet-600" />
                SSL / TLS
              </label>
            </div>
          </div>
        </div>

        {/* ── SMTP ── */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">SMTP — Outgoing Mail</h3>
          <p className="text-xs text-gray-400 mb-4">
            Used to send replies. Individual sender addresses can override this later.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={LBL}>Host</label>
              <input value={form.smtp_host} onChange={e => set('smtp_host', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Port</label>
              <input type="number" value={form.smtp_port}
                onChange={e => set('smtp_port', +e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>SMTP Username</label>
              <input value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)}
                placeholder="inbox@yourdomain.com" className={INP} />
            </div>
            <div>
              <label className={LBL}>{isEdit ? 'App Password (leave blank to keep)' : 'App Password'}</label>
              <input type="password" value={form.smtp_password}
                onChange={e => set('smtp_password', e.target.value)}
                placeholder={isEdit ? '••••••••' : 'xxxx xxxx xxxx xxxx'} className={INP} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                <input type="checkbox" checked={!!form.smtp_secure}
                  onChange={e => set('smtp_secure', e.target.checked ? 1 : 0)}
                  className="rounded border-gray-300 text-violet-600" />
                SSL / TLS
              </label>
            </div>
          </div>
        </div>

        {/* ── Email History ── */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Email History</h3>
          <p className="text-xs text-gray-400 mb-4">
            How far back to import existing emails from your inbox on the first sync.
            Older emails already in the mailbox will be pulled in up to this limit.
          </p>
          <div className="max-w-xs">
            <label className={LBL}>Import history</label>
            <select value={form.sync_history_days}
              onChange={e => set('sync_history_days', +e.target.value)} className={INP}>
              <option value={0}>All time (everything in mailbox)</option>
              <option value={365}>Last 1 year</option>
              <option value={180}>Last 6 months</option>
              <option value={90}>Last 90 days</option>
              <option value={60}>Last 60 days</option>
              <option value={30}>Last 30 days</option>
              <option value={7}>Last 7 days</option>
            </select>
          </div>
        </div>

        {/* ── AI Follow-up ── */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">AI Auto Follow-up</h3>
          <p className="text-xs text-gray-400 mb-4">
            If an assigned employee doesn't reply within the delay window, Claude writes and sends
            a follow-up on their behalf.
          </p>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={!!form.ai_followup_enabled}
                onChange={e => set('ai_followup_enabled', e.target.checked ? 1 : 0)}
                className="w-4 h-4 rounded border-gray-300 text-violet-600" />
              <span className="text-sm text-gray-700 dark:text-gray-200">Enable AI auto follow-up</span>
            </label>
            {!!form.ai_followup_enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7">
                <div>
                  <label className={LBL}>Send follow-up after (hours)</label>
                  <input type="number" min={1} max={72} value={form.ai_followup_delay_hr}
                    onChange={e => set('ai_followup_delay_hr', +e.target.value)} className={INP} />
                </div>
                <div>
                  <label className={LBL}>Email tone</label>
                  <select value={form.ai_followup_tone}
                    onChange={e => set('ai_followup_tone', e.target.value)} className={INP}>
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly &amp; warm</option>
                    <option value="casual">Casual</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 pb-8">
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {isEdit ? 'Save Changes' : 'Create Inbox'}
          </button>
          <button onClick={() => navigate(basePath)}
            className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
