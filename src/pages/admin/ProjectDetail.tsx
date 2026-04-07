import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useState } from 'react';
import { ArrowLeft, LayoutGrid, List, Zap, Timer, Users, Pencil, Trash2, X } from 'lucide-react';
import { extractProjectEntity } from '@/lib/projectResponse';
import type { Project, ProjectTask } from '@/lib/projectTypes';
import KanbanBoard from '@/components/projects/KanbanBoard';
import BacklogView from '@/components/projects/BacklogView';
import EpicsView from '@/components/projects/EpicsView';
import SprintsView from '@/components/projects/SprintsView';
import MembersView from '@/components/projects/MembersView';
import TaskDetailDrawer from '@/components/projects/TaskDetailDrawer';
import CreateTaskModal from '@/components/projects/CreateTaskModal';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'board', label: 'Board', icon: LayoutGrid },
  { id: 'backlog', label: 'Backlog', icon: List },
  { id: 'epics', label: 'Epics', icon: Zap },
  { id: 'sprints', label: 'Sprints', icon: Timer },
  { id: 'members', label: 'Members', icon: Users },
] as const;

type TabId = typeof TABS[number]['id'];

const statusOptions = ['Active', 'On Hold', 'Completed', 'Cancelled'];
const priorityOptions = ['Critical', 'High', 'Medium', 'Low'];
const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('board');
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [createTaskStatus, setCreateTaskStatus] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', status: 'Active', priority: 'Medium', start_date: '', due_date: '', color: '#3B82F6' });

  const { data: projectRaw, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then(r => extractProjectEntity<Project>(r.data, ['project'])),
    enabled: !!id,
  });

  const project: Project | undefined = projectRaw;

  const updateMut = useMutation({
    mutationFn: (d: typeof editForm) => api.put(`/projects/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setShowEdit(false);
      toast.success('Project updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update'),
  });

  const cancelMut = useMutation({
    mutationFn: () => api.put(`/projects/${id}`, { status: 'Cancelled' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setShowCancelConfirm(false);
      toast.success('Project cancelled');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to cancel'),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
      const basePath = window.location.pathname.startsWith('/emp') ? '/emp' : '/admin';
      navigate(`${basePath}/projects`);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete'),
  });

  const openEdit = () => {
    if (project) {
      setEditForm({
        name: project.name || '',
        description: project.description || '',
        status: project.status || 'Active',
        priority: project.priority || 'Medium',
        start_date: project.start_date || '',
        due_date: project.due_date || '',
        color: project.color || '#3B82F6',
      });
      setShowEdit(true);
    }
  };

  if (isLoading) return <div className="page-container"><div className="glass-card h-64 animate-pulse" /></div>;
  if (!project) return <div className="page-container"><p className="text-muted-foreground">Project not found</p></div>;

  return (
    <div className="page-container">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </button>

      {/* Project Header */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-10 rounded-full" style={{ background: project.color || 'hsl(var(--primary))' }} />
            <div>
              <h1 className="text-xl font-bold">{project.name}</h1>
              <p className="text-sm text-muted-foreground">{project.client_name || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={project.status === 'Active' ? 'badge-success' : project.status === 'Completed' ? 'badge-info' : project.status === 'On Hold' ? 'badge-warning' : 'badge-neutral'}>{project.status}</span>
            <span className={project.priority === 'Critical' ? 'badge-danger' : project.priority === 'High' ? 'badge-warning' : 'badge-neutral'}>{project.priority}</span>
            <button onClick={openEdit} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Edit Project">
              <Pencil className="h-4 w-4" />
            </button>
            {project.status !== 'Cancelled' && (
              <button onClick={() => setShowCancelConfirm(true)} className="px-3 py-1.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:bg-warning/10 hover:text-warning hover:border-warning/30 transition-colors" title="Cancel Project">
                Cancel
              </button>
            )}
            <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete Project">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {project.description && <p className="text-sm text-muted-foreground mb-3">{project.description}</p>}
        {project.progress != null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span>{project.progress}%</span></div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${project.progress}%`, background: project.color || 'hsl(var(--primary))' }} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
          {project.active_sprint_name && <span className="badge-primary">{project.active_sprint_name}</span>}
          {project.open_task_count != null && <span>{project.open_task_count} open tasks</span>}
          {project.members && <span>{project.members.length} members</span>}
          {project.due_date && <span>Due: {new Date(project.due_date).toLocaleDateString()}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'board' && (
        <KanbanBoard projectId={id!} onTaskClick={setSelectedTask} onCreateTask={(status) => setCreateTaskStatus(status || 'Open')} />
      )}
      {activeTab === 'backlog' && <BacklogView projectId={id!} onTaskClick={setSelectedTask} onCreateTask={() => setCreateTaskStatus('Open')} />}
      {activeTab === 'epics' && <EpicsView projectId={id!} onTaskClick={setSelectedTask} />}
      {activeTab === 'sprints' && <SprintsView projectId={id!} onTaskClick={setSelectedTask} />}
      {activeTab === 'members' && <MembersView projectId={id!} />}

      {selectedTask && (
        <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} projectId={id!} />
      )}

      {createTaskStatus !== null && (
        <CreateTaskModal projectId={id!} defaultStatus={createTaskStatus} onClose={() => setCreateTaskStatus(null)} />
      )}

      {/* Edit Project Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Project</h2>
              <button onClick={() => setShowEdit(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Project Name *" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <textarea placeholder="Description" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Project Color</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setEditForm(f => ({ ...f, color: c }))} className={`w-7 h-7 rounded-full border-2 transition-all ${editForm.color === c ? 'border-foreground scale-110' : 'border-transparent'}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
                {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Start Date</label><input type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" /></div>
              <div><label className="text-xs text-muted-foreground">Due Date</label><input type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowEdit(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => updateMut.mutate(editForm)} disabled={updateMut.isPending || !editForm.name} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {updateMut.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold">Delete Project</h2>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{project.name}</strong>? This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}