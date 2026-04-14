import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import api from '@/lib/api';
import { ArrowLeft, Calendar, Users, X, ChevronDown, Paperclip, Plus, Send } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import toast from 'react-hot-toast';

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const initials = (n?: string) => n ? n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

const STATUS_CLS: Record<string, string> = {
  Active: 'bg-success/15 text-success',
  Completed: 'bg-secondary text-muted-foreground',
  Planned: 'bg-info/15 text-info',
  Open: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  'In Progress': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  Review: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  Done: 'bg-green-500/15 text-green-700 dark:text-green-400',
  Cancelled: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

const PRIORITY_CLS: Record<string, string> = {
  High: 'bg-red-500/15 text-red-700 dark:text-red-400',
  Critical: 'bg-red-500/15 text-red-700 dark:text-red-400',
  Medium: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  Low: 'bg-green-500/15 text-green-700 dark:text-green-400',
};

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>;
}

/* ─── Readable Description ─── */
function ReadableDescription({ text }: { text?: string }) {
  if (!text) return null;

  // Parse URLs, bold (**text**), and line breaks for a more interactive display
  const renderLine = (line: string, i: number) => {
    // Split by URLs and bold markers
    const parts = line.split(/(https?:\/\/[^\s]+|\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {parts.map((part, j) => {
          if (part.match(/^https?:\/\//)) {
            return <a key={j} href={part} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{part}</a>;
          }
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
          }
          return <span key={j}>{part}</span>;
        })}
      </span>
    );
  };

  const lines = text.split('\n');
  // Detect if it has bullet points or numbered lists
  const hasList = lines.some(l => /^\s*[-•]\s/.test(l) || /^\s*\d+[.)]\s/.test(l));

  return (
    <div className="text-sm text-foreground/90 leading-relaxed space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        // Bullet points
        if (/^[-•]\s/.test(trimmed)) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-primary mt-0.5">•</span>
              <span>{renderLine(trimmed.replace(/^[-•]\s/, ''), i)}</span>
            </div>
          );
        }
        // Numbered list
        const numMatch = trimmed.match(/^(\d+)[.)]\s(.*)/);
        if (numMatch) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-muted-foreground font-medium min-w-[1.2rem] text-right">{numMatch[1]}.</span>
              <span>{renderLine(numMatch[2], i)}</span>
            </div>
          );
        }

        return <p key={i}>{renderLine(line, i)}</p>;
      })}
    </div>
  );
}

