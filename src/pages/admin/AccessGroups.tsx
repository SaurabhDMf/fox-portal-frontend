import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ChevronDown, ChevronRight, Plus, Search, Shield, Trash2, Users, Copy, X, Check, Minus, Loader2,
} from 'lucide-react';

/* ---------------- permission model ----------------
   Ported from the Lovable design (fox-portal-redesign/src/components/AccessControlPanel.tsx).
   This is an ADDITIVE layer on top of the existing role_permissions system —
   a named "group" of users with its own feature-level permission matrix,
   finer-grained than the module-level roles in RolesPermissions.tsx. See
   backend/src/routes/groups.ts + migrations/109_permission_groups.sql. */

const ACTIONS = ['view', 'create', 'edit', 'delete', 'export'] as const;
type Action = (typeof ACTIONS)[number];

const ACTION_LABEL: Record<Action, string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', export: 'Export',
};

type Feature = { key: string; label: string; actions: Action[] };
type ModuleDef = { key: string; label: string; group: string; features: Feature[] };

const A_ALL: Action[] = ['view', 'create', 'edit', 'delete', 'export'];
const A_CRUD: Action[] = ['view', 'create', 'edit', 'delete'];
const A_VE: Action[] = ['view', 'edit'];
const A_V: Action[] = ['view'];

// Static metadata — which modules/features exist and which actions apply to
// each. Matches what's already live in this app's modules (see AppHeader's
// sectionLabels / role_permissions MODULES list) rather than the redesign's
// example set, so the picker only offers real, meaningful toggles.
const MODULES: ModuleDef[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Workspace', features: [
    { key: 'overview', label: 'Overview widgets', actions: A_V },
  ]},
  { key: 'crm', label: 'CRM', group: 'Workspace', features: [
    { key: 'leads', label: 'Leads', actions: A_ALL },
    { key: 'lead-value', label: 'Deal value & pipeline amounts', actions: A_VE },
    { key: 'assignment', label: 'Lead assignment & ownership', actions: A_VE },
    { key: 'all-leads', label: 'All leads (not just own)', actions: A_V },
  ]},
  { key: 'clients', label: 'Clients', group: 'Workspace', features: [
    { key: 'accounts', label: 'Client accounts', actions: A_ALL },
    { key: 'portal-access', label: 'Client portal access', actions: A_CRUD },
  ]},
  { key: 'projects', label: 'Projects', group: 'Workspace', features: [
    { key: 'projects', label: 'Projects', actions: A_CRUD },
    { key: 'tasks', label: 'Tasks', actions: A_CRUD },
    { key: 'budget', label: 'Project budget', actions: A_VE },
  ]},
  { key: 'chat', label: 'Chat', group: 'Workspace', features: [
    { key: 'channels', label: 'Internal channels', actions: A_CRUD },
    { key: 'members', label: 'Manage room members', actions: A_VE },
  ]},
  { key: 'email', label: 'Email', group: 'Communication', features: [
    { key: 'mailbox', label: 'Personal mailbox', actions: A_CRUD },
    { key: 'send', label: 'Send & reply', actions: ['create'] },
  ]},
  { key: 'inbox', label: 'Shared Inbox', group: 'Communication', features: [
    { key: 'tickets', label: 'Ticket threads', actions: A_CRUD },
    { key: 'reply', label: 'Reply to lead', actions: ['create'] },
    { key: 'notes', label: 'Internal notes', actions: ['view', 'create'] },
    { key: 'assign', label: 'Assign & change status', actions: A_VE },
  ]},
  { key: 'invoicing', label: 'Invoicing', group: 'Finance', features: [
    { key: 'invoices', label: 'Invoices', actions: A_ALL },
    { key: 'approve', label: 'Approve & send', actions: ['create', 'edit'] },
    { key: 'payments', label: 'Record payments', actions: ['view', 'create'] },
  ]},
  { key: 'payroll', label: 'Payroll', group: 'Finance', features: [
    { key: 'runs', label: 'Payroll runs', actions: A_ALL },
    { key: 'salaries', label: 'Salary details', actions: A_VE },
  ]},
  { key: 'tracker', label: 'Tracker', group: 'Operations', features: [
    { key: 'own-time', label: 'Own timesheet', actions: A_CRUD },
    { key: 'team-time', label: 'Team timesheets', actions: A_VE },
  ]},
  { key: 'vault', label: 'Password Manager', group: 'Operations', features: [
    { key: 'shared', label: 'Shared vault', actions: A_CRUD },
    { key: 'reveal', label: 'Reveal secrets', actions: A_V },
  ]},
  { key: 'users', label: 'Team & Users', group: 'Operations', features: [
    { key: 'users', label: 'Users', actions: A_CRUD },
    { key: 'groups', label: 'Groups & access control', actions: A_CRUD },
  ]},
  { key: 'reports', label: 'Reports', group: 'Operations', features: [
    { key: 'sales', label: 'Sales reports', actions: ['view', 'export'] },
  ]},
];

