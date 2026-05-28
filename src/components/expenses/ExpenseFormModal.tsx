import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Expense {
  id?: string;
  title: string;
  category: string;
  amount: number;
  expense_date: string;
  vendor?: string | null;
  payment_method?: string | null;
  reference_no?: string | null;
  notes?: string | null;
  attachment_url?: string | null;
}

export const EXPENSE_CATEGORIES = [
  'Office Rent',
  'Utilities',
  'Software & Subscriptions',
  'Marketing & Ads',
  'Travel',
  'Meals & Entertainment',
  'Equipment & Hardware',
  'Office Supplies',
  'Professional Services',
  'Internet & Phone',
  'Taxes & Fees',
  'Bank Charges',
  'Contractor Payments',
  'Miscellaneous',
];

export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Credit Card', 'Debit Card', 'Cheque', 'Other'];

interface Props {
  open: boolean;
  onClose: () => void;
  expense?: Expense | null;
}

export default function ExpenseFormModal({ open, onClose, expense }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Expense>({
    title: '',
    category: EXPENSE_CATEGORIES[0],
    amount: 0,
    expense_date: new Date().toISOString().slice(0, 10),
    vendor: '',
    payment_method: 'Bank Transfer',
    reference_no: '',
    notes: '',
    attachment_url: '',
  });

  useEffect(() => {
    if (expense) {
      setForm({
        ...expense,
        expense_date: expense.expense_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      });
    } else {
      setForm({
        title: '',
        category: EXPENSE_CATEGORIES[0],
        amount: 0,
        expense_date: new Date().toISOString().slice(0, 10),
        vendor: '',
        payment_method: 'Bank Transfer',
        reference_no: '',
        notes: '',
        attachment_url: '',
      });
    }
  }, [expense, open]);

  const saveMut = useMutation({
    mutationFn: async (data: Expense) => {
      const payload = {
        ...data,
        amount: Number(data.amount) || 0,
        vendor: data.vendor || null,
        payment_method: data.payment_method || null,
        reference_no: data.reference_no || null,
        notes: data.notes || null,
        attachment_url: data.attachment_url || null,
      };
      if (expense?.id) return api.put(`/expenses/${expense.id}`, payload);
      return api.post('/expenses', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success(expense?.id ? 'Expense updated' : 'Expense added');
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
          <h2 className="text-lg font-semibold">{expense?.id ? 'Edit Expense' : 'Add Expense'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded-md text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
                placeholder="e.g. AWS monthly bill" required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category *</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
                placeholder="0.00" required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expense Date *</label>
              <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })}
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
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendor / Paid To</label>
              <input value={form.vendor || ''} onChange={e => setForm({ ...form, vendor: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
                placeholder="e.g. Amazon Web Services" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reference / Invoice No</label>
              <input value={form.reference_no || ''} onChange={e => setForm({ ...form, reference_no: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
                placeholder="INV-1234" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Attachment URL</label>
              <input value={form.attachment_url || ''} onChange={e => setForm({ ...form, attachment_url: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
                placeholder="https://... (receipt or bill)" />
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
              {saveMut.isPending ? 'Saving...' : expense?.id ? 'Update Expense' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
