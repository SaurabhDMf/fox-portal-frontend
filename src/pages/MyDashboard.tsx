import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import { ListChecks, FolderKanban, Target, FileText, Clock, ArrowUpRight, ArrowDownRight, CheckCircle2, Coffee, Plus, Trash2, StickyNote } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const fmtNum = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function MyDashboard() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const basePath = window.location.pathname.startsWith('/admin') ? '/admin' : window.location.pathname.startsWith('/portal') ? '/portal' : '/emp';

  const { data, isLoading } = useQuery({
    queryKey: ['my-dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
  });

  const { data: trackerSummary } = useQuery({
    queryKey: ['tracker-summary'],
    queryFn: () => api.get('/tracker/tracker-summary').then(r => r.data),
  });

  // Normalize backend response — different shapes use different field names
  const normalizeAttendance = (raw: any) => {
    if (!raw) return {};
    const r = raw?.data ?? raw;
    const checkIn = r.check_in_time ?? r.check_in ?? r.checkin_time ?? r.checked_in_at ?? r.checkInTime ?? r.start_time ?? null;
    const checkOut = r.check_out_time ?? r.check_out ?? r.checkout_time ?? r.checked_out_at ?? r.checkOutTime ?? r.end_time ?? null;
    const isCheckedIn = !!(checkIn && !checkOut) || r.checked_in === true || r.is_checked_in === true || r.status === 'checked_in';
    return {
      ...r,
      check_in_time: checkIn,
      check_out_time: checkOut,
      checked_in: isCheckedIn,
      hours_worked: r.hours_worked ?? r.hours ?? r.total_hours ?? 0,
    };
  };

  const { data: today } = useQuery({
    queryKey: ['today-attendance'],
    queryFn: () => api.get('/tracker/attendance/today').then(r => normalizeAttendance(r.data?.data ?? r.data)),
    refetchInterval: 60_000,
  });

  // Current-month target + received for this user
  const currentDate = new Date();
  const { data: targetData } = useQuery({
    queryKey: ['my-target', user?.id, currentDate.getFullYear(), currentDate.getMonth() + 1],
    queryFn: () => api.get('/performance-targets', {
      params: { user_id: user?.id, year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 },
    }).then(r => r.data),
    enabled: !!user?.id,
  });

  // Today's personal notes
  const { data: notesData } = useQuery({
    queryKey: ['my-notes-today', todayStr()],
    queryFn: () => api.get('/personal-notes', { params: { date: todayStr() } }).then(r => r.data?.data || []),
  });
  const todayNotes: any[] = Array.isArray(notesData) ? notesData : [];

  const [noteInput, setNoteInput] = useState('');
  const addNote = useMutation({
    mutationFn: (content: string) => api.post('/personal-notes', { content, note_date: todayStr() }),
    onSuccess: () => {
      setNoteInput('');
      qc.invalidateQueries({ queryKey: ['my-notes-today', todayStr()] });
    },
  });
  const toggleNote = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.patch(`/personal-notes/${id}`, { completed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notes-today', todayStr()] }),
  });
  const deleteNote = useMutation({
    mutationFn: (id: string) => api.delete(`/personal-notes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notes-today', todayStr()] }),
  });

  const invalidateTracker = () => {
    qc.invalidateQueries({ queryKey: ['today-attendance'] });
    qc.invalidateQueries({ queryKey: ['tracker-summary'] });
  };

  const checkInMut = useMutation({
    mutationFn: () => api.post('/tracker/attendance/check-in'),
    onSuccess: (res: any) => {
      // Optimistically seed the today cache from the response so the timer starts immediately
      const payload = normalizeAttendance(res?.data?.data ?? res?.data ?? {});
      if (payload.check_in_time) {
        qc.setQueryData(['today-attendance'], payload);
      } else {
        // Fallback: stamp now so the UI flips to "running" until refetch returns the real time
        qc.setQueryData(['today-attendance'], { check_in_time: new Date().toISOString(), checked_in: true });
      }
      invalidateTracker();
      toast.success('Checked in! Timer started.');
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || e?.response?.data?.message || 'Check-in failed';
      // If backend says already checked in, refetch to sync the UI with the real state
      if (/already/i.test(msg)) invalidateTracker();
      toast.error(msg);
    },
  });
  const checkOutMut = useMutation({
    mutationFn: () => api.post('/tracker/attendance/check-out'),
    onSuccess: (res: any) => {
      const payload = normalizeAttendance(res?.data?.data ?? res?.data ?? {});
      if (payload.check_out_time) qc.setQueryData(['today-attendance'], payload);
      invalidateTracker();
      toast.success('Checked out. Have a great day!');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e?.response?.data?.message || 'Check-out failed'),
  });

  const startBreakMut = useMutation({
    mutationFn: () => api.post('/tracker/attendance/break-start'),
    onSuccess: (res: any) => {
      const payload = normalizeAttendance(res?.data?.data ?? res?.data ?? {});
      qc.setQueryData(['today-attendance'], payload);
      invalidateTracker();
      toast.success('Break started!');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to start break'),
  });

  const endBreakMut = useMutation({
    mutationFn: () => api.post('/tracker/attendance/break-end'),
    onSuccess: (res: any) => {
      const payload = normalizeAttendance(res?.data?.data ?? res?.data ?? {});
      qc.setQueryData(['today-attendance'], payload);
      invalidateTracker();
      toast.success('Break ended!');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to end break'),
  });

  // Live tick — updates running timer every second while checked in
  const [now, setNow] = useState(Date.now());
  const isActive = !!today?.check_in_time && !today?.check_out_time;
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const formatElapsed = () => {
    if (today?.check_in_time && today?.check_out_time) {
      const hrs = Number(today.hours_worked || 0);
      return `${Math.floor(hrs)}h ${Math.round((hrs % 1) * 60)}m`;
    }
    if (today?.check_in_time) {
      const ms = now - new Date(today.check_in_time).getTime();
      const totalSec = Math.max(0, Math.floor(ms / 1000));
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }
    const th = trackerSummary?.today_hours;
    return typeof th === 'string' || typeof th === 'number' ? String(th) : '0h 0m';
  };

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const stats = data?.stats || {};
  const myTasks: any[] = Array.isArray(data?.my_tasks) ? data.my_tasks : [];
  const myProjects: any[] = Array.isArray(data?.my_projects) ? data.my_projects : [];
  const myLeads: any[] = Array.isArray(data?.my_leads) ? data.my_leads : [];
  const myInvoices: any[] = Array.isArray(data?.my_invoices) ? data.my_invoices : [];

  // Coerce stat values to numbers — backend may return objects like { count: N } or strings
  const toNum = (v: any, fallback = 0): number => {
    if (v == null) return fallback;
    if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
    if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
    if (typeof v === 'object') return toNum(v.count ?? v.value ?? v.total, fallback);
    return fallback;
  };
  

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.full_name}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Tasks" value={toNum(stats.tasks, myTasks.length)} icon={ListChecks} />
        <StatCard label="My Projects" value={toNum(stats.projects, myProjects.length)} icon={FolderKanban} iconColor="text-info" />
        <StatCard label="Open Leads" value={toNum(stats.leads, myLeads.length)} icon={Target} iconColor="text-warning" />
        <StatCard label="Invoices" value={toNum(stats.invoices, myInvoices.length)} icon={FileText} iconColor="text-success" />
      </div>

      {/* Monthly Target vs Received */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()} — Target vs Received</h2>
        </div>
        {(() => {
          const t = Number(targetData?.target_value || 0);
          const a = Number(targetData?.actual_sale  || 0);
          const pct = t > 0 ? Math.min(100, (a / t) * 100) : 0;
          const pending = Math.max(0, t - a);
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Target</p>
                <p className="text-xl font-bold mt-1">{fmtNum(t)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Received</p>
                <p className="text-xl font-bold mt-1 text-success">{fmtNum(a)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
                <p className="text-xl font-bold mt-1 text-warning">{fmtNum(pending)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Progress</p>
                <p className="text-xl font-bold mt-1">{pct.toFixed(1)}%</p>
                <div className="w-full bg-secondary h-2 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Time Tracker */}
      <div className={`glass-card p-5 flex flex-col sm:flex-row items-center gap-4 transition-colors ${isActive ? 'ring-1 ring-success/40' : ''}`}>
        <div className="relative">
          <Clock className={`h-8 w-8 ${isActive ? 'text-success' : 'text-primary'}`} />
          {isActive && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
            </span>
          )}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-muted-foreground">
            Today
            {isActive && !today?.on_break && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-semibold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Live
              </span>
            )}
            {today?.on_break === 1 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-semibold uppercase tracking-wider">
                <Coffee className="h-3 w-3" /> On Break
              </span>
            )}
          </div>
          <div className={`text-xl font-bold tabular-nums ${today?.on_break === 1 ? 'text-warning' : isActive ? 'text-success' : ''}`}>{formatElapsed()}</div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1 text-xs">
            {today?.check_in_time && <span className="text-success font-medium">In: {fmtTime(today.check_in_time)}</span>}
            {today?.check_out_time && <span className="text-destructive font-medium">Out: {fmtTime(today.check_out_time)}</span>}
            {(today?.total_break_minutes > 0) && <span className="text-muted-foreground">Break: {today.total_break_minutes}m</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
          {!today?.check_in_time && (
            <button
              onClick={() => checkInMut.mutate()}
              disabled={checkInMut.isPending}
              className="px-4 py-2 rounded-lg bg-success text-success-foreground text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all flex items-center gap-1 disabled:opacity-50"
            >
              <ArrowUpRight className="h-4 w-4" /> {checkInMut.isPending ? 'Checking in…' : 'Check In'}
            </button>
          )}
          {today?.check_in_time && !today?.check_out_time && !today?.on_break && (
            <button
              onClick={() => startBreakMut.mutate()}
              disabled={startBreakMut.isPending}
              className="px-4 py-2 rounded-lg border border-warning text-warning text-sm font-semibold hover:bg-warning/10 active:scale-[0.97] transition-all flex items-center gap-1 disabled:opacity-50"
            >
              <Coffee className="h-4 w-4" /> {startBreakMut.isPending ? 'Starting…' : 'Break'}
            </button>
          )}
          {today?.on_break === 1 && (
            <button
              onClick={() => endBreakMut.mutate()}
              disabled={endBreakMut.isPending}
              className="px-4 py-2 rounded-lg border border-success text-success text-sm font-semibold hover:bg-success/10 active:scale-[0.97] transition-all flex items-center gap-1 disabled:opacity-50"
            >
              <Coffee className="h-4 w-4" /> {endBreakMut.isPending ? 'Resuming…' : 'Resume'}
            </button>
          )}
          {today?.check_in_time && !today?.check_out_time && !today?.on_break && (
            <button
              onClick={() => checkOutMut.mutate()}
              disabled={checkOutMut.isPending}
              className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all flex items-center gap-1 disabled:opacity-50"
            >
              <ArrowDownRight className="h-4 w-4" /> {checkOutMut.isPending ? 'Checking out…' : 'Check Out'}
            </button>
          )}
          {today?.check_in_time && today?.check_out_time && (
            <span className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" /> Day complete
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Notes */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2"><StickyNote className="h-4 w-4 text-primary" /> Today's Notes</h2>
            <button onClick={() => navigate(`${basePath === '/portal' ? '/portal' : basePath}/tasks`)} className="text-xs text-primary hover:underline">View all</button>
          </div>
          <form onSubmit={e => { e.preventDefault(); const v = noteInput.trim(); if (v) addNote.mutate(v); }} className="flex gap-2 mb-3">
            <input value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="Add a note for today…"
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none" />
            <button type="submit" disabled={addNote.isPending || !noteInput.trim()}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1">
              <Plus className="h-4 w-4" />
            </button>
          </form>
          <div className="space-y-1.5">
            {todayNotes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No notes yet — add one above</p>}
            {todayNotes.map((n: any) => (
              <div key={n.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/40 group">
                <input type="checkbox" checked={!!n.completed}
                  onChange={() => toggleNote.mutate({ id: n.id, completed: !n.completed })}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
                <span className={`flex-1 text-sm ${n.completed ? 'line-through text-muted-foreground' : ''}`}>{n.content}</span>
                <button onClick={() => deleteNote.mutate(n.id)}
                  className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* My Tasks */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">My Tasks</h2>
            {basePath !== '/portal' && (
              <button onClick={() => navigate(`${basePath}/tasks`)} className="text-xs text-primary hover:underline">View all</button>
            )}
          </div>
          <div className="space-y-2">
            {myTasks.slice(0, 6).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                <div>
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.project_name}</div>
                </div>
                <span className={t.status === 'Done' ? 'badge-success' : t.status === 'In Progress' ? 'badge-info' : 'badge-neutral'}>{t.status}</span>
              </div>
            ))}
            {myTasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No tasks assigned</p>}
          </div>
        </div>

        {/* My Projects */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">My Projects</h2>
            <button onClick={() => navigate(`${basePath}/projects`)} className="text-xs text-primary hover:underline">View all</button>
          </div>
          <div className="space-y-2">
            {myProjects.slice(0, 6).map((p: any) => (
              <div key={p.id} onClick={() => navigate(`${basePath}/projects/${p.id}`)} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-6 rounded-full flex-shrink-0" style={{ background: p.color || 'hsl(var(--primary))' }} />
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.client_name}</div>
                  </div>
                </div>
                <span className={p.status === 'Active' ? 'badge-success' : p.status === 'Completed' ? 'badge-info' : 'badge-neutral'}>{p.status}</span>
              </div>
            ))}
            {myProjects.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No projects</p>}
          </div>
        </div>

        {/* My Leads */}
        {myLeads.length > 0 && (
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">My Leads</h2>
              {basePath === '/admin' && (
                <button onClick={() => navigate('/admin/crm')} className="text-xs text-primary hover:underline">View all</button>
              )}
            </div>
            <div className="space-y-2">
              {myLeads.slice(0, 5).map((l: any) => (
                <div key={l.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                  <div>
                    <div className="text-sm font-medium">{l.full_name}</div>
                    <div className="text-xs text-muted-foreground">{l.company_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{l.deal_value ? `$${Number(l.deal_value).toLocaleString()}` : '—'}</div>
                    <span className={l.status === 'Closed Won' ? 'badge-success' : l.status === 'Closed Lost' ? 'badge-danger' : 'badge-info'}>{l.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Invoices */}
        {myInvoices.length > 0 && (
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">My Invoices</h2>
              <button onClick={() => navigate(basePath === '/portal' ? '/portal/invoices' : `${basePath}/invoicing`)} className="text-xs text-primary hover:underline">View all</button>
            </div>
            <div className="space-y-2">
              {myInvoices.slice(0, 5).map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                  <div>
                    <div className="text-sm font-medium">{inv.invoice_number || inv.id?.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{inv.client_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">${Number(inv.total || 0).toLocaleString()}</div>
                    <span className={inv.status === 'Paid' ? 'badge-success' : inv.status === 'Overdue' ? 'badge-danger' : 'badge-warning'}>{inv.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="glass-card h-48 animate-pulse" />)}
        </div>
      )}
    </div>
  );
}