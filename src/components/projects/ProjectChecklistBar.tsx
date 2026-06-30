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

/**
 * Shows the project's current Category + selected services on the tasks tab,
 * and lets the user append more services from the same category — which
 * auto-creates additional checklist tasks via POST /projects/:id/services.
 */
export default function ProjectChecklistBar({ project, onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const category: string = project?.category || '';

  // Project.service_types comes back as either a string (JSON) or already an array
  const currentServices = useMemo<string[]>(() => {
    const raw = project?.service_types;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    }
    return [];
  }, [project?.service_types]);

  const { data: templatesData } = useQuery({
    queryKey: ['project-templates'],
    queryFn: () => api.get('/projects/templates').then(r => r.data?.data || []),
    staleTime: 60 * 60 * 1000,
    enabled: open || !!category,
  });
  const templates: Template[] = Array.isArray(templatesData) ? templatesData : [];

  const remainingServices = useMemo(() => {
    if (!category) return [];
    const cat = templates.find(t => t.category === category);
    if (!cat) return [];
    return cat.services.filter(s => !currentServices.includes(s.name));
  }, [templates, category, currentServices]);

  const apply = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      const res = await api.post(`/projects/${project.id}/services`, {
        category,
        service_types: picked,
      });
      toast.success(`Added ${res.data?.tasks_created || 0} tasks`);
      setOpen(false);
      setPicked([]);
      onApplied();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to add services');
    } finally {
      setBusy(false);
    }
  };

  // Nothing to show if the project has no category set
  if (!category) return null;

  return (
    <div className="glass-card p-4 mb-4 flex flex-wrap items-center gap-2">
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-medium">{category} project</span>
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
      {remainingServices.length > 0 && (
        <button
          onClick={() => { setOpen(true); setPicked([]); }}
          className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25"
        >
          <Plus className="h-3.5 w-3.5" /> Add services
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Add services to this {category} project</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">
              Picking a service auto-creates one Open task per checklist item from the master template.
            </p>
            <div className="max-h-72 overflow-y-auto rounded-lg bg-secondary border border-border p-2 space-y-1">
              {remainingServices.map(svc => {
                const checked = picked.includes(svc.name);
                return (
                  <label key={svc.name} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setPicked(p => checked ? p.filter(x => x !== svc.name) : [...p, svc.name])}
                      className="rounded border-border accent-primary"
                    />
                    <span className="flex-1">{svc.name}</span>
                    <span className="text-xs text-muted-foreground">{svc.item_count} tasks</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={apply} disabled={busy || !picked.length} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {busy ? 'Adding…' : `Add ${picked.length} service${picked.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
