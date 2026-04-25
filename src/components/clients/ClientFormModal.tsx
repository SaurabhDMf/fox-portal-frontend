import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const industries = ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Services', 'Other'];
const clientTypes = ['New', 'Active', 'Inactive', 'VIP', 'At-Risk'];

const inputCls = 'px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

export interface ClientFormData {
  company_name: string;
  industry: string;
  client_type: string;
  website: string;
  contact_name: string;
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
  account_manager_id: string;
}

const emptyForm: ClientFormData = {
  company_name: '', industry: '', client_type: 'New', website: '',
  contact_name: '', email: '', phone: '',
  address_line1: '', address_line2: '', city: '', state: '', postal_code: '', country: 'India',
  gst_number: '', pan_number: '', account_manager_id: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ClientFormData) => void;
  isPending: boolean;
  users: { id: string; full_name: string; role?: string; job_title?: string }[];
  initial?: Partial<ClientFormData>;
  isEdit?: boolean;
}

export default function ClientFormModal({ open, onClose, onSubmit, isPending, users, initial, isEdit }: Props) {
  const [form, setForm] = useState<ClientFormData>({ ...emptyForm });

  useEffect(() => {
    if (open) setForm({ ...emptyForm, ...initial });
  }, [open, initial]);

  if (!open) return null;

  const set = (field: keyof ClientFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const sectionLabel = (text: string) => (
    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider pt-2">{text}</p>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-3 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Client' : 'Add Client'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {sectionLabel('Basic Info')}
        <input placeholder="Company Name" value={form.company_name} onChange={set('company_name')} className={`w-full ${inputCls}`} />
        <div className="grid grid-cols-2 gap-3">
          <select value={form.industry} onChange={set('industry')} className={inputCls}>
            <option value="">Select Industry</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <select value={form.client_type} onChange={set('client_type')} className={inputCls}>
            {clientTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <input placeholder="Website URL" value={form.website} onChange={set('website')} className={`w-full ${inputCls}`} />

        {sectionLabel('Contact')}
        <input placeholder="Contact Person Name" value={form.contact_name} onChange={set('contact_name')} className={`w-full ${inputCls}`} />
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Email Address" type="email" value={form.email} onChange={set('email')} className={inputCls} />
          <input placeholder="Phone Number" type="tel" value={form.phone} onChange={set('phone')} className={inputCls} />
        </div>

        {sectionLabel('Billing Address')}
        <input placeholder="Address Line 1" value={form.address_line1} onChange={set('address_line1')} className={`w-full ${inputCls}`} />
        <input placeholder="Address Line 2" value={form.address_line2} onChange={set('address_line2')} className={`w-full ${inputCls}`} />
        <div className="grid grid-cols-3 gap-3">
          <input placeholder="City" value={form.city} onChange={set('city')} className={inputCls} />
          <input placeholder="State" value={form.state} onChange={set('state')} className={inputCls} />
          <input placeholder="Postal Code" value={form.postal_code} onChange={set('postal_code')} className={inputCls} />
        </div>
        <input placeholder="Country" value={form.country} onChange={set('country')} className={`w-full ${inputCls}`} />

        {sectionLabel('Tax Info')}
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="GST Number" value={form.gst_number} onChange={set('gst_number')} className={inputCls} />
          <input placeholder="PAN Number" value={form.pan_number} onChange={set('pan_number')} className={inputCls} />
        </div>

        {sectionLabel('Assignment')}
        <select value={form.account_manager_id} onChange={set('account_manager_id')} className={`w-full ${inputCls}`}>
          <option value="">Select Sales Representative</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {isPending ? 'Saving...' : isEdit ? 'Update Client' : 'Add Client'}
          </button>
        </div>
      </div>
    </div>
  );
}
