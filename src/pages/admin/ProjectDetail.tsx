import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { dependencyDelete } from '@/lib/dependencyDelete';
import { useAuthStore } from '@/stores/authStore';
import { useState } from 'react';
import { ArrowLeft, List, Zap, Timer, Users, Pencil, Trash2, X, Archive, ChevronDown, Settings2, IndianRupee, FolderOpen } from 'lucide-react';
import { extractProjectEntity } from '@/lib/projectResponse';
import type { Project, ProjectTask } from '@/lib/projectTypes';
import TasksListView from '@/components/projects/TasksListView';
import EpicsView from '@/components/projects/EpicsView';
import SprintsView from '@/components/projects/SprintsView';
import BacklogView from '@/components/projects/BacklogView';
import MembersView from '@/components/projects/MembersView';
import TaskDetailDrawer from '@/components/projects/TaskDetailDrawer';
import CreateTaskModal from '@/components/projects/CreateTaskModal';
import ProjectSettingsModal from '@/components/projects/ProjectSettingsModal';
import FinancialsView from '@/components/projects/FinancialsView';
import DocumentsView from '@/components/projects/DocumentsView';
import toast from 'react-hot-toast';

const ALL_TABS = [
  { id: 'tasks', label: 'Tasks', icon: List },
  { id: 'backlog', label: 'Backlog', icon: Archive },
  { id: 'epics', label: 'Modules', icon: Zap },
  { id: 'sprints', label: 'Sprints', icon: Timer },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'financials', label: 'Financials', icon: IndianRupee },
] as const;

type TabId = typeof ALL_TABS[number]['id'];

