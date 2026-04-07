import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { TASK_TYPE_CONFIG, PRIORITY_COLORS, type ProjectTask, type Sprint } from '@/lib/projectTypes';

import { useState } from 'react';
import { Play } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  onTaskClick: (task: ProjectTask) => void;
}

export default function BacklogView({ projectId, onTaskClick }: Props) {
  const qc = useQueryClient();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const { data: backlogRaw } = useQuery({
    queryKey: ['project-backlog', projectId],
    queryFn: () => api.get(`/projects/${projectId}/backlog`).then(r => r.data?.tasks || r.data || []),
  });
  const backlog: ProjectTask[] = Array.isArray(backlogRaw) && backlogRaw.length > 0 ? backlogRaw : dummyBacklogTasks;

  const { data: sprintsRaw } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => r.data?.sprints || r.data || []),
  });
  const sprints: Sprint[] = Array.isArray(sprintsRaw) && sprintsRaw.length > 0 ? sprintsRaw : dummySprints;

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
      </div>
    );
  };

  return (
    <div className="space-y-6">
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
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Backlog</h3>

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
      </div>
    </div>
  );
}
