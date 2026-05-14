import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import {
  Upload, Trash2, Download, FileText, Image,
  FileSpreadsheet, Archive, File, Loader2, Eye, EyeOff,
} from 'lucide-react';

const ACCEPTED = '.pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.zip';
const MAX_MB = 25;

function fileIconProps(mime: string) {
  if (mime?.startsWith('image/'))
    return { Icon: Image, color: 'text-blue-500', bg: 'bg-blue-500/10' };
  if (mime === 'application/pdf')
    return { Icon: FileText, color: 'text-red-500', bg: 'bg-red-500/10' };
  if (mime?.includes('spreadsheet') || mime?.includes('excel') || mime?.includes('csv'))
    return { Icon: FileSpreadsheet, color: 'text-green-500', bg: 'bg-green-500/10' };
  if (mime?.includes('zip'))
    return { Icon: Archive, color: 'text-amber-500', bg: 'bg-amber-500/10' };
  return { Icon: File, color: 'text-muted-foreground', bg: 'bg-muted' };
}

function fmtSize(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsView({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isClient = currentUser?.role === 'client';
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['project-docs', projectId],
    queryFn: () => api.get(`/projects/${projectId}/documents`).then((r) => r.data?.data ?? []),
    enabled: !!projectId,
  });
  const docs: any[] = Array.isArray(data) ? data : [];

  const uploadFile = useCallback(async (file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File too large — max ${MAX_MB} MB`);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', file.name);
      await api.post(`/projects/${projectId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      qc.invalidateQueries({ queryKey: ['project-docs', projectId] });
      toast.success('Document uploaded');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [projectId, qc]);

  const deleteMut = useMutation({
    mutationFn: (docId: string) => api.delete(`/projects/${projectId}/documents/${docId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-docs', projectId] });
      toast.success('Document removed');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Delete failed'),
  });

  const shareMut = useMutation({
    mutationFn: ({ docId, shared }: { docId: string; shared: boolean }) =>
      api.patch(`/projects/${projectId}/documents/${docId}`, { shared_with_client: shared }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['project-docs', projectId] });
      toast.success(vars.shared ? 'Now visible to client' : 'Hidden from client');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to update visibility'),
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Upload drop zone */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !uploading && inputRef.current?.click()}
        className={`glass-card border-2 border-dashed rounded-xl p-8 text-center cursor-pointer select-none transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-primary/[0.03]'
        } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
      >
        <input ref={inputRef} type="file" accept={ACCEPTED} className="sr-only" onChange={handleChange} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a file here or click to browse</p>
            <p className="text-xs text-muted-foreground">PDF · PNG · JPG · Excel (.xlsx/.xls) · CSV · ZIP — up to {MAX_MB} MB</p>
          </div>
        )}
      </div>

      {/* Legend for internal users */}
      {!isClient && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-emerald-500" />
            Visible to client
          </span>
          <span className="flex items-center gap-1.5">
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            Internal only
          </span>
          <span className="ml-auto italic">Click the eye icon to toggle client visibility</span>
        </div>
      )}

      {/* Document list */}
      {isLoading ? (
        <div className="glass-card p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          {isClient ? 'No documents have been shared with you yet' : 'No documents uploaded yet'}
        </div>
      ) : (
        <div className="glass-card overflow-hidden divide-y divide-border">
          {docs.map((doc: any) => {
            const { Icon, color, bg } = fileIconProps(doc.file_type || '');
            const canDelete = isAdmin || doc.uploaded_by === currentUser?.id;
            const isShared = !!doc.shared_with_client;

            return (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                {/* File type icon */}
                <div className={`w-9 h-9 shrink-0 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title || doc.file_name}</p>
                    {!isClient && isShared && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Client visible
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fmtSize(doc.file_size)} · {doc.uploaded_by_name || 'Unknown'} · {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Share toggle — internal users only */}
                  {!isClient && (
                    <button
                      onClick={() => shareMut.mutate({ docId: doc.id, shared: !isShared })}
                      disabled={shareMut.isPending}
                      title={isShared ? 'Shared with client — click to make internal only' : 'Internal only — click to share with client'}
                      className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                        isShared
                          ? 'text-emerald-500 hover:bg-emerald-500/10'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {isShared ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  )}

                  {/* Download */}
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    download={doc.file_name}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </a>

                  {/* Delete */}
                  {canDelete && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete "${doc.title || doc.file_name}"?`)) deleteMut.mutate(doc.id);
                      }}
                      disabled={deleteMut.isPending}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
