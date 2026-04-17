import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray } from '@/lib/projectResponse';
import type { Module, Epic, ProjectTask } from '@/lib/projectTypes';
import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, ArrowRightLeft } from 'lucide-react';
import MoveEpicModal from './MoveEpicModal';

interface Props {
  projectId: string;
  onTaskClick?: (task: ProjectTask) => void;
}

export default function EpicsView({ projectId }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: modulesRaw, isLoading: modulesLoading } = useQuery({
    queryKey: ['project-modules', projectId],
    queryFn: () =>
      api.get(`/projects/${projectId}/modules`)
        .then(r => extractProjectArray<Module>(r.data, ['modules', 'epics'])),
  });
  const modules: Module[] = Array.isArray(modulesRaw) ? modulesRaw : [];

  // Compute timeline range across all modules + their dates
  const { minDate, range } = useMemo(() => {
    const dates = modules.flatMap(m => [m.start_date, m.due_date]).filter(Boolean).map(d => new Date(d!).getTime());
    const min = dates.length > 0 ? Math.min(...dates) : Date.now();
    const max = dates.length > 0 ? Math.max(...dates) : Date.now() + 86400000 * 90;
    return { minDate: min, range: (max - min) || 1 };
  }, [modules]);

  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Roadmap</h3>
          <p className="text-xs text-muted-foreground">Modules and their epics over time</p>
        </div>
      </div>

      <div className="glass-card p-4 space-y-2">
        {modulesLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading roadmap…</p>}
        {!modulesLoading && modules.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No modules yet. Create modules from a Sprint to populate the roadmap.</p>
        )}
        {modules.map(mod => {
          const isOpen = expanded.has(mod.id);
          const start = mod.start_date ? new Date(mod.start_date).getTime() : minDate;
          const end = mod.due_date ? new Date(mod.due_date).getTime() : minDate + range;
          const left = ((start - minDate) / range) * 100;
          const width = Math.max(((end - start) / range) * 100, 4);
          const total = mod.task_count ?? mod.total_tasks ?? 0;
          const done = mod.done_count ?? mod.done_tasks ?? 0;
          const progress = total > 0 ? Math.round((done / total) * 100) : (mod.progress || 0);

          return (
            <div key={mod.id} className="rounded-lg border border-border/60 overflow-hidden">
              {/* Module row */}
              <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-secondary/40 transition-colors" onClick={() => toggle(mod.id)}>
                <button className="p-0.5">{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button>
                <div className="w-44 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded" style={{ background: mod.color || 'hsl(var(--primary))' }} />
                    <span className="text-sm font-semibold truncate">{mod.title}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{done}/{total} tasks · {progress}%</span>
                </div>
                <div className="flex-1 relative h-7">
                  <div className="absolute inset-0 bg-secondary rounded-full" />
                  <div
                    className="absolute top-0 h-full rounded-full flex items-center justify-end px-2"
                    style={{ left: `${left}%`, width: `${width}%`, background: mod.color || 'hsl(var(--primary))', opacity: 0.85 }}
                  >
                    <span className="text-[10px] font-bold text-white">{progress}%</span>
                  </div>
                </div>
              </div>

              {/* Epics under module */}
              {isOpen && (
                <ModuleEpicTimeline projectId={projectId} moduleId={mod.id} moduleColor={mod.color} minDate={minDate} range={range} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModuleEpicTimeline({ projectId, moduleId, moduleColor, minDate, range }: { projectId: string; moduleId: string; moduleColor?: string; minDate: number; range: number }) {
  const [moveEpic, setMoveEpic] = useState<Epic | null>(null);
  const { data: epicsRaw, isLoading } = useQuery({
    queryKey: ['module-epics', projectId, moduleId],
    queryFn: () =>
      api.get(`/projects/${projectId}/epics`, { params: { module_id: moduleId } })
        .then(r => extractProjectArray<Epic>(r.data, ['epics'])),
  });
  const epics: Epic[] = Array.isArray(epicsRaw) ? epicsRaw : [];

  return (
    <div className="border-t border-border bg-secondary/20 px-3 py-2 space-y-1.5">
      {isLoading && <p className="text-xs text-muted-foreground text-center py-2">Loading epics…</p>}
      {!isLoading && epics.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">No epics in this module yet.</p>
      )}
      {epics.map(ep => {
        const start = ep.start_date ? new Date(ep.start_date).getTime() : minDate;
        const end = ep.due_date ? new Date(ep.due_date).getTime() : minDate + range;
        const left = ((start - minDate) / range) * 100;
        const width = Math.max(((end - start) / range) * 100, 3);
        const total = ep.task_count ?? ep.total_tasks ?? 0;
        const done = ep.done_count ?? ep.done_tasks ?? 0;
        const progress = total > 0 ? Math.round((done / total) * 100) : (ep.progress || 0);

        return (
          <div key={ep.id} className="group flex items-center gap-3">
            <div className="w-44 flex-shrink-0 pl-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: ep.color || moduleColor || 'hsl(var(--primary))' }} />
                <span className="text-xs truncate">{ep.title}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{done}/{total}</span>
            </div>
            <div className="flex-1 relative h-5">
              <div className="absolute inset-0 bg-secondary/60 rounded-full" />
              <div
                className="absolute top-0 h-full rounded-full flex items-center justify-end px-1.5"
                style={{ left: `${left}%`, width: `${width}%`, background: ep.color || moduleColor || 'hsl(var(--primary))', opacity: 0.8 }}
              >
                <span className="text-[9px] font-bold text-white">{progress}%</span>
              </div>
            </div>
            <button
              onClick={() => setMoveEpic(ep)}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all flex-shrink-0"
              title="Move to Module"
            >
              <ArrowRightLeft className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      {moveEpic && (
        <MoveEpicModal
          projectId={projectId}
          epicId={moveEpic.id}
          epicTitle={moveEpic.title}
          currentModuleId={moduleId}
          onClose={() => setMoveEpic(null)}
          onSuccess={() => setMoveEpic(null)}
        />
      )}
    </div>
  );
}
