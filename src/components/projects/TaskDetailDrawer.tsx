import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useProjectStatuses, useProjectStages, type StatusOption } from '@/hooks/useProjectOptions';
import InlineAddSelect from './InlineAddSelect';
import { TASK_TYPE_CONFIG, BOARD_COLUMNS, WORKFLOW_STAGES, type Epic, type Module, type ProjectTask, type Sprint } from '@/lib/projectTypes';
import { extractProjectArray, extractProjectEntity } from '@/lib/projectResponse';
import HandoffModal from './HandoffModal';
import { SubtaskRowActions, SubtaskDeleteConfirm } from './SubtaskActions';
import SubtaskCreateModal from './SubtaskCreateModal';
import UserPicker, { InlineUserPicker } from './UserPicker';
import HandoffBadge from './HandoffBadge';
import { useAuthStore } from '@/stores/authStore';

import { useState, useRef } from 'react';
import { X, Eye, EyeOff, Clock, MessageSquare, Activity, Plus, Send, Edit2, Trash2, Paperclip, Image, FileText, Download, UserPlus, ArrowRightLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import AttachmentDropzone, { type Attachment } from './AttachmentDropzone';

interface Props {
  task: ProjectTask;
  onClose: () => void;
  projectId: string;
}

const TYPES = ['Story', 'Task', 'Bug', 'Subtask'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const MASTER_STATUS_ROLES = new Set(['admin', 'super_admin', 'manager', 'sales_manager', 'project_manager', 'project_coordinator', 'supervisor']);

const getMemberId = (member: any) => member?.user_id || member?.id;
const toArray = <T,>(value: T | T[] | null | undefined): T[] => Array.isArray(value) ? value : value ? [value] : [];
const getPersonName = (person: any) => person?.full_name || person?.name || person?.user_name || person?.display_name || person?.username || person?.email || '';

function buildPerson(person: any, fallbackId?: string, fallbackName?: string) {
  const id = getMemberId(person) || fallbackId;
  const full_name = getPersonName(person) || fallbackName;
  return id || full_name ? { id: id || full_name || 'unknown', full_name: full_name || 'Unknown', avatar_url: person?.avatar_url, personal_status: person?.personal_status || person?.status } : undefined;
}

function normalizeTaskEntity(rawTask: any, members: any[] = []): ProjectTask {
  const extracted = extractProjectEntity<ProjectTask>(rawTask, ['task']);
  const task = extracted && typeof extracted === 'object' && !Array.isArray(extracted) ? extracted as any : rawTask as any;

  if (!task || typeof task !== 'object' || Array.isArray(task)) return rawTask as ProjectTask;

  const assigneeIds = [...new Set([
    ...toArray(task.assignee_ids),
    ...toArray(task.assignee_id),
    ...toArray(task.assigned_to_id),
    ...toArray(task.assigned_user_ids),
  ].map((value: any) => typeof value === 'string' ? value : getMemberId(value)).filter((value: any) => typeof value === 'string' && value.trim()))];

  const assigneeCandidates = [
    ...toArray(task.assignees),
    ...toArray(task.assignee),
    ...toArray(task.assigned_users),
    ...toArray(task.assigned_to_user),
    ...toArray(typeof task.assigned_to === 'object' ? task.assigned_to : null),
  ];

  const assignees = (
    assigneeIds.length > 0
      ? assigneeIds.map((id) => {
          const existing = assigneeCandidates.find((candidate: any) => getMemberId(candidate) === id);
          const member = members.find((candidate: any) => getMemberId(candidate) === id);
          return buildPerson(existing || member, id, getPersonName(existing || member));
        })
      : assigneeCandidates.map((candidate: any) => buildPerson(candidate))
  ).filter(Boolean);

  if (assignees.length === 0 && (task.assignee_name || task.assigned_to_name)) {
    assignees.push({
      id: assigneeIds[0] || task.assignee_id || task.assigned_to_id || String(task.assignee_name || task.assigned_to_name),
      full_name: task.assignee_name || task.assigned_to_name,
      avatar_url: undefined,
      personal_status: undefined,
    });
  }

  const reporter =
    buildPerson(task.reporter ?? task.reported_by ?? task.created_by_user, task.reporter_id ?? task.reported_by_id, task.reporter_name ?? task.reported_by_name) ||
    (task.reporter_name || task.reported_by_name
      ? { id: task.reporter_id || task.reported_by_id || String(task.reporter_name || task.reported_by_name), full_name: task.reporter_name || task.reported_by_name }
      : undefined);

  return {
    ...task,
    stage: task.stage || task.workflow_stage || task.current_stage || undefined,
    assignee_ids: assigneeIds,
    assignees,
    reporter,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.map((item: any) => normalizeTaskEntity(item, members)) : task.subtasks,
    tasks: Array.isArray(task.tasks) ? task.tasks.map((item: any) => normalizeTaskEntity(item, members)) : task.tasks,
  };
}

function normalizeCommentEntity(comment: any) {
  const userName = comment?.author_name || comment?.full_name || comment?.user_name
    || comment?.created_by_name
    || getPersonName(comment?.user || comment?.author || comment?.created_by)
    || comment?.user?.full_name || comment?.user?.name || comment?.user?.email
    || comment?.commenter_name || comment?.posted_by
    || '';
  return {
    ...comment,
    text: comment?.text || comment?.message || comment?.content || comment?.comment || '',
    user_name: userName || 'Unknown',
  };
}

function normalizeActivityEntity(activity: any) {
  return {
    ...activity,
    action: activity?.action || activity?.message || activity?.description || activity?.event || 'updated the task',
    user_name: activity?.user_name || activity?.full_name || activity?.actor_name || activity?.created_by_name || getPersonName(activity?.user || activity?.actor || activity?.created_by) || 'Unknown',
  };
}

function normalizeTimeLogEntity(timeLog: any) {
  return {
    ...timeLog,
    user_name: timeLog?.user_name || timeLog?.logged_by_name || getPersonName(timeLog?.user || timeLog?.logged_by) || 'Unknown',
  };
}

function normalizeHandoffEntity(handoff: any) {
  return {
    ...handoff,
    from_stage: handoff?.from_stage || handoff?.stage_from || handoff?.previous_stage,
    to_stage: handoff?.to_stage || handoff?.stage_to || handoff?.stage,
    from_user_name: handoff?.from_user_name || handoff?.handed_by_name || getPersonName(handoff?.from_user || handoff?.handed_by) || 'Someone',
    to_user_name: handoff?.to_user_name || handoff?.assignee_name || getPersonName(handoff?.to_user || handoff?.assignee) || 'Unassigned',
  };
}

function sanitizeTaskPatch(patch: Record<string, any>) {
  const payload: Record<string, any> = {};
  if ('title' in patch) { const t = String(patch.title ?? '').trim(); if (t) payload.title = t; }
  if ('description' in patch) payload.description = typeof patch.description === 'string' ? patch.description.trim() : '';
  if ('type' in patch && patch.type) payload.type = patch.type;
  if ('status' in patch && patch.status) payload.status = patch.status;
  if ('priority' in patch && patch.priority) payload.priority = patch.priority;
  // assignee_ids are now handled via PATCH /tasks/:id/assignee — skip them here
  if ('epic_id' in patch) payload.epic_id = patch.epic_id || null;
  if ('project_epic_id' in patch) payload.project_epic_id = patch.project_epic_id || null;
  if ('sprint_id' in patch) payload.sprint_id = patch.sprint_id || null;
  if ('parent_task_id' in patch) payload.parent_task_id = patch.parent_task_id || null;
  if ('due_date' in patch) payload.due_date = patch.due_date || null;
  if ('stage' in patch) payload.stage = patch.stage || null;
  return payload;
}

function EditableDescription({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const startEditing = () => { setDraft(value); setEditing(true); };
  if (editing) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Description</h4>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" autoFocus />
        <div className="flex gap-2 mt-1">
          <button onClick={() => { onSave(draft); setEditing(false); }} className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium">Save</button>
          <button onClick={() => { setDraft(value); setEditing(false); }} className="px-3 py-1 rounded bg-secondary text-xs">Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div onClick={startEditing} className="cursor-pointer group">
      <h4 className="text-xs font-semibold text-muted-foreground mb-1">Description <Edit2 className="inline h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" /></h4>
      <p className="text-sm text-foreground">{value || <span className="text-muted-foreground">No description. Click to add one.</span>}</p>
    </div>
  );
}

function ProjectEpicSelect({ projectId, sprintId, moduleId, value, onChange }: { projectId: string; sprintId?: string; moduleId?: string; value: string; onChange: (id: string) => void }) {
  const { data: epicsRaw } = useQuery({
    queryKey: ['project-epics-picker', projectId, sprintId, moduleId],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (sprintId) params.sprint_id = sprintId;
      if (moduleId) params.module_id = moduleId;
      return api.get(`/projects/${projectId}/epics`, { params }).then(r => extractProjectArray<any>(r.data, ['epics']));
    },
  });
  const epics = Array.isArray(epicsRaw) ? epicsRaw : [];
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
      <option value="">No Epic</option>
      {epics.map((ep: any) => <option key={ep.id} value={ep.id}>{ep.title}</option>)}
    </select>
  );
}

