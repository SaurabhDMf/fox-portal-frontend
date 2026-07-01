import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useMemo, useState, useCallback, useRef, useEffect, type CSSProperties } from 'react';
import { Plus, Search, X, Pencil, ChevronDown, ChevronUp, Check } from 'lucide-react';
import api from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { extractProjectArray } from '@/lib/projectResponse';
import type { ProjectTask, Sprint, Epic, ProjectMember } from '@/lib/projectTypes';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStatuses, type StatusOption } from '@/hooks/useProjectOptions';
import HandoffBadge from './HandoffBadge';
import { computeHierarchicalNumbers } from '@/lib/hierarchicalTaskNumbers';
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

const STATUS_ROW_COLORS: Record<string, string> = {
  'Open': '',
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
const REPORTER_FILTER_ROLES = new Set(['admin', 'super_admin', 'project_coordinator', 'sales_manager']);
const MASTER_STATUS_ROLES = new Set(['admin', 'super_admin', 'manager', 'sales_manager', 'project_manager', 'project_coordinator', 'supervisor']);

export default function TasksListView({ projectId, onTaskClick, onCreateTask }: Props) {
  const qc = useQueryClient();
  const userRole = useAuthStore(s => s.user?.role);
  const isRestricted = RESTRICTED_ROLES.includes(userRole || '');
  const canSeeReporterFilter = REPORTER_FILTER_ROLES.has(userRole || '');
  const seesMasterStatus = MASTER_STATUS_ROLES.has(userRole || '');
  const { statuses: STATUS_OPTIONS, statusObjects } = useProjectStatuses(projectId);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(''); // '' = All. Set by the SEO/SMM/PPC/GEO tab bar (only for checklist tasks)
  const [sprintFilter, setSprintFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [reporterFilter, setReporterFilter] = useState('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ChevronDown className="h-3 w-3 opacity-30 ml-1 inline" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-primary ml-1 inline" />
      : <ChevronDown className="h-3 w-3 text-primary ml-1 inline" />;
  };

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

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = { project_id: projectId };
    if (typeFilter) p.type = typeFilter;
    if (sprintFilter) p.sprint_id = sprintFilter;
    if (moduleFilter) p.module_id = moduleFilter;
    if (assigneeFilter) p.assignee_id = assigneeFilter;
    if (reporterFilter) p.reporter_id = reporterFilter;
    if (debouncedSearch) p.search = debouncedSearch;
    p.sort_by = sortBy;
    p.sort_dir = sortDir;
    return p;
  }, [projectId, typeFilter, sprintFilter, moduleFilter, assigneeFilter, reporterFilter, debouncedSearch, sortBy, sortDir]);

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

  const hierarchicalNumbers = useMemo(() => computeHierarchicalNumbers(tasks), [tasks]);

  // Checklist tasks created from the SEO/SMM/PPC/GEO templates have a
  // "{CATEGORY} · " prefix on their title. Detect which categories are
  // present so the tab bar only shows the ones with matching tasks.
  const CHECKLIST_CATEGORIES = ['SEO', 'SMM', 'PPC', 'GEO'] as const;
  const detectedCategories = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      for (const cat of CHECKLIST_CATEGORIES) {
        if (t.title?.startsWith(`${cat} · `)) { set.add(cat); break; }
      }
    }
    return CHECKLIST_CATEGORIES.filter(c => set.has(c));
  }, [tasks]);

  const matchesFilters = useCallback((t: ProjectTask) => {
    if (statusFilter.length > 0 && !statusFilter.includes(t.status)) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (categoryFilter && !t.title?.startsWith(`${categoryFilter} · `)) return false;
    return true;
  }, [statusFilter, priorityFilter, categoryFilter]);

  const visibleTasks = useMemo(() => tasks.filter(matchesFilters), [tasks, matchesFilters]);

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

  const ASSIGNER_ROLES = new Set(['project_manager', 'supervisor', 'project_coordinator', 'sales_manager']);
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

  const handleStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    qc.setQueryData(['project-all-tasks', queryParams], (old: ProjectTask[] | undefined) => {
      if (!old) return old;
      return old.map(t => t.id === taskId ? { ...t, status: newStatus, my_status: newStatus } : t);
    });
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
    } catch {
      toast.error('Failed to update status');
      qc.invalidateQueries({ queryKey: ['project-all-tasks'] });
    }
  }, [qc, queryParams]);

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

  const STATUS_CHIP_COLORS: Record<string, string> = {
    'Open':        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'Review':      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'Done':        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    'Cancelled':   'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  };

  const renderTaskRow = (t: ProjectTask) => {
    const assigneeName = (t as any).assignee_name ?? t.assignees?.[0]?.full_name;
    const assigneeAvatar = (t as any).assignee_avatar ?? t.assignees?.[0]?.avatar_url;
    const visibleStatus = seesMasterStatus ? t.status : (t.my_status || t.status);
    const statusColor = statusObjects.find(s => s.name === visibleStatus)?.color;

    // Parse per-user assignee statuses (admin only)
    const rawAssigneeStatuses = (t as any).assignee_statuses;
    const assigneeStatuses: { user_id: string; full_name: string; status: string; is_active: number }[] =
      seesMasterStatus && rawAssigneeStatuses
        ? (typeof rawAssigneeStatuses === 'string' ? JSON.parse(rawAssigneeStatuses) : rawAssigneeStatuses) ?? []
        : [];
    const subtaskCount = (t as any).subtask_count ?? 0;

    const rowBg = STATUS_ROW_COLORS[visibleStatus] || '';
    const leftBorderStyle: CSSProperties = statusColor && !STATUS_ROW_COLORS[visibleStatus]
      ? { borderLeft: `3px solid ${statusColor}` }
      : {};

    return (
      <TableRow
        key={t.id}
        className={`cursor-pointer group transition-colors ${rowBg}`}
        onClick={() => onTaskClick?.(t)}
        style={leftBorderStyle}
      >
        {/* Title */}
        <TableCell>
          <div className="min-w-[220px] flex items-start gap-2">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(() => {
                  const display = t.task_number || hierarchicalNumbers.get(t.id);
                  if (!display) return null;
                  return (
                    <>
                      {(t as any).parent_task_number && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                          ↳ #{(t as any).parent_task_number}
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        #{display}
                      </span>
                    </>
                  );
                })()}
                <span className="font-medium text-foreground leading-snug">{t.title}</span>
                {subtaskCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                    {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
                  </span>
                )}
                <HandoffBadge handoffInfo={(t as any).handoff_info} />
              </div>
            </div>
          </div>
        </TableCell>

        <TableCell>
          <Badge variant="secondary" className={`text-[10px] ${TYPE_COLORS[t.type] || ''}`}>
            {t.type || '—'}
          </Badge>
        </TableCell>
        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
          {fmtDate(t.created_at)}
        </TableCell>
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
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
          {(t as any).reporter_name || t.reporter?.full_name || '—'}
        </TableCell>
        <TableCell className={`text-xs whitespace-nowrap ${isPastDue(t.due_date) && visibleStatus !== 'Done' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
          {fmtDate(t.due_date)}
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className={`text-[10px] ${PRIORITY_COLORS[t.priority] || ''}`}>
            {t.priority || '—'}
          </Badge>
        </TableCell>
        <TableCell onClick={e => e.stopPropagation()}>
          <div className="flex flex-col gap-1.5 min-w-[120px]">
            {/* Master status dropdown — admin controls overall status */}
            <select
              value={visibleStatus}
              onChange={e => handleStatusChange(t.id, e.target.value)}
              className="px-2 py-1 rounded-md bg-secondary border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"
              title={seesMasterStatus ? 'Master task status (visible to all)' : 'Your personal status on this task'}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {/* Per-user personal status chips — admin only */}
            {assigneeStatuses.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {assigneeStatuses.map(as => (
                  <div key={as.user_id} className="flex items-center gap-1">
                    <span className={`shrink-0 text-[9px] font-semibold px-1 py-0.5 rounded ${as.is_active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {initials(as.full_name)}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CHIP_COLORS[as.status] || 'bg-muted text-muted-foreground'}`}>
                      {as.status}
                    </span>
                    {!as.is_active && (
                      <span className="text-[8px] text-muted-foreground italic">prev</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TableCell>
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
        <TableCell className="text-xs text-muted-foreground">
          {(t as any).epic_title || t.epic_name || '—'}
        </TableCell>
        <TableCell className="text-xs">
          {(t as any).project_epic_title ? (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium"
              style={{
                background: `${(t as any).project_epic_color || 'hsl(var(--primary))'}22`,
                color: (t as any).project_epic_color || 'hsl(var(--primary))',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: (t as any).project_epic_color || 'hsl(var(--primary))' }} />
              {(t as any).project_epic_title}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {t.sprint_name || (t as any).sprint_title || '—'}
        </TableCell>
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
  };

  return (
    <div className="space-y-4">
      {/* Checklist category tabs — only render when the project actually has
          tasks tagged with a category prefix (SEO / SMM / PPC / GEO). */}
      {detectedCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border pb-1">
          <button
            type="button"
            onClick={() => setCategoryFilter('')}
            className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${
              categoryFilter === '' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            All ({tasks.length})
          </button>
          {detectedCategories.map(cat => {
            const count = tasks.filter(t => t.title?.startsWith(`${cat} · `)).length;
            const active = categoryFilter === cat;
            return (
              <button
                type="button"
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${
                  active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {isRestricted ? 'My Tasks' : 'All Tasks'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Showing {visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''}
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

        {canSeeReporterFilter && (
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
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('title')}>Task Name<SortIcon col="title" /></TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('created_at')}>Created<SortIcon col="created_at" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('assignee_name')}>Assigned To<SortIcon col="assignee_name" /></TableHead>
              <TableHead>Assigned By</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('due_date')}>Due Date<SortIcon col="due_date" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('priority')}>Priority<SortIcon col="priority" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>Status<SortIcon col="status" /></TableHead>
              <TableHead>Code Repo</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Epic</TableHead>
              <TableHead>Sprint</TableHead>
              <TableHead className="w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={13} className="py-12 text-center text-sm text-muted-foreground">
                  Loading tasks…
                </TableCell>
              </TableRow>
            ) : visibleTasks.length > 0 ? (
              visibleTasks.map(t => renderTaskRow(t))
            ) : (
              <TableRow>
                <TableCell colSpan={13} className="py-12 text-center">
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
