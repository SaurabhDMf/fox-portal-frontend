import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray } from '@/lib/projectResponse';
import type { Epic } from '@/lib/projectTypes';
import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, ArrowRightLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import EpicFormModal from './EpicFormModal';
import MoveEpicModal from './MoveEpicModal';

interface Props {
  projectId: string;
  moduleId: string;
  sprintId?: string;
  moduleColor?: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  Critical: 'hsl(4 100% 64%)',
  High: 'hsl(35 100% 63%)',
  Medium: 'hsl(213 100% 62%)',
  Low: 'hsl(220 10% 50%)',
};

export default function ModuleEpicsList({ projectId, moduleId, sprintId, moduleColor }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editEpic, setEditEpic] = useState<Epic | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: epicsRaw, isLoading } = useQuery({
    queryKey: ['module-epics', projectId, moduleId],
    queryFn: () =>
      api.get(`/projects/${projectId}/epics`, { params: { module_id: moduleId } })
        .then(r => extractProjectArray<Epic>(r.data, ['epics'])),
    enabled: open,
  });
  const epics: Epic[] = Array.isArray(epicsRaw) ? epicsRaw : [];

  const deleteMut = useMutation({
    mutationFn: (eid: string) => api.delete(`/projects/${projectId}/epics/${eid}`, { skipConfirm: true } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-epics', projectId, moduleId] });
      qc.invalidateQueries({ queryKey: ['project-epics', projectId] });
      setDeleteId(null);
      toast.success('Epic deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete epic'),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['module-epics', projectId, moduleId] });
    qc.invalidateQueries({ queryKey: ['project-epics', projectId] });
    setShowCreate(false);
    setEditEpic(null);
  };

  return (
    <div className="border-t border-border" onClick={e => e.stopPropagation()}>
      <div className="px-4 py-2 flex items-center justify-between bg-secondary/30">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Epics {epics.length > 0 && <span className="text-[10px] text-muted-foreground/70">({epics.length})</span>}
        </button>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 text-xs text-primary hover:underline">
          <Plus className="h-3 w-3" /> Add Epic
        </button>
      </div>

      {open && (
        <div className="px-4 py-2 space-y-1.5">
          {isLoading && <p className="text-xs text-muted-foreground py-2 text-center">Loading…</p>}
          {!isLoading && epics.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 text-center">
              No epics yet. <button onClick={() => setShowCreate(true)} className="text-primary hover:underline">Add the first one →</button>
            </p>
          )}
          {epics.map(ep => {
            const total = ep.task_count ?? ep.total_tasks ?? 0;
            const done = ep.done_count ?? ep.done_tasks ?? 0;
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div key={ep.id} className="group flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary/50 transition-colors">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ep.color || moduleColor || 'hsl(var(--primary))' }} />
                <span className="text-sm flex-1 truncate">{ep.title}</span>
                {ep.priority && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${PRIORITY_COLOR[ep.priority]}20`, color: PRIORITY_COLOR[ep.priority] }}>
                    {ep.priority}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground tabular-nums">{done}/{total}</span>
                <div className="w-16 h-1 bg-secondary rounded-full overflow-hidden flex-shrink-0">
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: ep.color || moduleColor || 'hsl(var(--primary))' }} />
                </div>
                <button onClick={() => setEditEpic(ep)} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all" title="Edit Epic">
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={() => setDeleteId(ep.id)} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all" title="Delete Epic">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {(showCreate || editEpic) && (
        <EpicFormModal
          projectId={projectId}
          moduleId={moduleId}
          sprintId={sprintId}
          mode={editEpic ? 'edit' : 'create'}
          epic={editEpic || undefined}
          onClose={() => { setShowCreate(false); setEditEpic(null); }}
          onSuccess={() => { refresh(); setOpen(true); }}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setDeleteId(null)}>
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Delete Epic</h2>
            <p className="text-sm text-muted-foreground">Are you sure? Tasks under this epic will be unlinked.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => deleteMut.mutate(deleteId)} disabled={deleteMut.isPending}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
