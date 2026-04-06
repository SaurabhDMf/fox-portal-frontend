import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Pencil, X, Upload } from 'lucide-react';

const inputCls = 'w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

const defaultForm = {
  company_name: '', email: '', phone: '',
  address_line1: '', address_line2: '', city: '', state: '', postal_code: '', country: '',
  gst_number: '', pan: '', logo_url: '',
  bank_name: '', bank_account: '', ifsc: '',
  invoice_prefix: 'INV', default_currency: 'USD', payment_terms: 'Net 30', invoice_notes: '',
};

export default function CompanySettings() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const { data, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => api.get('/company').then(r => r.data),
  });

  useEffect(() => {
    if (data) {
      setForm({
        company_name: data.company_name || '',
        email: data.email || '',
        phone: data.phone || '',
        address_line1: data.address_line1 || data.address?.line1 || '',
        address_line2: data.address_line2 || data.address?.line2 || '',
        city: data.city || data.address?.city || '',
        state: data.state || data.address?.state || '',
        postal_code: data.postal_code || data.address?.postal_code || '',
        country: data.country || data.address?.country || '',
        gst_number: data.gst_number || '',
        pan: data.pan || '',
        logo_url: data.logo_url || '',
        bank_name: data.bank_name || '',
        bank_account: data.bank_account || '',
        ifsc: data.ifsc || '',
        invoice_prefix: data.invoice_prefix || 'INV',
        default_currency: data.default_currency || 'USD',
        payment_terms: data.payment_terms || 'Net 30',
        invoice_notes: data.invoice_notes || '',
      });
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => api.put('/company', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Company settings saved');
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error saving'),
  });

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  if (isLoading) return <div className="glass-card p-6"><div className="h-4 bg-secondary rounded animate-pulse w-48" /></div>;

  const Field = ({ label, field, type = 'text', span = false }: { label: string; field: string; type?: string; span?: boolean }) => (
    <div className={span ? 'md:col-span-2' : ''}>
      <label className="text-xs text-muted-foreground">{label}</label>
      {editing ? (
        <input type={type} value={(form as any)[field]} onChange={e => set(field, e.target.value)} className={inputCls} />
      ) : (
        <p className="text-sm font-medium mt-0.5">{(form as any)[field] || '—'}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Company Information</h2>
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
            {editing ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Company Name" field="company_name" />
          <Field label="Email" field="email" type="email" />
          <Field label="Phone" field="phone" />
          <Field label="Logo URL" field="logo_url" />
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">Address</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Address Line 1" field="address_line1" span />
          <Field label="Address Line 2" field="address_line2" span />
          <Field label="City" field="city" />
          <Field label="State" field="state" />
          <Field label="Postal Code" field="postal_code" />
          <Field label="Country" field="country" />
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">Tax Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="GST Number" field="gst_number" />
          <Field label="PAN" field="pan" />
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">Bank Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Bank Name" field="bank_name" />
          <Field label="Account Number" field="bank_account" />
          <Field label="IFSC Code" field="ifsc" />
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">Invoice Defaults</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Invoice Prefix" field="invoice_prefix" />
          <div>
            <label className="text-xs text-muted-foreground">Default Currency</label>
            {editing ? (
              <select value={form.default_currency} onChange={e => set('default_currency', e.target.value)} className={inputCls}>
                {['USD', 'EUR', 'GBP', 'INR', 'AED'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <p className="text-sm font-medium mt-0.5">{form.default_currency}</p>
            )}
          </div>
          <Field label="Payment Terms" field="payment_terms" />
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Default Invoice Notes</label>
            {editing ? (
              <textarea value={form.invoice_notes} onChange={e => set('invoice_notes', e.target.value)} rows={3} className={inputCls + ' resize-none'} />
            ) : (
              <p className="text-sm font-medium mt-0.5 whitespace-pre-wrap">{form.invoice_notes || '—'}</p>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {saveMut.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