const MODULE_GROUPS = ['Workspace', 'Communication', 'Finance', 'Operations'];

type Perms = Record<string, Action[]>; // "module.feature" -> allowed actions
const permKey = (m: string, f: string) => `${m}.${f}`;

function permsToApi(perms: Perms) {
  const modules: { key: string; features: any[] }[] = [];
  for (const m of MODULES) {
    const features = m.features.map(f => {
      const actions = perms[permKey(m.key, f.key)] || [];
      return {
        key: f.key,
        view: actions.includes('view'), create: actions.includes('create'),
        edit: actions.includes('edit'), delete: actions.includes('delete'), export: actions.includes('export'),
      };
    });
    modules.push({ key: m.key, features });
  }
  return { modules };
}

function apiToPerms(data: { modules?: { key: string; features: { key: string; view: boolean; create: boolean; edit: boolean; delete: boolean; export: boolean }[] }[] }): Perms {
  const perms: Perms = {};
  for (const mod of data.modules || []) {
    for (const f of mod.features || []) {
      const actions: Action[] = [];
      if (f.view) actions.push('view');
      if (f.create) actions.push('create');
      if (f.edit) actions.push('edit');
      if (f.delete) actions.push('delete');
      if (f.export) actions.push('export');
      perms[permKey(mod.key, f.key)] = actions;
    }
  }
  return perms;
}

function buildPerms(mode: 'all' | 'none' | 'read'): Perms {
  const p: Perms = {};
  for (const m of MODULES) for (const f of m.features) {
    p[permKey(m.key, f.key)] = mode === 'all' ? [...f.actions] : mode === 'read' ? f.actions.filter(a => a === 'view') : [];
  }
  return p;
}

/* ---------------- small UI atoms ---------------- */

function Box({ state, onClick, label, disabled }: { state: 'on' | 'off' | 'mixed'; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button" role="checkbox"
      aria-checked={state === 'on' ? 'true' : state === 'mixed' ? 'mixed' : 'false'}
      aria-label={label} disabled={disabled} onClick={onClick}
      className={`grid size-5 place-items-center rounded-[6px] border transition ${
        disabled ? 'cursor-not-allowed border-border bg-muted/40 opacity-40'
        : state === 'on' ? 'border-primary bg-primary text-primary-foreground'
        : state === 'mixed' ? 'border-primary bg-primary/20 text-primary'
        : 'border-border bg-transparent hover:border-primary/60'
      }`}
    >
      {state === 'on' && <Check className="size-3.5" strokeWidth={3} />}
      {state === 'mixed' && <Minus className="size-3.5" strokeWidth={3} />}
    </button>
  );
}

/* ---------------- main page ---------------- */

