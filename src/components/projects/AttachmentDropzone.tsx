import { useEffect, useRef, useState, useCallback } from 'react';
import { Paperclip, Image as ImageIcon, FileText, Trash2, Loader2, Download, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export type Attachment = {
  id: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  file_url?: string;
  created_at?: string;
};

interface Props {
  /** Existing task ID. If provided, uploads go to /tasks/:taskId/attachments/upload. Otherwise to /tasks/upload-temp. */
  taskId?: string;
  attachments: Attachment[];
  /** Called whenever a file is successfully uploaded. */
  onAdd: (att: Attachment) => void;
  /** Called when the user removes an attachment tile. For existing tasks, the parent should call DELETE. */
  onRemove: (att: Attachment) => void;
  /** When true, attaches a global paste listener so screenshots/files can be pasted from anywhere (e.g. while detail drawer is open). */
  globalPaste?: boolean;
  /** Heading shown above the dropzone. */
  label?: string;
}

const isImageMime = (m?: string) => !!m && m.startsWith('image/');
const isImageName = (n?: string) => !!n && /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(n);

const formatSize = (bytes?: number) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function AttachmentDropzone({ taskId, attachments, onAdd, onRemove, globalPaste, label = 'Attachments' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<{ id: string; name: string }[]>([]);

  const uploadOne = useCallback(async (file: File) => {
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setUploading((prev) => [...prev, { id: tempId, name: file.name }]);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const url = taskId ? `/tasks/${taskId}/attachments/upload` : '/tasks/upload-temp';
      const res = await api.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const data = res.data?.attachment || res.data?.data || res.data;
      if (data?.id) {
        onAdd({
          id: data.id,
          file_name: data.file_name || file.name,
          file_size: data.file_size ?? file.size,
          mime_type: data.mime_type || file.type,
          file_url: data.file_url,
          created_at: data.created_at,
        });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to upload ${file.name}`);
    } finally {
      setUploading((prev) => prev.filter((u) => u.id !== tempId));
    }
  }, [taskId, onAdd]);

  const uploadFiles = useCallback((files: FileList | File[] | null | undefined) => {
    if (!files) return;
    const arr = Array.from(files as any) as File[];
    if (arr.length === 0) return;
    arr.forEach((f) => uploadOne(f));
  }, [uploadOne]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target) setDragOver(false);
  };

  // Paste handler — local on the zone, or global when requested.
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length === 0) return;
      // Avoid hijacking paste while typing in inputs unless global=false and zone is focused
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
      if (isEditable && !files.some((f) => f.type.startsWith('image/'))) return;
      e.preventDefault();
      uploadFiles(files);
    };

    if (globalPaste) {
      window.addEventListener('paste', handler);
      return () => window.removeEventListener('paste', handler);
    }
    const node = zoneRef.current;
    if (!node) return;
    node.addEventListener('paste', handler as any);
    return () => node.removeEventListener('paste', handler as any);
  }, [globalPaste, uploadFiles]);

  const renderIcon = (att: Attachment) => {
    if (isImageMime(att.mime_type) || isImageName(att.file_name)) {
      return <ImageIcon className="h-4 w-4 text-primary" />;
    }
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  const allTiles = [
    ...attachments,
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground">{label}</h4>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Paperclip className="h-3 w-3" /> Attach files
        </button>
      </div>

      <div
        ref={zoneRef}
        tabIndex={0}
        onClick={(e) => {
          // only trigger browse when clicking the empty zone, not a tile button
          if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.dz === 'hint') {
            inputRef.current?.click();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`relative rounded-lg border-2 border-dashed transition-colors p-3 cursor-pointer outline-none focus:ring-2 focus:ring-primary/40 ${
          dragOver
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50 bg-secondary/30'
        }`}
      >
        {allTiles.length === 0 && uploading.length === 0 && (
          <div data-dz="hint" className="text-center py-6 pointer-events-none">
            <UploadCloud className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground" data-dz="hint">
              {dragOver ? 'Drop files to upload' : 'Drop files here, click to browse, or paste (Ctrl/Cmd+V)'}
            </p>
          </div>
        )}

        {(allTiles.length > 0 || uploading.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allTiles.map((att) => {
              const isImg = isImageMime(att.mime_type) || isImageName(att.file_name);
              return (
                <div
                  key={att.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border group"
                >
                  {isImg && att.file_url ? (
                    <img
                      src={att.file_url}
                      alt={att.file_name}
                      className="h-10 w-10 rounded object-cover border border-border flex-shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                      {renderIcon(att)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{att.file_name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatSize(att.file_size)}</p>
                  </div>
                  {att.file_url && (
                    <a
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(att); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            {uploading.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border"
              >
                <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{u.name}</p>
                  <p className="text-[10px] text-muted-foreground">Uploading…</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="*/*"
          className="hidden"
          onChange={(e) => {
            uploadFiles(e.target.files);
            if (inputRef.current) inputRef.current.value = '';
          }}
        />
      </div>
    </div>
  );
}