const statusOptions = ['Active', 'On Hold', 'Completed', 'Cancelled'];
const priorityOptions = ['Critical', 'High', 'Medium', 'Low'];
const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const userRole = useAuthStore((s) => s.user?.role);
  const userGrants = useAuthStore((s) => s.grants);
  const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'supervisor';
  const canViewFinancials = userRole === 'admin' || userRole === 'super_admin' || (Array.isArray(userGrants) && userGrants.includes('project_finance'));
  const TABS = ALL_TABS.filter(t => t.id !== 'financials' || canViewFinancials);
  const [activeTab, setActiveTab] = useState<TabId>('tasks');
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [createTaskDefaults, setCreateTaskDefaults] = useState<{ status?: string; sprint_id?: string; epic_id?: string } | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', status: 'Active', priority: 'Medium', start_date: '', due_date: '', color: '#3B82F6', client_id: '' as string | null });
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);

  const { data: projectRaw, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then(r => extractProjectEntity<Project>(r.data, ['project'])),
    enabled: !!id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients').then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || d?.clients || [];
    }),
    staleTime: 2 * 60 * 1000,
  });

  const filteredClients = clients.filter((c: any) =>
    c.company_name?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const project: Project | undefined = projectRaw;
  const displayClientName = (project as any)?.client_name
    || (project as any)?.client_company_name
    || (project as any)?.company_name
    || (project as any)?.client?.company_name
    || (project as any)?.client?.name
    || '—';

  const selectedEditClientName = editForm.client_id
    ? clients.find((c: any) => c.id === editForm.client_id)?.company_name || displayClientName
    : displayClientName;

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
    mutationFn: () =>
      dependencyDelete({
        url: `/projects/${id}`,
        entityType: 'project',
        entityName: (project as any)?.name,
        skipPreConfirm: true,
        dependencyLabels: {
          sprints: 'Sprint',
          modules: 'Module',
          epics: 'Epic',
          tasks: 'Task',
          subtasks: 'Subtask',
          members: 'Member',
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      const basePath = window.location.pathname.startsWith('/emp') ? '/emp' : '/admin';
      navigate(`${basePath}/projects`);
    },
    onError: (e: any) => {
      if (e?.message === 'cancelled') return;
      toast.error(e?.response?.data?.message || 'Failed to delete');
    },
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
        client_id: project.client_id || (project as any)?.client?.id || (project as any)?.client?.client_id || null,
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
              <p className="text-sm text-muted-foreground">{displayClientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={project.status === 'Active' ? 'badge-success' : project.status === 'Completed' ? 'badge-info' : project.status === 'On Hold' ? 'badge-warning' : 'badge-neutral'}>{project.status}</span>
            <span className={project.priority === 'Critical' ? 'badge-danger' : project.priority === 'High' ? 'badge-warning' : 'badge-neutral'}>{project.priority}</span>
            <button onClick={() => setShowProjectSettings(true)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Project Settings">
              <Settings2 className="h-4 w-4" />
            </button>
            {isAdmin && (
              <>
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
              </>
            )}
          </div>
        </div>
        {project.description && <p className="text-sm text-muted-foreground mb-3">{project.description}</p>}
        {project.progress != null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span>{project.progress}%</span></div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${project.progress}%`,
                background: project.progress >= 100 ? '#10B981' : project.progress >= 75 ? '#3B82F6' : project.progress >= 50 ? '#F59E0B' : project.progress >= 25 ? '#F97316' : '#EF4444',
              }} />
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

      {activeTab === 'tasks' && <TasksListView projectId={id!} onTaskClick={setSelectedTask} onCreateTask={() => setCreateTaskDefaults({ status: 'Open' })} />}
      {activeTab === 'epics' && <EpicsView projectId={id!} onTaskClick={setSelectedTask} />}
      {activeTab === 'sprints' && (
        <SprintsView
          projectId={id!}
          onTaskClick={setSelectedTask}
          onCreateTask={(defaults) => setCreateTaskDefaults({ status: 'Open', ...defaults })}
        />
      )}
      {activeTab === 'backlog' && (
        <BacklogView projectId={id!} onTaskClick={setSelectedTask} onCreateTask={() => setCreateTaskDefaults({ status: 'Open' })} />
      )}
      {activeTab === 'members' && <MembersView projectId={id!} />}
      {activeTab === 'documents' && <DocumentsView projectId={id!} />}
      {activeTab === 'financials' && canViewFinancials && <FinancialsView projectId={id!} />}

      {selectedTask && (
        <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} projectId={id!} />
      )}

      {createTaskDefaults !== null && (
        <CreateTaskModal
          projectId={id!}
          defaultStatus={createTaskDefaults.status}
          defaultSprintId={createTaskDefaults.sprint_id}
          defaultEpicId={createTaskDefaults.epic_id}
          onClose={() => setCreateTaskDefaults(null)}
          onCreated={(task) => setSelectedTask(task)}
        />
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
            {/* Client Picker */}
            <div className="space-y-1 relative">
              <label className="text-xs text-muted-foreground">Client</label>
              <button
                type="button"
                onClick={() => { setClientDropdownOpen(!clientDropdownOpen); setClientSearch(''); }}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center justify-between"
              >
                <span className={editForm.client_id ? 'text-foreground' : 'text-muted-foreground'}>
                  {editForm.client_id
                    ? selectedEditClientName || 'Selected'
                    : 'No client'}
                </span>
                <span className="flex items-center gap-1">
                  {editForm.client_id && (
                    <span onClick={(e) => { e.stopPropagation(); setEditForm(f => ({ ...f, client_id: null })); }} className="p-0.5 rounded hover:bg-muted-foreground/20 cursor-pointer"><X className="h-3 w-3" /></span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </button>
              {clientDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
                  <div className="p-2 border-b border-border">
                    <input
                      autoFocus
                      placeholder="Search clients..."
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm focus:outline-none"
                    />
                  </div>
                  {filteredClients.length === 0 && <p className="p-3 text-xs text-muted-foreground text-center">No clients found</p>}
                  {filteredClients.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setEditForm(f => ({ ...f, client_id: c.id })); setClientDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${editForm.client_id === c.id ? 'bg-accent text-accent-foreground' : ''}`}
                    >
                      {c.company_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
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

      {/* Cancel Project Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold">Cancel Project</h2>
            <p className="text-sm text-muted-foreground">Are you sure you want to cancel <strong>{project.name}</strong>? The project will be marked as Cancelled but not removed.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCancelConfirm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Go Back</button>
              <button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {cancelMut.isPending ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProjectSettings && <ProjectSettingsModal projectId={id!} onClose={() => setShowProjectSettings(false)} />}
    </div>
  );
}