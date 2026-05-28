import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Pencil, Trash2, ArrowDownRight, TrendingDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import ExpenseFormModal, { type Expense, EXPENSE_CATEGORIES } from '@/components/expenses/ExpenseFormModal';

const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Expense Sheet — OUTGOING payments only.
 * - Lists expense entries (sorted by date desc)
 * - Filter by year / month / category, plus search
 * - Add/edit/delete via ExpenseFormModal
 */
export default function ExpenseSheet() {
  const qc = useQueryClient();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number | 'all'>('all');
  const [category, setCategory] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');

  const [expenseModal, setExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const { data: expensesData = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get('/expenses').then((r) => r.data?.expenses || r.data || []),
  });
  const expenses: Expense[] = Array.isArray(expensesData) ? expensesData : [];

  const inRange = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (d.getFullYear() !== year) return false;
    if (month !== 'all' && d.getMonth() !== month) return false;
    return true;
  };

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter((e) => inRange(e.expense_date))
      .filter((e) => category === 'all' || e.category === category)
      .filter(
        (e) =>
          !q ||
          (e.title || '').toLowerCase().includes(q) ||
          (e.category || '').toLowerCase().includes(q) ||
          (e.vendor || '').toLowerCase().includes(q),
      );
  }, [expenses, year, month, category, search]);

  const totalExpense = useMemo(
    () => filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    [filteredExpenses],
  );

  // Per-category totals (helps user see where money's going)
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    filteredExpenses.forEach((e) => {
      const cat = e.category || 'Uncategorized';
      m.set(cat, (m.get(cat) || 0) + Number(e.amount || 0));
    });
    return Array.from(m.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  const deleteExpense = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete'),
  });

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const periodLabel =
    month === 'all'
      ? `${year}`
      : `${new Date(2000, month, 1).toLocaleString('default', { month: 'long' })} ${year}`;

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ArrowDownRight className="h-5 w-5 text-destructive" /> Expense Sheet
          </h1>
          <p className="page-subtitle">
            All outgoing payments · <span className="text-foreground font-medium">{periodLabel}</span>
          </p>
        </div>
        <button
          onClick={() => {
            setEditingExpense(null);
            setExpenseModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-all"
        >
          <ArrowDownRight className="h-4 w-4" /> Add Expense
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-3 flex flex-wrap items-center gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
        >
          <option value="all">All Months</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i}>
              {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
        >
          <option value="all">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Total + category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-destructive" />
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-destructive/5" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                Total Expenses — {periodLabel}
              </p>
              <p className="text-3xl font-bold mt-1 text-destructive">{fmtINR(totalExpense)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredExpenses.length} {filteredExpenses.length === 1 ? 'entry' : 'entries'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-destructive/10">
              <TrendingDown className="h-6 w-6 text-destructive" />
            </div>
          </div>
        </div>

        <div className="glass-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-3">By Category</h3>
          {byCategory.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 italic">No expenses to break down.</p>
          ) : (
            <div className="space-y-2">
              {byCategory.slice(0, 6).map(({ category, total }) => {
                const pct = totalExpense > 0 ? (total / totalExpense) * 100 : 0;
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-foreground font-medium">{category}</span>
                      <span className="text-muted-foreground">
                        {fmtINR(total)} <span className="text-[10px] opacity-70">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-destructive/70 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {byCategory.length > 6 && (
                <p className="text-[11px] text-muted-foreground/70 italic pt-1">
                  +{byCategory.length - 6} more categories
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-sm focus:border-primary focus:outline-none transition-colors"
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          Showing <span className="text-foreground font-semibold">{filteredExpenses.length}</span> of {expenses.length}
        </span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-left px-4 py-3 font-medium">Vendor</th>
                <th className="text-left px-4 py-3 font-medium">Method</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                      <div className="p-3 rounded-full bg-destructive/10 mb-3">
                        <ArrowDownRight className="h-6 w-6 text-destructive" />
                      </div>
                      <p className="text-sm font-medium">No expense entries</p>
                      <p className="text-xs mt-1">Add an expense to track outflows</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-border hover:bg-secondary/20 transition-colors group"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {e.expense_date?.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 font-medium">{e.title}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.vendor || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.payment_method || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-destructive whitespace-nowrap">
                      -{fmtINR(Number(e.amount || 0))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingExpense(e);
                            setExpenseModal(true);
                          }}
                          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => e.id && deleteExpense.mutate(e.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExpenseFormModal
        open={expenseModal}
        onClose={() => setExpenseModal(false)}
        expense={editingExpense}
      />
    </div>
  );
}
