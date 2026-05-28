import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, CheckCircle2, Send } from 'lucide-react';

const inputCls = 'w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

type Provider = 'smtp' | 'resend' | 'sendgrid';

type EmailForm = {
  email_provider: Provider;
  smtp_enabled: boolean;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_from: string;
  smtp_pass: string;
  resend_api_key: string;
  sendgrid_api_key: string;
};

const defaultForm: EmailForm = {
  email_provider: 'smtp',
  smtp_enabled: false,
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_from: '',
  smtp_pass: '',
  resend_api_key: '',
  sendgrid_api_key: '',
};

export default function EmailSettings() {
  const qc = useQueryClient();
  const [form, setForm] = useState<EmailForm>(defaultForm);
  const [showPass, setShowPass] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [showSendgrid, setShowSendgrid] = useState(false);
  const [passSet, setPassSet] = useState(false);
  const [resendSet, setResendSet] = useState(false);
  const [sendgridSet, setSendgridSet] = useState(false);
  const [testTo, setTestTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => api.get('/company').then(r => r.data),
  });

  useEffect(() => {
    if (data) {
      const provider = (['smtp', 'resend', 'sendgrid'] as const).includes(data.email_provider)
        ? (data.email_provider as Provider)
        : 'smtp';
      setForm({
        email_provider: provider,
        smtp_enabled: Boolean(data.smtp_enabled),
        smtp_host: data.smtp_host || '',
        smtp_port: String(data.smtp_port || '587'),
        smtp_user: data.smtp_user || '',
        smtp_from: data.smtp_from || '',
        smtp_pass: '',
        resend_api_key: '',
        sendgrid_api_key: '',
      });
      setPassSet(Boolean(data.smtp_pass_set));
      setResendSet(Boolean(data.resend_api_key_set));
      setSendgridSet(Boolean(data.sendgrid_api_key_set));
    }
  }, [data]);

  const set = <K extends keyof EmailForm>(key: K, val: EmailForm[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: any = {
        email_provider: form.email_provider,
        smtp_enabled: form.smtp_enabled,
      };
      if (form.email_provider === 'smtp') {
        payload.smtp_host = form.smtp_host;
        payload.smtp_port = Number(form.smtp_port);
        payload.smtp_user = form.smtp_user;
        payload.smtp_from = form.smtp_from;
        if (form.smtp_pass.trim().length > 0) payload.smtp_pass = form.smtp_pass;
      } else if (form.email_provider === 'resend') {
        if (form.resend_api_key.trim().length > 0) payload.resend_api_key = form.resend_api_key;
      } else if (form.email_provider === 'sendgrid') {
        if (form.sendgrid_api_key.trim().length > 0) payload.sendgrid_api_key = form.sendgrid_api_key;
      }
      return api.put('/company', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Email settings saved');
      setForm(f => ({ ...f, smtp_pass: '', resend_api_key: '', sendgrid_api_key: '' }));
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.response?.data?.error || 'Error saving'),
  });

  const testMut = useMutation({
    mutationFn: () => {
      const body: any = {};
      if (testTo.trim()) body.to = testTo.trim();
      return api.post('/company/test-smtp', body).then(r => r.data);
    },
    onSuccess: (res: any) => toast.success(res?.message || 'Test email sent'),
    onError: (e: any) =>
      toast.error(
        e.response?.data?.detail ||
          e.response?.data?.error ||
          e.response?.data?.message ||
          'Failed to send test email'
      ),
  });

  if (isLoading)
    return (
      <div className="glass-card p-6">
        <div className="h-4 bg-secondary rounded animate-pulse w-48" />
      </div>
    );

  const isSmtp = form.email_provider === 'smtp';
  const isResend = form.email_provider === 'resend';
  const isSendgrid = form.email_provider === 'sendgrid';

  const testDisabled =
    testMut.isPending ||
    (isSmtp && !form.smtp_host.trim()) ||
    (isResend && !resendSet && !form.resend_api_key.trim()) ||
    (isSendgrid && !sendgridSet && !form.sendgrid_api_key.trim());

  return (
    <div className="space-y-4">
      <div className="glass-card p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold">System Email — Alerts & Invoices</h2>
          <p className="text-xs text-muted-foreground mt-1">
            This email is used by the platform to send invoices, payslips, and system notifications.
            Configure once for the whole company.
          </p>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40">
          <div>
            <div className="text-sm font-medium">Enable Email Sending</div>
            <div className="text-xs text-muted-foreground">Turn on outgoing email delivery</div>
          </div>
          <button
            type="button"
            onClick={() => set('smtp_enabled', !form.smtp_enabled)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              form.smtp_enabled ? 'bg-primary' : 'bg-secondary border border-border'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                form.smtp_enabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Provider dropdown */}
        <div>
          <label className="text-xs text-muted-foreground">Provider</label>
          <select
            value={form.email_provider}
            onChange={e => set('email_provider', e.target.value as Provider)}
            className={inputCls}
          >
            <option value="smtp">SMTP</option>
            <option value="resend">Resend</option>
            <option value="sendgrid">SendGrid</option>
          </select>
        </div>

        {/* SMTP fields */}
        {isSmtp && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">SMTP Host</label>
              <input
                type="text"
                placeholder="smtp.gmail.com"
                value={form.smtp_host}
                onChange={e => set('smtp_host', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Port</label>
              <select
                value={form.smtp_port}
                onChange={e => set('smtp_port', e.target.value)}
                className={inputCls}
              >
                <option value="587">587 (STARTTLS)</option>
                <option value="465">465 (SSL)</option>
                <option value="25">25 (Plain)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">From Address</label>
              <input
                type="email"
                placeholder="noreply@yourcompany.com"
                value={form.smtp_from}
                onChange={e => set('smtp_from', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">SMTP Username</label>
              <input
                type="text"
                placeholder="your@email.com"
                value={form.smtp_user}
                onChange={e => set('smtp_user', e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">SMTP Password</label>
                {passSet && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">
                    <CheckCircle2 className="h-3 w-3" /> Saved
                  </span>
                )}
              </div>
              <div className="relative mt-1">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.smtp_pass}
                  onChange={e => set('smtp_pass', e.target.value)}
                  placeholder={passSet ? '••••••••' : 'Enter SMTP password'}
                  className={inputCls + ' pr-10'}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passSet && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Leave blank to keep existing password.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Resend */}
        {isResend && (
          <div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Resend API Key</label>
              {resendSet && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">
                  <CheckCircle2 className="h-3 w-3" /> Configured
                </span>
              )}
            </div>
            <div className="relative mt-1">
              <input
                type={showResend ? 'text' : 'password'}
                value={form.resend_api_key}
                onChange={e => set('resend_api_key', e.target.value)}
                placeholder={resendSet ? '••••••••' : 're_xxxxxxxxxxxxxxxx'}
                className={inputCls + ' pr-10'}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowResend(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showResend ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {resendSet && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Leave blank to keep existing API key.
              </p>
            )}
          </div>
        )}

        {/* SendGrid */}
        {isSendgrid && (
          <div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">SendGrid API Key</label>
              {sendgridSet && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">
                  <CheckCircle2 className="h-3 w-3" /> Configured
                </span>
              )}
            </div>
            <div className="relative mt-1">
              <input
                type={showSendgrid ? 'text' : 'password'}
                value={form.sendgrid_api_key}
                onChange={e => set('sendgrid_api_key', e.target.value)}
                placeholder={sendgridSet ? '••••••••' : 'SG.xxxxxxxxxxxxxxxx'}
                className={inputCls + ' pr-10'}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowSendgrid(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showSendgrid ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {sendgridSet && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Leave blank to keep existing API key.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {saveMut.isPending ? 'Saving...' : 'Save Email Settings'}
          </button>
        </div>
      </div>

      {/* Test Email */}
      <div className="glass-card p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Send Test Email</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Verify your email configuration by sending a test message.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Send test to…</label>
            <input
              type="email"
              placeholder={form.smtp_user || form.smtp_from || 'recipient@example.com'}
              value={testTo}
              onChange={e => setTestTo(e.target.value)}
              className={inputCls}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Leave blank to send to the configured sender.
            </p>
          </div>
          <button
            type="button"
            onClick={() => testMut.mutate()}
            disabled={testDisabled}
            className="px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Send className="h-3.5 w-3.5" />
            {testMut.isPending ? 'Sending...' : 'Send Test'}
          </button>
        </div>
      </div>
    </div>
  );
}
