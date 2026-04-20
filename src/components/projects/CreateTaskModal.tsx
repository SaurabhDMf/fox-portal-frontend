import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray, extractProjectEntity } from '@/lib/projectResponse';
import type { Epic, Module, Sprint, ProjectTask } from '@/lib/projectTypes';
import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import UserPicker from './UserPicker';
import InlineAddSelect from './InlineAddSelect';
import AttachmentDropzone, { type Attachment } from './AttachmentDropzone';
import { useProjectStatuses, useProjectStages, type StatusOption } from '@/hooks/useProjectOptions';

interface Props {
  projectId: string;
  defaultStatus?: string;
  defaultSprintId?: string;
  defaultEpicId?: string;
  defaultProjectEpicId?: string;
  onClose: () => void;
  onCreated?: (task: ProjectTask) => void;
}

type ItemType = 'Task' | 'Story' | 'Bug' | 'Feature';
const ITEM_TYPES: ItemType[] = ['Task', 'Story', 'Bug', 'Feature'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

function upsertTask<T extends { id: string }>(list: T[] = [], task: T): T[] {
  const index = list.findIndex((item) => item.id === task.id);
  if (index === -1) return [...list, task];

  const next = [...list];
  next[index] = { ...next[index], ...task };
  return next;
}



export default function CreateTaskModal({ projectId, defaultStatus, defaultSprintId, defaultEpicId, defaultProjectEpicId, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const [itemType, setItemType] = useState<ItemType>('Task');
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    status: defaultStatus || 'Open',
    stage: '',
    assignee_ids: [] as string[],
    epic_id: defaultEpicId || '', // Module (legacy field name)
    project_epic_id: defaultProjectEpicId || '',           // New Epic layer
    sprint_id: defaultSprintId || '',
    parent_task_id: '',
    due_date: '',
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const { statuses, statusObjects, addStatus } = useProjectStatuses(projectId);
  const { stages, stageObjects, addStage } = useProjectStages(projectId);

  // Removed project-members query — using UserPicker with /users/active instead

  // Modules layer — scoped to selected sprint (cascade)
  const { data: modulesRaw } = useQuery({
    queryKey: ['project-modules', projectId, form.sprint_id],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (form.sprint_id) params.sprint_id = form.sprint_id;
      return api.get(`/projects/${projectId}/modules`, { params }).then(r => extractProjectArray<Module>(r.data, ['modules', 'epics']));
    },
    enabled: !!form.sprint_id,
  });
  const modules = (Array.isArray(modulesRaw) ? modulesRaw : [])
    .slice()
    .sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));

  const { data: sprintsRaw } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => extractProjectArray<Sprint>(r.data, ['sprints'])),
  });
  const sprints = (Array.isArray(sprintsRaw) ? sprintsRaw : []).filter((s: Sprint) => s.status !== 'Completed');

  // Epic layer — scoped to selected module (and sprint). Only fetched when module is selected.
  const { data: projectEpicsRaw } = useQuery({
    queryKey: ['project-epics-picker', projectId, form.sprint_id, form.epic_id],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (form.sprint_id) params.sprint_id = form.sprint_id;
      if (form.epic_id) params.module_id = form.epic_id;
      return api.get(`/projects/${projectId}/epics`, { params }).then(r => extractProjectArray<Epic>(r.data, ['epics']));
    },
    enabled: !!form.epic_id,
  });
  const projectEpics = (Array.isArray(projectEpicsRaw) ? projectEpicsRaw : [])
    .slice()
    .sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));

  const { data: storiesRaw } = useQuery({
    queryKey: ['project-stories', projectId],
    queryFn: async () => {
      try {
        const r = await api.get('/tasks', { params: { project_id: projectId, type: 'Story' } });
        const stories = extractProjectArray(r.data, ['tasks']);
        if (stories.length > 0) return stories;
      } catch {}
      try {
        const r = await api.get('/tasks', { params: { project_id: projectId } });
        const all = extractProjectArray(r.data, ['tasks']);
        return all.filter((t: any) => t.type === 'Story');
      } catch { return []; }
    },
  });
  const stories = Array.isArray(storiesRaw) ? storiesRaw : [];

  const updateSprintCaches = (task: ProjectTask, targetSprintId: string) => {
    qc.setQueryData(['sprint-detail-tasks', projectId, targetSprintId], (old: any) => {
      if (!Array.isArray(old)) return task.parent_task_id ? old : [task];
      if (!task.parent_task_id) return upsertTask(old, task);

      return old.map((item: any) => item.id === task.parent_task_id
        ? { ...item, subtasks: upsertTask(item.subtasks || [], task) }
        : item);
    });

    qc.setQueryData(['sprint-detail-hierarchy', projectId, targetSprintId], (old: any) => {
      if (!old || typeof old !== 'object') return old;

      const moduleKey = Array.isArray(old.modules) || !Array.isArray(old.epics) ? 'modules' : 'epics';
      const currentModules = Array.isArray(old[moduleKey]) ? [...old[moduleKey]] : [];
      const attachToParent = (items: any[] = []) => items.map((item) => {
        if (item.id === task.parent_task_id) {
          return { ...item, subtasks: upsertTask(item.subtasks || [], task) };
        }

        return {
          ...item,
          tasks: Array.isArray(item.tasks) ? attachToParent(item.tasks) : item.tasks,
          subtasks: Array.isArray(item.subtasks) ? attachToParent(item.subtasks) : item.subtasks,
        };
      });

      if (task.parent_task_id) {
        return {
          ...old,
          [moduleKey]: currentModules.map((module: any) => ({ ...module, tasks: attachToParent(module.tasks || []) })),
          unassigned_tasks: attachToParent(old.unassigned_tasks || []),
        };
      }

      if (task.epic_id) {
        const moduleIndex = currentModules.findIndex((module: any) => module.id === task.epic_id);
        if (moduleIndex >= 0) {
          currentModules[moduleIndex] = {
            ...currentModules[moduleIndex],
            tasks: upsertTask(currentModules[moduleIndex].tasks || [], task),
          };
        } else {
          currentModules.push({
            id: task.epic_id,
            title: task.epic_name || (task as any).module_title || (task as any).epic_title || 'Module',
            color: task.epic_color || 'hsl(var(--primary))',
            tasks: [task],
          });
        }

        return {
          ...old,
          [moduleKey]: currentModules,
          unassigned_tasks: (old.unassigned_tasks || []).filter((item: any) => item.id !== task.id),
        };
      }

      return {
        ...old,
        [moduleKey]: currentModules,
        unassigned_tasks: upsertTask(old.unassigned_tasks || [], task),
      };
    });
  };

  const createMut = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {
        project_id: projectId,
        title: form.title,
        type: itemType,
        priority: form.priority,
        status: form.status,
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.stage) payload.stage = form.stage;
      if (form.assignee_ids.length === 1) payload.assignee_id = form.assignee_ids[0];
      if (form.assignee_ids.length > 1) payload.assignee_ids = form.assignee_ids;
      if (form.epic_id) payload.epic_id = form.epic_id; else payload.epic_id = null;
      if (form.project_epic_id) {
        payload.project_epic_id = form.project_epic_id;
      } else {
        payload.project_epic_id = null;
      }
      if (form.sprint_id) payload.sprint_id = form.sprint_id; else payload.sprint_id = null;
      if (form.parent_task_id) payload.parent_task_id = form.parent_task_id; else payload.parent_task_id = null;
      if (form.due_date) payload.due_date = form.due_date;
      if (attachments.length > 0) payload.attachment_ids = attachments.map(a => a.id);
      return api.post('/tasks', payload);
    },
    onSuccess: async (res) => {
      await qc.cancelQueries({ queryKey: ['project-all-tasks', projectId] });
      const newTask = (extractProjectEntity<ProjectTask>(res.data, ['task']) || res.data) as ProjectTask;
      if (newTask?.id) {
        // POST /tasks doesn't include attachments — seed them from the temp records
        // we already have locally (they were returned by upload-temp with file_url).
        const taskWithAttachments: any = {
          ...newTask,
          attachments: attachments.length > 0 ? attachments : (newTask as any).attachments || [],
        };

        // Pre-populate the task-detail cache so the drawer shows attachments instantly.
        qc.setQueryData(['task-detail', newTask.id], taskWithAttachments);

        qc.setQueryData(['project-all-tasks', projectId], (old: any) => {
          const prev = Array.isArray(old) ? old : [];
          return prev.some((t: any) => t?.id === newTask.id) ? prev : [...prev, taskWithAttachments];
        });

        const targetSprintId = newTask.sprint_id || form.sprint_id || defaultSprintId;
        if (targetSprintId) updateSprintCaches(taskWithAttachments, targetSprintId);
      }
      qc.invalidateQueries({ queryKey: ['project-all-tasks'] });
      qc.invalidateQueries({ queryKey: ['project-board', projectId] });
      qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
      qc.invalidateQueries({ queryKey: ['project-modules', projectId] });
      qc.invalidateQueries({ queryKey: ['project-epics', projectId] });
      qc.invalidateQueries({ queryKey: ['sprint-hierarchy', projectId] });
      qc.invalidateQueries({ queryKey: ['project-sprints', projectId] });
      toast.success(`${itemType} created`);
      if (newTask?.id && onCreated) {
        onCreated({ ...newTask, attachments: attachments.length > 0 ? attachments : (newTask as any).attachments } as ProjectTask);
      }
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.response?.data?.error || `Failed to create ${itemType}`),
  });

  const toggleAssignee = (uid: string) =>
    setForm(f => ({ ...f, assignee_ids: f.assignee_ids.includes(uid) ? f.assignee_ids.filter(id => id !== uid) : [...f.assignee_ids, uid] }));

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id));


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create {itemType}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {/* Type selector */}
        <div className="flex gap-1">
          {ITEM_TYPES.map(t => (
            <button key={t} onClick={() => setItemType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${itemType === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Title */}
        <input placeholder={`${itemType} title *`} value={form.title} onChange={e => set('title', e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus />

        {/* Description */}
        <textarea placeholder="Description (optional)" value={form.description} onChange={e => set('description', e.target.value)} rows={5}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y min-h-[100px]" />

        {/* Priority + Status + Stage */}
        <div className="grid grid-cols-3 gap-3">
          <select value={form.priority} onChange={e => set('priority', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div>
            <InlineAddSelect value={form.status} options={statuses} colorOptions={statusObjects} onChange={v => set('status', v)} onAdd={addStatus} placeholder="Status" />
          </div>
          <div>
            <InlineAddSelect value={form.stage} options={stages} colorOptions={stageObjects} onChange={v => set('stage', v)} onAdd={addStage} placeholder="No Stage" />
          </div>
        </div>

        {/* Sprint + Module — 2 cols */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Sprint (optional)</label>
            <select value={form.sprint_id} onChange={e => { set('sprint_id', e.target.value); set('epic_id', ''); set('project_epic_id', ''); }} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              <option value="">None</option>
              {sprints.map((s: Sprint) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Module (optional)</label>
            <select
              value={form.epic_id}
              onChange={e => { set('epic_id', e.target.value); set('project_epic_id', ''); }}
              disabled={!form.sprint_id}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{form.sprint_id ? 'None' : 'Select sprint first'}</option>
              {modules.map((m: Module) => <option key={m.id} value={m.id}>{m.title}{m.sprint_name ? ` — ${m.sprint_name}` : ''}</option>)}
            </select>
          </div>
        </div>

        {/* Epic + Due Date — 2 cols */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Epic (optional)</label>
            <select
              value={form.project_epic_id}
              onChange={e => set('project_epic_id', e.target.value)}
              disabled={!form.epic_id}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{form.epic_id ? 'None' : 'Select module first'}</option>
              {projectEpics.map((pe: any) => (
                <option key={pe.id} value={pe.id}>{pe.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Due Date (optional)</label>
            <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" />
          </div>
        </div>

        {/* Parent Story (optional) */}
        {stories.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Parent Story (optional — makes this a sub-task)</label>
            <select value={form.parent_task_id} onChange={e => set('parent_task_id', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              <option value="">None (standalone {itemType.toLowerCase()})</option>
              {stories.map((s: any) => <option key={s.id} value={s.id}>{s.task_number} — {s.title}</option>)}
            </select>
          </div>
        )}

        {/* Assignees */}
        <UserPicker
          multi
          selectedIds={form.assignee_ids}
          onToggle={toggleAssignee}
          value={null}
          onChange={() => {}}
          label="Assignees"
          placeholder="Select assignees..."
        />


        {/* Attachments */}
        <AttachmentDropzone
          attachments={attachments}
          onAdd={(att) => setAttachments((prev) => [...prev, att])}
          onRemove={(att) => removeAttachment(att.id)}
          label="Attachments (optional)"
        />

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={() => createMut.mutate()} disabled={!form.title || createMut.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {createMut.isPending ? 'Creating...' : `Create ${itemType}`}
          </button>
        </div>
      </div>
    </div>
  );
}
