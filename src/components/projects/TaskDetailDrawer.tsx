import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { TASK_TYPE_CONFIG, BOARD_COLUMNS, WORKFLOW_STAGES, type Epic, type ProjectTask, type Sprint } from '@/lib/projectTypes';
import { extractProjectArray, extractProjectEntity } from '@/lib/projectResponse';
import HandoffModal from './HandoffModal';

import { useState, useRef } from 'react';
import { X, Eye, EyeOff, Clock, MessageSquare, Activity, Plus, Send, Edit2, Trash2, Paperclip, Image, FileText, Download, UserPlus, ArrowRightLeft } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  task: ProjectTask;
  onClose: () => void;
  projectId: string;
}

const TYPES = ['Story', 'Task', 'Bug', 'Subtask'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

const getMemberId = (member: any) => member?.user_id || member?.id;
const toArray = <T,>(value: T | T[] | null | undefined): T[] => Array.isArray(value) ? value : value ? [value] : [];
const getPersonName = (person: any) => person?.full_name || person?.name || person?.user_name || person?.display_name || person?.username || person?.email || '';

function buildPerson(person: any, fallbackId?: string, fallbackName?: string) {
  const id = getMemberId(person) || fallbackId;
  const full_name = getPersonName(person) || fallbackName;
  return id || full_name ? { id: id || full_name || 'unknown', full_name: full_name || 'Unknown', avatar_url: person?.avatar_url } : undefined;
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
  };
}

function normalizeCommentEntity(comment: any) {
  return {
    ...comment,
    text: comment?.text || comment?.message || comment?.content || comment?.comment || '',
    user_name: comment?.user_name || comment?.author_name || comment?.created_by_name || getPersonName(comment?.user || comment?.author || comment?.created_by) || 'Unknown',
  };
}

