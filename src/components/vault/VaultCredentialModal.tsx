import { useState, useEffect } from 'react';
import { X, Globe, Eye, EyeOff, Lock, FileText, CreditCard, User } from 'lucide-react';
import PasswordGenerator from './PasswordGenerator';

const ITEM_TYPES = [
  { id: 'login',        label: 'Login',        icon: Lock },
  { id: 'secure_note',  label: 'Secure Note',  icon: FileText },
  { id: 'payment_card', label: 'Payment Card', icon: CreditCard },
  { id: 'identity',     label: 'Identity',     icon: User },
];

function getStrength(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak',      color: 'bg-destructive',             width: '20%' };
  if (score <= 2) return { label: 'Fair',      color: 'bg-orange-500',              width: '40%' };
  if (score <= 3) return { label: 'Good',      color: 'bg-yellow-500',              width: '60%' };
  if (score <= 4) return { label: 'Strong',    color: 'bg-[hsl(var(--success))]',   width: '80%' };
  return             { label: 'Very Strong', color: 'bg-[hsl(var(--success))]',   width: '100%' };
}

export interface CredentialForm {
  item_type: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  folder_id: string;
  // secure note
  note_body: string;
  // payment card
  cardholder_name: string;
  card_number: string;
  expiry: string;
  cvv: string;
  // identity
  full_name: string;
  email: string;
  phone: string;
  address: string;
}

const EMPTY: CredentialForm = {
  item_type: 'login', title: '', username: '', password: '', url: '', notes: '', folder_id: '',
  note_body: '', cardholder_name: '', card_number: '', expiry: '', cvv: '',
  full_name: '', email: '', phone: '', address: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CredentialForm) => void;
  isPending: boolean;
  folders: { id: string; name: string }[];
  initial?: Partial<CredentialForm>;
  isEdit?: boolean;
}

const input = "w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

export default function VaultCredentialModal({ open, onClose, onSubmit, isPending, folders, initial, isEdit }: Props) {
  const [form, setForm]       = useState<CredentialForm>(EMPTY);
  const [showPw, setShowPw]   = useState(false);
  const [showGen, setShowGen] = useState(false);

  useEffect(() => {
    if (open) setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
    setShowGen(false);
  }, [open, initial]);

  if (!open) return null;

  const set = (k: keyof CredentialForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const strength = getStrength(form.password);
  const type = form.item_type;

  const canSubmit = form.title.trim() && (
    type === 'login'        ? (form.username.trim() || form.password) :
    type === 'secure_note'  ? form.note_body.trim() :
    type === 'payment_card' ? form.cardholder_name.trim() :
    type === 'identity'     ? form.full_name.trim() : true
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Item' : 'Add Item'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {/* Type selector (only on create) */}
        {!isEdit && (
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-secondary rounded-xl">
            {ITEM_TYPES.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setForm(f => ({ ...EMPTY, item_type: t.id, title: f.title, folder_id: f.folder_id }))}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium transition-colors ${type === t.id ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Title + folder (all types) */}
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Title *" value={form.title} onChange={set('title')} className={input} />
          <select value={form.folder_id} onChange={set('folder_id')} className={input}>
            <option value="">No Folder</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {/* ── Login fields ── */}
        {type === 'login' && (<>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Username / Email" value={form.username} onChange={set('username')} className={input} />
            <div className="space-y-1">
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={set('password')} className={`${input} pr-9`} />
                <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.password && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full ${strength.color} rounded-full transition-all`} style={{ width: strength.width }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{strength.label}</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setShowGen(p => !p)} className="text-xs text-primary hover:underline text-left">
            {showGen ? 'Hide generator' : '⚡ Generate strong password'}
          </button>
          {showGen && (
            <PasswordGenerator onUse={pw => { setForm(f => ({ ...f, password: pw })); setShowGen(false); }} onClose={() => setShowGen(false)} />
          )}
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input placeholder="Website URL (optional)" value={form.url} onChange={set('url')} className={`${input} pl-10`} />
          </div>
          <textarea placeholder="Notes (optional)" value={form.notes} onChange={set('notes')} rows={2} className={`${input} resize-none`} />
        </>)}

        {/* ── Secure Note fields ── */}
        {type === 'secure_note' && (
          <textarea placeholder="Note content *" value={form.note_body} onChange={set('note_body')} rows={6} className={`${input} resize-none`} />
        )}

        {/* ── Payment Card fields ── */}
        {type === 'payment_card' && (<>
          <input placeholder="Cardholder name *" value={form.cardholder_name} onChange={set('cardholder_name')} className={input} />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Card number" value={form.card_number} onChange={set('card_number')} maxLength={19} className={input} />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="MM/YY" value={form.expiry} onChange={set('expiry')} maxLength={5} className={input} />
              <input placeholder="CVV" value={form.cvv} onChange={set('cvv')} maxLength={4} className={input} />
            </div>
          </div>
          <textarea placeholder="Notes (optional)" value={form.notes} onChange={set('notes')} rows={2} className={`${input} resize-none`} />
        </>)}

        {/* ── Identity fields ── */}
        {type === 'identity' && (<>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Full name *" value={form.full_name} onChange={set('full_name')} className={input} />
            <input placeholder="Email" value={form.email} onChange={set('email')} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Phone" value={form.phone} onChange={set('phone')} className={input} />
            <input placeholder="Address" value={form.address} onChange={set('address')} className={input} />
          </div>
          <textarea placeholder="Notes (optional)" value={form.notes} onChange={set('notes')} rows={2} className={`${input} resize-none`} />
        </>)}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={isPending || !canSubmit} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {isPending ? 'Saving…' : isEdit ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
