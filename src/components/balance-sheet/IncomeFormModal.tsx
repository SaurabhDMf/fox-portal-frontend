import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PAYMENT_METHODS } from '@/components/expenses/ExpenseFormModal';

export interface IncomeEntry {
  id?: string;
  title: string;
  source: string;
  amount: number;
  income_date: string;
  client_name?: string | null;
  payment_method?: string | null;
  reference_no?: string | null;
  notes?: string | null;
  lead_id?: string | null;
}

export const INCOME_SOURCES = [
  'Lead Closed',
  'Invoice Payment',
  'Retainer',
  'Consulting',
  'Refund Received',
  'Interest / Investment',
  'Other Income',
];

interface Props {
  open: boolean;
  onClose: () => void;
  income?: IncomeEntry | null;
}

export default function IncomeFormModal({ open, onClose, income }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<IncomeEntry>({
    title: '',
    source: INCOME_SOURCES[0],
    amount: 0,
    income_date: new Date().toISOString().slice(0, 10),
    client_name: '',
    payment_method: 'Bank Transfer',
    reference_no: '',
    notes: '',
  });

  useEffect(() => {
    if (income) {
      setForm({ ...income, income_date: income.income_date?.slice(0, 10) || new Date().toISOString().slice(0, 10) });
    } else {
      setForm({
        title: '', source: INCOME_SOURCES[0], amount: 0,
        income_date: new Date().toISOString().slice(0, 10),
        client_name: '', payment_method: 'Bank Transfer', reference_no: '', notes: '',
      });
    }
  }, [income, open]);

  const saveMut = useMutation({
    mutationFn: async (data: IncomeEntry) => {
      const payload = {
        ...data,
        amount: Number(data.amount) || 0,
        client_name: data.client_name || null,
        payment_method: data.payment_method || null,
        reference_no: data.reference_no || null,
        notes: data.notes || null,
        lead_id: data.lead_id || null,
      };
      if (income?.id) return api.put(`/income/${income.id}`, payload);
      return api.post('/income', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income'] });
      toast.success(income?.id ? 'Income updated' : 'Income added');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.amount || form.amount <= 0) return toast.error('Amount must be greater than 0');
    saveMut.mutate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card">
          <h2 className="text-lg font-semibold">{income?.id ? 'Edit Income' : 'Add Income'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded-md text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
                placeholder="e.g. Project advance from Acme Corp" required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source *</label>
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none">
                {INCOME_SOURCES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
                placeholder="0.00" required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date *</label>
              <input type="date" value={form.income_date} onChange={e => setForm({ ...form, income_date: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none" required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment Method</label>
              <select value={form.payment_method || ''} onChange={e => setForm({ ...form, payment_method: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none">
                {PAYMENT_METHODS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client / Payer</label>
              <input value={form.client_name || ''} onChange={e => setForm({ ...form, client_name: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
                placeholder="e.g. Acme Corp" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reference / Txn No</label>
              <input value={form.reference_no || ''} onChange={e => setForm({ ...form, reference_no: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
                placeholder="UTR / Receipt #" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
              <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
                placeholder="Additional details..." />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
            <button type="submit" disabled={saveMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saveMut.isPending ? 'Saving...' : income?.id ? 'Update Income' : 'Add Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
