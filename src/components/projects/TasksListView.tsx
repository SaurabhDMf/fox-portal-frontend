import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Search, X, Pencil, ChevronDown, Check } from 'lucide-react';
import api from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { extractProjectArray } from '@/lib/projectResponse';
import type { ProjectTask, Sprint, Epic, ProjectMember } from '@/lib/projectTypes';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStatuses, type StatusOption } from '@/hooks/useProjectOptions';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  onTaskClick?: (task: ProjectTask) => void;
  onCreateTask?: () => void;
}

const DEFAULT_STATUS_OPTIONS = ['Open', 'In Progress', 'Review', 'Done', 'Cancelled'];
const TYPE_OPTIONS = ['Task', 'Bug', 'Story', 'Subtask'];
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

const TYPE_COLORS: Record<string, string> = {
  Task: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  Bug: 'bg-red-500/15 text-red-700 dark:text-red-400',
  Story: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  Subtask: 'bg-muted text-muted-foreground',
};

const PRIORITY_COLORS: Record<string, string> = {
  High: 'bg-red-500/15 text-red-700 dark:text-red-400',
  Critical: 'bg-red-500/15 text-red-700 dark:text-red-400',
  Medium: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  Low: 'bg-green-500/15 text-green-700 dark:text-green-400',
};

// Status-based row background colors for quick visual identification
const STATUS_ROW_COLORS: Record<string, string> = {
  'Open': '', // Default
  'In Progress': 'bg-blue-50/50 dark:bg-blue-950/20',
  'Review': 'bg-amber-50/50 dark:bg-amber-950/20',
  'Done': 'bg-green-50/50 dark:bg-green-950/20',
  'Cancelled': 'bg-red-50/50 dark:bg-red-950/20',
};

const fmtDate = (v?: string) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const isPastDue = (v?: string) => {
  if (!v) return false;
  return new Date(v) < new Date();
};

const initials = (name?: string) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
};

const RESTRICTED_ROLES = ['resource', 'freelancer', 'sales_rep'];

