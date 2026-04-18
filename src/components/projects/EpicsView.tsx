import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray } from '@/lib/projectResponse';
import type { Module, Epic, Sprint, ProjectTask } from '@/lib/projectTypes';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, ArrowRightLeft, Calendar, User, Layers, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ModuleFormModal from './ModuleFormModal';
import EpicFormModal from './EpicFormModal';
import MoveEpicModal from './MoveEpicModal';
import CreateTaskModal from './CreateTaskModal';

interface Props {
  projectId: string;
  onTaskClick?: (task: ProjectTask) => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  Critical: 'hsl(4 100% 64%)',
  High: 'hsl(35 100% 63%)',
  Medium: 'hsl(213 100% 62%)',
  Low: 'hsl(220 10% 50%)',
};

function fmtDate(d?: string) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function EpicsView({ projectId }: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Add Module flow: pick sprint first
  const [addModuleSprintId, setAddModuleSprintId] = useState<string | null>(null);
  const [editModule, setEditModule] = useState<Module | null>(null);
  const [deleteModuleId, setDeleteModuleId] = useState<string | null>(null);

  const { data: sprintsRaw } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => extractProjectArray<Sprint>(r.data, ['sprints'])),
  });
  const sprints: Sprint[] = Array.isArray(sprintsRaw) ? sprintsRaw : [];

  const { data: modulesRaw, isLoading: modulesLoading } = useQuery({
    queryKey: ['project-modules', projectId],
    queryFn: () =>
      api.get(`/projects/${projectId}/modules`)
        .then(r => extractProjectArray<Module>(r.data, ['modules', 'epics'])),
  });
  const modules: Module[] = Array.isArray(modulesRaw) ? modulesRaw : [];

  const deleteModuleMut = useMutation({
    mutationFn: (mid: string) => api.delete(`/projects/${projectId}/modules/${mid}`, { skipConfirm: true } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-modules', projectId] });
      setDeleteModuleId(null);
      toast.success('Module deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete module'),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['project-modules', projectId] });
    qc.invalidateQueries({ queryKey: ['project-epics', projectId] });
    qc.invalidateQueries({ queryKey: ['module-epics', projectId] });
  };

  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Quick "Add Module" — show sprint picker first
  const [showSprintPicker, setShowSprintPicker] = useState(false);
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const baseModules = q
    ? modules.filter(m =>
        (m.title || '').toLowerCase().includes(q) ||
        (m.sprint_name || '').toLowerCase().includes(q) ||
        (m.owner_name || '').toLowerCase().includes(q)
      )
    : modules;
  const filteredModules = [...baseModules].sort((a, b) =>
    (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Roadmap</h3>
          <p className="text-xs text-muted-foreground">Modules and the epics under them. Click a module to expand.</p>
        </div>
        <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search modules…"
              className="w-full h-8 pl-8 pr-7 rounded-lg bg-secondary text-xs border border-transparent focus:border-border focus:outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-background text-muted-foreground"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        <div className="relative">
          <button
            onClick={() => setShowSprintPicker(s => !s)}
            disabled={sprints.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add Module
          </button>
          {showSprintPicker && sprints.length > 0 && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSprintPicker(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-56 glass-card p-1 max-h-72 overflow-auto">
                <p className="px-3 py-2 text-[10px] uppercase font-semibold text-muted-foreground">Pick a sprint</p>
                {sprints.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setAddModuleSprintId(s.id); setShowSprintPicker(false); }}
                    className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-secondary flex items-center justify-between"
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{s.status}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      {modulesLoading && (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">Loading roadmap…</div>
      )}

      {!modulesLoading && modules.length === 0 && (
        <div className="glass-card p-10 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
            <Layers className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No modules yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create a sprint first, then add modules to it.</p>
          </div>
          {sprints.length > 0 && (
            <button
              onClick={() => setShowSprintPicker(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Add Module
            </button>
          )}
        </div>
      )}

      {!modulesLoading && modules.length > 0 && filteredModules.length === 0 && (
        <div className="glass-card p-6 text-center text-xs text-muted-foreground">No modules match "{search}".</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredModules.map(mod => {
          const isOpen = expanded.has(mod.id);
          const total = mod.task_count ?? mod.total_tasks ?? 0;
          const done = mod.done_count ?? mod.done_tasks ?? 0;
          const progress = total > 0 ? Math.round((done / total) * 100) : (mod.progress || 0);
          const accent = mod.color || 'hsl(var(--primary))';

          return (
            <div
              key={mod.id}
              className="group glass-card overflow-hidden border border-border/60 hover:border-border transition-all"
              style={{ borderLeft: `3px solid ${accent}` }}
            >
              {/* Module header */}
              <div className="p-3 flex items-start gap-2">
                <button onClick={() => toggle(mod.id)} className="p-0.5 mt-0.5 rounded hover:bg-secondary text-muted-foreground">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggle(mod.id)}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: accent }} />
                    <h4 className="text-sm font-semibold truncate">{mod.title}</h4>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                    {mod.sprint_name && (
                      <span className="px-1.5 py-0.5 rounded bg-secondary text-foreground/70">{mod.sprint_name}</span>
                    )}
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(mod.start_date)} → {fmtDate(mod.due_date)}</span>
                    {mod.owner_name && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{mod.owner_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditModule(mod)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Edit Module">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => setDeleteModuleId(mod.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete Module">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Compact progress strip — no oversized blue bar */}
              <div className="px-3 pb-3 -mt-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span className="tabular-nums">{done}/{total} tasks</span>
                  <span className="tabular-nums font-semibold" style={{ color: accent }}>{progress}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, background: accent }}
                  />
                </div>
              </div>

              {isOpen && (
                <ModuleEpicsPanel
                  projectId={projectId}
                  moduleId={mod.id}
                  sprintId={mod.sprint_id}
                  moduleColor={accent}
                  onChanged={refresh}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {addModuleSprintId && (
        <ModuleFormModal
          projectId={projectId}
          sprintId={addModuleSprintId}
          mode="create"
          onClose={() => setAddModuleSprintId(null)}
          onSuccess={() => { setAddModuleSprintId(null); refresh(); }}
        />
      )}

      {editModule && (
        <ModuleFormModal
          projectId={projectId}
          sprintId={editModule.sprint_id || ''}
          mode="edit"
          module={editModule}
          onClose={() => setEditModule(null)}
          onSuccess={() => { setEditModule(null); refresh(); }}
        />
      )}

      {deleteModuleId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setDeleteModuleId(null)}>
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Delete Module</h2>
            <p className="text-sm text-muted-foreground">All epics and tasks under this module will be unlinked. This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteModuleId(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => deleteModuleMut.mutate(deleteModuleId)} disabled={deleteModuleMut.isPending}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {deleteModuleMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Epics under a module ---------------- */
function ModuleEpicsPanel({ projectId, moduleId, sprintId, moduleColor, onChanged }: { projectId: string; moduleId: string; sprintId?: string; moduleColor?: string; onChanged: () => void }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editEpic, setEditEpic] = useState<Epic | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [moveEpic, setMoveEpic] = useState<Epic | null>(null);
  const [createTaskEpic, setCreateTaskEpic] = useState<Epic | null>(null);

  const { data: epicsRaw, isLoading } = useQuery({
    queryKey: ['module-epics', projectId, moduleId],
    queryFn: () =>
      api.get(`/projects/${projectId}/epics`, { params: { module_id: moduleId } })
        .then(r => extractProjectArray<Epic>(r.data, ['epics'])),
  });
  const epics: Epic[] = (Array.isArray(epicsRaw) ? epicsRaw : [])
    .slice()
    .sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));

  const deleteMut = useMutation({
    mutationFn: (eid: string) => api.delete(`/projects/${projectId}/epics/${eid}`, { skipConfirm: true } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-epics', projectId, moduleId] });
      qc.invalidateQueries({ queryKey: ['project-epics', projectId] });
      onChanged();
      setDeleteId(null);
      toast.success('Epic deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete epic'),
  });

  return (
    <div className="border-t border-border/60 bg-secondary/20">
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
          Epics {epics.length > 0 && <span className="opacity-70">({epics.length})</span>}
        </span>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
          <Plus className="h-3 w-3" /> Add Epic
        </button>
      </div>

      <div className="px-3 pb-3 space-y-1">
        {isLoading && <p className="text-xs text-muted-foreground py-2 text-center">Loading…</p>}
        {!isLoading && epics.length === 0 && (
          <button onClick={() => setShowCreate(true)} className="w-full py-3 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors">
            + Add the first epic
          </button>
        )}
        {epics.map(ep => {
          const total = ep.task_count ?? ep.total_tasks ?? 0;
          const done = ep.done_count ?? ep.done_tasks ?? 0;
          const progress = total > 0 ? Math.round((done / total) * 100) : 0;
          const epicAccent = ep.color || moduleColor || 'hsl(var(--primary))';
          return (
            <div key={ep.id} className="group/epic flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-background/60 transition-colors">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: epicAccent }} />
              <span className="text-xs flex-1 truncate font-medium">{ep.title}</span>
              {ep.priority && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-medium hidden sm:inline" style={{ background: `${PRIORITY_COLOR[ep.priority]}20`, color: PRIORITY_COLOR[ep.priority] }}>
                  {ep.priority}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground tabular-nums">{done}/{total}</span>
              <div className="w-12 h-1 bg-secondary rounded-full overflow-hidden flex-shrink-0">
                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: epicAccent }} />
              </div>
              <div className="flex items-center opacity-0 group-hover/epic:opacity-100 transition-opacity">
                <button onClick={() => setMoveEpic(ep)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Move to Module">
                  <ArrowRightLeft className="h-3 w-3" />
                </button>
                <button onClick={() => setEditEpic(ep)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Edit Epic">
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={() => setDeleteId(ep.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete Epic">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {(showCreate || editEpic) && (
        <EpicFormModal
          projectId={projectId}
          moduleId={moduleId}
          sprintId={sprintId}
          mode={editEpic ? 'edit' : 'create'}
          epic={editEpic || undefined}
          onClose={() => { setShowCreate(false); setEditEpic(null); }}
          onSuccess={() => { setShowCreate(false); setEditEpic(null); onChanged(); qc.invalidateQueries({ queryKey: ['module-epics', projectId, moduleId] }); }}
        />
      )}

      {moveEpic && (
        <MoveEpicModal
          projectId={projectId}
          epicId={moveEpic.id}
          epicTitle={moveEpic.title}
          currentModuleId={moduleId}
          onClose={() => setMoveEpic(null)}
          onSuccess={() => { setMoveEpic(null); onChanged(); qc.invalidateQueries({ queryKey: ['module-epics', projectId, moduleId] }); }}
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
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
