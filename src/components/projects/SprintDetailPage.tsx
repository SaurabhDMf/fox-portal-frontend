import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { dependencyDelete } from '@/lib/dependencyDelete';
import { extractProjectArray, extractProjectEntity } from '@/lib/projectResponse';
import { TASK_TYPE_CONFIG, PRIORITY_COLORS, BOARD_COLUMNS } from '@/lib/projectTypes';
import type { ProjectTask } from '@/lib/projectTypes';
import { useProjectStatuses } from '@/hooks/useProjectOptions';
import { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ModuleFormModal from './ModuleFormModal';
import ModuleEpicsList from './ModuleEpicsList';
import { SubtaskRowActions, SubtaskEditModal, SubtaskDeleteConfirm } from './SubtaskActions';
import { InlineUserPicker } from './UserPicker';

interface HierarchyModule {
  id: string;
  title: string;
  description?: string;
  color: string;
  status?: string;
  owner_id?: string;
  owner_name?: string;
  owner_avatar?: string;
  total_tasks?: number;
  done_tasks?: number;
  open_tasks?: number;
  tasks?: HierarchyTask[];
}

interface HierarchyTask extends ProjectTask {
  subtasks?: ProjectTask[];
}

interface Props {
  projectId: string;
  sprintId: string;
  sprintName: string;
  onBack: () => void;
  onTaskClick: (task: ProjectTask) => void;
  onCreateTask: (defaults?: { sprint_id?: string; epic_id?: string }) => void;
}

const fallbackHierarchy = { sprint: {}, modules: [], unassigned_tasks: [] };

function normalizeHierarchyTask(task: any): HierarchyTask {
  const assigneeName = task?.assignee_name || task?.assignees?.[0]?.full_name || task?.assignee?.full_name;
  const assigneeId = task?.assignee_id || task?.assignees?.[0]?.id || task?.assignee?.id;

  return {
    ...task,
    type: task?.type || 'Task',
    status: task?.status || 'Open',
    priority: task?.priority || 'Medium',
    assignees: Array.isArray(task?.assignees) && task.assignees.length > 0
      ? task.assignees
      : assigneeName
        ? [{ id: assigneeId || assigneeName, full_name: assigneeName, avatar_url: task?.assignee_avatar }]
        : [],
    subtasks: Array.isArray(task?.subtasks) ? task.subtasks.map(normalizeHierarchyTask) : [],
  };
}

function dedupeTasks(tasks: any[] = []): HierarchyTask[] {
  const map = new Map<string, HierarchyTask>();

  tasks.forEach((task) => {
    const normalized = normalizeHierarchyTask(task);
    if (!normalized?.id) return;

    const previous = map.get(normalized.id);
    map.set(normalized.id, previous
      ? {
          ...previous,
          ...normalized,
          subtasks: dedupeTasks([...(previous.subtasks || []), ...(normalized.subtasks || [])]),
        }
      : normalized);
  });

  return Array.from(map.values());
}

export default function SprintDetailPage({ projectId, sprintId, sprintName, onBack, onTaskClick, onCreateTask }: Props) {
  const qc = useQueryClient();
  const { statuses: STATUS_OPTIONS } = useProjectStatuses(projectId);
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'table'>('hierarchy');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [moduleModal, setModuleModal] = useState<{ mode: 'create' | 'edit'; module?: HierarchyModule } | null>(null);
  const [deleteModuleId, setDeleteModuleId] = useState<string | null>(null);
  const [editingSubtask, setEditingSubtask] = useState<any>(null);
  const [deletingSubtask, setDeletingSubtask] = useState<any>(null);

  // Fetch hierarchy
  const { data: hierarchyRaw } = useQuery({
    queryKey: ['sprint-detail-hierarchy', projectId, sprintId],
    queryFn: async () => {
      try {
        const r = await api.get(`/projects/${projectId}/sprints/${sprintId}/hierarchy`);
        return r.data?.data || r.data;
      } catch { return fallbackHierarchy; }
    },
    placeholderData: (previousData) => previousData,
  });

  const hierarchy = hierarchyRaw || fallbackHierarchy;
  const sprint = hierarchy.sprint || {};

  // Fetch sprint tasks for table view
  const { data: sprintTasksRaw } = useQuery({
    queryKey: ['sprint-detail-tasks', projectId, sprintId],
    queryFn: async () => {
      try {
        const r = await api.get(`/projects/${projectId}/sprints/${sprintId}/tasks`);
        return extractProjectArray<HierarchyTask>(r.data, ['tasks']);
      } catch {
        try {
          const r = await api.get('/tasks', { params: { project_id: projectId, sprint_id: sprintId } });
          return extractProjectArray<HierarchyTask>(r.data, ['tasks']);
        } catch { return []; }
      }
    },
    placeholderData: (previousData) => previousData,
  });
  const fallbackSprintTasks = Array.isArray(sprintTasksRaw) ? sprintTasksRaw.map(normalizeHierarchyTask) : [];

  const { modules, unassignedTasks, sprintTasks } = useMemo(() => {
    const hierarchyModules = ((hierarchy.modules || hierarchy.epics || []) as HierarchyModule[]).map((module) => ({
      ...module,
      tasks: dedupeTasks(module.tasks || []),
    }));
    const moduleMap = new Map<string, HierarchyModule>();
    const unassignedMap = new Map<string, HierarchyTask>();
    const childTaskMap = new Map<string, HierarchyTask[]>();

    hierarchyModules.forEach((module) => {
      moduleMap.set(module.id, {
        ...module,
        tasks: dedupeTasks(module.tasks || []),
      });
    });

    fallbackSprintTasks.forEach((task) => {
      if (task.parent_task_id) {
        const current = childTaskMap.get(task.parent_task_id) || [];
        childTaskMap.set(task.parent_task_id, dedupeTasks([...current, task]));
      }
    });

    const attachSubtasks = (task: HierarchyTask): HierarchyTask => ({
      ...task,
      subtasks: dedupeTasks([...(task.subtasks || []), ...(childTaskMap.get(task.id) || [])]),
    });

    fallbackSprintTasks
      .filter((task) => !task.parent_task_id)
      .map(attachSubtasks)
      .forEach((task) => {
        const moduleId = task.epic_id;
        const moduleTitle = task.epic_name || (task as any).module_title || (task as any).epic_title;

        if (moduleId || moduleTitle) {
          const key = moduleId || `module-${moduleTitle}`;
          const existing = moduleMap.get(key) || {
            id: moduleId || key,
            title: moduleTitle || 'Module',
            color: task.epic_color || 'hsl(var(--primary))',
            tasks: [],
          };

          moduleMap.set(key, {
            ...existing,
            color: existing.color || task.epic_color || 'hsl(var(--primary))',
            tasks: dedupeTasks([...(existing.tasks || []), task]),
          });
          return;
        }

        unassignedMap.set(task.id, task);
      });

    dedupeTasks(hierarchy.unassigned_tasks || []).map(attachSubtasks).forEach((task) => {
      unassignedMap.set(task.id, task);
    });

    const mergedModules = Array.from(moduleMap.values()).map((module) => {
      const tasks = dedupeTasks((module.tasks || []).map(attachSubtasks));
      const total = module.total_tasks ?? tasks.length;
      const done = module.done_tasks ?? tasks.filter((task) => task.status === 'Done').length;

      return {
        ...module,
        tasks,
        total_tasks: total,
        done_tasks: done,
        open_tasks: module.open_tasks ?? Math.max(total - done, 0),
      };
    });

    const mergedUnassignedTasks = dedupeTasks(Array.from(unassignedMap.values()));
    const mergedSprintTasks = dedupeTasks([
      ...mergedModules.flatMap((module) => module.tasks || []),
      ...mergedUnassignedTasks,
      ...fallbackSprintTasks.filter((task) => !task.parent_task_id).map(attachSubtasks),
    ]);

    return {
      modules: mergedModules,
      unassignedTasks: mergedUnassignedTasks,
      sprintTasks: mergedSprintTasks,
    };
  }, [fallbackSprintTasks, hierarchy]);

  // Members for assignee display
  const { data: membersRaw } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get(`/projects/${projectId}/members`).then(r => extractProjectArray(r.data, ['members', 'users'])),
  });
  const members = Array.isArray(membersRaw) ? membersRaw : [];

  const getMemberId = (m: any) => m?.user_id || m?.id;

  // Inline field update — use dedicated PATCH for assignee
  const updateTaskStatus = (taskId: string, field: string, value: string | null) => {
    const isAssignee = field === 'assignee_id';
    const request = isAssignee
      ? api.patch(`/tasks/${taskId}/assignee`, { assignee_id: value })
      : api.put(`/tasks/${taskId}`, { [field]: value });
    request.then((res) => {
      // Update local cache optimistically
      const updated = extractProjectEntity(res.data, ['task']) || res.data;
      qc.setQueryData(['sprint-detail-hierarchy', projectId, sprintId], (old: any) => {
        if (!old) return old;
        const updateInList = (list: any[]) => list?.map((t: any) => {
          if (t.id === taskId) return { ...t, ...updated };
          if (t.subtasks) return { ...t, subtasks: updateInList(t.subtasks) };
          if (t.tasks) return { ...t, tasks: updateInList(t.tasks) };
          return t;
        });
        return {
          ...old,
          modules: (old.modules || old.epics || []).map((m: any) => ({ ...m, tasks: updateInList(m.tasks || []) })),
          unassigned_tasks: updateInList(old.unassigned_tasks || []),
        };
      });
      qc.setQueryData(['sprint-detail-tasks', projectId, sprintId], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((t: any) => {
          if (t.id === taskId) return { ...t, ...updated };
          if (t.subtasks) return { ...t, subtasks: t.subtasks.map((s: any) => s.id === taskId ? { ...s, ...updated } : s) };
          return t;
        });
      });
      toast.success('Updated');
    }).catch(() => toast.error('Failed to update'));
  };

  // Delete module
  const deleteModuleMut = useMutation({
    mutationFn: (moduleId: string) =>
      dependencyDelete({
        url: `/projects/${projectId}/modules/${moduleId}`,
        entityType: 'module',
        skipPreConfirm: true,
        dependencyLabels: {
          tasks: 'Task',
          epics: 'Epic',
          subtasks: 'Subtask',
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprint-detail-hierarchy', projectId, sprintId] });
      qc.invalidateQueries({ queryKey: ['sprint-detail-tasks', projectId, sprintId] });
      setDeleteModuleId(null);
    },
    onError: (e: any) => {
      if (e?.message === 'cancelled') { setDeleteModuleId(null); return; }
      toast.error(e?.response?.data?.message || 'Failed to delete module');
    },
  });

  const toggleModule = (id: string) => setExpandedModules(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTask = (id: string) => setExpandedTasks(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const TaskRow = ({ task, indent = 0 }: { task: HierarchyTask; indent?: number }) => {
    const tc = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.Task;
    const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);
    const assigneeName = (task as any).assignee_name || task.assignees?.[0]?.full_name || '';

    return (
      <>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors group"
          style={{ paddingLeft: `${12 + indent * 24}px` }}
        >
          {hasSubtasks ? (
            <button onClick={() => toggleTask(task.id)} className="p-0.5">
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          ) : <span className="w-4" />}
          <span className="text-xs font-mono text-muted-foreground w-16 flex-shrink-0">{task.task_number}</span>
          <span className="text-sm cursor-pointer hover:text-primary transition-colors flex-1 truncate" onClick={() => onTaskClick(task)}>{task.title}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${tc.color}20`, color: tc.color }}>{task.type}</span>
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: pc }} title={task.priority} />
          {assigneeName ? (
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-bold text-primary">{assigneeName[0]}</div>
              <span className="text-[10px] text-muted-foreground max-w-[60px] truncate">{assigneeName}</span>
            </div>
          ) : <span className="text-[10px] text-muted-foreground">—</span>}
          {task.due_date && <span className="text-[10px] text-muted-foreground">{new Date(task.due_date).toLocaleDateString()}</span>}
          <select
            value={task.status || 'Open'}
            onChange={e => { e.stopPropagation(); updateTaskStatus(task.id, 'status', e.target.value); }}
            className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] focus:outline-none cursor-pointer"
            onClick={e => e.stopPropagation()}
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {isExpanded && hasSubtasks && task.subtasks!.map(st => (
          <div key={st.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/30 transition-colors group" style={{ paddingLeft: `${12 + (indent + 1) * 24}px` }}>
            <span className="w-4 text-muted-foreground text-xs">↳</span>
            <span className="text-xs font-mono text-muted-foreground w-16 flex-shrink-0">{st.task_number}</span>
            <span className="text-sm flex-1 truncate cursor-pointer hover:text-primary" onClick={() => onTaskClick(st)}>{st.title}</span>
            <select
              value={st.status || 'Open'}
              onChange={e => updateTaskStatus(st.id, 'status', e.target.value)}
              className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] focus:outline-none cursor-pointer"
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <InlineUserPicker
              value={(st as any).assignee_id || st.assignees?.[0]?.id || ''}
              onChange={(userId) => updateTaskStatus(st.id, 'assignee_id', userId)}
            />
            <input
              type="date"
              value={st.due_date ? st.due_date.slice(0, 10) : ''}
              onChange={e => updateTaskStatus(st.id, 'due_date', e.target.value || null)}
              className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] focus:outline-none cursor-pointer"
            />
            <SubtaskRowActions subtask={st} onEdit={(s) => setEditingSubtask(s)} onDelete={(s) => setDeletingSubtask(s)} />
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold">{sprintName}</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {sprint.status && <span className={sprint.status === 'Active' ? 'badge-success' : sprint.status === 'Completed' ? 'badge-info' : 'badge-neutral'}>{sprint.status}</span>}
              {sprint.start_date && sprint.end_date && (
                <span>{new Date(sprint.start_date).toLocaleDateString()} — {new Date(sprint.end_date).toLocaleDateString()}</span>
              )}
              {sprint.goal && <span className="italic">{sprint.goal}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setModuleModal({ mode: 'create' })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
            <Plus className="h-3 w-3" /> Add Module
          </button>
          <button onClick={() => onCreateTask({ sprint_id: sprintId })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all">
            <Plus className="h-3 w-3" /> Add Task
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['hierarchy', 'table'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
            {tab === 'hierarchy' ? 'Hierarchy View' : 'Task Table'}
          </button>
        ))}
      </div>

      {/* HIERARCHY VIEW */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-3">
          {modules.map((mod) => {
            const isOpen = expandedModules.has(mod.id);
            const total = mod.total_tasks ?? mod.tasks?.length ?? 0;
            const done = mod.done_tasks ?? 0;
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div key={mod.id} className="glass-card overflow-hidden" style={{ borderLeft: `4px solid ${mod.color || 'hsl(var(--primary))'}` }}>
                <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => toggleModule(mod.id)}>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div className="w-3 h-3 rounded-full" style={{ background: mod.color }} />
                  <span className="font-semibold text-sm flex-1">{mod.title}</span>
                  {mod.owner_name && (
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-bold text-primary">{mod.owner_name[0]}</div>
                      <span className="text-xs text-muted-foreground">{mod.owner_name}</span>
                    </div>
                  )}
                  {mod.status && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{mod.status}</span>}
                  <span className="text-xs text-muted-foreground">{done}/{total} done</span>
                  <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onCreateTask({ sprint_id: sprintId, epic_id: mod.id }); }} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors" title="Add Task">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setModuleModal({ mode: 'edit', module: mod }); }} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Edit Module">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteModuleId(mod.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete Module">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {isOpen && (
                  <div className="border-t border-border pb-2">
                    {(mod.tasks || []).map((task) => <TaskRow key={task.id} task={task as HierarchyTask} indent={0} />)}
                    {(!mod.tasks || mod.tasks.length === 0) && <p className="text-xs text-muted-foreground text-center py-3">No tasks in this module</p>}
                  </div>
                )}
                {/* Epics under this Module */}
                <ModuleEpicsList projectId={projectId} moduleId={mod.id} sprintId={sprintId} moduleColor={mod.color} />
              </div>
            );
          })}

          {/* Unassigned tasks */}
          {unassignedTasks.length > 0 && (
            <div className="glass-card p-4 space-y-1" style={{ borderLeft: '4px solid hsl(var(--muted-foreground))' }}>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Unassigned Tasks</h4>
              {unassignedTasks.map(t => <TaskRow key={t.id} task={t as HierarchyTask} indent={0} />)}
            </div>
          )}

          {modules.length === 0 && unassignedTasks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground mb-2">No modules or tasks in this sprint yet</p>
              <button onClick={() => setModuleModal({ mode: 'create' })} className="text-sm text-primary hover:underline">Create a module →</button>
            </div>
          )}
        </div>
      )}

      {/* TABLE VIEW */}
      {activeTab === 'table' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">#</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Task Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Assigned To</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Due Date</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Priority</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Module</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sprintTasks.map(task => {
                  const tc = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.Task;
                  const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
                  const assigneeName = (task as any).assignee_name || task.assignees?.[0]?.full_name || '';
                  const moduleName = (task as any).module_title || (task as any).epic_title || task.epic_name || '';
                  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                  const isExpanded = expandedTasks.has(task.id);

                  return (
                    <React.Fragment key={task.id}>
                      <tr className="border-b border-border hover:bg-secondary/30 transition-colors">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {hasSubtasks && (
                              <button onClick={() => toggleTask(task.id)} className="p-0.5">
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              </button>
                            )}
                            <span className="text-xs font-mono text-muted-foreground">{task.task_number}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-medium cursor-pointer hover:text-primary" onClick={() => onTaskClick(task)}>{task.title}</td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${tc.color}20`, color: tc.color }}>{task.type}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">{assigneeName || '—'}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ background: pc }} />
                            <span className="text-xs">{task.priority}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={task.status || 'Open'}
                            onChange={e => updateTaskStatus(task.id, 'status', e.target.value)}
                            className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] focus:outline-none cursor-pointer"
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{moduleName || '—'}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => onTaskClick(task)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && task.subtasks?.map(st => (
                        <tr key={st.id} className="border-b border-border bg-secondary/20 group">
                          <td className="px-3 py-1.5 pl-8"><span className="text-xs font-mono text-muted-foreground">{st.task_number}</span></td>
                          <td className="px-3 py-1.5 text-sm cursor-pointer hover:text-primary" onClick={() => onTaskClick(st)}>↳ {st.title}</td>
                          <td className="px-3 py-1.5"><span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground">Subtask</span></td>
                          <td className="px-3 py-1.5">
                            <InlineUserPicker
                              value={(st as any).assignee_id || st.assignees?.[0]?.id || ''}
                              onChange={(userId) => updateTaskStatus(st.id, 'assignee_id', userId)}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="date" value={st.due_date ? st.due_date.slice(0, 10) : ''} onChange={e => updateTaskStatus(st.id, 'due_date', e.target.value || null)}
                              className="px-1 py-0.5 rounded bg-secondary border border-border text-[10px] focus:outline-none cursor-pointer" />
                          </td>
                          <td className="px-3 py-1.5"><div className="w-2 h-2 rounded-full" style={{ background: PRIORITY_COLORS[st.priority] || PRIORITY_COLORS.Medium }} /></td>
                          <td className="px-3 py-1.5">
                            <select value={st.status || 'Open'} onChange={e => updateTaskStatus(st.id, 'status', e.target.value)}
                              className="px-1 py-0.5 rounded bg-secondary border border-border text-[10px] focus:outline-none cursor-pointer">
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5">
                            <SubtaskRowActions subtask={st} onEdit={(s) => setEditingSubtask(s)} onDelete={(s) => setDeletingSubtask(s)} />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                {sprintTasks.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-sm text-muted-foreground">No tasks in this sprint</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Module Form Modal */}
      {moduleModal && (
        <ModuleFormModal
          projectId={projectId}
          sprintId={sprintId}
          mode={moduleModal.mode}
          module={moduleModal.module}
          onClose={() => setModuleModal(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['sprint-detail-hierarchy', projectId, sprintId] });
            setModuleModal(null);
          }}
        />
      )}

      {/* Delete Module Confirm */}
      {deleteModuleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold">Delete Module</h2>
            <p className="text-sm text-muted-foreground">Are you sure? Tasks in this module will become unassigned.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteModuleId(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => deleteModuleMut.mutate(deleteModuleId)} disabled={deleteModuleMut.isPending}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {deleteModuleMut.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSubtask && (
        <SubtaskEditModal
          subtask={editingSubtask}
          onClose={() => setEditingSubtask(null)}
          onSuccess={(updated) => {
            const updateInList = (list: any[]) => list?.map((t: any) => {
              if (t.id === updated.id) return { ...t, ...updated };
              if (t.subtasks) return { ...t, subtasks: updateInList(t.subtasks) };
              if (t.tasks) return { ...t, tasks: updateInList(t.tasks) };
              return t;
            });
            qc.setQueryData(['sprint-detail-hierarchy', projectId, sprintId], (old: any) => {
              if (!old) return old;
              return { ...old, modules: (old.modules || old.epics || []).map((m: any) => ({ ...m, tasks: updateInList(m.tasks || []) })), unassigned_tasks: updateInList(old.unassigned_tasks || []) };
            });
            qc.setQueryData(['sprint-detail-tasks', projectId, sprintId], (old: any) => Array.isArray(old) ? updateInList(old) : old);
            setEditingSubtask(null);
          }}
        />
      )}
      {deletingSubtask && (
        <SubtaskDeleteConfirm
          subtaskId={deletingSubtask.id}
          subtaskTitle={deletingSubtask.title}
          onClose={() => setDeletingSubtask(null)}
          onDeleted={(id) => {
            const removeFromList = (list: any[]): any[] => list?.map((t: any) => {
              if (t.subtasks) return { ...t, subtasks: t.subtasks.filter((s: any) => s.id !== id) };
              if (t.tasks) return { ...t, tasks: removeFromList(t.tasks) };
              return t;
            }).filter((t: any) => t.id !== id);
            qc.setQueryData(['sprint-detail-hierarchy', projectId, sprintId], (old: any) => {
              if (!old) return old;
              return { ...old, modules: (old.modules || old.epics || []).map((m: any) => ({ ...m, tasks: removeFromList(m.tasks || []) })), unassigned_tasks: removeFromList(old.unassigned_tasks || []) };
            });
            qc.setQueryData(['sprint-detail-tasks', projectId, sprintId], (old: any) => Array.isArray(old) ? removeFromList(old) : old);
            setDeletingSubtask(null);
          }}
        />
      )}
    </div>
  );
}