export default function TasksListView({ projectId, onTaskClick, onCreateTask }: Props) {
  const qc = useQueryClient();
  const userRole = useAuthStore(s => s.user?.role);
  const isRestricted = RESTRICTED_ROLES.includes(userRole || '');
  const { statuses: STATUS_OPTIONS, statusObjects } = useProjectStatuses(projectId);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sprintFilter, setSprintFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [reporterFilter, setReporterFilter] = useState('');

  // Close status dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleStatusFilter = (s: string) => {
    setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  // Build query params — priority is client-side only, status is now client-side too for multi-select
  const queryParams = useMemo(() => {
    const p: Record<string, string> = { project_id: projectId };
    if (typeFilter) p.type = typeFilter;
    if (sprintFilter) p.sprint_id = sprintFilter;
    if (moduleFilter) p.module_id = moduleFilter;
    if (assigneeFilter) p.assignee_id = assigneeFilter;
    if (reporterFilter) p.reporter_id = reporterFilter;
    return p;
  }, [projectId, typeFilter, sprintFilter, moduleFilter, assigneeFilter, reporterFilter]);

  // Main task query
  const { data: raw, isLoading } = useQuery({
    queryKey: ['project-all-tasks', queryParams],
    queryFn: async () => {
      const r = await api.get('/tasks', { params: queryParams });
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const tasks: ProjectTask[] = raw ?? [];

  // Client-side filters (priority + status multi-select)
  const filtered = useMemo(() => {
    let result = tasks;
    if (statusFilter.length > 0) result = result.filter(t => statusFilter.includes(t.status));
    if (priorityFilter) result = result.filter(t => t.priority === priorityFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.task_number?.toLowerCase().includes(q) ||
        (t as any).assignee_name?.toLowerCase().includes(q) ||
        t.assignees?.[0]?.full_name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tasks, statusFilter, priorityFilter, search]);

  // Filter option queries
  const { data: sprints } = useQuery({
    queryKey: ['project-sprints-list', projectId],
    queryFn: async () => {
      const r = await api.get(`/projects/${projectId}/sprints`);
      return extractProjectArray<Sprint>(r.data, ['sprints', 'data']);
    },
    staleTime: 60_000,
  });

  const { data: modules } = useQuery({
    queryKey: ['project-epics-list', projectId],
    queryFn: async () => {
      const r = await api.get(`/projects/${projectId}/epics`);
      return extractProjectArray<Epic>(r.data, ['epics', 'data']);
    },
    staleTime: 60_000,
  });

  const { data: members } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      const r = await api.get(`/projects/${projectId}/members`);
      return extractProjectArray<ProjectMember>(r.data, ['members', 'data']);
    },
    staleTime: 60_000,
  });

  // "Assigned By" options: only project members whose role qualifies them to assign tasks.
  // Allowed: clients (linked to project), project lead (project_role === 'lead'),
  // and users with role: project_manager, supervisor, project_coordinator, sales_manager.
  const ASSIGNER_ROLES = new Set([
    'project_manager',
    'supervisor',
    'project_coordinator',
    'sales_manager',
  ]);
  const reporterOptions = useMemo(() => {
    const list = Array.isArray(members) ? members : [];
    return list.filter((m: any) => {
      const userRole = (m.user_role || m.role || '').toLowerCase();
      const projectRole = (m.project_role || '').toLowerCase();
      if (userRole === 'client') return true;
      if (projectRole === 'lead') return true;
      return ASSIGNER_ROLES.has(userRole);
    });
  }, [members]);

  const hasActiveFilters = search || statusFilter.length > 0 || typeFilter || priorityFilter || sprintFilter || moduleFilter || assigneeFilter || reporterFilter;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter([]);
    setTypeFilter('');
    setPriorityFilter('');
    setSprintFilter('');
    setModuleFilter('');
    setAssigneeFilter('');
    setReporterFilter('');
  };

  // Inline status update
  const handleStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    qc.setQueryData(['project-all-tasks', queryParams], (old: ProjectTask[] | undefined) => {
      if (!old) return old;
      return old.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
    });
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
    } catch {
      toast.error('Failed to update status');
      qc.invalidateQueries({ queryKey: ['project-all-tasks'] });
    }
  }, [qc, queryParams]);

  // Inline code repo status update
  const handleCodeRepoChange = useCallback(async (taskId: string, val: string | null) => {
    qc.setQueryData(['project-all-tasks', queryParams], (old: ProjectTask[] | undefined) => {
      if (!old) return old;
      return old.map(t => t.id === taskId ? { ...t, code_repo_status: val } : t);
    });
    try {
      await api.patch(`/tasks/${taskId}`, { code_repo_status: val });
    } catch {
      toast.error('Failed to update code repo status');
      qc.invalidateQueries({ queryKey: ['project-all-tasks'] });
    }
  }, [qc, queryParams]);

  const selectCls = "px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[100px]";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {isRestricted ? 'My Tasks' : 'All Tasks'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Showing {filtered.length} task{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        {onCreateTask && (
          <Button size="sm" onClick={onCreateTask} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Task
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <select value={sprintFilter} onChange={e => setSprintFilter(e.target.value)} className={selectCls}>
          <option value="">All Sprints</option>
          {(sprints ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className={selectCls}>
          <option value="">All Modules</option>
          {(modules ?? []).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>

        {!isRestricted && (
          <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className={selectCls}>
            <option value="">All Assignees</option>
            {(members ?? []).map(m => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
          </select>
        )}

        {!isRestricted && (
          <select value={reporterFilter} onChange={e => setReporterFilter(e.target.value)} className={selectCls}>
            <option value="">Assigned By</option>
            {reporterOptions.map((u: any) => (
              <option key={u.user_id || u.id} value={u.user_id || u.id}>{u.full_name}</option>
            ))}
          </select>
        )}

        <div ref={statusDropdownRef} className="relative">
          <button
            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
            className={`${selectCls} flex items-center gap-1.5 cursor-pointer`}
          >
            {statusFilter.length === 0 ? 'All Statuses' : `${statusFilter.length} Status${statusFilter.length > 1 ? 'es' : ''}`}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
          {statusDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 w-48 rounded-lg border border-border bg-popover shadow-lg py-1">
              {STATUS_OPTIONS.map(s => {
                const selected = statusFilter.includes(s);
                const statusObj = statusObjects?.find((so: StatusOption) => so.name === s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleStatusFilter(s)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left"
                  >
                    <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                      {selected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </span>
                    {statusObj?.color && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusObj.color }} />
                    )}
                    {s}
                  </button>
                );
              })}
              {statusFilter.length > 0 && (
                <>
                  <div className="border-t border-border my-1" />
                  <button onClick={() => setStatusFilter([])} className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent text-left">
                    Clear selection
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectCls}>
          <option value="">All Types</option>
          {TYPE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className={selectCls}>
          <option value="">All Priorities</option>
          {PRIORITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs">
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Assigned By</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Code Repo</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Sprint</TableHead>
              <TableHead className="w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={14} className="py-12 text-center text-sm text-muted-foreground">
                  Loading tasks…
                </TableCell>
              </TableRow>
            ) : filtered.length > 0 ? (
              filtered.map(t => {
                const assigneeName = (t as any).assignee_name ?? t.assignees?.[0]?.full_name;
                const assigneeAvatar = (t as any).assignee_avatar ?? t.assignees?.[0]?.avatar_url;
                return (
                  <TableRow key={t.id} className={`cursor-pointer group ${STATUS_ROW_COLORS[t.status] || ''}`} onClick={() => onTaskClick?.(t)}
                    style={!STATUS_ROW_COLORS[t.status] && statusObjects.find(s => s.name === t.status)?.color ? { borderLeft: `3px solid ${statusObjects.find(s => s.name === t.status)!.color}` } : undefined}>
                    {/* Task Name */}
                    <TableCell>
                      <div className="min-w-[200px]">
                        <div className="flex items-center gap-2">
                          {t.task_number && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {t.task_number}
                            </span>
                          )}
                          <span className="font-medium text-foreground">{t.title}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] ${TYPE_COLORS[t.type] || ''}`}>
                        {t.type || '—'}
                      </Badge>
                    </TableCell>

                    {/* Client */}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap max-w-[140px] truncate">
                      {(t as any).client_name || '—'}
                    </TableCell>

                    {/* Created */}
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {fmtDate(t.created_at)}
                    </TableCell>

                    {/* Assigned To */}
                    <TableCell>
                      {assigneeName ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            {assigneeAvatar && <AvatarImage src={assigneeAvatar} />}
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {initials(assigneeName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs truncate max-w-[100px]">{assigneeName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>

                    {/* Assigned By (Reporter) */}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {(t as any).reporter_name || t.reporter?.full_name || '—'}
                    </TableCell>

                    {/* Due Date */}
                    <TableCell className={`text-xs whitespace-nowrap ${isPastDue(t.due_date) && t.status !== 'Done' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                      {fmtDate(t.due_date)}
                    </TableCell>

                    {/* Priority */}
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] ${PRIORITY_COLORS[t.priority] || ''}`}>
                        {t.priority || '—'}
                      </Badge>
                    </TableCell>

                    {/* Status — inline dropdown */}
                    <TableCell onClick={e => e.stopPropagation()}>
                      <select
                        value={t.status}
                        onChange={e => handleStatusChange(t.id, e.target.value)}
                        className="px-2 py-1 rounded-md bg-secondary border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </TableCell>

                    {/* Code Repo — inline dropdown */}
                    <TableCell onClick={e => e.stopPropagation()}>
                      <select
                        value={(t as any).code_repo_status || ''}
                        onChange={e => handleCodeRepoChange(t.id, e.target.value || null)}
                        className="px-2 py-1 rounded-md bg-secondary border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">—</option>
                        <option value="not_pushed">Not Pushed</option>
                        <option value="pushed">Pushed</option>
                        <option value="conflict">Conflict</option>
                      </select>
                    </TableCell>

                    {/* Module */}
                    <TableCell className="text-xs text-muted-foreground">
                      {(t as any).epic_title || t.epic_name || '—'}
                    </TableCell>

                    {/* Sprint */}
                    <TableCell className="text-xs text-muted-foreground">
                      {t.sprint_name || (t as any).sprint_title || '—'}
                    </TableCell>

                    {/* Actions */}
                    <TableCell onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onTaskClick?.(t)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={14} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {hasActiveFilters ? 'No tasks match your filters.' : 'No tasks found. Create the first one.'}
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
