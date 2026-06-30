import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, X, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface Template {
  category: string;
  services: { name: string; item_count: number }[];
}

interface Props {
  project: any;
  onApplied: () => void;
}

// Accepts JSON-stringified arrays, real arrays, or a single legacy string.
function parseJsonArray(raw: any): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string');
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('[')) {
      try { const p = JSON.parse(t); if (Array.isArray(p)) return p.filter((x) => typeof x === 'string'); } catch {}
    } else if (t) {
      return [t];
    }
  }
  return [];
}

/**
 * Renders the categories + already-applied services as colored tags above the
 * project's Tasks tab, and lets the user pick MORE services (across multiple
 * categories) to add to the checklist — POST /projects/:id/services creates
 * one Open task per checklist item.
 */
export default function ProjectChecklistBar({ project, onApplied }: Props) {
  const [open, setOpen] = useState(false);
  // Per-category map of newly-picked services to append
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const projectCategories = useMemo(() => parseJsonArray(project?.category), [project?.category]);
  const currentServices = useMemo(() => parseJsonArray(project?.service_types), [project?.service_types]);

  const { data: templatesData } = useQuery({
    queryKey: ['project-templates'],
    queryFn: () => api.get('/projects/templates').then(r => r.data?.data || []),
    staleTime: 60 * 60 * 1000,
    enabled: open || projectCategories.length > 0,
  });
  const templates: Template[] = Array.isArray(templatesData) ? templatesData : [];

  // Show all categories from templates so the user can ADD a new one too
  // (not just append services to the categories the project already has).
  const groupsForPicker = templates;

  const totalPicked = Object.values(picked).reduce((n, arr) => n + arr.length, 0);

  const apply = async () => {
    if (!totalPicked) return;
    setBusy(true);
    try {
      // Send everything in one call — the backend accepts an array of categories
      // and a flat list of selected service names; it walks each category and
      // creates tasks for services it knows.
      const categories: string[] = [];
      const services: string[] = [];
      for (const [cat, svcs] of Object.entries(picked)) {
        if (svcs.length) {
          categories.push(cat);
          services.push(...svcs);
        }
      }
      const res = await api.post(`/projects/${project.id}/services`, {
        categories,
        service_types: services,
      });
      toast.success(`Added ${res.data?.tasks_created || 0} tasks`);
      setOpen(false);
      setPicked({});
      onApplied();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to add services');
    } finally {
      setBusy(false);
    }
  };

  // Hide the bar entirely if there's nothing to show AND no templates available
  if (!projectCategories.length && !templates.length) return null;

  return (
    <div className="glass-card p-4 mb-4 flex flex-wrap items-center gap-2">
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      {projectCategories.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {projectCategories.map(c => (
            <span key={c} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-semibold">
              {c}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-sm font-medium">No template applied</span>
      )}
      {currentServices.length > 0 && (
        <>
          <span className="text-xs text-muted-foreground">·</span>
          <div className="flex flex-wrap gap-1.5">
            {currentServices.map(s => (
              <span key={s} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {s}
              </span>
            ))}
          </div>
        </>
      )}
      <button
        onClick={() => { setOpen(true); setPicked({}); }}
        className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25"
      >
        <Plus className="h-3.5 w-3.5" /> Add services
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Add services to this project</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">
              Picking a service auto-creates one Open task per checklist item from the master template.
            </p>
            {groupsForPicker.map(group => {
              const remaining = group.services.filter(s => !currentServices.includes(s.name));
              if (!remaining.length) return null;
              const groupPicked = picked[group.category] || [];
              const allChecked = remaining.length > 0 && remaining.every(s => groupPicked.includes(s.name));
              const toggleAll = () => {
                setPicked(p => ({
                  ...p,
                  [group.category]: allChecked ? [] : remaining.map(s => s.name),
                }));
              };
              return (
                <div key={group.category} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">{group.category}</span>
                    <span className="text-xs text-muted-foreground">{remaining.length} service{remaining.length === 1 ? '' : 's'} available</span>
                    <button type="button" onClick={toggleAll} className="ml-auto text-[11px] text-primary hover:underline">
                      {allChecked ? 'Clear all' : 'Select all'}
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-secondary border border-border p-2 space-y-1">
                    {remaining.map(svc => {
                      const checked = groupPicked.includes(svc.name);
                      return (
                        <label key={svc.name} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setPicked(p => {
                              const cur = p[group.category] || [];
                              const next = checked ? cur.filter(x => x !== svc.name) : [...cur, svc.name];
                              return { ...p, [group.category]: next };
                            })}
                            className="rounded border-border accent-primary"
                          />
                          <span className="flex-1">{svc.name}</span>
                          <span className="text-xs text-muted-foreground">{svc.item_count} tasks</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={apply} disabled={busy || !totalPicked} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {busy ? 'Adding…' : `Add ${totalPicked} service${totalPicked === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