export default function AccessGroups() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newGroup, setNewGroup] = useState(false);
  const [newName, setNewName] = useState('');
  const [addMember, setAddMember] = useState(false);
  const [localPerms, setLocalPerms] = useState<Perms | null>(null);

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: () => api.get('/groups').then(r => r.data as { id: string; name: string; description: string | null; member_count: number }[]),
  });

  const active = groups.find(g => g.id === activeId) || groups[0];
  const activeId2 = active?.id;

  const { data: members = [] } = useQuery({
    queryKey: ['permission-group-members', activeId2],
    queryFn: () => api.get(`/groups/${activeId2}/members`).then(r => r.data as { id: string; name: string; email: string; role: string; active: boolean }[]),
    enabled: !!activeId2,
  });

  const { data: permsData } = useQuery({
    queryKey: ['permission-group-permissions', activeId2],
    queryFn: () => api.get(`/groups/${activeId2}/permissions`).then(r => r.data),
    enabled: !!activeId2,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-for-groups'],
    queryFn: () => api.get('/users').then(r => (r.data?.data || r.data || []) as { id: string; full_name: string; email: string }[]),
    enabled: addMember,
  });

  const perms = localPerms ?? (permsData ? apiToPerms(permsData) : {});

  const createGroupMut = useMutation({
    mutationFn: (d: { name: string; description?: string }) => api.post('/groups', d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['permission-groups'] });
      setActiveId(res.data.id);
      setNewName(''); setNewGroup(false);
      toast.success('Group created');
    },
    onError: () => toast.error('Could not create group'),
  });

  const deleteGroupMut = useMutation({
    mutationFn: (id: string) => api.delete(`/groups/${id}`, { skipConfirm: true } as any),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ['permission-groups'] });
      if (id === activeId) setActiveId(null);
      toast.success('Group deleted');
    },
    onError: () => toast.error('Could not delete group'),
  });

  const addMemberMut = useMutation({
    mutationFn: (userId: string) => api.post(`/groups/${activeId2}/members`, { user_id: userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-group-members', activeId2] });
      qc.invalidateQueries({ queryKey: ['permission-groups'] });
    },
    onError: () => toast.error('Could not add member'),
  });

  const removeMemberMut = useMutation({
    mutationFn: (userId: string) => api.delete(`/groups/${activeId2}/members/${userId}`, { skipConfirm: true } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-group-members', activeId2] });
      qc.invalidateQueries({ queryKey: ['permission-groups'] });
    },
    onError: () => toast.error('Could not remove member'),
  });

  const savePermsMut = useMutation({
    mutationFn: (p: Perms) => api.put(`/groups/${activeId2}/permissions`, permsToApi(p)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-group-permissions', activeId2] });
      toast.success('Permissions saved');
    },
    onError: () => toast.error('Could not save permissions'),
  });

  const setPerms = (updater: (p: Perms) => Perms) => setLocalPerms(updater(perms));

  const has = (m: string, f: string, a: Action) => (perms[permKey(m, f)] ?? []).includes(a);

  const toggleAction = (m: string, f: string, a: Action) =>
    setPerms(p => {
      const k = permKey(m, f);
      const cur = p[k] ?? [];
      let next = cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a];
      const feature = MODULES.find(x => x.key === m)!.features.find(x => x.key === f)!;
      if (a !== 'view' && next.includes(a) && feature.actions.includes('view') && !next.includes('view')) next = ['view', ...next];
      if (a === 'view' && !next.includes('view')) next = [];
      return { ...p, [k]: next };
    });

  const featureState = (m: ModuleDef, f: Feature): 'on' | 'off' | 'mixed' => {
    const cur = perms[permKey(m.key, f.key)] ?? [];
    if (cur.length === 0) return 'off';
    return cur.length === f.actions.length ? 'on' : 'mixed';
  };

  const toggleFeature = (m: ModuleDef, f: Feature) =>
    setPerms(p => {
      const k = permKey(m.key, f.key);
      const full = (p[k] ?? []).length === f.actions.length;
      return { ...p, [k]: full ? [] : [...f.actions] };
    });

  const moduleCounts = (m: ModuleDef) => {
    let on = 0, total = 0;
    for (const f of m.features) { total += f.actions.length; on += (perms[permKey(m.key, f.key)] ?? []).length; }
    return { on, total };
  };

  const moduleState = (m: ModuleDef): 'on' | 'off' | 'mixed' => {
    const { on, total } = moduleCounts(m);
    return on === 0 ? 'off' : on === total ? 'on' : 'mixed';
  };

  const toggleModule = (m: ModuleDef) =>
    setPerms(p => {
      const grant = moduleState(m) !== 'on';
      const next = { ...p };
      for (const f of m.features) next[permKey(m.key, f.key)] = grant ? [...f.actions] : [];
      return next;
    });

  const setAll = (mode: 'all' | 'none' | 'read') => setPerms(() => buildPerms(mode));

  const visibleModules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MODULES;
    return MODULES.filter(m => m.label.toLowerCase().includes(q) || m.features.some(f => f.label.toLowerCase().includes(q)));
  }, [query]);

  const totalGranted = useMemo(() => Object.values(perms).reduce((n, v) => n + v.length, 0), [perms]);
  const totalPerms = useMemo(() => MODULES.reduce((n, m) => n + m.features.reduce((k, f) => k + f.actions.length, 0), 0), []);

  const createGroup = () => {
    const name = newName.trim();
    if (!name) return;
    createGroupMut.mutate({ name });
  };

  const memberIds = new Set(members.map(m => m.id));
  const availableUsers = allUsers.filter(u => !memberIds.has(u.id));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Access Groups</h1>
          <p className="page-subtitle">Micro-level, feature-by-feature access — additive to Roles &amp; Permissions</p>
        </div>
      </div>

      {loadingGroups ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !active ? (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm space-y-3">
          <p>No access groups yet.</p>
          <button onClick={() => setNewGroup(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all">
            <Plus className="h-4 w-4" /> Create group
          </button>
          {newGroup && (
            <div className="flex gap-1.5 justify-center pt-2">
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createGroup()}
                placeholder="Group name" className="h-9 w-56 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary" />
              <button onClick={createGroup} className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Add</button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
          {/* groups list */}
          <aside className="glass-card p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Groups</p>
              <button onClick={() => setNewGroup(v => !v)} className="grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="New group">
                <Plus className="size-4" />
              </button>
            </div>

            {newGroup && (
              <div className="mb-2 flex gap-1.5 px-1">
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createGroup()}
                  placeholder="Group name" className="h-8 w-full rounded-md border border-border bg-background px-2 text-[13px] outline-none focus:border-primary" />
                <button onClick={createGroup} className="h-8 shrink-0 rounded-md bg-primary px-2 text-[12px] font-medium text-primary-foreground">Add</button>
              </div>
            )}

            <div className="space-y-0.5">
              {groups.map(g => {
                const isActive = g.id === active.id;
                return (
                  <div key={g.id} className={`group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors ${isActive ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                    <button onClick={() => { setActiveId(g.id); setLocalPerms(null); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <Shield className={`size-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="min-w-0">
                        <span className={`block truncate text-[13px] ${isActive ? 'font-medium text-primary' : ''}`}>{g.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{g.member_count} members</span>
                      </span>
                    </button>
                    <button onClick={() => deleteGroupMut.mutate(g.id)} className="opacity-0 transition group-hover:opacity-100" aria-label={`Delete ${g.name}`}>
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* permission matrix */}
          <div className="space-y-4">
            <section className="glass-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold">{active.name}</h3>
                  {active.description && <p className="mt-0.5 text-[13px] text-muted-foreground">{active.description}</p>}
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    <span className="font-medium text-foreground">{totalGranted}</span> of {totalPerms} permissions granted
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button onClick={() => setAll('read')} className="h-8 rounded-lg border border-border px-2.5 text-[12px] transition hover:bg-muted">Read only</button>
                  <button onClick={() => setAll('none')} className="h-8 rounded-lg border border-border px-2.5 text-[12px] transition hover:bg-muted">Clear all</button>
                  <button onClick={() => setAll('all')} className="h-8 rounded-lg bg-primary px-2.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90">Grant all</button>
                  <button
                    onClick={() => savePermsMut.mutate(perms)}
                    disabled={savePermsMut.isPending || !localPerms}
                    className="h-8 rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                  >
                    {savePermsMut.isPending ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>

              {/* members */}
              <div className="mt-4 border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="text-[12px] font-medium text-muted-foreground">Members</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {members.map(m => (
                    <span key={m.id} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[12px]">
                      {m.name}
                      <button onClick={() => removeMemberMut.mutate(m.id)} aria-label={`Remove ${m.name}`}>
                        <X className="size-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </span>
                  ))}
                  <button onClick={() => setAddMember(v => !v)} className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[12px] text-muted-foreground transition hover:border-primary hover:text-primary">
                    <Plus className="size-3" /> Add member
                  </button>
                </div>
                {addMember && (
                  <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-border p-2">
                    {availableUsers.map(u => (
                      <button key={u.id} onClick={() => addMemberMut.mutate(u.id)} className="rounded-full bg-muted px-2.5 py-1 text-[12px] transition hover:bg-primary/15 hover:text-primary">
                        {u.full_name}
                      </button>
                    ))}
                    {availableUsers.length === 0 && <span className="px-1 text-[12px] text-muted-foreground">Everyone is already a member.</span>}
                  </div>
                )}
              </div>
            </section>

            <section className="glass-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
                <div>
                  <h4 className="font-display text-sm font-semibold">Module &amp; feature access</h4>
                  <p className="text-[12px] text-muted-foreground">Tick exactly what this group can do. Unticking "View" removes the feature entirely.</p>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search module or feature"
                    className="h-8 w-56 rounded-md border border-border bg-background pl-8 pr-2 text-[12px] outline-none focus:border-primary" />
                </div>
              </div>

              <div className="divide-y divide-border">
                {MODULE_GROUPS.map(grp => {
                  const mods = visibleModules.filter(m => m.group === grp);
                  if (!mods.length) return null;
                  return (
                    <div key={grp}>
                      <p className="bg-muted/40 px-4 py-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{grp}</p>
                      {mods.map(m => {
                        const isOpen = !collapsed[m.key];
                        const { on, total } = moduleCounts(m);
                        return (
                          <div key={m.key} className="border-t border-border/60">
                            <div className="flex items-center gap-3 px-4 py-2.5">
                              <Box state={moduleState(m)} onClick={() => toggleModule(m)} label={`Toggle all ${m.label} permissions`} />
                              <button onClick={() => setCollapsed(c => ({ ...c, [m.key]: isOpen }))} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                                {isOpen ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                                <span className="truncate text-[13px] font-medium">{m.label}</span>
                                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${on === 0 ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary'}`}>{on}/{total}</span>
                              </button>
                            </div>

                            {isOpen && (
                              <div className="overflow-x-auto pb-2">
                                <table className="w-full min-w-[620px] text-left">
                                  <thead>
                                    <tr className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                                      <th className="w-[46%] pl-12 font-medium">Feature</th>
                                      {ACTIONS.map(a => <th key={a} className="px-2 pb-1 text-center font-medium">{ACTION_LABEL[a]}</th>)}
                                      <th className="pr-4 text-right font-medium">All</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {m.features.map(f => (
                                      <tr key={f.key} className="transition-colors hover:bg-muted/40">
                                        <td className="py-1.5 pl-12 text-[13px] text-muted-foreground">{f.label}</td>
                                        {ACTIONS.map(a => (
                                          <td key={a} className="px-2 py-1.5 text-center">
                                            {f.actions.includes(a) ? (
                                              <span className="inline-flex">
                                                <Box state={has(m.key, f.key, a) ? 'on' : 'off'} onClick={() => toggleAction(m.key, f.key, a)} label={`${ACTION_LABEL[a]} ${f.label}`} />
                                              </span>
                                            ) : (
                                              <span className="text-[11px] text-muted-foreground/40">—</span>
                                            )}
                                          </td>
                                        ))}
                                        <td className="py-1.5 pr-4 text-right">
                                          <button onClick={() => toggleFeature(m, f)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground">
                                            <Copy className="size-3" />
                                            {featureState(m, f) === 'on' ? 'None' : 'All'}
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
