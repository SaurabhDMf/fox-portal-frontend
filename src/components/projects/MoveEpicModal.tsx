import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray } from '@/lib/projectResponse';
import type { Module, Sprint } from '@/lib/projectTypes';
import { useState, useMemo } from 'react';
import { X, ChevronRight, Check, Layers, FolderKanban } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  epicId: string;
  epicTitle: string;
  currentModuleId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MoveEpicModal({ projectId, epicId, epicTitle, currentModuleId, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');

  const { data: sprintsRaw, isLoading: sprintsLoading } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () =>
      api.get(`/projects/${projectId}/sprints`)
        .then(r => extractProjectArray<Sprint>(r.data, ['sprints'])),
  });
  const sprints: Sprint[] = Array.isArray(sprintsRaw) ? sprintsRaw : [];

  const { data: modulesRaw, isLoading: modulesLoading } = useQuery({
    queryKey: ['project-modules-all', projectId],
    queryFn: () =>
      api.get(`/projects/${projectId}/modules`)
        .then(r => extractProjectArray<Module>(r.data, ['modules', 'epics'])),
  });
  const modules: Module[] = Array.isArray(modulesRaw) ? modulesRaw : [];

  // Pre-select the sprint that contains the current module
  useMemo(() => {
    if (!selectedSprintId && currentModuleId && modules.length > 0) {
      const cur = modules.find(m => m.id === currentModuleId);
      if (cur?.sprint_id) setSelectedSprintId(cur.sprint_id);
    }
  }, [modules, currentModuleId, selectedSprintId]);

  const modulesInSprint = useMemo(
    () => modules.filter(m => m.sprint_id === selectedSprintId),
    [modules, selectedSprintId]
  );

  // Sprints that have at least one module — so users don't pick empty sprints
  const sprintsWithModules = useMemo(() => {
    const ids = new Set(modules.map(m => m.sprint_id).filter(Boolean));
    return sprints.filter(s => ids.has(s.id));
  }, [sprints, modules]);

  const moveMut = useMutation({
    mutationFn: () => {
      const target = modules.find(m => m.id === selectedModuleId);
      if (!target) throw new Error('Select a module');
      const payload: Record<string, any> = { module_id: target.id };
      if (target.sprint_id) payload.sprint_id = target.sprint_id;
      return api.put(`/projects/${projectId}/epics/${epicId}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-epics', projectId] });
      qc.invalidateQueries({ queryKey: ['project-epics', projectId] });
      qc.invalidateQueries({ queryKey: ['project-modules', projectId] });
      toast.success('Epic moved');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to move epic'),
  });

  const isLoading = sprintsLoading || modulesLoading;
  const canSubmit = !!selectedModuleId && selectedModuleId !== currentModuleId && !moveMut.isPending;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-2xl p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Move Epic</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Move <span className="font-medium text-foreground">"{epicTitle}"</span> — pick a sprint, then a module under it.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
          <span className="font-medium text-foreground">Sprint</span>
          <ChevronRight className="h-3 w-3" />
          <span className={selectedSprintId ? 'font-medium text-foreground' : ''}>Module</span>
          <ChevronRight className="h-3 w-3" />
          <span className={selectedModuleId ? 'font-medium text-primary' : ''}>Confirm</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading hierarchy…</div>
        ) : sprintsWithModules.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No sprints with modules available.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[260px]">
            {/* Sprint column */}
            <div className="border border-border/60 rounded-lg overflow-hidden flex flex-col">
              <div className="px-3 py-2 bg-secondary/40 border-b border-border/60 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FolderKanban className="h-3 w-3" /> Sprints ({sprintsWithModules.length})
              </div>
              <div className="flex-1 overflow-auto max-h-[320px] p-1 space-y-0.5">
                {sprintsWithModules.map(s => {
                  const count = modules.filter(m => m.sprint_id === s.id).length;
                  const isActive = selectedSprintId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedSprintId(s.id); setSelectedModuleId(''); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between gap-2 transition-colors ${
                        isActive ? 'bg-primary/15 text-foreground' : 'hover:bg-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                        <span className="truncate">{s.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Module column */}
            <div className="border border-border/60 rounded-lg overflow-hidden flex flex-col">
              <div className="px-3 py-2 bg-secondary/40 border-b border-border/60 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3 w-3" /> Modules {selectedSprintId && `(${modulesInSprint.length})`}
              </div>
              <div className="flex-1 overflow-auto max-h-[320px] p-1 space-y-0.5">
                {!selectedSprintId ? (
                  <p className="text-xs text-muted-foreground text-center py-8 px-3">Select a sprint to see its modules.</p>
                ) : modulesInSprint.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8 px-3">No modules in this sprint.</p>
                ) : (
                  modulesInSprint.map(m => {
                    const isActive = selectedModuleId === m.id;
                    const isCurrent = m.id === currentModuleId;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedModuleId(m.id)}
                        disabled={isCurrent}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between gap-2 transition-colors ${
                          isActive ? 'bg-primary/15 text-foreground' : 'hover:bg-secondary'
                        } ${isCurrent ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color || 'hsl(var(--primary))' }} />
                          <span className="truncate">{m.title}</span>
                          {isCurrent && <span className="text-[9px] text-muted-foreground">(current)</span>}
                        </div>
                        {isActive && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2 border-t border-border/60">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button
            onClick={() => moveMut.mutate()}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {moveMut.isPending ? 'Moving…' : 'Move Epic'}
          </button>
        </div>
      </div>
    </div>
  );
}
