import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { TASK_TYPE_CONFIG, PRIORITY_COLORS, BOARD_COLUMNS, type ProjectTask } from '@/lib/projectTypes';

import { useState } from 'react';
import { X, Eye, EyeOff, Clock, MessageSquare, Activity, Plus, Send, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  task: ProjectTask;
  onClose: () => void;
  projectId: string;
}

const TYPES = ['Task', 'Bug', 'Story', 'Feature', 'Subtask'];
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

  const { data: taskDetail } = useQuery({
    queryKey: ['task-detail', initialTask.id],
    queryFn: () => api.get(`/tasks/${initialTask.id}`).then(r => r.data),
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

  const updateMut = useMutation({
    mutationFn: (d: any) => api.put(`/tasks/${initialTask.id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-detail', initialTask.id] }); qc.invalidateQueries({ queryKey: ['project-board', projectId] }); toast.success('Updated'); },
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

  const tc = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.Task;

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
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Description</h4>
            <p className="text-sm text-muted-foreground">{task.description || 'No description. Click to add one.'}</p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-muted-foreground">Assignees</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {task.assignees?.map(a => (
                  <div key={a.id} className="flex items-center gap-1 bg-secondary rounded-full px-2 py-0.5">
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary">{a.full_name?.[0]}</div>
                    <span className="text-xs">{a.full_name}</span>
                  </div>
                )) || <span className="text-xs text-muted-foreground">Unassigned</span>}
              </div>
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

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Subtasks</h4>
              <button onClick={() => setShowSubtask(true)} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Add</button>
            </div>
            {task.subtasks?.map(st => (
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
    </div>
  );
}
