import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useState } from 'react';
import { ArrowLeft, Plus, X, MessageSquare, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const taskStatuses = ['Open', 'In Progress', 'Review', 'Done', 'Cancelled'];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', type: 'Task', status: 'Open', priority: 'Medium', estimate_hours: '', due_date: '' });

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['project-tasks', id],
    queryFn: () => api.get('/tasks', { params: { project_id: id } }).then(r => r.data?.tasks || r.data || []),
    enabled: !!id,
  });

  const createTaskMut = useMutation({
    mutationFn: (d: any) => api.post('/tasks', { ...d, project_id: id, estimate_hours: d.estimate_hours ? Number(d.estimate_hours) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-tasks', id] }); setShowCreateTask(false); toast.success('Task created'); },
  });

  const updateTaskMut = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) => api.put(`/tasks/${taskId}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-tasks', id] }); toast.success('Updated'); },
  });

  if (isLoading) return <div className="page-container"><div className="glass-card h-64 animate-pulse" /></div>;
  if (!project) return <div className="page-container"><p className="text-muted-foreground">Project not found</p></div>;

  const tasksArr = Array.isArray(tasks) ? tasks : [];

  return (
    <div className="page-container">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </button>

      {/* Project Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.client_name || ''}</p>
          </div>
          <span className={project.status === 'Active' ? 'badge-success' : project.status === 'Completed' ? 'badge-info' : 'badge-neutral'}>{project.status}</span>
        </div>
        {project.description && <p className="text-sm text-muted-foreground mb-3">{project.description}</p>}
        {project.progress != null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span>{project.progress}%</span></div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${project.progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Tasks Kanban */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Tasks</h2>
        <button onClick={() => setShowCreateTask(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all">
          <Plus className="h-3 w-3" /> Add Task
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        {taskStatuses.map(status => {
          const col = tasksArr.filter((t: any) => t.status === status);
          return (
            <div key={status} className="min-w-[250px] flex-shrink-0">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{status}</h3>
                <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.map((task: any) => (
                  <div key={task.id} className="glass-card-hover p-3 space-y-2">
                    <div className="text-sm font-medium">{task.title}</div>
                    <div className="flex items-center justify-between">
                      <span className={task.priority === 'Critical' ? 'badge-danger' : task.priority === 'High' ? 'badge-warning' : 'badge-info'}>{task.priority}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {task.estimate_hours && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{task.estimate_hours}h</span>}
                      </div>
                    </div>
                    {task.assignee_name && <div className="text-xs text-muted-foreground">{task.assignee_name}</div>}
                    {/* Quick status change */}
                    <select
                      value={task.status}
                      onChange={e => updateTaskMut.mutate({ taskId: task.id, status: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-secondary border border-border text-xs focus:outline-none"
                      onClick={e => e.stopPropagation()}
                    >
                      {taskStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
                {col.length === 0 && <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">No tasks</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Members */}
      {project.members && project.members.length > 0 && (
        <div className="glass-card p-5 mt-4">
          <h3 className="text-sm font-semibold mb-3">Team Members</h3>
          <div className="flex flex-wrap gap-2">
            {(project.members as any[]).map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-1.5">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">{m.full_name?.[0]}</div>
                <span className="text-xs font-medium">{m.full_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Task</h2>
              <button onClick={() => setShowCreateTask(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Task Title" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="grid grid-cols-2 gap-3">
              <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {['Critical', 'High', 'Medium', 'Low'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input type="number" placeholder="Est. Hours" value={taskForm.estimate_hours} onChange={e => setTaskForm(f => ({ ...f, estimate_hours: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreateTask(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => createTaskMut.mutate(taskForm)} disabled={createTaskMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createTaskMut.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
