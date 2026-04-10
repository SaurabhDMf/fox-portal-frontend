import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray } from '@/lib/projectResponse';
import type { Sprint, ProjectTask } from '@/lib/projectTypes';
import { TASK_TYPE_CONFIG, PRIORITY_COLORS } from '@/lib/projectTypes';
import { useState } from 'react';
import { Plus, ArrowRight, X, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface BacklogModule {
  id: string;
  title: string;
  color: string;
  status?: string;
  total_tasks?: number;
  done_tasks?: number;
  open_tasks?: number;
  tasks?: ProjectTask[];
}

interface Props {
  projectId: string;
  onTaskClick?: (task: any) => void;
  onCreateTask?: () => void;
}

export default function BacklogView({ projectId, onTaskClick, onCreateTask }: Props) {
  const qc = useQueryClient();
  const [sprintPickerTarget, setSprintPickerTarget] = useState<{ type: 'module' | 'task'; id: string } | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Fetch backlog
  const { data: backlogRaw, isLoading } = useQuery({
    queryKey: ['project-backlog', projectId],
    queryFn: async () => {
      try {
        const r = await api.get(`/projects/${projectId}/backlog`);
        return r.data?.data || r.data;
      } catch {
        return { data: [], loose_tasks: [] };
      }
    },
  });

  const backlog = backlogRaw || {};
  const modules: BacklogModule[] = backlog.data || backlog.modules || backlog.epics ||
    extractProjectArray(backlogRaw, ['epics', 'modules', 'backlog', 'items']);
  const looseTasks: ProjectTask[] = backlog.loose_tasks || backlog.unassigned_tasks || [];

  const { data: sprintsRaw } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => extractProjectArray<Sprint>(r.data, ['sprints'])),
  });
  const sprints: Sprint[] = (Array.isArray(sprintsRaw) ? sprintsRaw : []).filter(s => s.status !== 'Completed');

  const moveModuleToSprint = useMutation({
    mutationFn: ({ moduleId, sprintId }: { moduleId: string; sprintId: string }) =>
      api.put(`/projects/${projectId}/epics/${moduleId}`, { sprint_id: sprintId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
      qc.invalidateQueries({ queryKey: ['project-sprints', projectId] });
      setSprintPickerTarget(null);
      toast.success('Module assigned to sprint');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const moveTaskToSprint = useMutation({
    mutationFn: ({ taskId, sprintId }: { taskId: string; sprintId: string }) =>
      api.put(`/tasks/${taskId}/sprint`, { sprint_id: sprintId }).catch(() =>
        api.put(`/tasks/${taskId}`, { sprint_id: sprintId })
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
      qc.invalidateQueries({ queryKey: ['project-sprints', projectId] });
      setSprintPickerTarget(null);
      toast.success('Task moved to sprint');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const toggleModule = (id: string) => setExpandedModules(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Backlog</h3>
        {onCreateTask && (
          <button onClick={onCreateTask} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all">
            <Plus className="h-3 w-3" /> Create Item
          </button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading backlog…</p>}

      {/* Unplanned Modules */}
      {Array.isArray(modules) && modules.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unplanned Modules</h4>
          {modules.map(mod => {
            const total = mod.total_tasks ?? mod.tasks?.length ?? 0;
            const done = mod.done_tasks ?? 0;
            const isOpen = expandedModules.has(mod.id);
            return (
              <div key={mod.id} className="glass-card overflow-hidden" style={{ borderLeft: `4px solid ${mod.color || 'hsl(var(--primary))'}` }}>
                <div className="p-4 flex items-center gap-2">
                  {mod.tasks && mod.tasks.length > 0 && (
                    <button onClick={() => toggleModule(mod.id)} className="p-0.5">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  )}
                  <div className="w-3 h-3 rounded-full" style={{ background: mod.color }} />
                  <span className="text-sm font-semibold flex-1">{mod.title}</span>
                  <span className="text-xs text-muted-foreground">{done}/{total} done</span>
                  <button onClick={() => setSprintPickerTarget({ type: 'module', id: mod.id })}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                    <ArrowRight className="h-3 w-3" /> Assign to Sprint
                  </button>
                </div>
                {isOpen && mod.tasks && mod.tasks.length > 0 && (
                  <div className="border-t border-border px-4 pb-2">
                    {mod.tasks.map(task => {
                      const tc = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.Task;
                      const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
                      return (
                        <div key={task.id} onClick={() => onTaskClick?.(task)}
                          className="flex items-center gap-2 py-2 hover:bg-secondary/50 rounded-lg px-2 cursor-pointer transition-colors">
                          <span className="text-sm">{tc.icon}</span>
                          <span className="text-xs font-mono text-muted-foreground">{task.task_number}</span>
                          <span className="text-sm flex-1 truncate">{task.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{task.status}</span>
                          <div className="w-2 h-2 rounded-full" style={{ background: pc }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Loose Tasks */}
      {looseTasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Loose Tasks</h4>
          {looseTasks.map(task => {
            const tc = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.Task;
            const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
            return (
              <div key={task.id} className="flex items-center gap-2 px-3 py-2 rounded-lg glass-card hover:bg-secondary/50 cursor-pointer transition-colors">
                <span className="text-sm">{tc.icon}</span>
                <span className="text-xs font-mono text-muted-foreground w-16 flex-shrink-0">{task.task_number}</span>
                <span className="text-sm font-medium flex-1 truncate" onClick={() => onTaskClick?.(task)}>{task.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{task.status}</span>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: pc }} />
                <button onClick={() => setSprintPickerTarget({ type: 'task', id: task.id })}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors">
                  <ArrowRight className="h-2.5 w-2.5" /> Move
                </button>
              </div>
            );
          })}
        </div>
      )}

      {(!Array.isArray(modules) || modules.length === 0) && looseTasks.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground mb-2">Backlog is empty</p>
          {onCreateTask && <button onClick={onCreateTask} className="text-sm text-primary hover:underline">Create an item →</button>}
        </div>
      )}

      {/* Sprint Picker Modal */}
      {sprintPickerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Move to Sprint</h2>
              <button onClick={() => setSprintPickerTarget(null)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            {sprints.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active or planned sprints.</p>
            ) : (
              <div className="space-y-2">
                {sprints.map(s => (
                  <button key={s.id}
                    onClick={() => {
                      if (sprintPickerTarget.type === 'module') moveModuleToSprint.mutate({ moduleId: sprintPickerTarget.id, sprintId: s.id });
                      else moveTaskToSprint.mutate({ taskId: sprintPickerTarget.id, sprintId: s.id });
                    }}
                    disabled={moveModuleToSprint.isPending || moveTaskToSprint.isPending}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-secondary/80 text-sm transition-colors disabled:opacity-50">
                    <span className="font-medium">{s.name}</span>
                    <span className={s.status === 'Active' ? 'badge-success' : 'badge-neutral'}>{s.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
