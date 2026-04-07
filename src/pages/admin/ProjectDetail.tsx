import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useState } from 'react';
import { ArrowLeft, LayoutGrid, List, Zap, Timer, Users } from 'lucide-react';
import { dummyProjectsEnhanced } from '@/lib/projectDummyData';
import type { Project, ProjectTask } from '@/lib/projectTypes';
import KanbanBoard from '@/components/projects/KanbanBoard';
import BacklogView from '@/components/projects/BacklogView';
import EpicsView from '@/components/projects/EpicsView';
import SprintsView from '@/components/projects/SprintsView';
import MembersView from '@/components/projects/MembersView';
import TaskDetailDrawer from '@/components/projects/TaskDetailDrawer';
import CreateTaskModal from '@/components/projects/CreateTaskModal';

const TABS = [
  { id: 'board', label: 'Board', icon: LayoutGrid },
  { id: 'backlog', label: 'Backlog', icon: List },
  { id: 'epics', label: 'Epics', icon: Zap },
  { id: 'sprints', label: 'Sprints', icon: Timer },
  { id: 'members', label: 'Members', icon: Users },
] as const;

type TabId = typeof TABS[number]['id'];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('board');
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [createTaskStatus, setCreateTaskStatus] = useState<string | null>(null);

  const { data: projectRaw, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const project: Project | undefined = projectRaw || dummyProjectsEnhanced.find(p => p.id === id) || (id ? dummyProjectsEnhanced[0] : undefined);

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
        {/* Quick stats */}
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

      {/* Tab content */}
      {activeTab === 'board' && (
        <KanbanBoard projectId={id!} onTaskClick={setSelectedTask} onCreateTask={(status) => setCreateTaskStatus(status || 'Open')} />
      )}
      {activeTab === 'backlog' && <BacklogView projectId={id!} onTaskClick={setSelectedTask} />}
      {activeTab === 'epics' && <EpicsView projectId={id!} />}
      {activeTab === 'sprints' && <SprintsView projectId={id!} />}
      {activeTab === 'members' && <MembersView projectId={id!} />}

      {/* Task Detail Drawer */}
      {selectedTask && (
        <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} projectId={id!} />
      )}

      {/* Create Task Modal */}
      {createTaskStatus !== null && (
        <CreateTaskModal projectId={id!} defaultStatus={createTaskStatus} onClose={() => setCreateTaskStatus(null)} />
      )}
    </div>
  );
}
