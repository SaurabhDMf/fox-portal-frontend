import { useState, useEffect } from 'react';
import { X, Globe, Eye, EyeOff } from 'lucide-react';

const categories = ['Login', 'API Key', 'Database', 'SSH', 'Other'];

function getStrength(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak', color: 'bg-destructive', width: '20%' };
  if (score <= 2) return { label: 'Fair', color: 'bg-[hsl(var(--warning))]', width: '40%' };
  if (score <= 3) return { label: 'Good', color: 'bg-[hsl(var(--info))]', width: '60%' };
  if (score <= 4) return { label: 'Strong', color: 'bg-[hsl(var(--success))]', width: '80%' };
  return { label: 'Very Strong', color: 'bg-[hsl(var(--success))]', width: '100%' };
}

export interface CredentialForm {
  title: string;
  username: string;
  password: string;
  url: string;
  category: string;
  notes: string;
  folder_id: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CredentialForm) => void;
  isPending: boolean;
  folders: { id: string; name: string }[];
  initial?: Partial<CredentialForm>;
  isEdit?: boolean;
}

export default function VaultCredentialModal({ open, onClose, onSubmit, isPending, folders, initial, isEdit }: Props) {
  const [form, setForm] = useState<CredentialForm>({ title: '', username: '', password: '', url: '', category: 'Other', notes: '', folder_id: '' });
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (open && initial) setForm({ title: initial.title || '', username: initial.username || '', password: initial.password || '', url: initial.url || '', category: initial.category || 'Other', notes: initial.notes || '', folder_id: initial.folder_id || '' });
    else if (open) setForm({ title: '', username: '', password: '', url: '', category: 'Other', notes: '', folder_id: '' });
  }, [open, initial]);

  if (!open) return null;
  const strength = getStrength(form.password);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Credential' : 'Add Credential'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <input placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Username / Email *" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <div className="space-y-1">
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} placeholder="Password *" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2 pr-9 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.password && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden"><div className={`h-full ${strength.color} rounded-full transition-all`} style={{ width: strength.width }} /></div>
                <span className="text-[10px] text-muted-foreground">{strength.label}</span>
              </div>
            )}
          </div>
        </div>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input placeholder="URL (optional)" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="w-full pl-10 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={form.folder_id} onChange={e => setForm(f => ({ ...f, folder_id: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">No Folder</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={isPending || !form.title || !form.username} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {isPending ? 'Saving...' : isEdit ? 'Update' : 'Save Credential'}
          </button>
        </div>
      </div>
    </div>
  );
}
