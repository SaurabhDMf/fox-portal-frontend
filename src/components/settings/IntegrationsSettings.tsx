import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { CreditCard, Eye, EyeOff } from 'lucide-react';

const MASKED = '••••••••';

interface CompanyData {
  // Stripe
  stripe_enabled?: boolean;
  stripe_secret_key?: string;
  stripe_secret_key_set?: boolean;
  stripe_publishable_key?: string;
  stripe_webhook_secret?: string;
  stripe_webhook_secret_set?: boolean;
  // Razorpay
  razorpay_enabled?: boolean;
  razorpay_key_id?: string;
  razorpay_key_secret?: string;
  razorpay_key_secret_set?: boolean;
  // SMTP
  smtp_enabled?: boolean;
  smtp_host?: string;
  smtp_port?: string | number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_password_set?: boolean;
  smtp_from_address?: string;
  // Misc
  admin_email?: string;
  email?: string;
}

export default function IntegrationsSettings() {
  const qc = useQueryClient();
  const { data: company, isLoading } = useQuery<CompanyData>({
    queryKey: ['company'],
    queryFn: () => api.get('/company').then(r => r.data?.data || r.data || {}),
  });

  const [form, setForm] = useState<CompanyData>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Sync form with fetched company once available; mask secret-set fields with placeholder.
  useEffect(() => {
    if (!company) return;
    setForm({
      stripe_enabled: !!company.stripe_enabled,
      stripe_secret_key: company.stripe_secret_key_set ? MASKED : '',
      stripe_publishable_key: company.stripe_publishable_key || '',
      stripe_webhook_secret: company.stripe_webhook_secret_set ? MASKED : '',
      stripe_secret_key_set: company.stripe_secret_key_set,
      stripe_webhook_secret_set: company.stripe_webhook_secret_set,

      razorpay_enabled: !!company.razorpay_enabled,
      razorpay_key_id: company.razorpay_key_id || '',
      razorpay_key_secret: company.razorpay_key_secret_set ? MASKED : '',
      razorpay_key_secret_set: company.razorpay_key_secret_set,

      admin_email: company.admin_email || company.email || '',
    });
  }, [company]);

  const saveMut = useMutation({
    mutationFn: (payload: Record<string, any>) => api.put('/company', payload),
    onSuccess: () => {
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['company'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.response?.data?.error || 'Failed to save'),
  });

  // Build a payload that omits any secret field still showing the masked placeholder.
  const buildPayload = (section: 'stripe' | 'razorpay' | 'smtp') => {
    const payload: Record<string, any> = {};

    if (section === 'stripe') {
      payload.stripe_enabled = !!form.stripe_enabled;
      payload.stripe_publishable_key = form.stripe_publishable_key || null;
      if (form.stripe_secret_key && form.stripe_secret_key !== MASKED) {
        payload.stripe_secret_key = form.stripe_secret_key;
      }
      if (form.stripe_webhook_secret && form.stripe_webhook_secret !== MASKED) {
        payload.stripe_webhook_secret = form.stripe_webhook_secret;
      }
    }

    if (section === 'razorpay') {
      payload.razorpay_enabled = !!form.razorpay_enabled;
      payload.razorpay_key_id = form.razorpay_key_id || null;
      if (form.razorpay_key_secret && form.razorpay_key_secret !== MASKED) {
        payload.razorpay_key_secret = form.razorpay_key_secret;
      }
    }

    if (section === 'smtp') {
      payload.smtp_enabled = !!form.smtp_enabled;
      payload.smtp_host = form.smtp_host || null;
      payload.smtp_port = form.smtp_port ? Number(form.smtp_port) : null;
      payload.smtp_username = form.smtp_username || null;
      payload.smtp_from_address = form.smtp_from_address || null;
      if (form.smtp_password && form.smtp_password !== MASKED) {
        payload.smtp_password = form.smtp_password;
      }
    }

    return payload;
  };

  const sendTestEmail = async () => {
    if (!testEmailTo.trim()) { toast.error('Enter a recipient email'); return; }
    setTestingSmtp(true);
    try {
      await api.post('/company/test-smtp', { to: testEmailTo.trim() });
      toast.success(`Test email sent to ${testEmailTo}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.response?.data?.error || 'Failed to send test email');
    } finally {
      setTestingSmtp(false);
    }
  };

  const inputCls = "w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";
  const labelCls = "text-xs text-muted-foreground font-medium";

  const SecretField = ({
    name, label, value, placeholder,
  }: { name: string; label: string; value: string; placeholder?: string }) => {
    const visible = !!showSecrets[name];
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <div className="relative">
          <input
            type={visible ? 'text' : 'password'}
            value={value || ''}
            placeholder={placeholder}
            onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
            onFocus={() => {
              // Clear masked placeholder on focus so the user can type a new value
              if (value === MASKED) setForm(f => ({ ...f, [name]: '' }));
            }}
            className={`${inputCls} pr-10 font-mono`}
          />
          <button
            type="button"
            onClick={() => setShowSecrets(s => ({ ...s, [name]: !s[name] }))}
            className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 p-1 rounded hover:bg-muted text-muted-foreground"
            tabIndex={-1}
          >
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    );
  };

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <div className="flex items-center justify-between mb-4">
      <div className="text-sm font-medium">{label}</div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-secondary border border-border'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );

  if (isLoading) {
    return <div className="glass-card p-6 animate-pulse h-40" />;
  }

  return (
    <div className="space-y-4">
      {/* Stripe */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Stripe</h2>
        </div>
        <Toggle
          label="Stripe Enabled"
          checked={!!form.stripe_enabled}
          onChange={(v) => setForm(f => ({ ...f, stripe_enabled: v }))}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SecretField name="stripe_secret_key" label="Secret Key" value={form.stripe_secret_key || ''} placeholder="sk_..." />
          <div>
            <label className={labelCls}>Publishable Key</label>
            <input
              value={form.stripe_publishable_key || ''}
              placeholder="pk_..."
              onChange={e => setForm(f => ({ ...f, stripe_publishable_key: e.target.value }))}
              className={`${inputCls} font-mono`}
            />
          </div>
          <SecretField name="stripe_webhook_secret" label="Webhook Secret" value={form.stripe_webhook_secret || ''} placeholder="whsec_..." />
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => saveMut.mutate(buildPayload('stripe'))}
            disabled={saveMut.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {saveMut.isPending ? 'Saving…' : 'Save Stripe Settings'}
          </button>
        </div>
      </div>

      {/* Razorpay */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Razorpay</h2>
        </div>
        <Toggle
          label="Razorpay Enabled"
          checked={!!form.razorpay_enabled}
          onChange={(v) => setForm(f => ({ ...f, razorpay_enabled: v }))}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Key ID</label>
            <input
              value={form.razorpay_key_id || ''}
              placeholder="rzp_live_..."
              onChange={e => setForm(f => ({ ...f, razorpay_key_id: e.target.value }))}
              className={`${inputCls} font-mono`}
            />
          </div>
          <SecretField name="razorpay_key_secret" label="Key Secret" value={form.razorpay_key_secret || ''} />
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => saveMut.mutate(buildPayload('razorpay'))}
            disabled={saveMut.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {saveMut.isPending ? 'Saving…' : 'Save Razorpay Settings'}
          </button>
        </div>
      </div>

      {/* SMTP */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Email (SMTP)</h2>
        </div>
        <Toggle
          label="Email Enabled"
          checked={!!form.smtp_enabled}
          onChange={(v) => setForm(f => ({ ...f, smtp_enabled: v }))}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Host</label>
            <input value={form.smtp_host || ''} placeholder="smtp.gmail.com" onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Port</label>
            <input type="number" value={form.smtp_port || ''} placeholder="587" onChange={e => setForm(f => ({ ...f, smtp_port: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Username</label>
            <input value={form.smtp_username || ''} placeholder="user@example.com" onChange={e => setForm(f => ({ ...f, smtp_username: e.target.value }))} className={inputCls} />
          </div>
          <SecretField name="smtp_password" label="Password" value={form.smtp_password || ''} />
          <div className="md:col-span-2">
            <label className={labelCls}>From Address</label>
            <input value={form.smtp_from_address || ''} placeholder="noreply@yourcompany.com" onChange={e => setForm(f => ({ ...f, smtp_from_address: e.target.value }))} className={inputCls} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-border">
          <div className="flex-1 min-w-[200px]">
            <label className={labelCls}>Send Test Email To</label>
            <input
              type="email"
              value={testEmailTo}
              onChange={e => setTestEmailTo(e.target.value)}
              placeholder="admin@yourcompany.com"
              className={inputCls}
            />
          </div>
          <button
            onClick={sendTestEmail}
            disabled={testingSmtp || !form.smtp_enabled}
            title={!form.smtp_enabled ? 'Enable Email and save first' : 'Send test email'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> {testingSmtp ? 'Sending…' : 'Send Test Email'}
          </button>
          <button
            onClick={() => saveMut.mutate(buildPayload('smtp'))}
            disabled={saveMut.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {saveMut.isPending ? 'Saving…' : 'Save Email Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
