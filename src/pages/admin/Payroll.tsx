import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState, useMemo } from 'react';
import {
  Plus, X, ChevronRight, Wallet, Users as UsersIcon, FileText, Check, Search,
  Pencil, Save, Download, Send, Calculator, TrendingUp, AlertCircle, IndianRupee, ArrowLeft, Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useModulePermission } from '@/hooks/usePermission';
import PayslipView from '@/components/payroll/PayslipView';

const fmtINR = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

type Tab = 'overview' | 'structure' | 'runs';

const EARNING_FIELDS = [
  { key: 'base_pay', label: 'Base Pay' },
  { key: 'hra', label: 'HRA' },
  { key: 'conveyance', label: 'Conveyance' },
  { key: 'medical', label: 'Medical' },
  { key: 'special_allowance', label: 'Special Allowance' },
] as const;

const DEDUCTION_FIELDS = [
  { key: 'pf', label: 'Provident Fund' },
  { key: 'esi', label: 'ESI' },
  { key: 'professional_tax', label: 'Professional Tax' },
  { key: 'tds', label: 'TDS' },
] as const;

export default function Payroll() {
  const perm = useModulePermission('payroll');
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('overview');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);

  // ------- Runs -------
  const { data: runsData = [], isLoading: runsLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs').then(r => r.data?.runs || r.data?.data || r.data || []),
  });
  const runs = Array.isArray(runsData) ? runsData : [];

  // ------- Selected Run Detail -------
  const { data: runDetail } = useQuery({
    queryKey: ['payroll-run-detail', selectedRunId],
    queryFn: () => api.get(`/payroll/runs/${selectedRunId}`).then(r => r.data?.data || r.data),
    enabled: !!selectedRunId,
  });

  // ------- Users (for Salary Structure) -------
  const { data: usersData = [] } = useQuery({
    queryKey: ['users-payroll'],
    queryFn: () => api.get('/users').then(r => {
      const d = r.data;
      return d?.users || d?.data || (Array.isArray(d) ? d : []);
    }),
  });
  const users: any[] = Array.isArray(usersData) ? usersData : [];
  const teamUsers = users.filter(u => u.role !== 'client' && u.is_active !== false);
  const filteredUsers = teamUsers.filter(u =>
    !search || `${u.full_name} ${u.email} ${u.job_title || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  // ------- Stats / Overview -------
  const overview = useMemo(() => {
    const totalGross = runs.reduce((s: number, r: any) => s + Number(r.total_gross || r.total_net || 0), 0);
    const totalNet = runs.reduce((s: number, r: any) => s + Number(r.total_net || 0), 0);
    const draftCount = runs.filter((r: any) => r.status === 'Draft' || r.status === 'Pending').length;
    const paidCount = runs.filter((r: any) => r.status === 'Paid').length;
    const totalCTC = teamUsers.reduce((s, u) => {
      const ss = u.salary_structure || {};
      const monthly = EARNING_FIELDS.reduce((a, f) => a + Number(ss[f.key] || 0), 0);
      return s + monthly * 12;
    }, 0);
    return { totalGross, totalNet, draftCount, paidCount, totalCTC, employeeCount: teamUsers.length };
  }, [runs, teamUsers]);

  // ------- Mutations -------
  const createRunMut = useMutation({
    mutationFn: (d: any) => api.post('/payroll/runs', d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      setShowCreate(false);
      toast.success('Payroll run created');
      const id = res.data?.data?.id || res.data?.id;
      if (id) { setSelectedRunId(id); setTab('runs'); }
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create run'),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      qc.invalidateQueries({ queryKey: ['payroll-run-detail', selectedRunId] });
      toast.success('Payroll approved');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to approve'),
  });

  const payMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/pay`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      qc.invalidateQueries({ queryKey: ['payroll-run-detail', selectedRunId] });
      toast.success('Marked as paid');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to mark as paid'),
  });

  const sendPayslipsMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/payslips/send`),
    onSuccess: () => toast.success('Payslips sent'),
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to send payslips'),
  });

  const updateSalaryMut = useMutation({
    mutationFn: ({ id, salary_structure }: { id: string; salary_structure: any }) =>
      api.put(`/users/${id}`, { salary_structure }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-payroll'] });
      toast.success('Salary structure updated');
      setEditingUser(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update'),
  });

  const updateRunEmployeeMut = useMutation({
    mutationFn: ({ runId, userId, data }: { runId: string; userId: string; data: any }) =>
      api.put(`/payroll/runs/${runId}/employees/${userId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-run-detail', selectedRunId] });
      toast.success('Updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update'),
  });

  // ------- Render -------
  const TabBtn = ({ id, label, icon: Icon, count }: { id: Tab; label: string; icon: any; count?: number }) => (
    <button
      onClick={() => { setTab(id); setSelectedRunId(null); }}
      className={`relative px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-2 ${
        tab === id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {typeof count === 'number' && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
          tab === id ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
        }`}>{count}</span>
      )}
      {tab === id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
    </button>
  );

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="page-subtitle">Salary structure, automated runs, and payslips</p>
        </div>
        {perm.canCreate && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> New Payroll Run
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <TabBtn id="overview" label="Overview" icon={TrendingUp} />
        <TabBtn id="structure" label="Salary Structure" icon={UsersIcon} count={teamUsers.length} />
        <TabBtn id="runs" label="Payroll Runs" icon={FileText} count={runs.length} />
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Employees" value={overview.employeeCount} icon={UsersIcon} color="primary" />
            <StatCard label="Annual CTC" value={fmtINR(overview.totalCTC)} icon={IndianRupee} color="success" />
            <StatCard label="Pending Runs" value={overview.draftCount} icon={AlertCircle} color="warning" />
            <StatCard label="Paid Runs" value={overview.paidCount} icon={Check} color="primary" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" /> Recent Payroll Runs
              </h3>
              <div className="space-y-2">
                {runs.slice(0, 5).map((r: any) => (
                  <div key={r.id} onClick={() => { setTab('runs'); setSelectedRunId(r.id); }}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 cursor-pointer transition-colors">
                    <div>
                      <p className="text-sm font-medium">{r.period_label}</p>
                      <p className="text-xs text-muted-foreground">{fmtRange(r.period_start, r.period_end)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{fmtINR(Number(r.total_net || 0))}</span>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                ))}
                {runs.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No payroll runs yet</p>}
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-muted-foreground" /> Top Earners
              </h3>
              <div className="space-y-2">
                {[...teamUsers]
                  .map(u => ({ u, total: EARNING_FIELDS.reduce((s, f) => s + Number(u.salary_structure?.[f.key] || 0), 0) }))
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 5)
                  .map(({ u, total }) => (
                    <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                        {u.full_name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.job_title || u.role}</p>
                      </div>
                      <span className="text-sm font-semibold">{fmtINR(total)}</span>
                    </div>
                  ))}
                {teamUsers.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No employees</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SALARY STRUCTURE TAB */}
      {tab === 'structure' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-sm focus:border-primary focus:outline-none" />
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{filteredUsers.length} employees</span>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Employee</th>
                    <th className="text-right px-4 py-3 font-medium">Base Pay</th>
                    <th className="text-right px-4 py-3 font-medium">Allowances</th>
                    <th className="text-right px-4 py-3 font-medium">Deductions</th>
                    <th className="text-right px-4 py-3 font-medium">Gross / Month</th>
                    <th className="text-right px-4 py-3 font-medium">Net / Month</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No employees found</td></tr>
                  ) : filteredUsers.map(u => {
                    const ss = u.salary_structure || {};
                    const base = Number(ss.base_pay || 0);
                    const allowances = ['hra', 'conveyance', 'medical', 'special_allowance']
                      .reduce((s, k) => s + Number(ss[k] || 0), 0);
                    const deductions = DEDUCTION_FIELDS.reduce((s, f) => s + Number(ss[f.key] || 0), 0);
                    const gross = base + allowances;
                    const net = gross - deductions;
                    const hasStructure = gross > 0;
                    return (
                      <tr key={u.id} className="border-t border-border hover:bg-secondary/20 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                              {u.full_name?.[0]}
                            </div>
                            <div>
                              <p className="font-medium">{u.full_name}</p>
                              <p className="text-xs text-muted-foreground">{u.job_title || u.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">{hasStructure ? fmtINR(base) : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3 text-right">{hasStructure ? fmtINR(allowances) : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3 text-right text-destructive">{hasStructure ? fmtINR(deductions) : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3 text-right font-medium">{hasStructure ? fmtINR(gross) : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3 text-right font-bold text-success">{hasStructure ? fmtINR(net) : <span className="text-muted-foreground italic text-xs">Not configured</span>}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setEditingUser(u)}
                            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors opacity-60 group-hover:opacity-100"
                            title="Edit salary">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RUNS TAB */}
      {tab === 'runs' && (
        selectedRunId && runDetail ? (
          <RunDetail
            run={runDetail}
            onBack={() => setSelectedRunId(null)}
            onApprove={() => approveMut.mutate(selectedRunId)}
            onPay={() => payMut.mutate(selectedRunId)}
            onSendPayslips={() => sendPayslipsMut.mutate(selectedRunId)}
            onUpdateEmployee={(userId, data) => updateRunEmployeeMut.mutate({ runId: selectedRunId, userId, data })}
            isApproving={approveMut.isPending}
            isPaying={payMut.isPending}
            isSending={sendPayslipsMut.isPending}
          />
        ) : (
          <div className="space-y-3">
            {runsLoading ? (
              [...Array(3)].map((_, i) => <div key={i} className="glass-card h-20 animate-pulse" />)
            ) : runs.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-40" />
                <p className="text-sm font-medium">No payroll runs yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first run to get started</p>
              </div>
            ) : runs.map((run: any) => (
              <div key={run.id} onClick={() => setSelectedRunId(run.id)}
                className="glass-card p-5 flex items-center justify-between cursor-pointer hover:shadow-lg transition-all group">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{run.period_label}</h3>
                    <p className="text-xs text-muted-foreground">{fmtRange(run.period_start, run.period_end)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold">{fmtINR(Number(run.total_net || 0))}</p>
                    <p className="text-[10px] text-muted-foreground">{run.employee_count || 0} employees</p>
                  </div>
                  <StatusBadge status={run.status} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* CREATE RUN MODAL */}
      {showCreate && <CreateRunModal onClose={() => setShowCreate(false)} onSubmit={(d) => createRunMut.mutate(d)} isSubmitting={createRunMut.isPending} />}

      {/* EDIT SALARY MODAL */}
      {editingUser && (
        <SalaryStructureModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={(salary_structure) => updateSalaryMut.mutate({ id: editingUser.id, salary_structure })}
          isSaving={updateSalaryMut.isPending}
        />
      )}
    </div>
  );
}

// ============= Sub-components =============

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: 'primary' | 'success' | 'warning' | 'destructive' }) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
  };
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        <div className={`p-1.5 rounded-lg ${colorMap[color]}`}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const cls = status === 'Paid' ? 'bg-success/15 text-success'
    : status === 'Approved' ? 'bg-primary/15 text-primary'
    : status === 'Pending' ? 'bg-warning/15 text-warning'
    : 'bg-secondary text-muted-foreground';
  return <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${cls}`}>{status || 'Draft'}</span>;
}

function fmtRange(s?: string, e?: string) {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${s ? new Date(s).toLocaleDateString('en-IN', opts) : ''} — ${e ? new Date(e).toLocaleDateString('en-IN', opts) : ''}`;
}

// ----- Salary Structure Modal -----
function SalaryStructureModal({ user, onClose, onSave, isSaving }: any) {
  const initial = { ...user.salary_structure };
  const [form, setForm] = useState<Record<string, any>>(
    [...EARNING_FIELDS, ...DEDUCTION_FIELDS].reduce((acc, f) => ({ ...acc, [f.key]: initial[f.key] ?? '' }), {})
  );

  const num = (k: string) => Number(form[k] || 0);
  const totalEarnings = EARNING_FIELDS.reduce((s, f) => s + num(f.key), 0);
  const totalDeductions = DEDUCTION_FIELDS.reduce((s, f) => s + num(f.key), 0);
  const net = totalEarnings - totalDeductions;
  const ctc = totalEarnings * 12;

  const save = () => {
    const cleaned: any = {};
    [...EARNING_FIELDS, ...DEDUCTION_FIELDS].forEach(f => {
      cleaned[f.key] = form[f.key] === '' || form[f.key] == null ? null : Number(form[f.key]);
    });
    onSave(cleaned);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Salary Structure</h2>
            <p className="text-xs text-muted-foreground">{user.full_name} · {user.job_title || user.role}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-success">Earnings</h3>
            {EARNING_FIELDS.map(f => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground">{f.label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                  <input type="number" min="0" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive">Deductions</h3>
            {DEDUCTION_FIELDS.map(f => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground">{f.label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                  <input type="number" min="0" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-lg bg-secondary/40 border border-border">
          <SummaryItem label="Earnings" value={fmtINR(totalEarnings)} color="success" />
          <SummaryItem label="Deductions" value={fmtINR(totalDeductions)} color="destructive" />
          <SummaryItem label="Net / Month" value={fmtINR(net)} color="primary" highlight />
          <SummaryItem label="Annual CTC" value={fmtINR(ctc)} color="muted" />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={save} disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> {isSaving ? 'Saving...' : 'Save Structure'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  const colorClass = color === 'success' ? 'text-success' : color === 'destructive' ? 'text-destructive' : color === 'primary' ? 'text-primary' : 'text-foreground';
  return (
    <div className={highlight ? 'p-2 rounded-md bg-primary/5' : ''}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${colorClass}`}>{value}</p>
    </div>
  );
}

// ----- Create Run Modal -----
function CreateRunModal({ onClose, onSubmit, isSubmitting }: any) {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const periodEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const monthLabel = lastMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  const [form, setForm] = useState({
    period_label: monthLabel,
    period_start: lastMonth.toISOString().slice(0, 10),
    period_end: periodEnd.toISOString().slice(0, 10),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Payroll Run</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground">
          A run will be created with all active employees pre-loaded from their salary structure.
        </p>
        <div>
          <label className="text-xs text-muted-foreground">Period Label</label>
          <input value={form.period_label} onChange={e => setForm(f => ({ ...f, period_label: e.target.value }))}
            placeholder="e.g. March 2026"
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Period Start</label>
            <input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Period End</label>
            <input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={isSubmitting || !form.period_label}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {isSubmitting ? 'Creating...' : 'Create Run'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- Run Detail -----
function RunDetail({ run, onBack, onApprove, onPay, onSendPayslips, onUpdateEmployee, isApproving, isPaying, isSending }: any) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [payslipEmployee, setPayslipEmployee] = useState<any>(null);

  const employees = run.employees || [];
  const totals = useMemo(() => {
    return employees.reduce((acc: any, e: any) => {
      const gross = Number(e.gross_pay || EARNING_FIELDS.reduce((s, f) => s + Number(e[f.key] || 0), 0) + Number(e.bonus || 0));
      const ded = Number(e.total_deductions || DEDUCTION_FIELDS.reduce((s, f) => s + Number(e[f.key] || 0), 0) + Number(e.lop_amount || 0) + Number(e.loan_recovery || 0));
      const net = Number(e.net_pay || (gross - ded));
      acc.gross += gross; acc.deductions += ded; acc.net += net;
      return acc;
    }, { gross: 0, deductions: 0, net: 0 });
  }, [employees]);

  const startEdit = (emp: any) => {
    setEditing(emp.user_id || emp.id);
    setEditForm({
      bonus: emp.bonus ?? '',
      lop_days: emp.lop_days ?? '',
      lop_amount: emp.lop_amount ?? '',
      overtime_amount: emp.overtime_amount ?? '',
      loan_recovery: emp.loan_recovery ?? '',
      other_deductions: emp.other_deductions ?? '',
    });
  };
  const saveEdit = (userId: string) => {
    const data: any = {};
    Object.entries(editForm).forEach(([k, v]) => { data[k] = v === '' ? null : Number(v); });
    onUpdateEmployee(userId, data);
    setEditing(null);
  };

  const isLocked = run.status === 'Approved' || run.status === 'Paid';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to runs
        </button>
        <div className="flex items-center gap-2">
          {run.status === 'Pending' || run.status === 'Draft' ? (
            <button onClick={onApprove} disabled={isApproving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-all disabled:opacity-50">
              <Check className="h-3.5 w-3.5" /> {isApproving ? 'Approving...' : 'Approve'}
            </button>
          ) : null}
          {run.status === 'Approved' && (
            <button onClick={onPay} disabled={isPaying}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success/15 text-success text-sm font-medium hover:bg-success/25 transition-all disabled:opacity-50">
              <Wallet className="h-3.5 w-3.5" /> {isPaying ? 'Processing...' : 'Mark as Paid'}
            </button>
          )}
          {(run.status === 'Approved' || run.status === 'Paid') && (
            <button onClick={onSendPayslips} disabled={isSending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-all disabled:opacity-50">
              <Send className="h-3.5 w-3.5" /> {isSending ? 'Sending...' : 'Email Payslips'}
            </button>
          )}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold">{run.period_label}</h2>
            <p className="text-xs text-muted-foreground">{fmtRange(run.period_start, run.period_end)}</p>
          </div>
          <StatusBadge status={run.status} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <SummaryItem label="Employees" value={String(employees.length)} color="primary" />
          <SummaryItem label="Gross" value={fmtINR(totals.gross)} color="success" />
          <SummaryItem label="Deductions" value={fmtINR(totals.deductions)} color="destructive" />
          <SummaryItem label="Net Payable" value={fmtINR(totals.net)} color="primary" highlight />
        </div>

        {employees.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <UsersIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No employee data available for this run
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="pb-3 pr-3 font-medium">Employee</th>
                  <th className="pb-3 px-3 text-right font-medium">Base</th>
                  <th className="pb-3 px-3 text-right font-medium">Allowances</th>
                  <th className="pb-3 px-3 text-right font-medium">Bonus</th>
                  <th className="pb-3 px-3 text-right font-medium">LOP</th>
                  <th className="pb-3 px-3 text-right font-medium">Deductions</th>
                  <th className="pb-3 px-3 text-right font-medium">Net Pay</th>
                  <th className="pb-3 pl-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp: any) => {
                  const userId = emp.user_id || emp.id;
                  const isEditing = editing === userId;
                  const allowances = ['hra', 'conveyance', 'medical', 'special_allowance']
                    .reduce((s, k) => s + Number(emp[k] || 0), 0);
                  const deductions = DEDUCTION_FIELDS.reduce((s, f) => s + Number(emp[f.key] || 0), 0)
                    + Number(emp.loan_recovery || 0) + Number(emp.other_deductions || 0);
                  const gross = Number(emp.base_pay || 0) + allowances + Number(emp.bonus || 0) + Number(emp.overtime_amount || 0);
                  const net = Number(emp.net_pay || (gross - deductions - Number(emp.lop_amount || 0)));

                  if (isEditing) {
                    return (
                      <tr key={userId} className="border-b border-border bg-primary/5">
                        <td colSpan={8} className="py-4 px-3">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">{emp.full_name?.[0]}</div>
                              <span className="font-medium text-sm">{emp.full_name}</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {[
                                { k: 'bonus', label: 'Bonus' },
                                { k: 'overtime_amount', label: 'Overtime' },
                                { k: 'lop_days', label: 'LOP Days' },
                                { k: 'lop_amount', label: 'LOP Amount' },
                                { k: 'loan_recovery', label: 'Loan Recovery' },
                                { k: 'other_deductions', label: 'Other Deductions' },
                              ].map(({ k, label }) => (
                                <div key={k}>
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</label>
                                  <input type="number" min="0" value={editForm[k]} onChange={e => setEditForm((p: any) => ({ ...p, [k]: e.target.value }))}
                                    className="w-full px-2 py-1.5 rounded-md bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-secondary">Cancel</button>
                              <button onClick={() => saveEdit(userId)} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
                                <Save className="h-3 w-3" /> Save
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={userId} className="border-b border-border/50 hover:bg-secondary/20 group">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">{emp.full_name?.[0]}</div>
                          <div>
                            <p className="font-medium">{emp.full_name}</p>
                            {emp.job_title && <p className="text-[10px] text-muted-foreground">{emp.job_title}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">{fmtINR(Number(emp.base_pay || 0))}</td>
                      <td className="py-3 px-3 text-right">{fmtINR(allowances)}</td>
                      <td className="py-3 px-3 text-right text-success">{Number(emp.bonus || 0) > 0 ? `+${fmtINR(Number(emp.bonus))}` : '—'}</td>
                      <td className="py-3 px-3 text-right text-warning">{Number(emp.lop_days || 0) > 0 ? `${emp.lop_days}d` : '—'}</td>
                      <td className="py-3 px-3 text-right text-destructive">-{fmtINR(deductions + Number(emp.lop_amount || 0))}</td>
                      <td className="py-3 px-3 text-right font-bold">{fmtINR(net)}</td>
                      {!isLocked ? (
                        <td className="py-3 pl-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setPayslipEmployee(emp)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="View Payslip">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => startEdit(emp)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {emp.payslip_url && (
                              <a href={emp.payslip_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="Download Payslip">
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      ) : (
                        <td className="py-3 pl-3 text-right">
                          <button onClick={() => setPayslipEmployee(emp)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors" title="View Payslip">
                            <Eye className="h-3 w-3" /> Payslip
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold">
                  <td className="py-3 pr-3">Total</td>
                  <td className="py-3 px-3 text-right">—</td>
                  <td className="py-3 px-3 text-right">—</td>
                  <td className="py-3 px-3 text-right">—</td>
                  <td className="py-3 px-3 text-right">—</td>
                  <td className="py-3 px-3 text-right text-destructive">-{fmtINR(totals.deductions)}</td>
                  <td className="py-3 px-3 text-right text-primary">{fmtINR(totals.net)}</td>
                  {!isLocked && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
