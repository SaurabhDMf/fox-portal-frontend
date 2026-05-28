import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Pencil, X, Send, Mail } from 'lucide-react';

const inputCls =
  'w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

const PASSWORD_MASK = '••••••••';
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED'];

type FormState = {
  // Profile
  name: string;
  tagline: string;
  email: string;
  phone: string;
  website: string;
  logo_url: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  // Tax
  gst_number: string;
  pan_number: string;
  tax_id: string;
  // Bank
  bank_name: string;
  bank_account: string;
  bank_ifsc: string;
  bank_swift: string;
  // Invoice defaults
  invoice_prefix: string;
  invoice_notes: string;
  payment_terms: string;
  currency: string;
  // SMTP
  smtp_enabled: boolean;
  smtp_host: string;
  smtp_port: string; // kept as string in form, coerced to number on save
  smtp_user: string;
  smtp_from: string;
  smtp_pass: string;
};

const emptyForm: FormState = {
  name: '',
  tagline: '',
  email: '',
  phone: '',
  website: '',
  logo_url: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  gst_number: '',
  pan_number: '',
  tax_id: '',
  bank_name: '',
  bank_account: '',
  bank_ifsc: '',
  bank_swift: '',
  invoice_prefix: 'INV',
  invoice_notes: '',
  payment_terms: '',
  currency: 'USD',
  smtp_enabled: false,
  smtp_host: '',
  smtp_port: '',
  smtp_user: '',
  smtp_from: '',
  smtp_pass: '',
};

function hydrate(data: any): FormState {
  const d = data || {};
  return {
    name: d.name ?? d.company_name ?? '',
    tagline: d.tagline ?? '',
    email: d.email ?? '',
    phone: d.phone ?? '',
    website: d.website ?? '',
    logo_url: d.logo_url ?? '',
    address_line1: d.address_line1 ?? d.address?.line1 ?? '',
    address_line2: d.address_line2 ?? d.address?.line2 ?? '',
    city: d.city ?? d.address?.city ?? '',
    state: d.state ?? d.address?.state ?? '',
    postal_code: d.postal_code ?? d.address?.postal_code ?? '',
    country: d.country ?? d.address?.country ?? '',
    gst_number: d.gst_number ?? '',
    pan_number: d.pan_number ?? d.pan ?? '',
    tax_id: d.tax_id ?? '',
    bank_name: d.bank_name ?? '',
    bank_account: d.bank_account ?? '',
    bank_ifsc: d.bank_ifsc ?? d.ifsc ?? '',
    bank_swift: d.bank_swift ?? d.swift ?? '',
    invoice_prefix: d.invoice_prefix ?? 'INV',
    invoice_notes: d.invoice_notes ?? '',
    payment_terms: d.payment_terms ?? '',
    currency: d.currency ?? d.default_currency ?? 'USD',
    smtp_enabled: !!d.smtp_enabled,
    smtp_host: d.smtp_host ?? '',
    smtp_port: d.smtp_port != null ? String(d.smtp_port) : '',
    smtp_user: d.smtp_user ?? '',
    smtp_from: d.smtp_from ?? '',
    // If the backend signals a password is already set, show mask. Otherwise blank.
    smtp_pass: d.smtp_pass_set || d.has_smtp_pass ? PASSWORD_MASK : '',
  };
}

