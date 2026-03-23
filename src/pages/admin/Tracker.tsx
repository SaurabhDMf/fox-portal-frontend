import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Clock, Calendar, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import toast from 'react-hot-toast';
import StatCard from '@/components/ui/StatCard';

const tabs = ['Overview', 'Leave', 'Time Logs', 'Expenses'];

export default function Tracker() {
  const [tab, setTab] = useState('Overview');
  const qc = useQueryClient();

  const { data: summary } = useQuery({
    queryKey: ['tracker-summary'],
    queryFn: () => api.get('/tracker/tracker-summary').then(r => r.data),
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => api.get('/tracker/leave-requests').then(r => r.data?.leave_requests || r.data || []),
    enabled: tab === 'Leave',
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

  const checkInMut = useMutation({
    mutationFn: () => api.post('/tracker/attendance/check-in'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tracker-summary'] }); toast.success('Checked in'); },
  });

  const checkOutMut = useMutation({
    mutationFn: () => api.post('/tracker/attendance/check-out'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tracker-summary'] }); toast.success('Checked out'); },
  });

  const s = summary || {};

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
          {/* Check in/out card */}
          <div className="glass-card p-5 flex flex-col sm:flex-row items-center gap-4">
            <Clock className="h-8 w-8 text-primary" />
            <div className="flex-1 text-center sm:text-left">
              <div className="text-sm text-muted-foreground">Today</div>
              <div className="text-xl font-bold">{s.today_hours || '0h 0m'}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => checkInMut.mutate()} className="px-4 py-2 rounded-lg bg-success/15 text-success text-sm font-medium hover:bg-success/25 active:scale-[0.97] transition-all flex items-center gap-1">
                <ArrowUpRight className="h-4 w-4" /> Check In
              </button>
              <button onClick={() => checkOutMut.mutate()} className="px-4 py-2 rounded-lg bg-destructive/15 text-destructive text-sm font-medium hover:bg-destructive/25 active:scale-[0.97] transition-all flex items-center gap-1">
                <ArrowDownRight className="h-4 w-4" /> Check Out
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Hours This Month" value={s.monthly_hours || '0'} icon={Clock} />
            <StatCard label="Leave Balance" value={s.leave_balance ?? '—'} icon={Calendar} iconColor="text-info" />
            <StatCard label="Pending Expenses" value={s.pending_expenses ? `$${s.pending_expenses}` : '$0'} icon={DollarSign} iconColor="text-warning" />
          </div>
        </div>
      )}

      {tab === 'Leave' && (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-4">Type</th><th className="p-4">Start</th><th className="p-4">End</th><th className="p-4">Reason</th><th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(leaveRequests) ? leaveRequests : []).map((lr: any) => (
                <tr key={lr.id} className="border-b border-border/50">
                  <td className="p-4 font-medium">{lr.leave_type}</td>
                  <td className="p-4 text-muted-foreground">{lr.start_date ? new Date(lr.start_date).toLocaleDateString() : ''}</td>
                  <td className="p-4 text-muted-foreground">{lr.end_date ? new Date(lr.end_date).toLocaleDateString() : ''}</td>
                  <td className="p-4 text-muted-foreground">{lr.reason}</td>
                  <td className="p-4"><span className={lr.status === 'Approved' ? 'badge-success' : lr.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}>{lr.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Time Logs' && (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-4">Date</th><th className="p-4">Hours</th><th className="p-4">Project</th><th className="p-4">Description</th><th className="p-4">Billable</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(timeEntries) ? timeEntries : []).map((te: any) => (
                <tr key={te.id} className="border-b border-border/50">
                  <td className="p-4">{te.date ? new Date(te.date).toLocaleDateString() : ''}</td>
                  <td className="p-4 font-medium">{te.hours}h</td>
                  <td className="p-4 text-muted-foreground">{te.project_name || '—'}</td>
                  <td className="p-4 text-muted-foreground">{te.description}</td>
                  <td className="p-4">{te.is_billable ? <span className="badge-success">Yes</span> : <span className="badge-neutral">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Expenses' && (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-4">Title</th><th className="p-4">Category</th><th className="p-4">Amount</th><th className="p-4">Date</th><th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(expenses) ? expenses : []).map((exp: any) => (
                <tr key={exp.id} className="border-b border-border/50">
                  <td className="p-4 font-medium">{exp.title}</td>
                  <td className="p-4 text-muted-foreground">{exp.category}</td>
                  <td className="p-4 font-medium">${Number(exp.amount || 0).toLocaleString()}</td>
                  <td className="p-4 text-muted-foreground">{exp.expense_date ? new Date(exp.expense_date).toLocaleDateString() : ''}</td>
                  <td className="p-4"><span className={exp.status === 'Approved' ? 'badge-success' : exp.status === 'Draft' ? 'badge-neutral' : 'badge-warning'}>{exp.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
