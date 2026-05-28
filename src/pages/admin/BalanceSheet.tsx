import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, ListChecks, Receipt,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import api from '@/lib/api';
import type { IncomeEntry } from '@/components/balance-sheet/IncomeFormModal';
import type { Expense } from '@/components/expenses/ExpenseFormModal';

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

// Distinct hues for pie slices — chosen to contrast in both light/dark themes.
const CATEGORY_COLORS = [
  '#6c63fa', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
];

/**
 * Balance Sheet — read-only OVERVIEW page.
 *
 * Shows:
 *  - Total In, Total Out, Net (KPI cards)
 *  - Income vs Expenses by month (bar chart)
 *  - Expenses broken down by CATEGORY (pie chart + legend)
 *  - Recent income / expense lists (last 5 each)
 *  - Quick links to Input Sheet (income detail) and Expense Sheet
 *
 * Editing/import lives on the dedicated Input Sheet and Expense Sheet pages.
 */
export default function BalanceSheet() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number | 'all'>('all');

  const { data: incomeData = [] } = useQuery({
    queryKey: ['income'],
    queryFn: () => api.get('/income').then((r) => r.data?.income || r.data || []),
  });
  const { data: expensesData = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get('/expenses').then((r) => r.data?.expenses || r.data || []),
  });

  const incomes: IncomeEntry[] = Array.isArray(incomeData) ? incomeData : [];
  const expenses: Expense[] = Array.isArray(expensesData) ? expensesData : [];

  const inRange = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (d.getFullYear() !== year) return false;
    if (month !== 'all' && d.getMonth() !== month) return false;
    return true;
  };

  const filteredIncome = useMemo(() => incomes.filter((i) => inRange(i.income_date)), [incomes, year, month]);
  const filteredExpenses = useMemo(() => expenses.filter((e) => inRange(e.expense_date)), [expenses, year, month]);

  const totalIncome = useMemo(
    () => filteredIncome.reduce((s, i) => s + Number(i.amount || 0), 0),
    [filteredIncome],
  );
  const totalExpense = useMemo(
    () => filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    [filteredExpenses],
  );
  const netBalance = totalIncome - totalExpense;

  // Monthly comparison for the bar chart
  const monthlyComparison = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2000, i, 1).toLocaleString('default', { month: 'short' }),
      income: 0,
      expense: 0,
    }));
    incomes.forEach((i) => {
      const d = new Date(i.income_date);
      if (d.getFullYear() === year) months[d.getMonth()].income += Number(i.amount || 0);
    });
    expenses.forEach((e) => {
      const d = new Date(e.expense_date);
      if (d.getFullYear() === year) months[d.getMonth()].expense += Number(e.amount || 0);
    });
    return months;
  }, [incomes, expenses, year]);

  // Per-category expense breakdown for the pie chart
  const categoryBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    filteredExpenses.forEach((e) => {
      const cat = e.category || 'Uncategorized';
      m.set(cat, (m.get(cat) || 0) + Number(e.amount || 0));
    });
    return Array.from(m.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const periodLabel =
    month === 'all'
      ? `${year}`
      : `${new Date(2000, month, 1).toLocaleString('default', { month: 'long' })} ${year}`;

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Balance Sheet</h1>
          <p className="page-subtitle">
            Total In, Total Out, and where the money goes ·{' '}
            <span className="text-foreground font-medium">{periodLabel}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/input-sheet"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success/15 text-success text-sm font-medium hover:bg-success/25 transition-all"
          >
            <ListChecks className="h-4 w-4" /> Input Sheet
          </Link>
          <Link
            to="/admin/expense-sheet"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive/15 text-destructive text-sm font-medium hover:bg-destructive/25 transition-all"
          >
            <Receipt className="h-4 w-4" /> Expense Sheet
          </Link>
        </div>
      </div>

      {/* Period filters */}
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
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Total In"
          value={fmtINR(totalIncome)}
          sub={`${filteredIncome.length} ${filteredIncome.length === 1 ? 'entry' : 'entries'}`}
          color="success"
          icon={<TrendingUp className="h-4 w-4 text-success" />}
        />
        <KpiCard
          label="Total Out"
          value={fmtINR(totalExpense)}
          sub={`${filteredExpenses.length} ${filteredExpenses.length === 1 ? 'entry' : 'entries'}`}
          color="destructive"
          icon={<TrendingDown className="h-4 w-4 text-destructive" />}
        />
        <KpiCard
          label="Net Balance"
          value={fmtINR(netBalance)}
          sub={netBalance >= 0 ? '↑ Profit' : '↓ Loss'}
          color={netBalance >= 0 ? 'primary' : 'warning'}
          icon={<Wallet className={`h-4 w-4 ${netBalance >= 0 ? 'text-primary' : 'text-warning'}`} />}
        />
      </div>

      {/* Monthly bar chart */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold mb-4">Income vs Expenses — Monthly ({year})</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyComparison}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip {...tooltipStyle} formatter={(v: number) => fmtINR(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="income" name="Income" fill="hsl(157, 87%, 46%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Expense" fill="hsl(4, 100%, 64%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Expenses by category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-4">Expenses by Category — {periodLabel}</h2>
          {categoryBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center italic">
              No expenses in this period.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v: number) => fmtINR(v)} />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-2">
                {categoryBreakdown.map((row, i) => {
                  const pct = totalExpense > 0 ? (row.amount / totalExpense) * 100 : 0;
                  return (
                    <div key={row.category} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
                      <span className="flex-1 truncate text-foreground">{row.category}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {fmtINR(row.amount)}{' '}
                        <span className="opacity-70">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-3">Top spending</h3>
          {categoryBreakdown.slice(0, 5).map((row, i) => {
            const pct = totalExpense > 0 ? (row.amount / totalExpense) * 100 : 0;
            return (
              <div key={row.category} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{row.category}</span>
                  <span className="text-muted-foreground tabular-nums">{fmtINR(row.amount)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                    }}
                  />
                </div>
              </div>
            );
          })}
          {categoryBreakdown.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-2">No data yet.</p>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentList
          title="Recent Income"
          items={filteredIncome}
          getDate={(i: any) => i.income_date}
          getTitle={(i: any) => i.title}
          getSubtitle={(i: any) => i.source}
          getAmount={(i: any) => Number(i.amount || 0)}
          color="success"
          emptyText="No income entries"
          icon={<ArrowUpRight className="h-4 w-4 text-success" />}
          link="/admin/input-sheet"
        />
        <RecentList
          title="Recent Expenses"
          items={filteredExpenses}
          getDate={(e: any) => e.expense_date}
          getTitle={(e: any) => e.title}
          getSubtitle={(e: any) => e.category}
          getAmount={(e: any) => Number(e.amount || 0)}
          color="destructive"
          emptyText="No expense entries"
          icon={<ArrowDownRight className="h-4 w-4 text-destructive" />}
          link="/admin/expense-sheet"
        />
      </div>
    </div>
  );
}

// ─── small reusable bits ─────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, icon,
}: {
  label: string; value: string; sub: string;
  color: 'success' | 'destructive' | 'primary' | 'warning';
  icon: React.ReactNode;
}) {
  const text = `text-${color}`;
  const bg = `bg-${color}/10`;
  const ring = `bg-${color}/5`;
  const bar = `bg-${color}`;

  return (
    <div className="glass-card p-5 relative overflow-hidden group hover:shadow-lg transition-shadow">
      <div className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${ring} group-hover:opacity-100 transition-opacity`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
          <div className={`p-1.5 rounded-lg ${bg}`}>{icon}</div>
        </div>
        <p className={`text-2xl font-bold mt-2 ${text}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </div>
    </div>
  );
}

function RecentList<T>({
  title, items, getDate, getTitle, getSubtitle, getAmount, color, emptyText, icon, link,
}: {
  title: string;
  items: T[];
  getDate: (item: T) => string | undefined;
  getTitle: (item: T) => string;
  getSubtitle: (item: T) => string;
  getAmount: (item: T) => number;
  color: 'success' | 'destructive';
  emptyText: string;
  icon: React.ReactNode;
  link: string;
}) {
  const sign = color === 'success' ? '+' : '-';
  const text = `text-${color}`;
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {icon} {title}
        </h3>
        <Link to={link} className="text-xs text-primary hover:underline">
          View all →
        </Link>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center italic">{emptyText}</p>
        ) : (
          items.slice(0, 5).map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{getTitle(item)}</p>
                <p className="text-xs text-muted-foreground">
                  {getDate(item)?.slice(0, 10)} · {getSubtitle(item)}
                </p>
              </div>
              <span className={`text-sm font-semibold whitespace-nowrap ml-2 ${text}`}>
                {sign}
                {fmtINR(getAmount(item))}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