export default function CompanySettings() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [original, setOriginal] = useState<FormState>(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => api.get('/company').then((r) => r.data?.data ?? r.data ?? {}),
  });

  useEffect(() => {
    if (data) {
      const hydrated = hydrate(data);
      setForm(hydrated);
      setOriginal(hydrated);
    }
  }, [data]);

  const buildChangedPayload = (): Record<string, any> => {
    const payload: Record<string, any> = {};
    (Object.keys(form) as (keyof FormState)[]).forEach((key) => {
      const cur = form[key];
      const prev = original[key];

      // Never send the masked password back — only send if user typed a real new value.
      if (key === 'smtp_pass') {
        if (typeof cur === 'string' && cur && cur !== PASSWORD_MASK) {
          payload.smtp_pass = cur;
        }
        return;
      }

      if (cur !== prev) {
        if (key === 'smtp_port') {
          payload.smtp_port = cur === '' ? null : Number(cur);
        } else {
          payload[key] = cur;
        }
      }
    });
    return payload;
  };

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = buildChangedPayload();
      if (Object.keys(payload).length === 0) {
        return Promise.resolve({ noop: true } as any);
      }
      return api.put('/company', payload);
    },
    onSuccess: (res: any) => {
      if (res?.noop) {
        toast('No changes to save');
        setEditing(false);
        return;
      }
      qc.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Company settings saved');
      setEditing(false);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || e?.message || 'Error saving settings'),
  });

  const testSmtpMut = useMutation({
    mutationFn: () => {
      // Send the current SMTP fields so user can test before saving (only real password if typed)
      const body: Record<string, any> = {
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port === '' ? null : Number(form.smtp_port),
        smtp_user: form.smtp_user,
        smtp_from: form.smtp_from,
      };
      if (form.smtp_pass && form.smtp_pass !== PASSWORD_MASK) {
        body.smtp_pass = form.smtp_pass;
      }
      return api.post('/company/test-smtp', body);
    },
    onSuccess: () => toast.success('Test email sent — check your inbox'),
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || e?.message || 'Test email failed'),
  });

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const dirtyCount = useMemo(
    () => Object.keys(buildChangedPayload()).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, original],
  );

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="h-4 bg-secondary rounded animate-pulse w-48" />
      </div>
    );
  }

  // Generic field renderer
  const Field = ({
    label,
    field,
    type = 'text',
    span = false,
    placeholder,
  }: {
    label: string;
    field: keyof FormState;
    type?: string;
    span?: boolean;
    placeholder?: string;
  }) => {
    const value = form[field] as string;
    return (
      <div className={span ? 'md:col-span-2' : ''}>
        <label className="text-xs text-muted-foreground">{label}</label>
        {editing ? (
          <input
            type={type}
            value={value ?? ''}
            placeholder={placeholder}
            onChange={(e) => set(field, e.target.value as any)}
            className={inputCls}
          />
        ) : (
          <p className="text-sm font-medium mt-0.5 break-words">{value || '—'}</p>
        )}
      </div>
    );
  };

  const TextArea = ({
    label,
    field,
    rows = 3,
  }: {
    label: string;
    field: keyof FormState;
    rows?: number;
  }) => (
    <div className="md:col-span-2">
      <label className="text-xs text-muted-foreground">{label}</label>
      {editing ? (
        <textarea
          value={(form[field] as string) ?? ''}
          rows={rows}
          onChange={(e) => set(field, e.target.value as any)}
          className={inputCls + ' resize-none'}
        />
      ) : (
        <p className="text-sm font-medium mt-0.5 whitespace-pre-wrap">
          {(form[field] as string) || '—'}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header / edit toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Company Settings</h1>
          <p className="text-xs text-muted-foreground">
            These details appear on invoices, payslips, and system emails.
          </p>
        </div>
        <button
          onClick={() => {
            if (editing) {
              setForm(original);
            }
            setEditing(!editing);
          }}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          {editing ? (
            <>
              <X className="h-3.5 w-3.5" /> Cancel
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </>
          )}
        </button>
      </div>

      {/* Company Profile */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">Company Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Company Name" field="name" />
          <Field label="Tagline" field="tagline" />
          <Field label="Email" field="email" type="email" />
          <Field label="Phone" field="phone" />
          <Field label="Website" field="website" placeholder="https://example.com" />
          <Field label="Logo URL" field="logo_url" placeholder="https://…/logo.png" />
          <Field label="Address Line 1" field="address_line1" span />
          <Field label="Address Line 2" field="address_line2" span />
          <Field label="City" field="city" />
          <Field label="State" field="state" />
          <Field label="Postal Code" field="postal_code" />
          <Field label="Country" field="country" />
        </div>
      </div>

      {/* Tax & Registration */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">Tax & Registration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="GST Number" field="gst_number" />
          <Field label="PAN Number" field="pan_number" />
          <Field label="Tax ID / VAT" field="tax_id" />
        </div>
      </div>

      {/* Bank Details */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">Bank Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Bank Name" field="bank_name" />
          <Field label="Account Number" field="bank_account" />
          <Field label="IFSC" field="bank_ifsc" />
          <Field label="SWIFT / BIC" field="bank_swift" />
        </div>
      </div>

      {/* Invoice Defaults */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">Invoice Defaults</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Invoice Prefix" field="invoice_prefix" placeholder="INV" />
          <div>
            <label className="text-xs text-muted-foreground">Currency</label>
            {editing ? (
              <select
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
                className={inputCls}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-medium mt-0.5">{form.currency}</p>
            )}
          </div>
          <TextArea label="Payment Terms" field="payment_terms" />
          <TextArea label="Default Invoice Notes" field="invoice_notes" />
        </div>
      </div>

      {/* SMTP Email */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4" /> SMTP Email
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Used to send invoices, payslips, and system alerts from your own mail server.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <span className="text-muted-foreground">Enabled</span>
            <input
              type="checkbox"
              disabled={!editing}
              checked={form.smtp_enabled}
              onChange={(e) => set('smtp_enabled', e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="SMTP Host" field="smtp_host" placeholder="smtp.example.com" />
          <Field label="SMTP Port" field="smtp_port" type="number" placeholder="587" />
          <Field label="SMTP Username" field="smtp_user" placeholder="user@example.com" />
          <Field label="From Address" field="smtp_from" placeholder="no-reply@example.com" />
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">SMTP Password</label>
            {editing ? (
              <input
                type="password"
                value={form.smtp_pass}
                onFocus={(e) => {
                  // If showing the mask, clear it on focus so user types a real value
                  if (e.target.value === PASSWORD_MASK) set('smtp_pass', '');
                }}
                onChange={(e) => set('smtp_pass', e.target.value)}
                placeholder={original.smtp_pass === PASSWORD_MASK ? 'Leave blank to keep current' : 'Enter password'}
                className={inputCls}
              />
            ) : (
              <p className="text-sm font-medium mt-0.5">
                {original.smtp_pass === PASSWORD_MASK ? PASSWORD_MASK : '—'}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Leave blank to keep the existing password. Only typed values are sent to the server.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => testSmtpMut.mutate()}
            disabled={testSmtpMut.isPending || !form.smtp_host}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/70 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {testSmtpMut.isPending ? 'Sending…' : 'Send Test Email'}
          </button>
        </div>
      </div>

      {editing && (
        <div className="flex items-center justify-end gap-2 sticky bottom-2">
          <span className="text-xs text-muted-foreground mr-auto">
            {dirtyCount === 0 ? 'No changes' : `${dirtyCount} field${dirtyCount === 1 ? '' : 's'} changed`}
          </span>
          <button
            onClick={() => {
              setForm(original);
              setEditing(false);
            }}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || dirtyCount === 0}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {saveMut.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
