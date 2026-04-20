import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray, extractProjectEntity } from '@/lib/projectResponse';
import type { ProjectTask, Module, Sprint } from '@/lib/projectTypes';
import { X, Paperclip, Image as ImageIcon, FileText, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  parentTask: ProjectTask;
  projectId: string;
  onClose: () => void;
  onCreated?: (subtask: ProjectTask) => void;
}

type TempAttachment = { id: string; file_name: string; file_size: number; mime_type: string };

export default function SubtaskCreateModal({ parentTask, projectId, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Pre-populate Sprint/Module/Epic from parent task; allow override
  const [sprintId, setSprintId] = useState<string>(parentTask.sprint_id || '');
  const [moduleId, setModuleId] = useState<string>(parentTask.epic_id || '');
  const [projectEpicId, setProjectEpicId] = useState<string>((parentTask as any).project_epic_id || '');
  const [attachments, setAttachments] = useState<TempAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sprints
  const { data: sprintsRaw } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => extractProjectArray<Sprint>(r.data, ['sprints'])),
  });
  const sprints = (Array.isArray(sprintsRaw) ? sprintsRaw : []).filter((s: Sprint) => s.status !== 'Completed');

  // Modules (legacy field name `epic_id` on tasks) — scoped to selected sprint (cascade)
  const { data: modulesRaw } = useQuery({
    queryKey: ['project-modules', projectId, sprintId],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (sprintId) params.sprint_id = sprintId;
      return api.get(`/projects/${projectId}/modules`, { params }).then(r => extractProjectArray<Module>(r.data, ['modules', 'epics']));
    },
    enabled: !!sprintId,
  });
  const modules = (Array.isArray(modulesRaw) ? modulesRaw : [])
    .slice()
    .sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));

  // Fetch epics scoped to the selected module (and sprint). Only enabled when module is selected.
  const { data: epicsRaw } = useQuery({
    queryKey: ['project-epics-picker', projectId, sprintId, moduleId],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (sprintId) params.sprint_id = sprintId;
      if (moduleId) params.module_id = moduleId;
      return api.get(`/projects/${projectId}/epics`, { params }).then(r => extractProjectArray<any>(r.data, ['epics']));
    },
    enabled: !!moduleId,
  });
  const epics = Array.isArray(epicsRaw) ? epicsRaw : [];

  const createMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        title: title.trim(),
        description: description.trim() || null,
        type: 'Subtask',
        priority: parentTask.priority || 'Medium',
        status: 'Open',
        project_id: projectId,
        parent_task_id: parentTask.id,
        sprint_id: sprintId || null,
        epic_id: moduleId || null,
        project_epic_id: projectEpicId || null,
      };
      if (attachments.length > 0) payload.attachment_ids = attachments.map(a => a.id);
      const res = await api.post('/tasks', payload);
      return res.data;
    },
    onSuccess: (data) => {
      const created = extractProjectEntity<ProjectTask>(data, ['task']) as any;
      if (created?.id) onCreated?.(created);
      qc.invalidateQueries({ queryKey: ['task-detail', parentTask.id] });
      qc.invalidateQueries({ queryKey: ['task-attachments', created?.id] });
      toast.success('Subtask created');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create subtask'),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: TempAttachment[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/tasks/upload-temp', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        const data = res.data?.attachment || res.data;
        if (data?.id) uploaded.push({ id: data.id, file_name: data.file_name, file_size: data.file_size, mime_type: data.mime_type });
      }
      setAttachments(prev => [...prev, ...uploaded]);
      if (uploaded.length) toast.success(`${uploaded.length} file${uploaded.length > 1 ? 's' : ''} uploaded`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id));

  const getFileIcon = (fileName: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || ''))
      return <ImageIcon className="h-4 w-4 text-primary" />;
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  // Close on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selectedEpic = epics.find((e: any) => e.id === projectEpicId);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Subtask</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Subtask title"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
            placeholder="Optional details about this subtask..."
          />
        </div>

        {/* Sprint → Module → Epic */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Sprint</label>
            <select
              value={sprintId}
              onChange={e => { setSprintId(e.target.value); setModuleId(''); setProjectEpicId(''); }}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">No Sprint</option>
              {sprints.map((s: Sprint) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Module</label>
            <select
              value={moduleId}
              onChange={e => { setModuleId(e.target.value); setProjectEpicId(''); }}
              disabled={!sprintId}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{sprintId ? 'No Module' : 'Select sprint first'}</option>
              {modules.map((m: Module) => (
                <option key={m.id} value={m.id}>{m.title}{m.sprint_name ? ` — ${m.sprint_name}` : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-2">
            Epic
            {selectedEpic?.color && <span className="w-2 h-2 rounded-full" style={{ background: selectedEpic.color }} />}
          </label>
          <select
            value={projectEpicId}
            onChange={e => setProjectEpicId(e.target.value)}
            disabled={!moduleId}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{moduleId ? 'No Epic (inherit from parent)' : 'Select module first'}</option>
            {epics.map((ep: any) => (
              <option key={ep.id} value={ep.id}>{ep.title}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-muted-foreground">Attachments (optional)</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
              {uploading ? 'Uploading...' : 'Attach Files'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
          {attachments.length > 0 && (
            <div className="space-y-1.5">
              {attachments.map(att => (
                <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 group">
                  {getFileIcon(att.file_name)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{att.file_name}</p>
                    <p className="text-[10px] text-muted-foreground">{(att.file_size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">
            Cancel
          </button>
          <button
            onClick={() => createMut.mutate()}
            disabled={!title.trim() || createMut.isPending || uploading}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {createMut.isPending ? 'Creating...' : 'Create Subtask'}
          </button>
        </div>
      </div>
    </div>
  );
}
