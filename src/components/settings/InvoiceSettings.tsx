import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Building2, Save, Upload, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const inputCls =
  'w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

type InvoiceForm = {
  logo_url: string;
  name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  gst_number: string;
  pan_number: string;
  invoice_prefix: string;
  payment_terms: string;
  invoice_notes: string;
  bank_name: string;
  bank_account: string;
  bank_ifsc: string;
  bank_swift: string;
};

const empty: InvoiceForm = {
  logo_url: '', name: '', email: '', phone: '',
  address_line1: '', address_line2: '', city: '', state: '', postal_code: '', country: '',
  gst_number: '', pan_number: '',
  invoice_prefix: 'INV', payment_terms: 'Net 30', invoice_notes: '',
  bank_name: '', bank_account: '', bank_ifsc: '', bank_swift: '',
};

function hydrate(d: any): InvoiceForm {
  d = d || {};
  return {
    logo_url: d.logo_url ?? '',
    name: d.name ?? d.company_name ?? '',
    email: d.email ?? '',
    phone: d.phone ?? '',
    address_line1: d.address_line1 ?? d.address?.line1 ?? '',
    address_line2: d.address_line2 ?? d.address?.line2 ?? '',
    city: d.city ?? d.address?.city ?? '',
    state: d.state ?? d.address?.state ?? '',
    postal_code: d.postal_code ?? d.address?.postal_code ?? '',
    country: d.country ?? d.address?.country ?? '',
    gst_number: d.gst_number ?? '',
    pan_number: d.pan_number ?? d.pan ?? '',
    invoice_prefix: d.invoice_prefix ?? 'INV',
    payment_terms: d.payment_terms ?? '',
    invoice_notes: d.invoice_notes ?? '',
    bank_name: d.bank_name ?? '',
    bank_account: d.bank_account ?? '',
    bank_ifsc: d.bank_ifsc ?? d.ifsc ?? '',
    bank_swift: d.bank_swift ?? d.swift ?? '',
  };
}

// Defined OUTSIDE the parent component so its identity is stable across
// re-renders. Defining it inside would unmount/remount the input on every
// keystroke and steal focus from the user.
function Field({
  label,
  value,
  onChange,
  type = 'text',
  span = false,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  span?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className={span ? 'md:col-span-2' : ''}>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={inputCls}
      />
    </div>
  );
}

