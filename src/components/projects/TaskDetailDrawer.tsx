import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { TASK_TYPE_CONFIG, PRIORITY_COLORS, BOARD_COLUMNS, type ProjectTask } from '@/lib/projectTypes';
import { extractProjectArray } from '@/lib/projectResponse';

import { useState, useRef } from 'react';
import { X, Eye, EyeOff, Clock, MessageSquare, Activity, Plus, Send, Edit2, Trash2, Paperclip, Image, FileText, Download, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  task: ProjectTask;
  onClose: () => void;
  projectId: string;
}

const TYPES = ['Story', 'Task', 'Bug', 'Subtask'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

export default function TaskDetailDrawer({ task: initialTask, onClose, projectId }: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'activity' | 'timelog'>('activity');
  const [commentText, setCommentText] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(initialTask.title);
  const [showLogTime, setShowLogTime] = useState(false);
  const [timeForm, setTimeForm] = useState({ hours: '', date: new Date().toISOString().split('T')[0], description: '' });
  const [showSubtask, setShowSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: taskDetail } = useQuery({
    queryKey: ['task-detail', initialTask.id],
    queryFn: () => api.get(`/tasks/${initialTask.id}`).then(r => r.data?.task || r.data?.data?.task || r.data),
    initialData: initialTask,
  });
  const task = taskDetail || initialTask;

  const { data: commentsRaw } = useQuery({
    queryKey: ['task-comments', initialTask.id],
    queryFn: () => api.get(`/tasks/${initialTask.id}/comments`).then(r => r.data?.comments || r.data || []),
  });
  const comments = Array.isArray(commentsRaw) ? commentsRaw : [];

  const { data: activityRaw } = useQuery({
    queryKey: ['task-activity', initialTask.id],
    queryFn: () => api.get(`/tasks/${initialTask.id}/activity`).then(r => r.data?.activity || r.data || []),
  });
  const activity = Array.isArray(activityRaw) ? activityRaw : [];

  const { data: timeLogsRaw } = useQuery({
    queryKey: ['task-timelogs', initialTask.id],
    queryFn: () => api.get(`/tasks/${initialTask.id}/timelogs`).then(r => r.data?.timelogs || r.data || []),
  });
  const timeLogs = Array.isArray(timeLogsRaw) ? timeLogsRaw : [];

  const { data: membersRaw } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get(`/projects/${projectId}/members`).then(r => extractProjectArray(r.data, ['members', 'users'])),
    enabled: showAssigneePicker,
  });
  const members = Array.isArray(membersRaw) ? membersRaw : [];

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

  const updateMut = useMutation({
    mutationFn: (d: any) => api.put(`/tasks/${initialTask.id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] }); qc.invalidateQueries({ queryKey: ['project-board', projectId] }); qc.invalidateQueries({ queryKey: ['project-backlog', projectId] }); toast.success('Updated'); },
  });

  const commentMut = useMutation({
    mutationFn: (text: string) => api.post(`/tasks/${initialTask.id}/comments`, { text }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-comments', initialTask.id] }); setCommentText(''); toast.success('Comment added'); },
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
    mutationFn: (title: string) => api.post('/tasks', { title, type: 'Subtask', project_id: projectId, parent_task_id: initialTask.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] }); setShowSubtask(false); setSubtaskTitle(''); toast.success('Subtask added'); },
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/tasks/${initialTask.id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments', initialTask.id] });
      qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] });
      toast.success('File uploaded');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Upload failed'),
  });

  const deleteAttachmentMut = useMutation({
    mutationFn: (attachmentId: string) => api.delete(`/tasks/${initialTask.id}/attachments/${attachmentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments', initialTask.id] });
      toast.success('Attachment removed');
    },
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteTaskMut = useMutation({
    mutationFn: () => api.delete(`/tasks/${initialTask.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-board', projectId] });
      qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
      toast.success('Task deleted');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete task'),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(f => uploadMut.mutate(f));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleAssignee = (userId: string) => {
    const currentIds = task.assignee_ids || task.assignees?.map((a: any) => a.id) || [];
    const newIds = currentIds.includes(userId)
      ? currentIds.filter((id: string) => id !== userId)
      : [...currentIds, userId];
    updateMut.mutate({ assignee_ids: newIds });
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
          {/* Dropdowns row */}
          <div className="flex flex-wrap gap-2">
            <select value={task.type} onChange={e => updateMut.mutate({ type: e.target.value })} className="px-2 py-1 rounded bg-secondary border border-border text-xs focus:outline-none">
              {TYPES.map(t => <option key={t} value={t}>{TASK_TYPE_CONFIG[t]?.icon} {t}</option>)}
            </select>
            <select value={task.status} onChange={e => updateMut.mutate({ status: e.target.value })} className="px-2 py-1 rounded bg-secondary border border-border text-xs focus:outline-none">
              {BOARD_COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={task.priority} onChange={e => updateMut.mutate({ priority: e.target.value })} className="px-2 py-1 rounded bg-secondary border border-border text-xs focus:outline-none">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Title */}
          {isEditingTitle ? (
            <div className="flex gap-2">
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus onBlur={() => { updateMut.mutate({ title: editTitle }); setIsEditingTitle(false); }} onKeyDown={e => { if (e.key === 'Enter') { updateMut.mutate({ title: editTitle }); setIsEditingTitle(false); } }} />
            </div>
          ) : (
            <h1 className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors" onClick={() => setIsEditingTitle(true)}>{task.title}</h1>
          )}

          {/* Description */}
          <EditableDescription
            value={task.description || ''}
            onSave={(desc) => updateMut.mutate({ description: desc })}
          />

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Assignees with picker */}
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
              {/* Assignee dropdown */}
              {showAssigneePicker && (
                <div className="absolute top-full left-0 z-20 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg p-2 space-y-1 max-h-48 overflow-y-auto">
                  {members.map((m: any) => {
                    const isAssigned = task.assignees?.some((a: any) => a.id === (m.user_id || m.id)) || task.assignee_ids?.includes(m.user_id || m.id);
                    return (
                      <button key={m.user_id || m.id} onClick={() => toggleAssignee(m.user_id || m.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${isAssigned ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>
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
              <span className="text-xs text-muted-foreground">Epic</span>
              {task.epic_name ? (
                <div className="flex items-center gap-1 mt-1"><div className="w-2.5 h-2.5 rounded" style={{ background: task.epic_color }} /><span className="text-sm">{task.epic_name}</span></div>
              ) : <p className="text-sm text-muted-foreground">None</p>}
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Sprint</span>
              <p className="text-sm">{task.sprint_name || '—'}</p>
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
              <div className="flex items-center gap-1">
                <button onClick={() => fileInputRef.current?.click()} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> Attach File
                </button>
                <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" className="hidden" onChange={handleFileSelect} />
              </div>
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
                  {att.file_url && (
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button onClick={() => deleteAttachmentMut.mutate(att.id)} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all" title="Remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {attachments.length === 0 && !uploadMut.isPending && (
                <div className="text-center py-4 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Drop files here or click to attach</p>
                  <p className="text-[10px] text-muted-foreground">Images, docs, PDFs, screenshots</p>
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
              <div key={st.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-secondary/50">
                <input type="checkbox" checked={st.status === 'Done'} readOnly className="rounded border-border" />
                <span className="text-xs font-mono text-muted-foreground">{st.task_number}</span>
                <span className={`text-sm ${st.status === 'Done' ? 'line-through text-muted-foreground' : ''}`}>{st.title}</span>
              </div>
            ))}
            {(!task.subtasks || task.subtasks.length === 0) && !showSubtask && <p className="text-xs text-muted-foreground">No subtasks</p>}
            {showSubtask && (
              <div className="flex gap-2 mt-1">
                <input placeholder="Subtask title" value={subtaskTitle} onChange={e => setSubtaskTitle(e.target.value)} className="flex-1 px-2 py-1 rounded bg-secondary border border-border text-sm focus:outline-none" autoFocus onKeyDown={e => { if (e.key === 'Enter' && subtaskTitle) subtaskMut.mutate(subtaskTitle); }} />
                <button onClick={() => subtaskTitle && subtaskMut.mutate(subtaskTitle)} className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs">Add</button>
                <button onClick={() => setShowSubtask(false)} className="px-2 py-1 rounded text-xs text-muted-foreground hover:bg-secondary">Cancel</button>
              </div>
            )}
          </div>

          {/* Tabs: Activity / Time Log */}
          <div className="border-t border-border pt-4">
            <div className="flex gap-4 mb-4">
              <button onClick={() => setActiveTab('activity')} className={`flex items-center gap-1 text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'activity' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                <MessageSquare className="h-3.5 w-3.5" /> Activity
              </button>
              <button onClick={() => setActiveTab('timelog')} className={`flex items-center gap-1 text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'timelog' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                <Clock className="h-3.5 w-3.5" /> Time Log
              </button>
            </div>

            {activeTab === 'activity' && (
              <div className="space-y-4">
                {/* Comment input */}
                <div className="flex gap-2">
                  <input placeholder="Add a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" onKeyDown={e => { if (e.key === 'Enter' && commentText) commentMut.mutate(commentText); }} />
                  <button onClick={() => commentText && commentMut.mutate(commentText)} disabled={!commentText} className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
                    <Send className="h-4 w-4" />
                  </button>
                </div>

                {/* Combined timeline */}
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
          </div>
        </div>
      </div>

      {/* Delete Task Confirmation */}
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
    </div>
  );
}