function normalizeActivityEntity(activity: any) {
  return {
    ...activity,
    action: activity?.action || activity?.message || activity?.description || activity?.event || 'updated the task',
    user_name: activity?.user_name || activity?.actor_name || activity?.created_by_name || getPersonName(activity?.user || activity?.actor || activity?.created_by) || 'Someone',
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
  if ('assignee_ids' in patch && Array.isArray(patch.assignee_ids)) {
    payload.assignee_ids = [...new Set(patch.assignee_ids.filter((id: string) => typeof id === 'string' && id.trim()))];
  }
  if ('epic_id' in patch) payload.epic_id = patch.epic_id || null;
  if ('sprint_id' in patch) payload.sprint_id = patch.sprint_id || null;
  if ('parent_task_id' in patch) payload.parent_task_id = patch.parent_task_id || null;
  if ('due_date' in patch) payload.due_date = patch.due_date || null;
  if ('stage' in patch) payload.stage = patch.stage || null;
  if ('story_points' in patch) {
    if (patch.story_points === '' || patch.story_points == null) payload.story_points = null;
    else { const p = Number(patch.story_points); if (Number.isFinite(p)) payload.story_points = p; }
  }
  return payload;
}

function EditableDescription({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (editing) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Description</h4>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" autoFocus />
        <div className="flex gap-2 mt-1">
          <button onClick={() => { onSave(draft); setEditing(false); }} className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium">Save</button>
          <button onClick={() => { setDraft(value); setEditing(false); }} className="px-3 py-1 rounded bg-secondary text-xs">Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div onClick={() => setEditing(true)} className="cursor-pointer group">
      <h4 className="text-xs font-semibold text-muted-foreground mb-1">Description <Edit2 className="inline h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" /></h4>
      <p className="text-sm text-muted-foreground">{value || 'No description. Click to add one.'}</p>
    </div>
  );
}

export default function TaskDetailDrawer({ task: initialTask, onClose, projectId }: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'activity' | 'timelog' | 'handoffs'>('activity');
  const [commentText, setCommentText] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(initialTask.title);
  const [showLogTime, setShowLogTime] = useState(false);
  const [timeForm, setTimeForm] = useState({ hours: '', date: new Date().toISOString().split('T')[0], description: '' });
  const [showSubtask, setShowSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
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

  const { data: epicsRaw } = useQuery({
    queryKey: ['project-epics', projectId],
    queryFn: () => api.get(`/projects/${projectId}/epics`).then(r => extractProjectArray<Epic>(r.data, ['epics'])),
  });
  const epics = Array.isArray(epicsRaw) ? epicsRaw : [];

  const { data: sprintsRaw } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => extractProjectArray<Sprint>(r.data, ['sprints'])),
  });
  const sprints = Array.isArray(sprintsRaw) ? sprintsRaw : [];

  const { data: attachmentsRaw } = useQuery({
    queryKey: ['task-attachments', initialTask.id],
    queryFn: async () => {
      try {
        const r = await api.get(`/tasks/${initialTask.id}/attachments`);
        return r.data?.attachments || r.data?.data?.attachments || r.data || [];
      } catch { return task.attachments || []; }
    },
  });
  const attachments = Array.isArray(attachmentsRaw) ? attachmentsRaw : (task.attachments || []);

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
      const epic = epics.find((item) => item.id === patch.epic_id);
      nextTask.epic_id = patch.epic_id || undefined;
      nextTask.epic_name = epic?.title;
      nextTask.epic_color = epic?.color;
    }
    if ('sprint_id' in patch) {
      const sprint = sprints.find((item) => item.id === patch.sprint_id);
      nextTask.sprint_id = patch.sprint_id || undefined;
      nextTask.sprint_name = sprint?.name;
    }
    if ('parent_task_id' in patch) nextTask.parent_task_id = patch.parent_task_id || undefined;
    if ('due_date' in patch) nextTask.due_date = patch.due_date || undefined;
    if ('story_points' in patch) nextTask.story_points = patch.story_points == null || patch.story_points === '' ? undefined : Number(patch.story_points);
    if ('description' in patch) nextTask.description = patch.description;
    if ('stage' in patch) nextTask.stage = patch.stage || undefined;
    return normalizeTaskEntity(nextTask, members);
  };

  const invalidateTaskQueries = () => {
    qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] });
    qc.invalidateQueries({ queryKey: ['project-board', projectId] });
    qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
    qc.invalidateQueries({ queryKey: ['project-backlog-tasks', projectId] });
    qc.invalidateQueries({ queryKey: ['project-all-tasks', projectId] });
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-attachments', initialTask.id] }); toast.success('Attachment removed'); },
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteTaskMut = useMutation({
    mutationFn: () => api.delete(`/tasks/${initialTask.id}`),
    onSuccess: () => { invalidateTaskQueries(); toast.success('Task deleted'); onClose(); },
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
    submitTaskUpdate({ assignee_ids: newIds });
    setShowAssigneePicker(false);
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
      <div className="relative w-full max-w-2xl bg-card border-l border-border overflow-y-auto animate-slide-up">
        <div className="sticky top-0 z-10 bg-card border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{tc.icon}</span>
            <span className="text-sm font-mono text-muted-foreground">{task.task_number}</span>
            {task.stage && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">{task.stage}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHandoff(true)} className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-accent text-accent-foreground hover:opacity-90 transition-colors font-medium" title="Hand Off">
              <ArrowRightLeft className="h-3 w-3" /> Hand Off
            </button>
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
          {/* Dropdowns row */}
          <div className="flex flex-wrap gap-2">
            <select value={task.type} onChange={e => submitTaskUpdate({ type: e.target.value })} className="px-2 py-1 rounded bg-secondary border border-border text-xs focus:outline-none">
              {TYPES.map(t => <option key={t} value={t}>{TASK_TYPE_CONFIG[t]?.icon} {t}</option>)}
            </select>
            <select value={task.status} onChange={e => submitTaskUpdate({ status: e.target.value })} className="px-2 py-1 rounded bg-secondary border border-border text-xs focus:outline-none">
              {BOARD_COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={task.priority} onChange={e => submitTaskUpdate({ priority: e.target.value })} className="px-2 py-1 rounded bg-secondary border border-border text-xs focus:outline-none">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Title */}
          {isEditingTitle ? (
            <div className="flex gap-2">
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus onBlur={() => { submitTaskUpdate({ title: editTitle }); setIsEditingTitle(false); }} onKeyDown={e => { if (e.key === 'Enter') { submitTaskUpdate({ title: editTitle }); setIsEditingTitle(false); } }} />
            </div>
          ) : (
            <h1 className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors" onClick={() => setIsEditingTitle(true)}>{task.title}</h1>
          )}

          <EditableDescription value={task.description || ''} onSave={(desc) => submitTaskUpdate({ description: desc })} />

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs text-muted-foreground">Assignees</span>
                <button onClick={() => setShowAssigneePicker(!showAssigneePicker)} className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors" title="Assign member">
                  <UserPlus className="h-3 w-3" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {task.assignees?.map(a => (
                  <div key={a.id} className="flex items-center gap-1 bg-secondary rounded-full px-2 py-0.5">
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary">{a.full_name?.[0]}</div>
                    <span className="text-xs">{a.full_name}</span>
                    <button onClick={() => toggleAssignee(a.id)} className="text-muted-foreground hover:text-destructive ml-0.5"><X className="h-2.5 w-2.5" /></button>
                  </div>
                )) || <span className="text-xs text-muted-foreground">Unassigned</span>}
                {(!task.assignees || task.assignees.length === 0) && <span className="text-xs text-muted-foreground">Unassigned</span>}
              </div>
              {showAssigneePicker && (
                <div className="absolute top-full left-0 z-20 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg p-2 space-y-1 max-h-48 overflow-y-auto">
                  {members.map((m: any) => {
                    const mid = getMemberId(m);
                    const isAssigned = task.assignees?.some((a: any) => getMemberId(a) === mid || a.id === mid) || task.assignee_ids?.includes(mid);
                    return (
                      <button key={mid} onClick={() => toggleAssignee(mid)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${isAssigned ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>
                        <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary">{m.full_name?.[0]}</div>
                        <span className="flex-1 truncate">{m.full_name}</span>
                        {isAssigned && <span className="text-[10px]">✓</span>}
                      </button>
                    );
                  })}
                  {members.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No members found</p>}
                </div>
              )}
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Reporter</span>
              <p className="text-sm">{task.reporter?.full_name || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Module</span>
              <select value={task.epic_id || ''} onChange={e => submitTaskUpdate({ epic_id: e.target.value || null })} className="mt-1 w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">No Module</option>
                {epics.map((epic) => <option key={epic.id} value={epic.id}>{epic.title}</option>)}
              </select>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Sprint</span>
              <select value={task.sprint_id || ''} onChange={e => submitTaskUpdate({ sprint_id: e.target.value || null })} className="mt-1 w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">No Sprint</option>
                {sprints.filter((s) => s.status !== 'Completed').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Story Points</span>
              <p className="text-sm font-semibold">{task.story_points ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Due Date</span>
              <p className="text-sm">{task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Stage</span>
              <select value={task.stage || ''} onChange={e => submitTaskUpdate({ stage: e.target.value || null })} className="mt-1 w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">No Stage</option>
                {WORKFLOW_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Time Tracked</span>
              <p className="text-sm">{task.logged_hours || 0}h / {task.estimate_hours || 0}h est.</p>
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

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Attachments</h4>
              <button onClick={() => fileInputRef.current?.click()} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Paperclip className="h-3 w-3" /> Attach File
              </button>
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" className="hidden" onChange={handleFileSelect} />
            </div>
            {uploadMut.isPending && <p className="text-xs text-muted-foreground animate-pulse">Uploading...</p>}
            <div className="space-y-1.5">
              {attachments.map((att: any) => (
                <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 group">
                  {getFileIcon(att.file_name)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{att.file_name}</p>
                    {att.created_at && <p className="text-[10px] text-muted-foreground">{new Date(att.created_at).toLocaleDateString()}</p>}
                  </div>
                  {att.file_url && <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Download className="h-3.5 w-3.5" /></a>}
                  <button onClick={() => deleteAttachmentMut.mutate(att.id)} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {attachments.length === 0 && !uploadMut.isPending && (
                <div className="text-center py-4 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Drop files here or click to attach</p>
                </div>
              )}
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Subtasks</h4>
              <button onClick={() => setShowSubtask(true)} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Add</button>
            </div>
            {task.subtasks?.map((st: any) => (
              <div key={st.id} className="flex items-center gap-2 py-2 px-2 rounded hover:bg-secondary/50 flex-wrap">
                {/* Checkbox + Title */}
                <input
                  type="checkbox"
                  checked={st.status === 'Done'}
                  onChange={() => {
                    const newStatus = st.status === 'Done' ? 'Open' : 'Done';
                    api.put(`/tasks/${st.id}`, { status: newStatus }).then(() => {
                      qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] });
                      toast.success(`Subtask ${newStatus === 'Done' ? 'completed' : 'reopened'}`);
                    }).catch(() => toast.error('Failed to update subtask'));
                  }}
                  className="rounded border-border cursor-pointer"
                />
                <span className="text-xs font-mono text-muted-foreground">{st.task_number}</span>
                <span className={`text-sm flex-1 min-w-[80px] ${st.status === 'Done' ? 'line-through text-muted-foreground' : ''}`}>{st.title}</span>

                {/* Status */}
                <select
                  value={st.status || 'Open'}
                  onChange={(e) => {
                    api.put(`/tasks/${st.id}`, { status: e.target.value }).then(() => {
                      qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] });
                      toast.success('Status updated');
                    }).catch(() => toast.error('Failed to update'));
                  }}
                  className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] focus:outline-none cursor-pointer"
                >
                  {BOARD_COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                {/* Assignee */}
                <select
                  value={st.assignee_ids?.[0] || st.assignees?.[0]?.id || ''}
                  onChange={(e) => {
                    const payload: Record<string, any> = e.target.value
                      ? { assignee_id: e.target.value }
                      : { assignee_id: null };
                    api.put(`/tasks/${st.id}`, payload).then(() => {
                      qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] });
                      toast.success('Assignee updated');
                    }).catch(() => toast.error('Failed to update'));
                  }}
                  className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] focus:outline-none cursor-pointer max-w-[100px]"
                >
                  <option value="">Unassigned</option>
                  {members.map((m: any) => {
                    const uid = getMemberId(m);
                    return <option key={uid} value={uid}>{getPersonName(m)}</option>;
                  })}
                </select>

                {/* Due Date */}
                <input
                  type="date"
                  value={st.due_date ? st.due_date.slice(0, 10) : ''}
                  onChange={(e) => {
                    api.put(`/tasks/${st.id}`, { due_date: e.target.value || null }).then(() => {
                      qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] });
                      toast.success('Due date updated');
                    }).catch(() => toast.error('Failed to update'));
                  }}
                  className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] focus:outline-none cursor-pointer"
                />
              </div>
            ))}
            {(!task.subtasks || task.subtasks.length === 0) && !showSubtask && <p className="text-xs text-muted-foreground">No subtasks</p>}
            {showSubtask && (
              <div className="flex gap-2 mt-1">
                <input placeholder="Subtask title" value={subtaskTitle} onChange={e => setSubtaskTitle(e.target.value)} className="flex-1 px-2 py-1 rounded bg-secondary border border-border text-sm focus:outline-none" autoFocus onKeyDown={e => { if (e.key === 'Enter' && subtaskTitle.trim()) subtaskMut.mutate(subtaskTitle); }} />
                <button onClick={() => subtaskTitle.trim() && subtaskMut.mutate(subtaskTitle)} className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs">Add</button>
                <button onClick={() => setShowSubtask(false)} className="px-2 py-1 rounded text-xs text-muted-foreground hover:bg-secondary">Cancel</button>
              </div>
            )}
          </div>

          {/* Tabs: Activity / Time Log / Handoffs */}
          <div className="border-t border-border pt-4">
            <div className="flex gap-4 mb-4">
              <button onClick={() => setActiveTab('activity')} className={`flex items-center gap-1 text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'activity' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                <MessageSquare className="h-3.5 w-3.5" /> Activity
              </button>
              <button onClick={() => setActiveTab('timelog')} className={`flex items-center gap-1 text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'timelog' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                <Clock className="h-3.5 w-3.5" /> Time Log
              </button>
              <button onClick={() => setActiveTab('handoffs')} className={`flex items-center gap-1 text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'handoffs' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                <ArrowRightLeft className="h-3.5 w-3.5" /> Handoffs
              </button>
            </div>

            {activeTab === 'activity' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input placeholder="Add a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" onKeyDown={e => { const nextComment = commentText.trim(); if (e.key === 'Enter' && nextComment) commentMut.mutate(nextComment); }} />
                  <button onClick={() => { const nextComment = commentText.trim(); if (nextComment) commentMut.mutate(nextComment); }} disabled={!commentText.trim() || commentMut.isPending} className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3">
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
                  {activity.map((a: any) => (
                    <div key={a.id} className="flex gap-3 items-center">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{a.user_name}</span> {a.action} · {new Date(a.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'timelog' && (
              <div className="space-y-3">
                <button onClick={() => setShowLogTime(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all">
                  <Plus className="h-3 w-3" /> Log Time
                </button>
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
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {h.from_user_name || 'Someone'} → {h.to_user_name || 'Unassigned'}
                      </p>
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
    </div>
  );
}
