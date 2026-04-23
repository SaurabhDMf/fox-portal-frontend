import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, Download, ArrowUpRight, ArrowDownRight, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import IncomeFormModal, { type IncomeEntry, INCOME_SOURCES } from '@/components/balance-sheet/IncomeFormModal';
import ImportLeadsModal from '@/components/balance-sheet/ImportLeadsModal';
import BankStatementImportModal from '@/components/balance-sheet/BankStatementImportModal';
import ExpenseFormModal, { type Expense, EXPENSE_CATEGORIES } from '@/components/expenses/ExpenseFormModal';

type Tab = 'overview' | 'income' | 'expenses';

const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const tooltipStyle = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'hsl(var(--foreground))',
  },
};

export default function BalanceSheet() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');

  const [incomeModal, setIncomeModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [importModal, setImportModal] = useState(false);
  const [bankImportModal, setBankImportModal] = useState(false);

  const [expenseModal, setExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const { data: incomeData = [] } = useQuery({
    queryKey: ['income'],
    queryFn: () => api.get('/income').then(r => r.data?.income || r.data || []),
  });
  const { data: expensesData = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get('/expenses').then(r => r.data?.expenses || r.data || []),
  });

  const incomes: IncomeEntry[] = Array.isArray(incomeData) ? incomeData : [];
  const expenses: Expense[] = Array.isArray(expensesData) ? expensesData : [];

  const importedLeadIds = useMemo(() =>
    new Set(incomes.filter(i => i.lead_id).map(i => String(i.lead_id))),
  [incomes]);

  const inRange = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if (d.getFullYear() !== year) return false;
    if (month !== 'all' && d.getMonth() !== month) return false;
    return true;
  };

  const filteredIncome = useMemo(() => incomes
    .filter(i => inRange(i.income_date))
    .filter(i => !search || `${i.title} ${i.client_name || ''} ${i.notes || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.income_date || '').localeCompare(a.income_date || '')),
  [incomes, year, month, search]);

  const filteredExpenses = useMemo(() => expenses
    .filter(e => inRange(e.expense_date))
    .filter(e => !search || `${e.title} ${e.vendor || ''} ${e.notes || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || '')),
  [expenses, year, month, search]);

  const totalIncome = filteredIncome.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalExpense = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;

  const monthlyComparison = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i, 1).toLocaleString('default', { month: 'short' }),
      income: 0,
      expense: 0,
    }));
    incomes.forEach(i => {
      const d = new Date(i.income_date);
      if (d.getFullYear() === year) months[d.getMonth()].income += Number(i.amount || 0);
    });
    expenses.forEach(e => {
      const d = new Date(e.expense_date);
      if (d.getFullYear() === year) months[d.getMonth()].expense += Number(e.amount || 0);
    });
    return months;
  }, [incomes, expenses, year]);

  const deleteIncome = useMutation({
    mutationFn: (id: string) => api.delete(`/income/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['income'] }); toast.success('Income deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete'),
  });
  const deleteExpense = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete'),
  });

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const TabBtn = ({ id, label, count }: { id: Tab; label: string; count?: number }) => (
    <button onClick={() => setTab(id)}
      className={`relative px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-2 ${
        tab === id
          ? 'text-primary'
          : 'text-muted-foreground hover:text-foreground'
      }`}>
      {label}
      {typeof count === 'number' && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
          tab === id ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
        }`}>{count}</span>
      )}
      {tab === id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
    </button>
  );

  const periodLabel = month === 'all'
    ? `${year}`
    : `${new Date(2000, month, 1).toLocaleString('default', { month: 'long' })} ${year}`;

  return (
    <div className="page-container">
      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Input Sheet</h1>
          <p className="page-subtitle">Track income, expenses, and net balance · <span className="text-foreground font-medium">{periodLabel}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => { setEditingIncome(null); setIncomeModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success/15 text-success text-sm font-medium hover:bg-success/25 transition-all">
            <ArrowUpRight className="h-4 w-4" /> Income
          </button>
          <button onClick={() => { setEditingExpense(null); setExpenseModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive/15 text-destructive text-sm font-medium hover:bg-destructive/25 transition-all">
            <ArrowDownRight className="h-4 w-4" /> Expense
          </button>
        </div>
      </div>

      {/* Toolbar: filters + import actions */}
      <div className="glass-card p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 mr-auto">
          <select value={month} onChange={e => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none">
            <option value="all">All Months</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>{new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={() => setBankImportModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-all">
          <Upload className="h-4 w-4" /> Upload Statement
        </button>
        <button onClick={() => setImportModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm hover:bg-secondary/80 transition-all">
          <Download className="h-4 w-4" /> Import Won Leads
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 relative overflow-hidden group hover:shadow-lg transition-shadow">
          <div className="absolute inset-y-0 left-0 w-1 bg-success" />
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-success/5 group-hover:bg-success/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Total Income</p>
              <div className="p-1.5 rounded-lg bg-success/10"><TrendingUp className="h-4 w-4 text-success" /></div>
            </div>
            <p className="text-2xl font-bold mt-2 text-success">{fmtINR(totalIncome)}</p>
            <p className="text-xs text-muted-foreground mt-1">{filteredIncome.length} {filteredIncome.length === 1 ? 'entry' : 'entries'}</p>
          </div>
        </div>
        <div className="glass-card p-5 relative overflow-hidden group hover:shadow-lg transition-shadow">
          <div className="absolute inset-y-0 left-0 w-1 bg-destructive" />
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-destructive/5 group-hover:bg-destructive/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Total Expenses</p>
              <div className="p-1.5 rounded-lg bg-destructive/10"><TrendingDown className="h-4 w-4 text-destructive" /></div>
            </div>
            <p className="text-2xl font-bold mt-2 text-destructive">{fmtINR(totalExpense)}</p>
            <p className="text-xs text-muted-foreground mt-1">{filteredExpenses.length} {filteredExpenses.length === 1 ? 'entry' : 'entries'}</p>
          </div>
        </div>
        <div className="glass-card p-5 relative overflow-hidden group hover:shadow-lg transition-shadow">
          <div className={`absolute inset-y-0 left-0 w-1 ${netBalance >= 0 ? 'bg-primary' : 'bg-warning'}`} />
          <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${netBalance >= 0 ? 'bg-primary/5 group-hover:bg-primary/10' : 'bg-warning/5 group-hover:bg-warning/10'} transition-colors`} />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Net Balance</p>
              <div className={`p-1.5 rounded-lg ${netBalance >= 0 ? 'bg-primary/10' : 'bg-warning/10'}`}>
                <Wallet className={`h-4 w-4 ${netBalance >= 0 ? 'text-primary' : 'text-warning'}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold mt-2 ${netBalance >= 0 ? 'text-primary' : 'text-warning'}`}>{fmtINR(netBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">{netBalance >= 0 ? '↑ Profit' : '↓ Loss'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <TabBtn id="overview" label="Overview" />
        <TabBtn id="income" label="Income" count={filteredIncome.length} />
        <TabBtn id="expenses" label="Expenses" count={filteredExpenses.length} />
      </div>

      {tab === 'overview' && (
        <>
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold mb-4">Income vs Expenses — Monthly ({year})</h2>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={monthlyComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => fmtINR(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill="hsl(157, 87%, 46%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="hsl(4, 100%, 64%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3">Recent Income</h3>
              <div className="space-y-2">
                {filteredIncome.slice(0, 5).map(i => (
                  <div key={i.id} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{i.title}</p>
                      <p className="text-xs text-muted-foreground">{i.income_date?.slice(0, 10)} · {i.source}</p>
                    </div>
                    <span className="text-sm font-semibold text-success whitespace-nowrap ml-2">+{fmtINR(Number(i.amount || 0))}</span>
                  </div>
                ))}
                {filteredIncome.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No income entries</p>}
              </div>
            </div>
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3">Recent Expenses</h3>
              <div className="space-y-2">
                {filteredExpenses.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.expense_date?.slice(0, 10)} · {e.category}</p>
                    </div>
                    <span className="text-sm font-semibold text-destructive whitespace-nowrap ml-2">-{fmtINR(Number(e.amount || 0))}</span>
                  </div>
                ))}
                {filteredExpenses.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No expense entries</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {(tab === 'income' || tab === 'expenses') && (
        <div className="glass-card p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none" />
          </div>
        </div>
      )}

      {tab === 'income' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3">Source</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Method</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncome.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No income entries</td></tr>
                ) : filteredIncome.map(i => (
                  <tr key={i.id} className="border-t border-border hover:bg-secondary/20">
                    <td className="px-4 py-3 whitespace-nowrap">{i.income_date?.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-medium">
                      {i.title}
                      {i.lead_id && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">CRM</span>}
                    </td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-md bg-success/10 text-success text-xs">{i.source}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{i.client_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.payment_method || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-success">+{fmtINR(Number(i.amount || 0))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditingIncome(i); setIncomeModal(true); }} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => i.id && deleteIncome.mutate(i.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
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
                {filteredExpenses.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No expense entries</td></tr>
                ) : filteredExpenses.map(e => (
                  <tr key={e.id} className="border-t border-border hover:bg-secondary/20">
                    <td className="px-4 py-3 whitespace-nowrap">{e.expense_date?.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-medium">{e.title}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs">{e.category}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{e.vendor || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.payment_method || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-destructive">-{fmtINR(Number(e.amount || 0))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditingExpense(e); setExpenseModal(true); }} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => e.id && deleteExpense.mutate(e.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <IncomeFormModal open={incomeModal} onClose={() => setIncomeModal(false)} income={editingIncome} />
      <ExpenseFormModal open={expenseModal} onClose={() => setExpenseModal(false)} expense={editingExpense} />
      <ImportLeadsModal open={importModal} onClose={() => setImportModal(false)} importedLeadIds={importedLeadIds} />
      <BankStatementImportModal open={bankImportModal} onClose={() => setBankImportModal(false)} />
    </div>
  );
}
