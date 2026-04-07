import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useModulePermission } from '@/hooks/usePermission';

import type { Project } from '@/lib/projectTypes';

const statusOptions = ['Active', 'On Hold', 'Completed', 'Cancelled'];
const priorityOptions = ['Critical', 'High', 'Medium', 'Low'];
const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

const extractProjects = (payload: any): Project[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.projects)) return payload.projects;
  if (Array.isArray(payload?.data?.projects)) return payload.data.projects;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
};

const extractProject = (payload: any) => payload?.project || payload?.data?.project || payload?.data || payload;

export default function Projects() {
  const perm = useModulePermission('projects');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', client_id: '', description: '', status: 'Active', priority: 'Medium', due_date: '', start_date: '', color: '#3B82F6' });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['projects', search],
    queryFn: () => api.get('/projects', { params: { search } }).then(r => extractProjects(r.data)),
    placeholderData: (previousData) => previousData,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients').then(r => r.data?.clients || r.data || []),
    enabled: showCreate,
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/projects', d),
    onSuccess: (res) => {
      const newProject = extractProject(res.data);
      if (newProject?.id) {
        qc.setQueryData(['projects', search], (old: any) => {
          const prev = Array.isArray(old) ? old : [];
          const withoutDuplicate = prev.filter((project: any) => project?.id !== newProject.id);
          return [...withoutDuplicate, newProject];
        });
      }
      qc.invalidateQueries({ queryKey: ['projects'] });
      setShowCreate(false);
      setForm({ name: '', client_id: '', description: '', status: 'Active', priority: 'Medium', due_date: '', start_date: '', color: '#3B82F6' });
      toast.success('Project created');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const rawProjects = Array.isArray(data) ? data : [];
  const projects: Project[] = rawProjects;
  const clientsArr = Array.isArray(clients) ? clients : [];
  const basePath = window.location.pathname.startsWith('/emp') ? '/emp' : '/admin';

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Projects</h1><p className="page-subtitle">Track project progress</p></div>
        {perm.canCreate && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> New Project
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? [...Array(6)].map((_, i) => <div key={i} className="glass-card h-48 animate-pulse" />) :
        projects.map((p) => (
          <div key={p.id} onClick={() => navigate(`${basePath}/projects/${p.id}`)} className="glass-card-hover p-5 space-y-3 cursor-pointer">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-8 rounded-full flex-shrink-0" style={{ background: p.color || 'hsl(var(--primary))' }} />
                <div>
                  <h3 className="font-semibold text-sm">{p.name}</h3>
                  {p.client_name && <span className="text-xs text-muted-foreground">{p.client_name}</span>}
                </div>
              </div>
              <span className={p.status === 'Active' ? 'badge-success' : p.status === 'Completed' ? 'badge-info' : p.status === 'On Hold' ? 'badge-warning' : 'badge-neutral'}>{p.status}</span>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2">{p.description || 'No description'}</p>

            {/* Sprint & task count */}
            <div className="flex items-center gap-3 text-xs">
              {p.active_sprint_name && <span className="badge-primary">{p.active_sprint_name}</span>}
              {p.open_task_count != null && <span className="text-muted-foreground">{p.open_task_count} open tasks</span>}
              <span className={`ml-auto ${p.priority === 'Critical' ? 'badge-danger' : p.priority === 'High' ? 'badge-warning' : 'badge-neutral'}`}>{p.priority}</span>
            </div>

            {/* Progress */}
            {p.progress != null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span>{p.progress}%</span></div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${p.progress}%`, background: p.color || 'hsl(var(--primary))' }} />
                </div>
              </div>
            )}

            {/* Members & due date */}
            <div className="flex items-center justify-between">
              {p.members && p.members.length > 0 && (
                <div className="flex -space-x-1.5">
                  {p.members.slice(0, 4).map(m => (
                    <div key={m.id} className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary border-2 border-card" title={m.full_name}>{m.full_name?.[0]}</div>
                  ))}
                  {p.members.length > 4 && <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground border-2 border-card">+{p.members.length - 4}</div>}
                </div>
              )}
              {p.due_date && <span className="text-xs text-muted-foreground">Due: {new Date(p.due_date).toLocaleDateString()}</span>}
            </div>
          </div>
        ))}
        {projects.length === 0 && !isLoading && (
          <div className="col-span-full text-center py-16 text-muted-foreground text-sm">No projects found</div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Project</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Project Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="">Select Client (optional)</option>
              {clientsArr.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
            <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />

            {/* Color picker */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Project Color</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`} style={{ background: c }} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
                {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Start Date</label><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" /></div>
              <div><label className="text-xs text-muted-foreground">Due Date</label><input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