export default function TaskDetailDrawer({ task: initialTask, onClose, projectId }: Props) {
  const qc = useQueryClient();
  const userRole = useAuthStore(s => s.user?.role);
  const seesMasterStatus = MASTER_STATUS_ROLES.has(userRole || '');
  const { statuses, statusObjects, addStatus } = useProjectStatuses(projectId);
  const { stages, stageObjects, addStage } = useProjectStages(projectId);
  const [activeTab, setActiveTab] = useState<'timelog' | 'handoffs'>('timelog');
  const [commentText, setCommentText] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(initialTask.title);
  const [showLogTime, setShowLogTime] = useState(false);
  const [timeForm, setTimeForm] = useState({ hours: '', date: new Date().toISOString().split('T')[0], description: '' });
  const [showSubtask, setShowSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [deletingSubtask, setDeletingSubtask] = useState<any>(null);
  const [openSubtask, setOpenSubtask] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: taskDetail } = useQuery({
    queryKey: ['task-detail', initialTask.id],
    queryFn: () => api.get(`/tasks/${initialTask.id}`).then(r => normalizeTaskEntity(r.data)),
    initialData: normalizeTaskEntity(initialTask),
  });

  // Fixed endpoints: extract from .data
  const { data: commentsRaw } = useQuery({
    queryKey: ['task-comments', initialTask.id],
    queryFn: () => api.get(`/tasks/${initialTask.id}/comments`).then(r => extractProjectArray(r.data, ['comments']).map(normalizeCommentEntity)),
  });
  const comments = Array.isArray(commentsRaw) ? commentsRaw : [];

  const { data: activityRaw } = useQuery({
    queryKey: ['task-activity', initialTask.id],
    queryFn: () => api.get(`/tasks/${initialTask.id}/activity`).then(r => extractProjectArray(r.data, ['activity']).map(normalizeActivityEntity)),
  });
  const activity = Array.isArray(activityRaw) ? activityRaw : [];

  const { data: timeLogsRaw } = useQuery({
    queryKey: ['task-timelogs', initialTask.id],
    queryFn: () => api.get(`/tasks/${initialTask.id}/timelogs`).then(r => extractProjectArray(r.data, ['timelogs']).map(normalizeTimeLogEntity)),
  });
  const timeLogs = Array.isArray(timeLogsRaw) ? timeLogsRaw : [];

  const { data: handoffsRaw } = useQuery({
    queryKey: ['task-handoffs', initialTask.id],
    queryFn: () => api.get(`/tasks/${initialTask.id}/handoffs`).then(r => extractProjectArray(r.data, ['handoffs']).map(normalizeHandoffEntity)),
  });
  const handoffs = Array.isArray(handoffsRaw) ? handoffsRaw : [];

  const { data: membersRaw } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get(`/projects/${projectId}/members`).then(r => extractProjectArray(r.data, ['members', 'users'])),
  });
  const members = Array.isArray(membersRaw) ? membersRaw : [];
  const task = normalizeTaskEntity(taskDetail || initialTask, members);

  // Modules list (the "Module" picker — backend route is /modules, table was historically called epics)
  const { data: modulesRaw } = useQuery({
    queryKey: ['project-modules', projectId],
    queryFn: () => api.get(`/projects/${projectId}/modules`).then(r => extractProjectArray<Module>(r.data, ['modules', 'epics'])),
  });
  const modules: Module[] = Array.isArray(modulesRaw) ? modulesRaw : [];

  const { data: sprintsRaw } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => extractProjectArray<Sprint>(r.data, ['sprints'])),
  });
  const sprints = Array.isArray(sprintsRaw) ? sprintsRaw : [];

  // Attachments now come embedded in the task detail response (task.attachments).
  // No separate fetch — initialise & update via the ['task-detail'] cache.
  const attachments: Attachment[] = Array.isArray((task as any).attachments) ? (task as any).attachments : [];

  const buildOptimisticTask = (currentTask: ProjectTask, patch: Record<string, any>): ProjectTask => {
    const nextTask: ProjectTask = { ...currentTask, ...patch };
    if ('assignee_ids' in patch) {
      const nextIds = Array.isArray(patch.assignee_ids) ? patch.assignee_ids : [];
      nextTask.assignee_ids = nextIds;
      nextTask.assignees = nextIds.map((id: string) => {
        const member = members.find((item: any) => getMemberId(item) === id);
        const existing = currentTask.assignees?.find((a: any) => getMemberId(a) === id || a?.id === id);
        if (member) return { id, full_name: member.full_name, avatar_url: member.avatar_url };
        return existing;
      }).filter(Boolean) as ProjectTask['assignees'];
    }
    if ('epic_id' in patch) {
      const mod = modules.find((item) => item.id === patch.epic_id);
      nextTask.epic_id = patch.epic_id || undefined;
      nextTask.epic_name = mod?.title;
      nextTask.epic_color = mod?.color;
    }
    if ('sprint_id' in patch) {
      const sprint = sprints.find((item) => item.id === patch.sprint_id);
      nextTask.sprint_id = patch.sprint_id || undefined;
      nextTask.sprint_name = sprint?.name;
    }
    if ('parent_task_id' in patch) nextTask.parent_task_id = patch.parent_task_id || undefined;
    if ('due_date' in patch) nextTask.due_date = patch.due_date || undefined;
    
    if ('description' in patch) nextTask.description = patch.description;
    if ('stage' in patch) nextTask.stage = patch.stage || undefined;
    return normalizeTaskEntity(nextTask, members);
  };

  const invalidateTaskQueries = () => {
    qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] });
    qc.invalidateQueries({ queryKey: ['project-board', projectId] });
    qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
    qc.invalidateQueries({ queryKey: ['project-backlog-tasks', projectId] });
    qc.invalidateQueries({ queryKey: ['project-all-tasks'] });
    qc.invalidateQueries({ queryKey: ['project-epics', projectId] });
    qc.invalidateQueries({ queryKey: ['project-epic-task-rollups', projectId] });
    qc.invalidateQueries({ queryKey: ['sprint-hierarchy', projectId] });
    qc.invalidateQueries({ queryKey: ['project-sprints', projectId] });
  };

  const updateMut = useMutation({
    mutationFn: async (d: Record<string, any>) => {
      try {
        return await api.put(`/tasks/${initialTask.id}`, d);
      } catch (error: any) {
        if ((error.response?.status === 400 || error.response?.status === 422) && 'stage' in d) {
          const { stage, ...rest } = d;
          return api.put(`/tasks/${initialTask.id}`, { ...rest, workflow_stage: stage || null });
        }
        throw error;
      }
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['task-detail', initialTask.id] });
      const previousTask = qc.getQueryData<ProjectTask>(['task-detail', initialTask.id]);
      qc.setQueryData(['task-detail', initialTask.id], buildOptimisticTask(previousTask || task, patch));
      return { previousTask };
    },
    onSuccess: (res, patch) => {
      const updatedTask = normalizeTaskEntity(res.data, members);
      if (updatedTask) qc.setQueryData<ProjectTask>(['task-detail', initialTask.id], (c) => buildOptimisticTask({ ...(c || task), ...updatedTask }, patch));
      invalidateTaskQueries();
      setTimeout(invalidateTaskQueries, 1200);
      toast.success('Updated');
    },
    onError: (e: any, _p, ctx) => {
      if (ctx?.previousTask) qc.setQueryData(['task-detail', initialTask.id], ctx.previousTask);
      toast.error(e.response?.data?.message || 'Failed to update task');
    },
  });

  const submitTaskUpdate = (patch: Record<string, any>) => {
    const payload = sanitizeTaskPatch(patch);
    if (Object.keys(payload).length === 0) return;
    updateMut.mutate(payload);
  };

  const commentMut = useMutation({
    mutationFn: async (text: string) => {
      const trimmed = text.trim();
      try {
        return await api.post(`/tasks/${initialTask.id}/comments`, { text: trimmed });
      } catch (error: any) {
        if (error.response?.status === 400 || error.response?.status === 422) {
          try {
            return await api.post(`/tasks/${initialTask.id}/comments`, { message: trimmed });
          } catch (fallbackError: any) {
            if (fallbackError.response?.status === 400 || fallbackError.response?.status === 422) {
              return api.post(`/tasks/${initialTask.id}/comments`, { content: trimmed });
            }
            throw fallbackError;
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-comments', initialTask.id] });
      qc.invalidateQueries({ queryKey: ['task-activity', initialTask.id] });
      setCommentText('');
      toast.success('Comment added');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.response?.data?.error || 'Failed to send message'),
  });

  const watchMut = useMutation({
    mutationFn: () => task.is_watching ? api.delete(`/tasks/${initialTask.id}/watch`) : api.post(`/tasks/${initialTask.id}/watch`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] }); },
  });

  const logTimeMut = useMutation({
    mutationFn: (d: typeof timeForm) => api.post(`/tasks/${initialTask.id}/timelogs`, { hours: Number(d.hours), date: d.date, description: d.description }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-timelogs', initialTask.id] }); setShowLogTime(false); setTimeForm({ hours: '', date: new Date().toISOString().split('T')[0], description: '' }); toast.success('Time logged'); },
  });

  const subtaskMut = useMutation({
    mutationFn: (title: string) => {
      const payload: Record<string, any> = {
        title: title.trim(), type: 'Subtask', priority: task.priority || 'Medium', status: 'Open',
        project_id: projectId, parent_task_id: initialTask.id,
      };
      return api.post('/tasks', payload);
    },
    onMutate: async (title) => {
      await qc.cancelQueries({ queryKey: ['task-detail', initialTask.id] });
      const prev = qc.getQueryData<ProjectTask>(['task-detail', initialTask.id]);
      const tempId = `temp-${Date.now()}`;
      qc.setQueryData<ProjectTask>(['task-detail', initialTask.id], (c) => ({
        ...(c || task),
        subtasks: [...((c || task).subtasks || []), { id: tempId, task_number: 'NEW', title: title.trim(), type: 'Subtask' as const, status: 'Open', priority: task.priority || 'Medium' as const }],
      }));
      return { prev, tempId };
    },
    onSuccess: (res, _t, ctx) => {
      const created = extractProjectEntity<ProjectTask>(res.data, ['task']);
      if (created) qc.setQueryData<ProjectTask>(['task-detail', initialTask.id], (c) => ({
        ...(c || task),
        subtasks: ((c || task).subtasks || []).map(s => s.id === ctx?.tempId ? created : s),
      }));
      invalidateTaskQueries();
      setTimeout(invalidateTaskQueries, 1200);
      setShowSubtask(false); setSubtaskTitle('');
      toast.success('Subtask added');
    },
    onError: (e: any, _t, ctx) => {
      if (ctx?.prev) qc.setQueryData(['task-detail', initialTask.id], ctx.prev);
      toast.error(e.response?.data?.message || 'Failed to add subtask');
    },
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/tasks/${initialTask.id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-attachments', initialTask.id] }); toast.success('File uploaded'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Upload failed'),
  });

  const deleteAttachmentMut = useMutation({
    mutationFn: (aid: string) => api.delete(`/tasks/${initialTask.id}/attachments/${aid}`),
    onSuccess: (_res, aid) => {
      // Remove only the deleted attachment from the task-detail cache.
      // Do NOT invalidate — a refetch can race the backend and wipe the list.
      qc.setQueryData(['task-detail', initialTask.id], (old: any) => {
        if (!old || typeof old !== 'object') return old;
        const prev = Array.isArray(old.attachments) ? old.attachments : [];
        return { ...old, attachments: prev.filter((a: any) => a?.id !== aid) };
      });
      });
      toast.success('Attachment removed');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to remove attachment'),
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteTaskMut = useMutation({
    mutationFn: () => api.delete(`/tasks/${initialTask.id}`),
    onSuccess: () => {
      // Immediately remove from all task lists (optimistic removal)
      qc.setQueryData(['project-all-tasks'], (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.filter((t: any) => t.id !== initialTask.id);
      });
      // Also remove from any filtered query variants
      qc.getQueryCache().getAll().forEach(query => {
        const key = query.queryKey;
        if (key[0] === 'project-all-tasks' && Array.isArray(query.state.data)) {
          qc.setQueryData(key, (old: any) => {
            if (!old || !Array.isArray(old)) return old;
            return old.filter((t: any) => t.id !== initialTask.id);
          });
        }
      });
      // Remove from task-detail cache if present
      qc.removeQueries({ queryKey: ['task-detail', initialTask.id] });
      invalidateTaskQueries();
      toast.success('Task deleted');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete task'),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) Array.from(files).forEach(f => uploadMut.mutate(f));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleAssignee = (userId: string) => {
    const currentIds = task.assignee_ids || task.assignees?.map((a: any) => getMemberId(a) || a.id) || [];
    const newIds = currentIds.includes(userId) ? currentIds.filter((id: string) => id !== userId) : [...currentIds, userId];
    setShowAssigneePicker(false);
    // Use PUT /tasks/:id with assignee_id for broad role compatibility
    api.put(`/tasks/${initialTask.id}`, { assignee_id: newIds[newIds.length - 1] || null, assignee_ids: newIds }).then((res) => {
      const updated = normalizeTaskEntity(res.data, members);
      qc.setQueryData(['task-detail', initialTask.id], (old: any) => ({ ...(old || task), ...updated, assignee_ids: newIds }));
      invalidateTaskQueries();
      toast.success('Assignee updated');
    }).catch((e: any) => toast.error(e.response?.data?.message || 'Failed to update assignee'));
  };

  const tc = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.Task;

  const getFileIcon = (fileName: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return <Image className="h-4 w-4 text-primary" />;
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

    return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-7xl bg-card border-l border-border overflow-y-auto animate-slide-up">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{tc.icon}</span>
            <span className="text-sm font-mono text-muted-foreground">{task.task_number}</span>
            <HandoffBadge handoffInfo={(task as any).handoff_info} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => watchMut.mutate()} className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${task.is_watching ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-muted-foreground'}`}>
              {task.is_watching ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {task.watchers_count || 0}
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete task">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* Header controls: Type, Status, Priority, Handoff, Timelog */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={task.type} onChange={e => submitTaskUpdate({ type: e.target.value })} className="px-2 py-1 rounded bg-secondary border border-border text-xs focus:outline-none">
              {TYPES.map(t => <option key={t} value={t}>{TASK_TYPE_CONFIG[t]?.icon} {t}</option>)}
            </select>
            <InlineAddSelect value={seesMasterStatus ? task.status : ((task as any).my_status || task.status)} options={statuses} colorOptions={statusObjects} onChange={v => submitTaskUpdate({ status: v })} onAdd={addStatus} placeholder={seesMasterStatus ? 'Status' : 'My Status'} />
            <select value={task.priority} onChange={e => submitTaskUpdate({ priority: e.target.value })} className="px-2 py-1 rounded bg-secondary border border-border text-xs focus:outline-none">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setShowHandoff(true)} className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-accent text-accent-foreground hover:opacity-90 transition-colors font-medium">
                <ArrowRightLeft className="h-3 w-3" /> Hand Off
              </button>
            </div>
          </div>

          {/* Two-column layout: left = title/description/subtasks/attachments/comments/timelog, right = details */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-6 min-w-0">
          {/* Title */}
          {isEditingTitle ? (
            <div className="flex gap-2">
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus onBlur={() => { submitTaskUpdate({ title: editTitle }); setIsEditingTitle(false); }} onKeyDown={e => { if (e.key === 'Enter') { submitTaskUpdate({ title: editTitle }); setIsEditingTitle(false); } }} />
            </div>
          ) : (
            <h1 className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors" onClick={() => setIsEditingTitle(true)}>{task.title}</h1>
          )}

          {/* Description */}
          <EditableDescription value={task.description || ''} onSave={(desc) => submitTaskUpdate({ description: desc })} />

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Subtasks</h4>
              <button onClick={() => setShowSubtask(true)} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Add</button>
            </div>
            {task.subtasks?.map((st: any) => (
              <div
                key={st.id}
                onClick={() => setOpenSubtask(st)}
                className="flex items-center gap-2 py-2 px-2 rounded hover:bg-secondary/50 flex-wrap group cursor-pointer"
              >
                <input type="checkbox" checked={st.status === 'Done'} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); const newStatus = st.status === 'Done' ? 'Open' : 'Done'; api.put(`/tasks/${st.id}`, { status: newStatus }).then(() => { qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] }); toast.success(`Subtask ${newStatus === 'Done' ? 'completed' : 'reopened'}`); }).catch(() => toast.error('Failed to update subtask')); }} className="rounded border-border cursor-pointer" />
                <span className="text-xs font-mono text-muted-foreground">{st.task_number}</span>
                <span className={`text-sm flex-1 min-w-[80px] ${st.status === 'Done' ? 'line-through text-muted-foreground' : ''}`}>{st.title}</span>
                <HandoffBadge handoffInfo={(st as any).handoff_info} />
                <select onClick={(e) => e.stopPropagation()} value={st.status || 'Open'} onChange={(e) => { e.stopPropagation(); api.put(`/tasks/${st.id}`, { status: e.target.value }).then(() => { qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] }); toast.success('Status updated'); }).catch(() => toast.error('Failed to update')); }} className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] focus:outline-none cursor-pointer">
                  {BOARD_COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div onClick={(e) => e.stopPropagation()}>
                  <InlineUserPicker value={st.assignee_ids?.[0] || st.assignees?.[0]?.id || ''} onChange={(userId) => { api.patch(`/tasks/${st.id}/assignee`, { assignee_id: userId }).then((res) => { qc.setQueryData(['task-detail', initialTask.id], (old: any) => { if (!old) return old; return { ...old, subtasks: (old.subtasks || []).map((s: any) => s.id === st.id ? { ...s, ...res.data } : s) }; }); toast.success('Assignee updated'); }).catch(() => toast.error('Failed to update')); }} />
                </div>
                <input onClick={(e) => e.stopPropagation()} type="date" value={st.due_date ? st.due_date.slice(0, 10) : ''} onChange={(e) => { e.stopPropagation(); api.put(`/tasks/${st.id}`, { due_date: e.target.value || null }).then(() => { qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] }); toast.success('Due date updated'); }).catch(() => toast.error('Failed to update')); }} className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] focus:outline-none cursor-pointer" />
                <div onClick={(e) => e.stopPropagation()}>
                  <SubtaskRowActions subtask={st} onEdit={(s) => setOpenSubtask(s)} onDelete={(s) => setDeletingSubtask(s)} />
                </div>
              </div>
            ))}
            {(!task.subtasks || task.subtasks.length === 0) && <p className="text-xs text-muted-foreground">No subtasks</p>}
          </div>

          {/* Attachments */}
          <AttachmentDropzone
            taskId={initialTask.id}
            globalPaste
            attachments={attachments as Attachment[]}
            onAdd={(att) => {
              // Append to the embedded task.attachments array in the task-detail cache.
              // Do NOT invalidate — a refetch can race backend indexing and wipe it.
              qc.setQueryData(['task-detail', initialTask.id], (old: any) => {
                if (!old || typeof old !== 'object') return old;
                const prev = Array.isArray(old.attachments) ? old.attachments : [];
                if (prev.some((a: any) => a?.id === att.id)) return old;
                return { ...old, attachments: [...prev, att] };
              });
            }}
            onRemove={(att) => {
              // Optimistically drop from the task-detail cache, then DELETE.
              qc.setQueryData(['task-detail', initialTask.id], (old: any) => {
                if (!old || typeof old !== 'object') return old;
                const prev = Array.isArray(old.attachments) ? old.attachments : [];
                return { ...old, attachments: prev.filter((a: any) => a?.id !== att.id) };
              });
              deleteAttachmentMut.mutate(att.id);
            }}
          />

          {/* Comments */}
          <div className="border border-border rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Comments</h4>
            <div className="flex gap-2">
              <input placeholder="Add a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" onKeyDown={e => { const c = commentText.trim(); if (e.key === 'Enter' && c) commentMut.mutate(c); }} />
              <button onClick={() => { const c = commentText.trim(); if (c) commentMut.mutate(c); }} disabled={!commentText.trim() || commentMut.isPending} className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"><Send className="h-4 w-4" /></button>
            </div>
            {comments.length > 0 && (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">{c.user_name?.[0]}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{c.user_name}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                        {c.is_own && (
                          <div className="flex gap-1 ml-auto">
                            <button className="p-0.5 rounded hover:bg-secondary text-muted-foreground"><Edit2 className="h-3 w-3" /></button>
                            <button className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        )}
                      </div>
                      <p className="text-sm mt-0.5">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

            </div>

            {/* Right column: Details + Labels */}
            <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* Details */}
          <div className="lg:border-t-0 border-t border-border lg:pt-0 pt-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Details</h4>
            <div className="grid grid-cols-1 gap-4">
              <div className="relative">
                <UserPicker multi selectedIds={task.assignee_ids || task.assignees?.map((a: any) => getMemberId(a) || a.id) || []} onToggle={toggleAssignee} value={null} onChange={() => {}} label="Assignees" placeholder="Select assignees..." />
                {/* Per-assignee personal status — visible to admins/managers only */}
                {seesMasterStatus && (task.assignees?.length ?? 0) > 0 && task.assignees!.some((a: any) => a.personal_status) && (
                  <div className="mt-2 space-y-1">
                    {task.assignees!.map((a: any) => {
                      const pStatus = a.personal_status;
                      if (!pStatus) return null;
                      const sObj = statusObjects.find((so: StatusOption) => so.name === pStatus);
                      const color = sObj?.color || 'hsl(var(--muted-foreground))';
                      return (
                        <div key={a.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-muted-foreground">{a.full_name}</span>
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap"
                            style={{ background: `${color}22`, color }}
                            title="Personal status"
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                            {pStatus}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              {/* Sprint */}
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">Sprint</span>
                <select value={task.sprint_id || ''} onChange={e => submitTaskUpdate({ sprint_id: e.target.value || null })} className="mt-1 w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">No Sprint</option>
                  {sprints.filter((s) => s.status !== 'Completed').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Module */}
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  Module
                  {(task as any).epic_color && <span className="w-2 h-2 rounded-full" style={{ background: (task as any).epic_color }} />}
                </span>
                <select value={task.epic_id || ''} onChange={e => submitTaskUpdate({ epic_id: e.target.value || null, project_epic_id: null })} className="mt-1 w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">No Module</option>
                  {modules.map((mod) => <option key={mod.id} value={mod.id}>{mod.title}{mod.sprint_name ? ` — ${mod.sprint_name}` : ''}</option>)}
                </select>
              </div>

              {/* Epic */}
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  Epic
                  {(task as any).project_epic_color && <span className="w-2 h-2 rounded-full" style={{ background: (task as any).project_epic_color }} />}
                </span>
                <ProjectEpicSelect
                  projectId={projectId}
                  sprintId={task.sprint_id}
                  moduleId={task.epic_id}
                  value={(task as any).project_epic_id || ''}
                  onChange={(id) => submitTaskUpdate({ project_epic_id: id || null })}
                />
              </div>

              {/* Reporter */}
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">Reporter</span>
                <p className="text-sm mt-2">{task.reporter?.full_name || '—'}</p>
              </div>

              {/* Due Date */}
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">Due Date</span>
                <input type="date" value={task.due_date ? task.due_date.substring(0, 10) : ''} onChange={e => submitTaskUpdate({ due_date: e.target.value || null })} className="mt-1 w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>

              {/* Stage */}
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">Stage</span>
                <div className="mt-1"><InlineAddSelect value={task.stage || ''} options={stages} colorOptions={stageObjects} onChange={v => submitTaskUpdate({ stage: v || null })} onAdd={addStage} placeholder="No Stage" /></div>
              </div>

              {/* Code Repo */}
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">Code Repo</span>
                <select value={(task as any).code_repo_status || ''} onChange={e => submitTaskUpdate({ code_repo_status: e.target.value || null })} className="mt-1 w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">No Status</option>
                  <option value="not_pushed">Not Pushed</option>
                  <option value="pushed">Pushed</option>
                  <option value="conflict">Conflict</option>
                </select>
              </div>

              {/* Time Tracked */}
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">Time Tracked</span>
                <p className="text-sm mt-2">{task.logged_hours || 0}h / {task.estimate_hours || 0}h est.</p>
              </div>
            </div>
          </div>

          {/* Labels */}
          {task.labels && task.labels.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">Labels</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {task.labels.map(l => (
                  <span key={l.id} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${l.color}22`, color: l.color }}>{l.name}</span>
                ))}
              </div>
            </div>
          )}

            </div>
          </div>

          {/* Time Log / Handoffs */}
          <div className="border-t border-border pt-4">
            <div className="flex gap-4 mb-4">
              <button onClick={() => setActiveTab('timelog')} className={`flex items-center gap-1 text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'timelog' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Clock className="h-3.5 w-3.5" /> Time Log</button>
              <button onClick={() => setActiveTab('handoffs')} className={`flex items-center gap-1 text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'handoffs' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><ArrowRightLeft className="h-3.5 w-3.5" /> Handoffs</button>
            </div>
            {activeTab === 'timelog' && (
              <div className="space-y-3">
                <button onClick={() => setShowLogTime(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all"><Plus className="h-3 w-3" /> Log Time</button>
                <div className="space-y-2">
                  {timeLogs.map((tl: any) => (
                    <div key={tl.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">{tl.user_name?.[0]}</div>
                      <div className="flex-1">
                        <div className="flex justify-between"><span className="text-sm font-medium">{tl.user_name}</span><span className="text-sm font-semibold text-primary">{tl.hours}h</span></div>
                        <p className="text-xs text-muted-foreground">{tl.description} · {new Date(tl.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {showLogTime && (
                  <div className="glass-card p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" placeholder="Hours *" step="0.25" value={timeForm.hours} onChange={e => setTimeForm(f => ({ ...f, hours: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" />
                      <input type="date" value={timeForm.date} onChange={e => setTimeForm(f => ({ ...f, date: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" />
                    </div>
                    <input placeholder="Description" value={timeForm.description} onChange={e => setTimeForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowLogTime(false)} className="px-3 py-1 rounded text-xs text-muted-foreground hover:bg-secondary">Cancel</button>
                      <button onClick={() => logTimeMut.mutate(timeForm)} disabled={!timeForm.hours} className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">Log</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'handoffs' && (
              <div className="space-y-3">
                {handoffs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No handoff history yet</p>}
                {handoffs.map((h: any, i: number) => (
                  <div key={h.id || i} className="flex gap-3 p-3 rounded-lg bg-secondary/50">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">{h.from_user_name?.[0] || '?'}</div>
                      <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                      <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-accent-foreground">{h.to_user_name?.[0] || '?'}</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold">{h.from_stage || '—'}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold text-primary">{h.to_stage}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{h.from_user_name || 'Someone'} → {h.to_user_name || 'Unassigned'}</p>
                      {h.note && <p className="text-xs mt-1 text-foreground/80">{h.note}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Delete Task</h2>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{task.task_number}</strong>? This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => deleteTaskMut.mutate()} disabled={deleteTaskMut.isPending} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {deleteTaskMut.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Handoff Modal */}
      {showHandoff && (
        <HandoffModal
          taskId={initialTask.id}
          projectId={projectId}
          currentStage={task.stage}
          onClose={() => setShowHandoff(false)}
        />
      )}

      {/* Subtask Detail Drawer (nested) */}
      {openSubtask && (
        <TaskDetailDrawer
          task={openSubtask}
          projectId={projectId}
          onClose={() => { setOpenSubtask(null); invalidateTaskQueries(); }}
        />
      )}

      {/* Subtask Delete Confirm */}
      {deletingSubtask && (
        <SubtaskDeleteConfirm
          subtaskId={deletingSubtask.id}
          subtaskTitle={deletingSubtask.title}
          onClose={() => setDeletingSubtask(null)}
          onDeleted={(id) => {
            qc.setQueryData<ProjectTask>(['task-detail', initialTask.id], (c) => ({
              ...(c || task),
              subtasks: ((c || task).subtasks || []).filter((s: any) => s.id !== id),
            }));
            setDeletingSubtask(null);
          }}
        />
      )}

      {/* Subtask Create Modal */}
      {showSubtask && (
        <SubtaskCreateModal
          parentTask={task}
          projectId={projectId}
          onClose={() => { setShowSubtask(false); invalidateTaskQueries(); }}
          onCreated={(created) => {
            qc.setQueryData<ProjectTask>(['task-detail', initialTask.id], (c) => ({
              ...(c || task),
              subtasks: [...((c || task).subtasks || []), created],
            }));
          }}
        />
      )}
    </div>
  );
}
