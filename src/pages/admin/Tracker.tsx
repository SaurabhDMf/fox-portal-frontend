import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Clock, Calendar, DollarSign, ArrowUpRight, ArrowDownRight, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import StatCard from '@/components/ui/StatCard';
import { useAuthStore } from '@/stores/authStore';
import { dummyTrackerSummary, dummyLeaveRequests, dummyTimeEntries, dummyExpenses } from '@/lib/dummyData';

const tabs = ['Overview', 'Leave', 'Time Logs', 'Expenses'];
const leaveTypes = ['Annual', 'Sick', 'Personal', 'Unpaid', 'Maternity', 'Paternity'];
const expenseCategories = ['Travel', 'Meals', 'Software', 'Equipment', 'Office Supplies', 'Other'];

export default function Tracker() {
  const [tab, setTab] = useState('Overview');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();

  const [leaveForm, setLeaveForm] = useState({ leave_type: 'Annual', start_date: '', end_date: '', reason: '' });
  const [timeForm, setTimeForm] = useState({ date: '', hours: '', project_id: '', description: '', is_billable: false, entry_type: 'Regular' });
  const [expenseForm, setExpenseForm] = useState({ title: '', category: 'Travel', amount: '', expense_date: '', description: '' });

  const { data: summary } = useQuery({
    queryKey: ['tracker-summary'],
    queryFn: () => api.get('/tracker/tracker-summary').then(r => r.data),
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => api.get('/tracker/leave-requests').then(r => r.data?.leave_requests || r.data || []),
    enabled: tab === 'Leave' || tab === 'Overview',
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['time-entries'],
    queryFn: () => api.get('/tracker/time-entries').then(r => r.data?.time_entries || r.data || []),
    enabled: tab === 'Time Logs',
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get('/tracker/expenses').then(r => r.data?.expenses || r.data || []),
    enabled: tab === 'Expenses',
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => api.get('/projects').then(r => r.data?.projects || r.data || []),
  });

  const checkInMut = useMutation({
    mutationFn: () => api.post('/tracker/attendance/check-in'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tracker-summary'] }); toast.success('Checked in!'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Already checked in'),
  });

  const checkOutMut = useMutation({
    mutationFn: () => api.post('/tracker/attendance/check-out'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tracker-summary'] }); toast.success('Checked out!'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Not checked in'),
  });

  const leaveMut = useMutation({
    mutationFn: (d: typeof leaveForm) => api.post('/tracker/leave-requests', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-requests'] }); setShowLeaveModal(false); toast.success('Leave request submitted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const timeMut = useMutation({
    mutationFn: (d: typeof timeForm) => api.post('/tracker/time-entries', { ...d, hours: Number(d.hours) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['time-entries'] }); setShowTimeModal(false); toast.success('Time logged'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const expenseMut = useMutation({
    mutationFn: (d: typeof expenseForm) => api.post('/tracker/expenses', { ...d, amount: Number(d.amount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setShowExpenseModal(false); toast.success('Expense added'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const submitExpenseMut = useMutation({
    mutationFn: (id: string) => api.post(`/tracker/expenses/${id}/submit`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Submitted'); },
  });

  const reviewLeaveMut = useMutation({
    mutationFn: ({ id, status, review_note }: { id: string; status: string; review_note: string }) =>
      api.put(`/tracker/leave-requests/${id}/review`, { status, review_note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-requests'] }); toast.success('Updated'); },
  });

  const s = summary || dummyTrackerSummary;
  const isManager = user?.role === 'admin' || user?.role === 'sales_manager';
  const projectsArr = Array.isArray(projects) ? projects : [];
  const leaveArr = (Array.isArray(leaveRequests) && leaveRequests.length > 0) ? leaveRequests : dummyLeaveRequests;
  const timeArr = (Array.isArray(timeEntries) && timeEntries.length > 0) ? timeEntries : dummyTimeEntries;
  const expenseArr = (Array.isArray(expenses) && expenses.length > 0) ? expenses : dummyExpenses;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">HR & Tracker</h1><p className="page-subtitle">Time, leave, and expenses</p></div>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`text-xs px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-4">
          <div className="glass-card p-5 flex flex-col sm:flex-row items-center gap-4">
            <Clock className="h-8 w-8 text-primary" />
            <div className="flex-1 text-center sm:text-left">
              <div className="text-sm text-muted-foreground">Today</div>
              <div className="text-xl font-bold">{s.today_hours || '0h 0m'}</div>
              {s.checked_in_at && <div className="text-xs text-muted-foreground">Checked in at {new Date(s.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => checkInMut.mutate()} disabled={checkInMut.isPending} className="px-4 py-2 rounded-lg bg-success/15 text-success text-sm font-medium hover:bg-success/25 active:scale-[0.97] transition-all flex items-center gap-1 disabled:opacity-50">
                <ArrowUpRight className="h-4 w-4" /> Check In
              </button>
              <button onClick={() => checkOutMut.mutate()} disabled={checkOutMut.isPending} className="px-4 py-2 rounded-lg bg-destructive/15 text-destructive text-sm font-medium hover:bg-destructive/25 active:scale-[0.97] transition-all flex items-center gap-1 disabled:opacity-50">
                <ArrowDownRight className="h-4 w-4" /> Check Out
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Hours This Month" value={s.monthly_hours || '0'} icon={Clock} />
            <StatCard label="Leave Balance" value={s.leave_balance ?? '—'} icon={Calendar} iconColor="text-info" />
            <StatCard label="Pending Expenses" value={s.pending_expenses ? `$${s.pending_expenses}` : '$0'} icon={DollarSign} iconColor="text-warning" />
          </div>

          {/* Leave balance bars */}
          {s.leave_balances && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3">Leave Balances</h3>
              <div className="space-y-3">
                {Object.entries(s.leave_balances as Record<string, { used: number; total: number }>).map(([type, bal]) => (
                  <div key={type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground capitalize">{type}</span>
                      <span>{bal.used}/{bal.total} days</span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(bal.used / bal.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'Leave' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowLeaveModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
              <Plus className="h-4 w-4" /> Request Leave
            </button>
          </div>
          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="p-4">Type</th><th className="p-4">Start</th><th className="p-4">End</th><th className="p-4">Reason</th><th className="p-4">Status</th>
                  {isManager && <th className="p-4">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {leaveArr.map((lr: any) => (
                  <tr key={lr.id} className="border-b border-border/50">
                    <td className="p-4 font-medium">{lr.leave_type}</td>
                    <td className="p-4 text-muted-foreground">{lr.start_date ? new Date(lr.start_date).toLocaleDateString() : ''}</td>
                    <td className="p-4 text-muted-foreground">{lr.end_date ? new Date(lr.end_date).toLocaleDateString() : ''}</td>
                    <td className="p-4 text-muted-foreground max-w-xs truncate">{lr.reason}</td>
                    <td className="p-4"><span className={lr.status === 'Approved' ? 'badge-success' : lr.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}>{lr.status}</span></td>
                    {isManager && lr.status === 'Pending' && (
                      <td className="p-4">
                        <div className="flex gap-1">
                          <button onClick={() => reviewLeaveMut.mutate({ id: lr.id, status: 'Approved', review_note: '' })} className="text-xs px-2 py-1 rounded bg-success/15 text-success hover:bg-success/25">Approve</button>
                          <button onClick={() => reviewLeaveMut.mutate({ id: lr.id, status: 'Rejected', review_note: '' })} className="text-xs px-2 py-1 rounded bg-destructive/15 text-destructive hover:bg-destructive/25">Reject</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Time Logs' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowTimeModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
              <Plus className="h-4 w-4" /> Log Time
            </button>
          </div>
          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="p-4">Date</th><th className="p-4">Hours</th><th className="p-4">Project</th><th className="p-4">Description</th><th className="p-4">Billable</th>
                </tr>
              </thead>
              <tbody>
                {timeArr.map((te: any) => (
                  <tr key={te.id} className="border-b border-border/50">
                    <td className="p-4">{te.date ? new Date(te.date).toLocaleDateString() : ''}</td>
                    <td className="p-4 font-medium">{te.hours}h</td>
                    <td className="p-4 text-muted-foreground">{te.project_name || '—'}</td>
                    <td className="p-4 text-muted-foreground max-w-xs truncate">{te.description}</td>
                    <td className="p-4">{te.is_billable ? <span className="badge-success">Billable</span> : <span className="badge-neutral">Non-billable</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Expenses' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowExpenseModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
              <Plus className="h-4 w-4" /> Add Expense
            </button>
          </div>
          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="p-4">Title</th><th className="p-4">Category</th><th className="p-4">Amount</th><th className="p-4">Date</th><th className="p-4">Status</th><th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenseArr.map((exp: any) => (
                  <tr key={exp.id} className="border-b border-border/50">
                    <td className="p-4 font-medium">{exp.title}</td>
                    <td className="p-4 text-muted-foreground">{exp.category}</td>
                    <td className="p-4 font-medium">${Number(exp.amount || 0).toLocaleString()}</td>
                    <td className="p-4 text-muted-foreground">{exp.expense_date ? new Date(exp.expense_date).toLocaleDateString() : ''}</td>
                    <td className="p-4"><span className={exp.status === 'Approved' ? 'badge-success' : exp.status === 'Draft' ? 'badge-neutral' : exp.status === 'Submitted' ? 'badge-info' : 'badge-warning'}>{exp.status}</span></td>
                    <td className="p-4">
                      {exp.status === 'Draft' && (
                        <button onClick={() => submitExpenseMut.mutate(exp.id)} className="text-xs text-primary hover:underline">Submit</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Request Leave</h2>
              <button onClick={() => setShowLeaveModal(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <select value={leaveForm.leave_type} onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              {leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Start Date</label><input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs text-muted-foreground">End Date</label><input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
            </div>
            <textarea placeholder="Reason" value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowLeaveModal(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => leaveMut.mutate(leaveForm)} disabled={leaveMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {leaveMut.isPending ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Log Modal */}
      {showTimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Log Time</h2>
              <button onClick={() => setShowTimeModal(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Date</label><input type="date" value={timeForm.date} onChange={e => setTimeForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs text-muted-foreground">Hours</label><input type="number" step="0.5" value={timeForm.hours} onChange={e => setTimeForm(f => ({ ...f, hours: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
            </div>
            <select value={timeForm.project_id} onChange={e => setTimeForm(f => ({ ...f, project_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="">Select Project</option>
              {projectsArr.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <textarea placeholder="Description" value={timeForm.description} onChange={e => setTimeForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={timeForm.is_billable} onChange={e => setTimeForm(f => ({ ...f, is_billable: e.target.checked }))} className="rounded" />
              <span className="text-muted-foreground">Billable</span>
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowTimeModal(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => timeMut.mutate(timeForm)} disabled={timeMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {timeMut.isPending ? 'Logging...' : 'Log Time'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Expense</h2>
              <button onClick={() => setShowExpenseModal(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Title" value={expenseForm.title} onChange={e => setExpenseForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="grid grid-cols-2 gap-3">
              <select value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" placeholder="Amount" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div><label className="text-xs text-muted-foreground">Date</label><input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
            <textarea placeholder="Description" value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowExpenseModal(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => expenseMut.mutate(expenseForm)} disabled={expenseMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {expenseMut.isPending ? 'Adding...' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
