import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, Receipt, TrendingDown, Calendar, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useModulePermission } from '@/hooks/usePermission';
import ExpenseFormModal, { type Expense, EXPENSE_CATEGORIES } from '@/components/expenses/ExpenseFormModal';

export default function Expenses() {
  const perm = useModulePermission('expenses' as any);
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState(''); // YYYY-MM
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get('/expenses').then(r => r.data?.expenses || r.data || []),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete'),
  });

  const expenses: Expense[] = Array.isArray(data) ? data : [];

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (search && !`${e.title} ${e.vendor || ''} ${e.notes || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (monthFilter && !(e.expense_date || '').startsWith(monthFilter)) return false;
      return true;
    }).sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || ''));
  }, [expenses, search, categoryFilter, monthFilter]);

  const totals = useMemo(() => {
    const now = new Date();
    const ymThis = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const yThis = `${now.getFullYear()}`;
    let mTotal = 0, yTotal = 0, allTotal = 0;
    expenses.forEach(e => {
      const amt = Number(e.amount || 0);
      allTotal += amt;
      if ((e.expense_date || '').startsWith(ymThis)) mTotal += amt;
      if ((e.expense_date || '').startsWith(yThis)) yTotal += amt;
    });
    return { mTotal, yTotal, allTotal, count: expenses.length };
  }, [expenses]);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (e: Expense) => { setEditing(e); setModalOpen(true); };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track and manage business expenses</p>
        </div>
        {(perm.canCreate ?? true) && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> Add Expense
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">This Month</p>
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold mt-1">{fmt(totals.mTotal)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">This Year</p>
            <TrendingDown className="h-4 w-4 text-warning" />
          </div>
          <p className="text-2xl font-bold mt-1">{fmt(totals.yTotal)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">All Time</p>
            <Receipt className="h-4 w-4 text-destructive" />
          </div>
          <p className="text-2xl font-bold mt-1">{fmt(totals.allTotal)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Entries</p>
          <p className="text-2xl font-bold mt-1">{totals.count}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title, vendor, notes..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none" />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none">
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none" />
        {(search || categoryFilter || monthFilter) && (
          <button onClick={() => { setSearch(''); setCategoryFilter(''); setMonthFilter(''); }}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Vendor</th>
                <th className="text-left px-4 py-3">Method</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">
                  No expenses found. {(perm.canCreate ?? true) && <button onClick={openNew} className="text-primary hover:underline">Add your first expense</button>}
                </td></tr>
              ) : (
                filtered.map(e => (
                  <tr key={e.id} className="border-t border-border hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{e.expense_date?.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{e.title}</div>
                      {e.reference_no && <div className="text-xs text-muted-foreground">Ref: {e.reference_no}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs">{e.category}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.vendor || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.payment_method || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(Number(e.amount || 0))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {e.attachment_url && (
                          <a href={e.attachment_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="View attachment">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        {(perm.canEdit ?? true) && (
                          <button onClick={() => openEdit(e)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {(perm.canDelete ?? true) && (
                          <button onClick={() => e.id && deleteMut.mutate(e.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExpenseFormModal open={modalOpen} onClose={() => setModalOpen(false)} expense={editing} />
    </div>
  );
}