export default function InvoiceSettings() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [form, setForm] = useState<InvoiceForm>(empty);
  const [original, setOriginal] = useState<InvoiceForm>(empty);

  const { data, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => api.get('/company').then((r) => r.data?.data ?? r.data ?? {}),
  });

  useEffect(() => {
    if (data) {
      const h = hydrate(data);
      setForm(h);
      setOriginal(h);
    }
  }, [data]);

  const set = <K extends keyof InvoiceForm>(k: K, v: InvoiceForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const changed = useMemo(() => {
    const out: Record<string, any> = {};
    (Object.keys(form) as (keyof InvoiceForm)[]).forEach((k) => {
      if (form[k] !== original[k]) out[k] = form[k];
    });
    return out;
  }, [form, original]);

  const saveMut = useMutation({
    mutationFn: () => {
      if (Object.keys(changed).length === 0) return Promise.resolve({ noop: true } as any);
      return api.put('/company', changed);
    },
    onSuccess: (res: any) => {
      if (res?.noop) {
        toast('No changes to save');
        return;
      }
      qc.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Invoice settings saved');
    },
    onError: (e: any) => {
      if (e?.response?.status === 403) {
        toast.error('Only admins can update invoice settings');
      } else {
        toast.error(e?.response?.data?.message || 'Failed to save settings');
      }
    },
  });

  const onUploadLogo = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = res.data?.url || res.data?.data?.url || res.data?.file_url;
      if (url) {
        set('logo_url', url);
        toast.success('Logo uploaded');
      } else {
        toast.error('Upload succeeded but no URL returned');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upload failed — paste a URL instead');
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="h-4 bg-secondary rounded animate-pulse w-48" />
      </div>
    );
  }

  // NOTE: Field must NOT be defined inside this component — that would create a
  // new component identity on every render and remount the input on each keystroke,
  // causing the input to lose focus while typing. Use the top-level <Field /> below.

  const previewAddress = [form.address_line1, form.address_line2, form.city, form.state, form.postal_code, form.country]
    .filter(Boolean).join(', ');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold">Invoice Settings</h1>
        <p className="text-xs text-muted-foreground">
          These details appear on every invoice you send. {isAdmin ? '' : 'Only admins can edit.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Logo + identity */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-semibold">Company Identity</h2>

            <div>
              <label className="text-xs text-muted-foreground">Company Logo</label>
              <div className="mt-1 flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-secondary border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo preview" className="w-full h-full object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={form.logo_url}
                    onChange={(e) => set('logo_url', e.target.value)}
                    placeholder="https://…/logo.png"
                    disabled={!isAdmin}
                    className={inputCls}
                  />
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-xs cursor-pointer hover:bg-secondary/70">
                        Upload image
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && onUploadLogo(e.target.files[0])}
                        />
                      </label>
                      <span className="text-[11px] text-muted-foreground">or paste a URL above</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Company Name" value={form.name} onChange={(v) => set('name', v)} disabled={!isAdmin} />
              <Field label="Company Email" value={form.email} onChange={(v) => set('email', v)} disabled={!isAdmin} type="email" />
              <Field label="Company Phone" value={form.phone} onChange={(v) => set('phone', v)} disabled={!isAdmin} />
            </div>
          </div>

          {/* Address */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-semibold">Address</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Address Line 1" value={form.address_line1} onChange={(v) => set('address_line1', v)} disabled={!isAdmin} span />
              <Field label="Address Line 2" value={form.address_line2} onChange={(v) => set('address_line2', v)} disabled={!isAdmin} span />
              <Field label="City" value={form.city} onChange={(v) => set('city', v)} disabled={!isAdmin} />
              <Field label="State" value={form.state} onChange={(v) => set('state', v)} disabled={!isAdmin} />
              <Field label="Postal Code" value={form.postal_code} onChange={(v) => set('postal_code', v)} disabled={!isAdmin} />
              <Field label="Country" value={form.country} onChange={(v) => set('country', v)} disabled={!isAdmin} />
            </div>
          </div>

          {/* Tax */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-semibold">Tax Identifiers <span className="text-xs text-muted-foreground font-normal">(optional)</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="GST Number" value={form.gst_number} onChange={(v) => set('gst_number', v)} disabled={!isAdmin} />
              <Field label="PAN Number" value={form.pan_number} onChange={(v) => set('pan_number', v)} disabled={!isAdmin} />
            </div>
          </div>

          {/* Invoice defaults */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-semibold">Invoice Defaults</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Invoice Prefix" value={form.invoice_prefix} onChange={(v) => set('invoice_prefix', v)} disabled={!isAdmin} placeholder="INV" />
              <Field label="Default Payment Terms" value={form.payment_terms} onChange={(v) => set('payment_terms', v)} disabled={!isAdmin} placeholder="Net 30" />
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Invoice Footer Notes</label>
                <textarea
                  value={form.invoice_notes}
                  onChange={(e) => set('invoice_notes', e.target.value)}
                  rows={3}
                  disabled={!isAdmin}
                  placeholder="Thank you for your business…"
                  className={inputCls + ' resize-none'}
                />
              </div>
            </div>
          </div>

          {/* Bank */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-semibold">Bank Details <span className="text-xs text-muted-foreground font-normal">(optional)</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Bank Name" value={form.bank_name} onChange={(v) => set('bank_name', v)} disabled={!isAdmin} />
              <Field label="Account Number" value={form.bank_account} onChange={(v) => set('bank_account', v)} disabled={!isAdmin} />
              <Field label="IFSC" value={form.bank_ifsc} onChange={(v) => set('bank_ifsc', v)} disabled={!isAdmin} />
              <Field label="SWIFT / BIC" value={form.bank_swift} onChange={(v) => set('bank_swift', v)} disabled={!isAdmin} />
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center justify-end gap-2 sticky bottom-2">
              <span className="text-xs text-muted-foreground mr-auto">
                {Object.keys(changed).length === 0
                  ? 'No changes'
                  : `${Object.keys(changed).length} field${Object.keys(changed).length === 1 ? '' : 's'} changed`}
              </span>
              <button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || Object.keys(changed).length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saveMut.isPending ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-4 space-y-3">
            <h2 className="text-sm font-semibold">Live Invoice Preview</h2>
            <div className="rounded-2xl border border-border bg-white text-slate-900 p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt=""
                      className="w-full h-full object-contain"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    />
                  ) : (
                    <Building2 className="h-7 w-7 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold truncate">{form.name || 'Your Company Name'}</div>
                  {previewAddress && (
                    <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{previewAddress}</div>
                  )}
                  {(form.email || form.phone) && (
                    <div className="text-xs text-slate-600 mt-1">
                      {form.email}{form.email && form.phone ? ' · ' : ''}{form.phone}
                    </div>
                  )}
                  {(form.gst_number || form.pan_number) && (
                    <div className="text-[11px] text-slate-500 mt-2 space-y-0.5">
                      {form.gst_number && <div>GST: {form.gst_number}</div>}
                      {form.pan_number && <div>PAN: {form.pan_number}</div>}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Invoice #</span>
                  <span className="font-mono">{form.invoice_prefix || 'INV'}-000123</span>
                </div>
                {form.payment_terms && (
                  <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                    <span>Payment Terms</span>
                    <span>{form.payment_terms}</span>
                  </div>
                )}
              </div>

              {form.invoice_notes && (
                <div className="mt-4 pt-4 border-t border-slate-200 text-[11px] text-slate-500 whitespace-pre-wrap">
                  {form.invoice_notes}
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              This is how your company header will appear on every invoice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
