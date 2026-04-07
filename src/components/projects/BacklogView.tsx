import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { TASK_TYPE_CONFIG, PRIORITY_COLORS, type ProjectTask, type Sprint } from '@/lib/projectTypes';
import { extractProjectArray } from '@/lib/projectResponse';
import { useState } from 'react';
import { Play, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  onTaskClick: (task: ProjectTask) => void;
  onCreateTask?: () => void;
}

export default function BacklogView({ projectId, onTaskClick, onCreateTask }: Props) {
  const qc = useQueryClient();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const { data: backlogRaw, isLoading } = useQuery({
    queryKey: ['project-backlog', projectId],
    queryFn: async () => {
      try {
        const r = await api.get(`/projects/${projectId}/backlog`);
        const tasks = extractProjectArray<ProjectTask>(r.data, ['tasks', 'backlog']);
        if (tasks.length > 0) return tasks;
      } catch {}
      // Fallback: fetch all project tasks (backlog = tasks without a sprint)
      try {
        const r = await api.get(`/projects/${projectId}/tasks`);
        return extractProjectArray<ProjectTask>(r.data, ['tasks']);
      } catch {}
      return [];
    },
  });
  const backlog: ProjectTask[] = Array.isArray(backlogRaw) ? backlogRaw : [];

  const { data: sprintsRaw } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => extractProjectArray<Sprint>(r.data, ['sprints'])),
  });
  const sprints: Sprint[] = Array.isArray(sprintsRaw) ? sprintsRaw : [];

  const moveToSprintMut = useMutation({
    mutationFn: ({ taskId, sprintId }: { taskId: string; sprintId: string }) =>
      api.put(`/tasks/${taskId}/sprint`, { sprint_id: sprintId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
      qc.invalidateQueries({ queryKey: ['project-sprints', projectId] });
      toast.success('Task moved to sprint');
    },
  });

  const startSprintMut = useMutation({
    mutationFn: (sprintId: string) => api.post(`/projects/${projectId}/sprints/${sprintId}/start`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-sprints', projectId] }); toast.success('Sprint started'); },
  });

  const deleteTaskMut = useMutation({
    mutationFn: (taskId: string) => api.delete(`/tasks/${taskId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
      qc.invalidateQueries({ queryKey: ['project-board', projectId] });
      setDeleteTaskId(null);
      toast.success('Task deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error deleting task'),
  });

  // Group backlog by epic
  const epicGroups: Record<string, { name: string; color: string; tasks: ProjectTask[] }> = {};
  const noEpicTasks: ProjectTask[] = [];
  backlog.forEach(t => {
    if (t.epic_id && t.epic_name) {
      if (!epicGroups[t.epic_id]) epicGroups[t.epic_id] = { name: t.epic_name, color: t.epic_color || '#888', tasks: [] };
      epicGroups[t.epic_id].tasks.push(t);
    } else {
      noEpicTasks.push(t);
    }
  });

  const TaskRow = ({ task }: { task: ProjectTask }) => {
    const tc = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.Task;
    const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
    return (
      <div
        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors group"
        onClick={() => onTaskClick(task)}
        draggable
        onDragStart={() => setDraggedTaskId(task.id)}
      >
        <input type="checkbox" className="rounded border-border" onClick={e => e.stopPropagation()} />
        <span className="text-sm">{tc.icon}</span>
        <span className="text-xs font-mono text-muted-foreground w-16 flex-shrink-0">{task.task_number}</span>
        <span className="text-sm font-medium flex-1 truncate">{task.title}</span>
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: pc }} title={task.priority} />
        {task.assignees?.slice(0, 2).map(a => (
          <div key={a.id} className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary" title={a.full_name}>{a.full_name?.[0]}</div>
        ))}
        {task.story_points != null && <span className="text-[10px] font-semibold bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">{task.story_points}</span>}
        <button
          onClick={(e) => { e.stopPropagation(); setDeleteTaskId(task.id); }}
          className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
          title="Delete Task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Backlog</h3>
        {onCreateTask && (
          <button onClick={onCreateTask} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-3 w-3" /> New Task
          </button>
        )}
      </div>

      {/* Sprint sections */}
      {sprints.filter(s => s.status !== 'Completed').map(sprint => (
        <div
          key={sprint.id}
          className="glass-card p-4"
          onDragOver={e => e.preventDefault()}
          onDrop={() => { if (draggedTaskId) moveToSprintMut.mutate({ taskId: draggedTaskId, sprintId: sprint.id }); setDraggedTaskId(null); }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{sprint.name}</h3>
              <span className={sprint.status === 'Active' ? 'badge-success' : 'badge-neutral'}>{sprint.status}</span>
              <span className="text-xs text-muted-foreground">{sprint.task_count || 0} tasks</span>
            </div>
            {sprint.status === 'Planned' && (
              <button onClick={() => startSprintMut.mutate(sprint.id)} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all">
                <Play className="h-3 w-3" /> Start Sprint
              </button>
            )}
          </div>
          {sprint.start_date && sprint.end_date && (
            <p className="text-xs text-muted-foreground">{new Date(sprint.start_date).toLocaleDateString()} — {new Date(sprint.end_date).toLocaleDateString()}</p>
          )}
          <div className="mt-2 text-xs text-muted-foreground text-center py-3 border border-dashed border-border rounded-lg">
            Drag tasks here to add to this sprint
          </div>
        </div>
      ))}

      {/* Backlog grouped by epic */}
      <div className="space-y-4">

        {Object.entries(epicGroups).map(([epicId, group]) => (
          <div key={epicId} className="space-y-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: `${group.color}15` }}>
              <div className="w-3 h-3 rounded" style={{ background: group.color }} />
              <span className="text-xs font-semibold" style={{ color: group.color }}>{group.name}</span>
              <span className="text-xs text-muted-foreground">({group.tasks.length})</span>
            </div>
            {group.tasks.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        ))}

        {noEpicTasks.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary">
              <span className="text-xs font-semibold text-muted-foreground">No Epic</span>
              <span className="text-xs text-muted-foreground">({noEpicTasks.length})</span>
            </div>
            {noEpicTasks.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        )}
        {backlog.length === 0 && Object.keys(epicGroups).length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground mb-2">No tasks in the backlog</p>
            {onCreateTask && <button onClick={onCreateTask} className="text-sm text-primary hover:underline">Create your first task →</button>}
          </div>
        )}
      </div>

      {/* Delete Task Confirmation */}
      {deleteTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold">Delete Task</h2>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this task? This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTaskId(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => deleteTaskMut.mutate(deleteTaskId)} disabled={deleteTaskMut.isPending} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {deleteTaskMut.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}