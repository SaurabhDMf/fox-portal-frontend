import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray, extractProjectEntity } from '@/lib/projectResponse';
import type { ProjectTask } from '@/lib/projectTypes';
import { X, Paperclip, Image as ImageIcon, FileText, Download, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  parentTask: ProjectTask;
  projectId: string;
  onClose: () => void;
  onCreated?: (subtask: ProjectTask) => void;
}

export default function SubtaskCreateModal({ parentTask, projectId, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load attachments for the freshly created subtask
  const { data: attachments = [] } = useQuery({
    queryKey: ['task-attachments', createdId],
    queryFn: async () => {
      const res = await api.get(`/tasks/${createdId}/attachments`);
      return extractProjectArray<any>(res.data, ['attachments']);
    },
    enabled: !!createdId,
  });

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
      };
      const res = await api.post('/tasks', payload);
      return res.data;
    },
    onSuccess: (data) => {
      const created = extractProjectEntity<ProjectTask>(data, ['task']) as any;
      const id = created?.id;
      if (id) {
        setCreatedId(id);
        onCreated?.(created);
      }
      qc.invalidateQueries({ queryKey: ['task-detail', parentTask.id] });
      toast.success('Subtask created — you can now attach files');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create subtask'),
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (!createdId) throw new Error('Create the subtask first');
      const fd = new FormData();
      fd.append('file', file);
      return api.post(`/tasks/${createdId}/attachments/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments', createdId] });
      toast.success('File uploaded');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Upload failed'),
  });

  const deleteAttachmentMut = useMutation({
    mutationFn: (aid: string) => api.delete(`/tasks/${createdId}/attachments/${aid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-attachments', createdId] }),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) Array.from(files).forEach(f => uploadMut.mutate(f));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{createdId ? 'Subtask Created' : 'Add Subtask'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={!!createdId}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
            placeholder="Subtask title"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={!!createdId}
            rows={4}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y disabled:opacity-60"
            placeholder="Optional details about this subtask..."
          />
        </div>

        {createdId && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground">Attachments</label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Paperclip className="h-3 w-3" /> Attach File
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
            {uploadMut.isPending && (
              <p className="text-xs text-muted-foreground animate-pulse">Uploading...</p>
            )}
            <div className="space-y-1.5">
              {attachments.map((att: any) => (
                <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 group">
                  {getFileIcon(att.file_name)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{att.file_name}</p>
                  </div>
                  {att.file_url && (
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                       className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => deleteAttachmentMut.mutate(att.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {attachments.length === 0 && !uploadMut.isPending && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="text-center py-4 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Paperclip className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Drop files here or click to attach</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          {!createdId ? (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">
                Cancel
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!title.trim() || createMut.isPending}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {createMut.isPending ? 'Creating...' : 'Create Subtask'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