export default function CPProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const { data: project = {}, isLoading } = useQuery({
    queryKey: ['cp-project', id],
    queryFn: () => api.get(`/client/projects/${id}`).then(r => r.data?.data || r.data || {}),
    enabled: !!id,
  });

  if (isLoading) return <div className="page-container"><div className="text-center py-20 text-muted-foreground">Loading...</div></div>;

  const done = project.done_tasks ?? 0;
  const total = project.total_tasks ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const members = project.members || project.team || [];

  return (
    <div className="page-container">
      <button onClick={() => navigate('/client-portal/projects')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </button>

      {/* Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{project.name}</h1>
            {project.description && (
              <div className="mt-2">
                <ReadableDescription text={project.description} />
              </div>
            )}
          </div>
          <StatusBadge status={project.status} />
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
          {project.start_date && <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Start: {fmtDate(project.start_date)}</div>}
          {project.due_date && <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Due: {fmtDate(project.due_date)}</div>}
          {project.lead_name && (
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">{project.lead_name[0]}</div>
              Lead: {project.lead_name}
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="sprints">Sprints</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab project={project} done={done} total={total} pct={pct} members={members} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab projectId={id!} onTaskClick={setSelectedTask} />
        </TabsContent>
        <TabsContent value="sprints">
          <SprintsTab projectId={id!} />
        </TabsContent>
        <TabsContent value="modules">
          <ModulesTab projectId={id!} />
        </TabsContent>
      </Tabs>

      {selectedTask && <TaskDetailDrawer task={selectedTask} projectId={id!} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}

/* ─── Overview Tab ─── */
function OverviewTab({ project, done, total, pct, members }: { project: any; done: number; total: number; pct: number; members: any[] }) {
  const sprints = project.sprints || [];
  const activeSprints = sprints.filter((s: any) => s.status === 'Active').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-4">
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">Progress</h3>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{done}/{total} tasks completed</span>
            <span className="font-medium text-foreground">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-4 text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Tasks</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className="text-2xl font-bold">{activeSprints}</div>
            <div className="text-xs text-muted-foreground mt-1">Active Sprints</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className="text-2xl font-bold">{members.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Team Members</div>
          </div>
        </div>

        {project.lead_name && (
          <div className="glass-card p-4 flex items-center gap-3">
            {project.lead_avatar ? (
              <img src={project.lead_avatar} className="w-10 h-10 rounded-full" alt="" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">{project.lead_name[0]}</div>
            )}
            <div>
              <div className="text-sm font-medium">{project.lead_name}</div>
              <div className="text-xs text-muted-foreground">Project Lead</div>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1"><Users className="h-4 w-4" /> Team</h3>
        {members.length > 0 ? (
          <div className="glass-card p-4 space-y-3">
            {members.map((m: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(m.full_name || m.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">{m.full_name || m.name}</div>
                  {m.role && <div className="text-xs text-muted-foreground">{m.role}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-8 text-center text-muted-foreground text-sm">No team members</div>
        )}
      </div>
    </div>
  );
}

/* ─── Tasks Tab ─── */
function TasksTab({ projectId, onTaskClick }: { projectId: string; onTaskClick: (t: any) => void }) {
  const qc = useQueryClient();
  const [statusF, setStatusF] = useState('');
  const [priorityF, setPriorityF] = useState('');
  const [sprintF, setSprintF] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [canCreate, setCanCreate] = useState<boolean | null>(null);

  const { data: rawTasks = [], isLoading } = useQuery({
    queryKey: ['cp-project-tasks', projectId],
    queryFn: () => api.get(`/client/projects/${projectId}/tasks`).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }),
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['cp-project-sprints', projectId],
    queryFn: () => api.get(`/client/projects/${projectId}/sprints`).then(r => {
      const d = r.data?.data ?? r.data?.sprints ?? r.data;
      return Array.isArray(d) ? d : [];
    }),
  });

  // Check if client can create tasks by attempting a preflight-style check
  useQuery({
    queryKey: ['cp-can-create-task', projectId],
    queryFn: async () => {
      try {
        // Try OPTIONS or a lightweight check; fallback: attempt POST with empty to see 403 vs 400
        await api.post(`/client/projects/${projectId}/tasks`, { title: '' });
        setCanCreate(true);
        return true;
      } catch (e: any) {
        if (e.response?.status === 403) { setCanCreate(false); return false; }
        // 400/422 means endpoint exists and is allowed, just validation failed
        setCanCreate(true);
        return true;
      }
    },
    retry: false,
    staleTime: Infinity,
  });

  const tasks = rawTasks.filter((t: any) => {
    if (statusF && t.status !== statusF) return false;
    if (priorityF && t.priority !== priorityF) return false;
    if (sprintF && t.sprint_id !== sprintF) return false;
    return true;
  });

  const statuses = [...new Set(rawTasks.map((t: any) => t.status).filter(Boolean))];
  const priorities = [...new Set(rawTasks.map((t: any) => t.priority).filter(Boolean))];
  const hasFilters = statusF || priorityF || sprintF;

  const selectCls = "px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[100px]";

  return (
    <div className="space-y-4">
      {/* Filters + New Task button */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={statusF} onChange={e => setStatusF(e.target.value)} className={selectCls}>
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={priorityF} onChange={e => setPriorityF(e.target.value)} className={selectCls}>
          <option value="">All Priorities</option>
          {priorities.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sprintF} onChange={e => setSprintF(e.target.value)} className={selectCls}>
          <option value="">All Sprints</option>
          {sprints.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setStatusF(''); setPriorityF(''); setSprintF(''); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        {canCreate && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-3.5 w-3.5" /> New Task
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Sprint</TableHead>
              <TableHead>Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">Loading tasks…</TableCell></TableRow>
            ) : tasks.length > 0 ? tasks.map((t: any) => (
              <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onTaskClick(t)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {t.task_number && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t.task_number}</span>}
                    <span className="font-medium text-sm">{t.title}</span>
                  </div>
                </TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell>
                  <Badge variant="secondary" className={`text-[10px] ${PRIORITY_CLS[t.priority] || ''}`}>{t.priority || '—'}</Badge>
                </TableCell>
                <TableCell>
                  {t.assignee_name ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {t.assignee_avatar && <AvatarImage src={t.assignee_avatar} />}
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(t.assignee_name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs">{t.assignee_name}</span>
                    </div>
                  ) : <span className="text-xs text-muted-foreground">Unassigned</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.sprint_name || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(t.due_date)}</TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No tasks found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Task Modal */}
      {showCreate && (
        <ClientCreateTaskModal
          projectId={projectId}
          sprints={sprints}
          onClose={() => setShowCreate(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['cp-project-tasks', projectId] }); setShowCreate(false); }}
        />
      )}
    </div>
  );
}

/* ─── Client Create Task Modal ─── */
function ClientCreateTaskModal({ projectId, sprints, onClose, onCreated }: { projectId: string; sprints: any[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'Medium', sprint_id: '', due_date: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setLoading(true);
    try {
      await api.post(`/client/projects/${projectId}/tasks`, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        sprint_id: form.sprint_id || undefined,
        due_date: form.due_date || undefined,
      });
      toast.success('Task created');
      onCreated();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Task</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Task title" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={5} className={`${inputCls} resize-y min-h-[100px]`} placeholder="Describe the task..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inputCls}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Sprint</label>
              <select value={form.sprint_id} onChange={e => setForm(f => ({ ...f, sprint_id: e.target.value }))} className={inputCls}>
                <option value="">None</option>
                {sprints.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Due Date</label>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputCls} />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Sprints Tab ─── */
function SprintsTab({ projectId }: { projectId: string }) {
  const { data: sprints = [], isLoading } = useQuery({
    queryKey: ['cp-project-sprints', projectId],
    queryFn: () => api.get(`/client/projects/${projectId}/sprints`).then(r => {
      const d = r.data?.data ?? r.data?.sprints ?? r.data;
      return Array.isArray(d) ? d : [];
    }),
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground text-sm">Loading sprints…</div>;

  return sprints.length > 0 ? (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sprints.map((s: any) => {
        const done = s.done_tasks ?? 0;
        const total = s.total_tasks ?? 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div key={s.id} className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{s.name}</h3>
              <StatusBadge status={s.status} />
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {fmtDate(s.start_date)} — {fmtDate(s.end_date)}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{done}/{total} tasks</span>
                <span>{pct}%</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    <div className="glass-card p-12 text-center text-muted-foreground text-sm">No sprints available</div>
  );
}

/* ─── Modules/Epics Tab ─── */
function ModulesTab({ projectId }: { projectId: string }) {
  const { data: epics = [], isLoading } = useQuery({
    queryKey: ['cp-project-epics', projectId],
    queryFn: () => api.get(`/client/projects/${projectId}/epics`).then(r => {
      const d = r.data?.data ?? r.data?.epics ?? r.data;
      return Array.isArray(d) ? d : [];
    }),
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground text-sm">Loading modules…</div>;

  return epics.length > 0 ? (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {epics.map((e: any) => {
        const done = e.done_tasks ?? 0;
        const total = e.total_tasks ?? 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div key={e.id} className="glass-card overflow-hidden">
            <div className="h-1.5" style={{ backgroundColor: e.color || 'hsl(var(--primary))' }} />
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{e.title || e.name}</h3>
                <StatusBadge status={e.status} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{done}/{total} tasks</span>
                  <span>{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    <div className="glass-card p-12 text-center text-muted-foreground text-sm">No modules available</div>
  );
}

/* ─── Task Detail Drawer ─── */
function TaskDetailDrawer({ task, projectId, onClose }: { task: any; projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState('');

  const { data: detail } = useQuery({
    queryKey: ['cp-task-detail', task.id],
    queryFn: () => api.get(`/client/projects/${projectId}/tasks/${task.id}`).then(r => r.data?.data || r.data || {}),
    enabled: !!task.id,
  });

  const t = { ...task, ...detail };
  const comments = t.comments || [];
  const subtasks = t.subtasks || [];
  const attachments = t.attachments || [];

  const commentMut = useMutation({
    mutationFn: async (text: string) => {
      const trimmed = text.trim();
      try {
        return await api.post(`/client/projects/${projectId}/tasks/${task.id}/comments`, { text: trimmed });
      } catch (e: any) {
        if (e.response?.status === 400 || e.response?.status === 422) {
          try { return await api.post(`/client/projects/${projectId}/tasks/${task.id}/comments`, { message: trimmed }); }
          catch (e2: any) {
            if (e2.response?.status === 400 || e2.response?.status === 422) {
              return api.post(`/client/projects/${projectId}/tasks/${task.id}/comments`, { content: trimmed });
            }
            throw e2;
          }
        }
        throw e;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cp-task-detail', task.id] });
      setCommentText('');
      toast.success('Comment added');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to add comment'),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background border-l border-border shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            {t.task_number && <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t.task_number}</span>}
            <h2 className="text-sm font-semibold truncate">{t.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-6">
          {/* Meta */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={t.status} />
            {t.priority && <Badge variant="secondary" className={`text-[10px] ${PRIORITY_CLS[t.priority] || ''}`}>{t.priority}</Badge>}
            {t.type && <Badge variant="secondary" className="text-[10px]">{t.type}</Badge>}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-muted-foreground">Assignee</span><div className="mt-1 font-medium">{t.assignee_name || 'Unassigned'}</div></div>
            <div><span className="text-muted-foreground">Sprint</span><div className="mt-1 font-medium">{t.sprint_name || '—'}</div></div>
            <div><span className="text-muted-foreground">Due Date</span><div className="mt-1 font-medium">{fmtDate(t.due_date)}</div></div>
            <div><span className="text-muted-foreground">Module</span><div className="mt-1 font-medium">{t.epic_title || t.epic_name || '—'}</div></div>
          </div>

          {/* Description - interactive */}
          {t.description && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Description</h4>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <ReadableDescription text={t.description} />
              </div>
            </div>
          )}

          {/* Subtasks */}
          {subtasks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Subtasks ({subtasks.length})</h4>
              <div className="space-y-1.5">
                {subtasks.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                    <span>{s.title}</span>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Attachments ({attachments.length})</h4>
              <div className="space-y-1.5">
                {attachments.map((a: any, i: number) => (
                  <a key={i} href={a.url || a.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm hover:bg-muted">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{a.name || a.file_name || 'Attachment'}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Comments {comments.length > 0 && `(${comments.length})`}</h4>
            {comments.length > 0 && (
              <div className="space-y-3 mb-4">
                {comments.map((c: any) => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        {c.author_avatar && <AvatarImage src={c.author_avatar} />}
                        <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{initials(c.author_name || c.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">{c.author_name || c.full_name || 'Unknown'}</span>
                      <span className="text-[10px] text-muted-foreground">{fmtDate(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground pl-7">{c.text || c.content || c.body || c.message}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Comment input */}
            <div className="flex gap-2">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && commentText.trim()) commentMut.mutate(commentText); }}
                placeholder="Add a comment…"
                className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={() => { if (commentText.trim()) commentMut.mutate(commentText); }}
                disabled={!commentText.trim() || commentMut.isPending}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
