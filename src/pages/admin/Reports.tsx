import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Users, IndianRupee, Receipt, Wallet, MessageCircle, Skull, Clock, Target } from 'lucide-react';

const STATUS_BUCKETS = {
  converted:   ['Closed Won'],
  discussion:  ['Contacted', 'Qualified', 'Negotiation', 'Proposal Sent', 'On Hold'],
  dead:        ['Dead', 'Closed Lost', 'Unqualified'],
  no_response: ['New'],
} as const;

const CHART_COLORS = ['hsl(199, 100%, 55%)', 'hsl(157, 87%, 46%)', 'hsl(244, 94%, 62%)', 'hsl(35, 100%, 63%)', 'hsl(4, 100%, 64%)', 'hsl(280, 80%, 60%)', 'hsl(180, 70%, 50%)', 'hsl(45, 100%, 60%)'];

const tooltipStyle = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'hsl(var(--foreground))',
  },
};

type Tab = 'sales' | 'finance' | 'expenses';

const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const FULL_ACCESS_ROLES = ['super_admin', 'admin', 'sales_manager'];

export default function Reports() {
  const me = useAuthStore(s => s.user);
  const hasFullAccess = FULL_ACCESS_ROLES.includes(me?.role || '');

  const [tab, setTab] = useState<Tab>('sales');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number | 'all'>('all'); // 0..11 or 'all'
  // Non-admins are locked to their own user id; admins start with "all"
  const [employeeId, setEmployeeId] = useState<string>(hasFullAccess ? 'all' : (me?.id || 'all'));
  const queryClient = useQueryClient();

  const inSelectedRange = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if (d.getFullYear() !== year) return false;
    if (month !== 'all' && d.getMonth() !== month) return false;
    return true;
  };

  const { data: leadsData = [] } = useQuery({
    queryKey: ['leads-all'],
    queryFn: () => api.get('/leads').then(r => r.data?.leads || r.data || []),
  });
  const { data: invoicesData = [] } = useQuery({
    queryKey: ['invoices-all'],
    queryFn: () => api.get('/invoices').then(r => r.data?.invoices || r.data || []),
  });
  const { data: expensesData = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get('/expenses').then(r => r.data?.expenses || r.data || []),
  });
  const { data: usersData = [] } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => api.get('/users').then(r => r.data?.data || r.data?.users || r.data || []),
  });
  const { data: payrollData = [] } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs').then(r => r.data?.runs || r.data || []),
  });

  const leads = Array.isArray(leadsData) ? leadsData : [];
  const invoices = Array.isArray(invoicesData) ? invoicesData : [];
  const expenses = Array.isArray(expensesData) ? expensesData : [];
  const users = Array.isArray(usersData) ? usersData : [];
  const payrollRuns = Array.isArray(payrollData) ? payrollData : [];

  // ---- SALES TAB ----
  const presalesUsers = useMemo(() =>
    users.filter((u: any) => ['sales_rep', 'sales_manager', 'pre_sales'].includes(u.role)), [users]);

  const filteredLeads = useMemo(() =>
    leads.filter((l: any) => inSelectedRange(l.created_at || l.createdAt)),
  [leads, year, month]);

  // Leads narrowed to a chosen employee (or all employees when employeeId='all')
  const employeeLeads = useMemo(() => {
    if (employeeId === 'all') return filteredLeads;
    return filteredLeads.filter((l: any) => {
      const uid = l.assigned_to || l.assigned_user_id || l.owner_id;
      return uid === employeeId;
    });
  }, [filteredLeads, employeeId]);

  const leadBuckets = useMemo(() => {
    const counts = { received: employeeLeads.length, converted: 0, discussion: 0, dead: 0, no_response: 0 };
    employeeLeads.forEach((l: any) => {
      const s = String(l.status || '').trim();
      if (STATUS_BUCKETS.converted.includes(s as any))         counts.converted++;
      else if (STATUS_BUCKETS.discussion.includes(s as any))   counts.discussion++;
      else if (STATUS_BUCKETS.dead.includes(s as any))         counts.dead++;
      else if (STATUS_BUCKETS.no_response.includes(s as any))  counts.no_response++;
    });
    return counts;
  }, [employeeLeads]);

  // ── Target vs Sale (requires a specific month selected) ──
  const targetMonth = month === 'all' ? null : month + 1; // backend uses 1-12
  const { data: targetData } = useQuery({
    queryKey: ['perf-target', employeeId, year, targetMonth],
    queryFn: () => api.get('/performance-targets', {
      params: { user_id: employeeId, year, month: targetMonth },
    }).then(r => r.data),
    enabled: targetMonth !== null,
  });

  const [targetInput, setTargetInput] = useState<string>('');
  useEffect(() => {
    if (targetData?.target_value !== undefined) setTargetInput(String(targetData.target_value || ''));
  }, [targetData]);

  const saveTarget = useMutation({
    mutationFn: (val: number) => api.put('/performance-targets', {
      user_id: employeeId, year, month: targetMonth, target_value: val,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['perf-target', employeeId, year, targetMonth] }),
  });

  const leadsPerUser = useMemo(() => {
    const map: Record<string, { name: string; received: number; converted: number }> = {};
    presalesUsers.forEach((u: any) => {
      map[u.id] = { name: u.full_name || u.email || 'Unknown', received: 0, converted: 0 };
    });
    filteredLeads.forEach((l: any) => {
      const uid = l.assigned_to || l.assigned_user_id || l.owner_id;
      if (!uid) return;
      if (!map[uid]) {
        const u = users.find((x: any) => x.id === uid);
        map[uid] = { name: u?.full_name || 'Unassigned', received: 0, converted: 0 };
      }
      map[uid].received += 1;
      if (l.status === 'Closed Won' || l.converted) map[uid].converted += 1;
    });
    return Object.values(map).sort((a, b) => b.received - a.received);
  }, [filteredLeads, presalesUsers, users]);

  const totalLeads = filteredLeads.length;
  const totalConverted = filteredLeads.filter((l: any) => l.status === 'Closed Won' || l.converted).length;
  const conversionRate = totalLeads ? ((totalConverted / totalLeads) * 100).toFixed(1) : '0.0';

  const leadsByMonth = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i, 1).toLocaleString('default', { month: 'short' }),
      received: 0,
      converted: 0,
    }));
    leads.forEach((l: any) => {
      const d = new Date(l.created_at || l.createdAt);
      if (d.getFullYear() !== year) return;
      months[d.getMonth()].received += 1;
      if (l.status === 'Closed Won' || l.converted) months[d.getMonth()].converted += 1;
    });
    return months;
  }, [leads, year]);

  // ---- FINANCE TAB ----
  const paymentInByMonth = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i, 1).toLocaleString('default', { month: 'short' }),
      paid: 0,
      pending: 0,
    }));
    invoices.forEach((inv: any) => {
      const d = new Date(inv.paid_at || inv.created_at || inv.due_date);
      if (!d || isNaN(d.getTime()) || d.getFullYear() !== year) return;
      const total = Number(inv.total || inv.amount || 0);
      if (inv.status === 'paid' || inv.status === 'Paid') months[d.getMonth()].paid += total;
      else months[d.getMonth()].pending += total;
    });
    return months;
  }, [invoices, year]);

  const expensesByMonthValue = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({ month: new Date(year, i, 1).toLocaleString('default', { month: 'short' }), value: 0 }));
    expenses.forEach((e: any) => {
      const d = new Date(e.expense_date);
      if (d.getFullYear() !== year) return;
      months[d.getMonth()].value += Number(e.amount || 0);
    });
    return months;
  }, [expenses, year]);

  const payrollByMonthValue = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({ month: new Date(year, i, 1).toLocaleString('default', { month: 'short' }), value: 0 }));
    payrollRuns.forEach((r: any) => {
      const d = new Date(r.period_end || r.created_at);
      if (d.getFullYear() !== year) return;
      months[d.getMonth()].value += Number(r.total_net || r.total_amount || 0);
    });
    return months;
  }, [payrollRuns, year]);

  const cashflowByMonth = useMemo(() => {
    return paymentInByMonth.map((m, i) => ({
      month: m.month,
      paymentIn: m.paid,
      paymentOut: expensesByMonthValue[i].value + payrollByMonthValue[i].value,
      net: m.paid - (expensesByMonthValue[i].value + payrollByMonthValue[i].value),
    }));
  }, [paymentInByMonth, expensesByMonthValue, payrollByMonthValue]);

  const totalPaymentIn = cashflowByMonth.reduce((s, m) => s + m.paymentIn, 0);
  const totalPaymentOut = cashflowByMonth.reduce((s, m) => s + m.paymentOut, 0);
  const totalExpenses = expensesByMonthValue.reduce((s, m) => s + m.value, 0);
  const totalPayroll = payrollByMonthValue.reduce((s, m) => s + m.value, 0);

  // ---- EXPENSES TAB ----
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => {
      if (!inSelectedRange(e.expense_date)) return;
      map[e.category || 'Other'] = (map[e.category || 'Other'] || 0) + Number(e.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses, year, month]);

  const expenseMonthlyByCategory = useMemo(() => {
    const cats = Array.from(new Set(expenses.map((e: any) => e.category || 'Other')));
    const rows = Array.from({ length: 12 }, (_, i) => {
      const row: any = { month: new Date(year, i, 1).toLocaleString('default', { month: 'short' }) };
      cats.forEach(c => { row[c] = 0; });
      return row;
    });
    expenses.forEach((e: any) => {
      const d = new Date(e.expense_date);
      if (d.getFullYear() !== year) return;
      const cat = e.category || 'Other';
      rows[d.getMonth()][cat] += Number(e.amount || 0);
    });
    return { rows, cats };
  }, [expenses, year]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button onClick={() => setTab(id)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
      {label}
    </button>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Business analytics and financial insights</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tab === 'sales' && hasFullAccess && (
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none">
              <option value="all">All Employees</option>
              {users.filter((u: any) => u.id && u.full_name).map((u: any) => (
                <option key={u.id} value={u.id}>{u.full_name}{u.role ? ` (${u.role})` : ''}</option>
              ))}
            </select>
          )}
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
      </div>

      <div className="flex items-center gap-2 border-b border-border pb-2">
        <TabBtn id="sales" label="Sales & Leads" />
        <TabBtn id="finance" label="Finance" />
        <TabBtn id="expenses" label="Expenses" />
      </div>

      {tab === 'sales' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground uppercase tracking-wider">Received</p><Users className="h-4 w-4 text-primary" /></div>
              <p className="text-2xl font-bold mt-1">{leadBuckets.received}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground uppercase tracking-wider">Converted</p><TrendingUp className="h-4 w-4 text-success" /></div>
              <p className="text-2xl font-bold mt-1 text-success">{leadBuckets.converted}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground uppercase tracking-wider">In Discussion</p><MessageCircle className="h-4 w-4 text-warning" /></div>
              <p className="text-2xl font-bold mt-1 text-warning">{leadBuckets.discussion}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground uppercase tracking-wider">Dead</p><Skull className="h-4 w-4 text-destructive" /></div>
              <p className="text-2xl font-bold mt-1 text-destructive">{leadBuckets.dead}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground uppercase tracking-wider">No Response</p><Clock className="h-4 w-4 text-muted-foreground" /></div>
              <p className="text-2xl font-bold mt-1">{leadBuckets.no_response}</p>
            </div>
          </div>

          {/* Target vs Sale — only shown when a specific month is selected */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Target vs Sale {month !== 'all' && `— ${new Date(year, month, 1).toLocaleString('default', { month: 'long' })} ${year}`}</h2>
              {employeeId !== 'all' && (
                <p className="text-xs text-muted-foreground">{users.find((u: any) => u.id === employeeId)?.full_name}</p>
              )}
            </div>
            {month === 'all' ? (
              <p className="text-sm text-muted-foreground py-4">Select a specific month to view target vs sale.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Target</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" value={targetInput} onChange={e => setTargetInput(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-base font-semibold focus:border-primary focus:outline-none" />
                    <button onClick={() => saveTarget.mutate(Number(targetInput) || 0)} disabled={saveTarget.isPending}
                      className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50">
                      {saveTarget.isPending ? '…' : 'Save'}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Actual Sale</p>
                  <p className="text-2xl font-bold text-success">{fmtINR(Number(targetData?.actual_sale || 0))}</p>
                  <p className="text-xs text-muted-foreground mt-1">{Number(targetData?.paid_invoice_count || 0)} paid invoice(s)</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Pending</p>
                  <p className="text-2xl font-bold text-warning">
                    {fmtINR(Math.max(0, Number(targetData?.target_value || 0) - Number(targetData?.actual_sale || 0)))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Progress</p>
                  {(() => {
                    const t = Number(targetData?.target_value || 0);
                    const a = Number(targetData?.actual_sale || 0);
                    const pct = t > 0 ? Math.min(100, (a / t) * 100) : 0;
                    return (
                      <>
                        <p className="text-2xl font-bold">{pct.toFixed(1)}%</p>
                        <div className="w-full bg-secondary h-2 rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold mb-4">Leads by Pre-Sales User</h2>
              {leadsPerUser.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">No pre-sales users with leads</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={leadsPerUser} margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="received" name="Leads Received" fill="hsl(199, 100%, 55%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="converted" name="Converted" fill="hsl(157, 87%, 46%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold mb-4">Leads — Monthly ({year})</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={leadsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="received" name="Received" stroke="hsl(199, 100%, 55%)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="converted" name="Converted" stroke="hsl(157, 87%, 46%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold mb-4">Pre-Sales User Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><th className="text-left py-2">User</th><th className="text-right py-2">Leads Received</th><th className="text-right py-2">Converted</th><th className="text-right py-2">Conversion %</th></tr>
                </thead>
                <tbody>
                  {leadsPerUser.map((u, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-2.5 font-medium">{u.name}</td>
                      <td className="py-2.5 text-right">{u.received}</td>
                      <td className="py-2.5 text-right text-success">{u.converted}</td>
                      <td className="py-2.5 text-right">{u.received ? ((u.converted / u.received) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  ))}
                  {leadsPerUser.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'finance' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground uppercase tracking-wider">Payment In</p><IndianRupee className="h-4 w-4 text-success" /></div>
              <p className="text-2xl font-bold mt-1 text-success">{fmtINR(totalPaymentIn)}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground uppercase tracking-wider">Payment Out</p><TrendingDown className="h-4 w-4 text-destructive" /></div>
              <p className="text-2xl font-bold mt-1 text-destructive">{fmtINR(totalPaymentOut)}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground uppercase tracking-wider">Expenses</p><Receipt className="h-4 w-4 text-warning" /></div>
              <p className="text-2xl font-bold mt-1">{fmtINR(totalExpenses)}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground uppercase tracking-wider">Payroll Paid</p><Wallet className="h-4 w-4 text-primary" /></div>
              <p className="text-2xl font-bold mt-1">{fmtINR(totalPayroll)}</p>
            </div>
          </div>

          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold mb-4">Cashflow — Payment In vs Payment Out ({year})</h2>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={cashflowByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => fmtINR(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="paymentIn" name="Payment In" fill="hsl(157, 87%, 46%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="paymentOut" name="Payment Out" fill="hsl(4, 100%, 64%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold mb-4">Net Cashflow ({year})</h2>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={cashflowByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => fmtINR(v)} />
                  <defs>
                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(199, 100%, 55%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(199, 100%, 55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="net" name="Net" stroke="hsl(199, 100%, 55%)" fill="url(#netGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold mb-4">Payment Out Breakdown ({year})</h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={[{ name: 'Expenses', value: totalExpenses }, { name: 'Payroll', value: totalPayroll }]} cx="50%" cy="50%" outerRadius={90} dataKey="value" nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    <Cell fill="hsl(35, 100%, 63%)" />
                    <Cell fill="hsl(244, 94%, 62%)" />
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v: number) => fmtINR(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {tab === 'expenses' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Expenses ({year})</p>
              <p className="text-2xl font-bold mt-1">{fmtINR(totalExpenses)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Categories</p>
              <p className="text-2xl font-bold mt-1">{expenseByCategory.length}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg / Month</p>
              <p className="text-2xl font-bold mt-1">{fmtINR(totalExpenses / 12)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold mb-4">Monthly Expenses ({year})</h2>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={expensesByMonthValue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => fmtINR(v)} />
                  <defs>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(35, 100%, 63%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(35, 100%, 63%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" name="Expenses" stroke="hsl(35, 100%, 63%)" fill="url(#expGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold mb-4">Expenses by Category ({year})</h2>
              {expenseByCategory.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">No expenses recorded</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={expenseByCategory} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {expenseByCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v: number) => fmtINR(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold mb-4">Monthly Breakdown by Category ({year})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left py-2 px-2">Category</th>
                    {expenseMonthlyByCategory.rows.map(r => <th key={r.month} className="text-right py-2 px-2">{r.month}</th>)}
                    <th className="text-right py-2 px-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseMonthlyByCategory.cats.length === 0 ? (
                    <tr><td colSpan={14} className="text-center py-6 text-muted-foreground">No expenses recorded</td></tr>
                  ) : expenseMonthlyByCategory.cats.map(cat => {
                    const total = expenseMonthlyByCategory.rows.reduce((s, r) => s + (r[cat] || 0), 0);
                    return (
                      <tr key={cat} className="border-t border-border">
                        <td className="py-2 px-2 font-medium">{cat}</td>
                        {expenseMonthlyByCategory.rows.map(r => (
                          <td key={r.month} className="py-2 px-2 text-right text-muted-foreground">{r[cat] ? fmtINR(r[cat]) : '—'}</td>
                        ))}
                        <td className="py-2 px-2 text-right font-semibold">{fmtINR(total)}</td>
                      </tr>
                    );
                  })}
                  {expenseMonthlyByCategory.cats.length > 0 && (
                    <tr className="border-t-2 border-border bg-secondary/30">
                      <td className="py-2 px-2 font-bold">Total</td>
                      {expenseMonthlyByCategory.rows.map(r => {
                        const monthTotal = expenseMonthlyByCategory.cats.reduce((s, c) => s + (r[c] || 0), 0);
                        return <td key={r.month} className="py-2 px-2 text-right font-semibold">{monthTotal ? fmtINR(monthTotal) : '—'}</td>;
                      })}
                      <td className="py-2 px-2 text-right font-bold text-primary">{fmtINR(totalExpenses)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
