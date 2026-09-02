import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useModulePermission } from '@/hooks/usePermission';
import { usePortalBase } from '@/hooks/usePortalBase';
import { Plus, Search, List, LayoutGrid, X, Calendar, Trash2, PlusCircle, ChevronDown, ChevronUp, ChevronRight, Check, Pencil, ArrowUpDown, UserCheck, Settings, Users, Sparkles, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import ConvertLeadModal from '@/components/crm/ConvertLeadModal';



const defaultStatuses = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'];
const defaultPurposes = ['Web Development', 'Mobile App', 'UI/UX Design', 'SEO', 'Digital Marketing', 'Consulting', 'Other'];

const countries = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan',
  'Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia',
  'Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica',
  'Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt',
  'El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon',
  'Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana',
  'Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel',
  'Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan',
  'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar',
  'Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia',
  'Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal',
  'Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan',
  'Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar',
  'Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino',
  'Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia',
  'Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden',
  'Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago',
  'Tunisia','Turkey','Turkmenistan','Tuvalu','UAE','Uganda','Ukraine','United Kingdom','United States','Uruguay',
  'Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe','Other',
];

function SearchableCountrySelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = q ? countries.filter(c => c.toLowerCase().includes(q.toLowerCase())) : countries;

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className={`${className} flex items-center justify-between w-full text-left`}>
        <span className={value ? '' : 'text-muted-foreground'}>{value || 'Select Country'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-border">
            <input autoFocus placeholder="Search country..." value={q} onChange={e => setQ(e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div className="overflow-y-auto max-h-48">
            <button type="button" onClick={() => { onChange(''); setOpen(false); setQ(''); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-secondary/80 text-muted-foreground">Clear</button>
            {filtered.map(c => (
              <button type="button" key={c} onClick={() => { onChange(c); setOpen(false); setQ(''); }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-secondary/80 flex items-center justify-between ${value === c ? 'bg-primary/10 text-primary' : ''}`}>
                {c} {value === c && <Check className="h-3 w-3" />}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-4 text-xs text-muted-foreground text-center">No countries found</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function isStale(lead: any): boolean {
  if (!lead.created_at) return false;
  if (lead.status && lead.status !== 'New') return false;
  const created = new Date(lead.created_at);
  const today = new Date();
  return created.toDateString() !== today.toDateString();
}

// 0 = overdue, 1 = today, 2 = future, 3 = no follow-up set
function followupBucket(lead: any): { bucket: 0|1|2|3; ts: number } {
  if (!lead?.next_followup) return { bucket: 3, ts: 0 };
  const f = new Date(lead.next_followup);
  if (isNaN(f.getTime())) return { bucket: 3, ts: 0 };
  const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
  const nextMid  = new Date(f); nextMid.setHours(0, 0, 0, 0);
  if (nextMid < todayMid)            return { bucket: 0, ts: f.getTime() };
  if (+nextMid === +todayMid)        return { bucket: 1, ts: f.getTime() };
  return { bucket: 2, ts: f.getTime() };
}

function formatFollowup(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getLeadCountry(lead: any): string {
  return lead?.country || lead?.country_name || lead?.lead_country || lead?.location || lead?.meta?.country || '';
}

function getLeadPurpose(lead: any): string {
  return lead?.purpose || lead?.purpose_name || lead?.lead_purpose || lead?.service || lead?.meta?.purpose || '';
}

function useCustomFields(userId: string | undefined) {
  const storageKey = `crm-custom-fields-${userId || 'default'}`;

  const { data: remoteFields } = useQuery({
    queryKey: ['custom-fields', userId],
    queryFn: () => api.get('/leads/custom-fields').then(r => r.data).catch(() => null),
    enabled: !!userId,
    retry: false,
  });

  const getLocal = (): { statuses: string[]; purposes: string[] } => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored);
    } catch {}
    return { statuses: [], purposes: [] };
  };

  const [local, setLocal] = useState(getLocal);

  useEffect(() => {
    if (remoteFields) {
      const merged = {
        statuses: remoteFields.statuses || [],
        purposes: remoteFields.purposes || [],
      };
      setLocal(merged);
      localStorage.setItem(storageKey, JSON.stringify(merged));
    }
  }, [remoteFields, storageKey]);

  const allStatuses = [...new Set([...defaultStatuses, ...(local.statuses || [])])];
  const allPurposes = [...new Set([...defaultPurposes, ...(local.purposes || [])])];

  const addStatus = async (value: string) => {
    if (!value.trim() || allStatuses.includes(value.trim())) return;
    const updated = { ...local, statuses: [...(local.statuses || []), value.trim()] };
    setLocal(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    try {
      await api.post('/leads/custom-fields', { type: 'status', value: value.trim() });
    } catch {}
  };

  const addPurpose = async (value: string) => {
    if (!value.trim() || allPurposes.includes(value.trim())) return;
    const updated = { ...local, purposes: [...(local.purposes || []), value.trim()] };
    setLocal(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    try {
      await api.post('/leads/custom-fields', { type: 'purpose', value: value.trim() });
    } catch {}
  };

  const removeStatus = async (value: string) => {
    if (defaultStatuses.includes(value)) return;
    const updated = { ...local, statuses: (local.statuses || []).filter(s => s !== value) };
    setLocal(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    try {
      await api.delete('/leads/custom-fields', { data: { field_type: 'status', value } });
    } catch {}
  };

  return { allStatuses, allPurposes, addStatus, addPurpose, removeStatus };
}

export default function CRM() {
  const navigate = useNavigate();
  const portalBase = usePortalBase();
  const user = useAuthStore(s => s.user);
  const perm = useModulePermission('crm');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // Debounce search so every keystroke doesn't fire a fresh /leads query —
  // on large lead tables this was the single biggest source of load.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (dateFilterRef.current && !dateFilterRef.current.contains(e.target as Node)) setShowDateFilter(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const [statusFilter, setStatusFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<any>(null);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [showConvert, setShowConvert] = useState<any>(null);
  const [newStatusInput, setNewStatusInput] = useState('');
  const [newPurposeInput, setNewPurposeInput] = useState('');
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [showAddPurpose, setShowAddPurpose] = useState(false);
  const [showManageStatuses, setShowManageStatuses] = useState(false);
  const qc = useQueryClient();

  const { allStatuses, allPurposes, addStatus, addPurpose, removeStatus } = useCustomFields(user?.id);

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', country: '', purpose: '',
    status: 'New', assigned_to: '', added_by: '', notes: '',
    lead_source: '', next_followup: '',
  });

  // Paged list — fetches 100 leads per page on demand instead of shipping the
  // full table on every render. The kanban view groups whatever's loaded so
  // far; the user can click "Load more" at the bottom of the list to pull in
  // additional pages.
  const PAGE_SIZE = 100;
  const {
    data: leadsPages,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['leads', search, statusFilter, countryFilter, assignedFilter, dateFrom, dateTo, tagFilter],
    initialPageParam: 1,
    queryFn: ({ pageParam = 1 }) => api.get('/leads', {
      params: {
        page: pageParam,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: statusFilter || undefined,
        country: countryFilter || undefined,
        assigned_to: assignedFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        tags: tagFilter || undefined,
      },
    }).then(r => r.data),
    getNextPageParam: (lastPage: any, allPages: any[]) =>
      lastPage?.hasMore ? allPages.length + 1 : undefined,
  });

  const leads = useMemo(() => {
    const pages = leadsPages?.pages || [];
    return pages.flatMap((p: any) =>
      Array.isArray(p?.data) ? p.data
        : Array.isArray(p?.leads) ? p.leads
        : Array.isArray(p) ? p
        : []
    );
  }, [leadsPages]);

  // Helper that updates every variant of the leads query (each search/filter
  // combination has its own key) so optimistic edits are reflected everywhere.
  const mutateLeadsCache = (mutator: (rows: any[]) => any[]) => {
    qc.setQueriesData<any>({ queryKey: ['leads'] }, (prev: any) => {
      if (!prev?.pages) return prev;
      return {
        ...prev,
        pages: prev.pages.map((page: any) => {
          const rows = Array.isArray(page?.data) ? page.data
            : Array.isArray(page?.leads) ? page.leads
            : [];
          return { ...page, data: mutator(rows) };
        }),
      };
    });
  };

  const fallbackUsers = [
    { id: 'presales-1', full_name: 'Riya Sharma', role: 'presales' },
    { id: 'presales-2', full_name: 'Amit Verma', role: 'presales' },
    { id: 'sm-1', full_name: 'Neha Kapoor', role: 'sales_manager' },
    { id: 'sm-2', full_name: 'Rahul Mehta', role: 'sales_manager' },
    { id: 'sr-1', full_name: 'Priya Singh', role: 'sales_rep' },
  ];

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users').then(r => {
      const list = r.data?.users || r.data?.data || r.data || [];
      console.log('[CRM] Users list from API:', list);
      return Array.isArray(list) ? list : [];
    }).catch(() => []),
  });

  // Shared with Shared Inbox — same tag vocabulary across both modules.
  const { data: allTags = [] } = useQuery<string[]>({
    queryKey: ['tags-all'],
    queryFn: () => api.get('/tags').then(r => r.data.tags).catch(() => []),
    staleTime: 30_000,
  });

  // Empty strings break MySQL datetime columns — send null instead.
  const normalizeLead = (d: typeof form) => ({
    ...d,
    next_followup: d.next_followup ? d.next_followup : null,
  });

  // All mutations push their result straight into the cache instead of
  // invalidating + refetching — that's what caused the "loading…" feel after
  // every save on bigger tables.
  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/leads', normalizeLead(d)).then(r => r.data),
    onSuccess: (newLead: any) => {
      if (newLead?.id) {
        mutateLeadsCache(rows => [newLead, ...rows.filter(r => r.id !== newLead.id)]);
        qc.setQueryData(['lead', newLead.id], newLead);
      }
      setShowCreate(false);
      setForm({ full_name: '', email: '', phone: '', country: '', purpose: '', status: 'New', assigned_to: '', added_by: '', notes: '', lead_source: '', next_followup: '' });
      toast.success('Lead created successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.response?.data?.error || 'Error creating lead'),
  });

  const editMut = useMutation({
    mutationFn: (d: { id: string; data: typeof form }) =>
      api.put(`/leads/${d.id}`, normalizeLead(d.data)).then(r => r.data),
    onSuccess: (updated: any, vars) => {
      const merged = (prev: any) => ({ ...(prev || {}), ...(updated || {}) });
      mutateLeadsCache(rows => rows.map(r => r.id === vars.id ? merged(r) : r));
      qc.setQueryData(['lead', vars.id], (prev: any) => merged(prev));
      setShowEdit(null);
      toast.success('Lead updated successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error updating lead'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`).then(() => id),
    onSuccess: (id: string) => {
      mutateLeadsCache(rows => rows.filter(r => r.id !== id));
      qc.removeQueries({ queryKey: ['lead', id] });
      setShowDelete(null);
      toast.success('Lead deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error deleting lead'),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/leads/${id}`, { status }).then(r => r.data),
    onSuccess: (updated: any, vars) => {
      const merged = (prev: any) => ({ ...(prev || {}), ...(updated || {}) });
      mutateLeadsCache(rows => rows.map(r => r.id === vars.id ? merged(r) : r));
      qc.setQueryData(['lead', vars.id], (prev: any) => merged(prev));
      toast.success('Status updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error updating status'),
  });

  const openEdit = (lead: any) => {
    setForm({
      full_name: lead.full_name || '', email: lead.email || '', phone: lead.phone || '',
      country: getLeadCountry(lead), purpose: getLeadPurpose(lead), status: lead.status || 'New',
      assigned_to: lead.assigned_to || '', added_by: lead.added_by || '', notes: lead.notes || '',
      lead_source: lead.lead_source || '',
      next_followup: lead.next_followup ? new Date(lead.next_followup).toISOString().slice(0, 16) : '',
    });
    setShowEdit(lead);
  };

  // Overdue follow-ups first, then today's, then future. Leads with no
  // follow-up date sort by created_at per the user's toggle. Dead, Closed
  // Won and Closed Lost leads sink to the bottom regardless of follow-up.
  const isInactive = (l: any) => {
    const s = (l.status || '').toLowerCase();
    return s === 'dead' || s === 'closed won' || s === 'closed lost';
  };
  const sortedLeads = [...leads].sort((a: any, b: any) => {
    const aInactive = isInactive(a);
    const bInactive = isInactive(b);
    if (aInactive !== bInactive) return aInactive ? 1 : -1;
    const pa = followupBucket(a);
    const pb = followupBucket(b);
    if (pa.bucket !== pb.bucket) return pa.bucket - pb.bucket;
    if (pa.bucket < 3)           return pa.ts - pb.ts;
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });
  const leadsArr = sortedLeads;
  const apiUsers = Array.isArray(users) ? users : [];
  const usersArr = apiUsers.length > 0 ? apiUsers : fallbackUsers;
  const presalesUsers = usersArr;
  const managerUsers = usersArr;

  // Build a lookup map: user id -> full_name (for resolving names client-side)
  const userNameMap: Record<string, string> = {};
  usersArr.forEach((u: any) => { if (u.id && u.full_name) userNameMap[u.id] = u.full_name; });
  const resolveAddedBy = (lead: any) => lead.added_by_name || lead.lead_by_name || userNameMap[lead.added_by] || '';
  const resolveAssignedTo = (lead: any) => lead.assigned_name || lead.assigned_to_name || userNameMap[lead.assigned_to] || '';

  const inputCls = "px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  // Stats over the currently loaded page(s) — the same data already backing
  // the table/grid below, no extra API call.
  const stats = useMemo(() => ({
    total: leadsArr.length,
    newLeads: leadsArr.filter((l: any) => (l.status || 'New') === 'New').length,
    closedWon: leadsArr.filter((l: any) => l.status === 'Closed Won').length,
    overdue: leadsArr.filter((l: any) => followupBucket(l).bucket === 0).length,
  }), [leadsArr]);

  const applyDatePreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(to.toISOString().slice(0, 10));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === leadsArr.length ? new Set() : new Set(leadsArr.map((l: any) => l.id)));
  };

  const exportSelected = () => {
    const rows = leadsArr.filter((l: any) => selectedIds.has(l.id));
    const header = ['Name', 'Email', 'Phone', 'Country', 'Purpose', 'Status', 'Added By', 'Assigned To', 'Created'];
    const csvRows = rows.map((l: any) => [
      l.full_name, l.email, l.phone, getLeadCountry(l), getLeadPurpose(l), l.status,
      resolveAddedBy(l), resolveAssignedTo(l), l.created_at ? new Date(l.created_at).toLocaleDateString() : '',
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} lead${rows.length === 1 ? '' : 's'}`);
  };

  const bulkDelete = async () => {
    setBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteMut.mutateAsync(id)));
      toast.success(`Deleted ${selectedIds.size} lead${selectedIds.size === 1 ? '' : 's'}`);
      setSelectedIds(new Set());
      setShowBulkDelete(false);
    } catch {
      toast.error('Some leads failed to delete');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleAddStatus = () => {
    const val = newStatusInput.trim();
    if (val) {
      addStatus(val);
      setNewStatusInput('');
      setShowAddStatus(false);
      toast.success(`Status "${val}" added`);
    }
  };

  const handleAddPurpose = () => {
    if (newPurposeInput.trim()) {
      addPurpose(newPurposeInput.trim());
      setNewPurposeInput('');
      setShowAddPurpose(false);
      toast.success(`Purpose "${newPurposeInput.trim()}" added`);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title !text-3xl md:!text-4xl">Sales CRM</h1><p className="page-subtitle">Manage your sales pipeline</p></div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary'} transition-colors`} title="List View"><List className="h-4 w-4" /></button>
            <button onClick={() => setView('grid')} className={`p-2 ${view === 'grid' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary'} transition-colors`} title="Grid View"><LayoutGrid className="h-4 w-4" /></button>
          </div>
          <button onClick={() => setShowManageStatuses(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:bg-secondary transition-all" title="Manage Statuses">
            <Settings className="h-4 w-4" /> Statuses
          </button>
          {perm.canCreate && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
              <Plus className="h-4 w-4" /> New Lead
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 space-y-3">
          <span className="block w-2.5 h-2.5 rounded-full bg-primary" />
          <div><div className="text-3xl font-bold font-display">{stats.total}</div><div className="text-sm text-muted-foreground">{hasNextPage ? 'Leads loaded' : 'Total leads'}</div></div>
        </div>
        <div className="glass-card p-5 space-y-3">
          <span className="block w-2.5 h-2.5 rounded-full bg-info" />
          <div><div className="text-3xl font-bold font-display">{stats.newLeads}</div><div className="text-sm text-muted-foreground">New</div></div>
        </div>
        <div className="glass-card p-5 space-y-3">
          <span className="block w-2.5 h-2.5 rounded-full bg-success" />
          <div><div className="text-3xl font-bold font-display">{stats.closedWon}</div><div className="text-sm text-muted-foreground">Closed Won</div></div>
        </div>
        <div className="glass-card p-5 space-y-3">
          <span className="block w-2.5 h-2.5 rounded-full bg-warning" />
          <div><div className="text-3xl font-bold font-display">{stats.overdue}</div><div className="text-sm text-muted-foreground">Overdue follow-ups</div></div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search leads..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className={inputCls}>
          <option value="">All Countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputCls}>
          <option value="">All Statuses</option>
          {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)} className={inputCls}>
          <option value="">All Assigned</option>
          {usersArr.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        {allTags.length > 0 && (
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className={inputCls}>
            <option value="">All Tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <div className="relative" ref={dateFilterRef}>
          <button onClick={() => setShowDateFilter(v => !v)} className={`flex items-center gap-1.5 ${inputCls} ${(dateFrom || dateTo) ? 'text-primary border-primary/40' : 'text-muted-foreground'}`}>
            <Calendar className="h-4 w-4" />
            {dateFrom || dateTo ? `${dateFrom || '…'} → ${dateTo || '…'}` : 'Date Range'}
          </button>
          {showDateFilter && (
            <div className="absolute z-50 mt-1 right-0 w-72 bg-popover border border-border rounded-lg shadow-lg p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[['Today', 1], ['7 days', 7], ['30 days', 30], ['90 days', 90]].map(([label, days]) => (
                  <button key={label as string} onClick={() => applyDatePreset(days as number)}
                    className="px-2 py-1.5 rounded-md text-xs bg-secondary hover:bg-secondary/70 transition-colors">{label}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={`${inputCls} flex-1 text-xs`} title="From Date" />
                <span className="text-muted-foreground text-xs">to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={`${inputCls} flex-1 text-xs`} title="To Date" />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-muted-foreground hover:text-foreground">Clear dates</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* List View */}
      {view === 'list' && (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="pl-4 pr-1 py-4 w-8">
                  <input type="checkbox" className="accent-primary" checked={leadsArr.length > 0 && selectedIds.size === leadsArr.length} onChange={toggleSelectAll} title="Select all" />
                </th>
                <th className="w-6"></th>
                <th className="px-3 py-4 whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}>
                  <span className="flex items-center gap-1">Created {sortOrder === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}</span>
                </th>
                <th className="px-3 py-4">Name</th>
                <th className="px-3 py-4">Purpose</th>
                <th className="px-3 py-4 whitespace-nowrap">Status</th>
                <th className="px-3 py-4 whitespace-nowrap">Follow-up</th>
                <th className="px-3 py-4 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={8} className="p-4"><div className="h-4 bg-secondary rounded animate-pulse" /></td></tr>) :
              leadsArr.map((lead: any) => {
                const stale = isStale(lead);
                const isDead = (lead.status || '').toLowerCase() === 'dead';
                const fb = followupBucket(lead);
                const followupCls =
                  fb.bucket === 0 ? 'text-destructive font-medium'
                  : fb.bucket === 1 ? 'text-amber-500 font-medium'
                  : 'text-muted-foreground';
                const statusBadgeCls =
                  lead.status === 'Closed Won'  ? 'badge-success'
                  : lead.status === 'Closed Lost' || isDead ? 'badge-danger'
                  : 'badge-info';
                // Make sure the lead's own status is in the dropdown even when it
                // isn't part of the global statuses list (e.g. "Dead" added later).
                const statusOptions = Array.from(new Set([...allStatuses, lead.status].filter(Boolean)));
                const rowDeadCls   = isDead ? 'opacity-60 [&_td]:line-through' : '';
                const rowStaleCls  = stale && !isDead ? 'bg-destructive/5' : '';
                const isExpanded = expandedId === lead.id;
                return (
                  <Fragment key={lead.id}>
                  <tr
                    className={`border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer ${rowStaleCls} ${rowDeadCls}`}>
                    <td className="pl-4 pr-1 py-4" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="accent-primary" checked={selectedIds.has(lead.id)} onChange={() => toggleSelect(lead.id)} />
                    </td>
                    <td onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : lead.id); }}>
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </td>
                    <td className={`px-3 py-4 text-muted-foreground whitespace-nowrap ${stale && !isDead ? 'text-destructive font-medium' : ''}`} onClick={() => navigate(`${portalBase}/crm/${lead.id}`)}>
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className={`px-3 py-4 font-medium ${stale && !isDead ? 'text-destructive' : ''}`} onClick={() => navigate(`${portalBase}/crm/${lead.id}`)} title={lead.full_name || ''}>
                      <div className="truncate max-w-[160px]">{lead.full_name}</div>
                      {Array.isArray(lead.tags) && lead.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {lead.tags.map((tag: string) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-normal">{tag}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-4 text-muted-foreground" onClick={() => navigate(`${portalBase}/crm/${lead.id}`)} title={getLeadPurpose(lead) || ''}><div className="truncate max-w-[160px]">{getLeadPurpose(lead) || '—'}</div></td>
                    <td className="px-3 py-4 no-underline whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {perm.canEdit ? (
                        <select
                          value={lead.status || 'New'}
                          onChange={(e) => statusMut.mutate({ id: lead.id, status: e.target.value })}
                          disabled={statusMut.isPending}
                          className={`${statusBadgeCls} cursor-pointer border-0 outline-none focus:ring-2 focus:ring-primary/50 rounded-full text-xs font-medium no-underline`}
                          title="Change status"
                        >
                          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className={statusBadgeCls}>{lead.status}</span>
                      )}
                    </td>
                    <td className={`px-3 py-4 whitespace-nowrap ${followupCls}`} onClick={() => navigate(`${portalBase}/crm/${lead.id}`)}>
                      {lead.next_followup
                        ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatFollowup(lead.next_followup)}
                            {fb.bucket === 0 && <span className="ml-1 text-[10px] uppercase tracking-wide">Overdue</span>}
                            {fb.bucket === 1 && <span className="ml-1 text-[10px] uppercase tracking-wide">Today</span>}
                          </span>
                        )
                        : '—'}
                    </td>
                    <td className="px-3 py-4 text-muted-foreground" onClick={() => navigate(`${portalBase}/crm/${lead.id}`)} title={resolveAddedBy(lead) || ''}><div className="truncate max-w-[140px]">{resolveAddedBy(lead) || '—'}</div></td>
                    <td className="px-3 py-4 text-muted-foreground" onClick={() => navigate(`${portalBase}/crm/${lead.id}`)} title={resolveAssignedTo(lead) || ''}><div className="truncate max-w-[140px]">{resolveAssignedTo(lead) || '—'}</div></td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {perm.canEdit && lead.status !== 'Closed Won' && (
                          <button onClick={(e) => { e.stopPropagation(); setShowConvert(lead); }} className="p-1.5 rounded-md hover:bg-success/10 text-muted-foreground hover:text-success transition-colors" title="Convert to Client">
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}
                        {perm.canEdit && (
                          <button onClick={(e) => { e.stopPropagation(); openEdit(lead); }} className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {perm.canDelete && (
                          <button onClick={(e) => { e.stopPropagation(); setShowDelete(lead.id); }} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-border/50 bg-secondary/30">
                      <td colSpan={8} className="px-8 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
                          <div>
                            <div className="text-muted-foreground uppercase tracking-wider font-semibold mb-2">Contact</div>
                            <div className="space-y-1 text-foreground/90">
                              <div>{lead.email || '—'}</div>
                              <div>{lead.phone || '—'}</div>
                              <div>{getLeadCountry(lead) || '—'}</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground uppercase tracking-wider font-semibold mb-2">Assignment</div>
                            <div className="space-y-1 text-foreground/90">
                              <div>Added by: {resolveAddedBy(lead) || '—'}</div>
                              <div>Assigned to: {resolveAssignedTo(lead) || '—'}</div>
                              <div>Source: {lead.lead_source || '—'}</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground uppercase tracking-wider font-semibold mb-2">Activity</div>
                            <div className="space-y-1.5 text-foreground/90">
                              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />Lead created — {lead.created_at ? new Date(lead.created_at).toLocaleString() : '—'}</div>
                              {lead.next_followup && (
                                <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${fb.bucket === 0 ? 'bg-destructive' : 'bg-info'}`} />Follow-up scheduled — {formatFollowup(lead.next_followup)}</div>
                              )}
                              {lead.notes && <div className="text-muted-foreground italic mt-1">"{lead.notes}"</div>}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
              {leadsArr.length === 0 && !isLoading && (
                <tr><td colSpan={8} className="p-12 text-center">
                  <div className="text-muted-foreground text-sm mb-3">No leads found</div>
                  {perm.canCreate && <button onClick={() => setShowCreate(true)} className="text-sm text-primary hover:underline">Create your first lead →</button>}
                </td></tr>
              )}
              {hasNextPage && leadsArr.length > 0 && (
                <tr><td colSpan={8} className="p-3 text-center border-t border-border/50">
                  <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                    className="text-xs text-primary hover:underline disabled:opacity-50">
                    {isFetchingNextPage ? 'Loading more leads…' : `Load more (${leadsArr.length} loaded)`}
                  </button>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid View */}
      {view === 'grid' && (
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => <div key={i} className="glass-card p-4 h-32 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {leadsArr.map((lead: any) => {
                const stale = isStale(lead);
                const isDead = (lead.status || '').toLowerCase() === 'dead';
                const statusBadgeCls =
                  lead.status === 'Closed Won'  ? 'badge-success'
                  : lead.status === 'Closed Lost' || isDead ? 'badge-danger'
                  : 'badge-info';
                const fb = followupBucket(lead);
                return (
                  <div key={lead.id} onClick={() => navigate(`${portalBase}/crm/${lead.id}`)}
                    className={`glass-card-hover p-4 space-y-2 cursor-pointer relative ${stale && !isDead ? 'border-destructive/50 bg-destructive/5' : ''} ${isDead ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <input type="checkbox" className="accent-primary mt-0.5" checked={selectedIds.has(lead.id)}
                        onClick={(e) => e.stopPropagation()} onChange={() => toggleSelect(lead.id)} />
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm truncate ${stale && !isDead ? 'text-destructive' : ''}`}>{lead.full_name}</div>
                        {lead.email && <div className="text-xs text-muted-foreground truncate">{lead.email}</div>}
                      </div>
                      <span className={`${statusBadgeCls} flex-shrink-0`}>{lead.status}</span>
                    </div>
                    {getLeadPurpose(lead) && <div className="text-xs text-muted-foreground">{getLeadPurpose(lead)}</div>}
                    {getLeadCountry(lead) && <div className="text-xs text-muted-foreground">{getLeadCountry(lead)}</div>}
                    {Array.isArray(lead.tags) && lead.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {lead.tags.map((tag: string) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">{tag}</span>
                        ))}
                      </div>
                    )}
                    {lead.next_followup && (
                      <div className={`text-[10px] flex items-center gap-1 ${fb.bucket === 0 ? 'text-destructive font-medium' : fb.bucket === 1 ? 'text-amber-500 font-medium' : 'text-muted-foreground'}`}>
                        <Calendar className="h-3 w-3" />{formatFollowup(lead.next_followup)}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                      {resolveAssignedTo(lead) && <span className="truncate">→ {resolveAssignedTo(lead)}</span>}
                      {lead.created_at && <span className="flex-shrink-0">{new Date(lead.created_at).toLocaleDateString()}</span>}
                    </div>
                    <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                      {perm.canEdit && lead.status !== 'Closed Won' && (
                        <button onClick={() => setShowConvert(lead)} className="p-1 rounded hover:bg-success/10 text-muted-foreground hover:text-success transition-colors" title="Convert to Client"><UserCheck className="h-3.5 w-3.5" /></button>
                      )}
                      {perm.canEdit && (
                        <button onClick={() => openEdit(lead)} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                      )}
                      {perm.canDelete && (
                        <button onClick={() => setShowDelete(lead.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {leadsArr.length === 0 && !isLoading && (
            <div className="glass-card p-12 text-center">
              <div className="text-muted-foreground text-sm mb-3">No leads found</div>
              {perm.canCreate && <button onClick={() => setShowCreate(true)} className="text-sm text-primary hover:underline">Create your first lead →</button>}
            </div>
          )}
          {hasNextPage && leadsArr.length > 0 && (
            <div className="text-center pt-4">
              <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                className="text-xs text-primary hover:underline disabled:opacity-50">
                {isFetchingNextPage ? 'Loading more leads…' : `Load more (${leadsArr.length} loaded)`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating bulk-action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 glass-card px-4 py-2.5 flex items-center gap-3 shadow-lg animate-slide-up">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="w-px h-5 bg-border" />
          <button onClick={exportSelected} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          {perm.canDelete && (
            <button onClick={() => setShowBulkDelete(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <button onClick={() => setSelectedIds(new Set())} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors" title="Clear selection">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {showBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold">Delete {selectedIds.size} Lead{selectedIds.size === 1 ? '' : 's'}</h2>
            <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowBulkDelete(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={bulkDelete} disabled={bulkDeleting} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {bulkDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Lead Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-2xl p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Lead</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Full Name *" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} />
              <input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
              <input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
              <SearchableCountrySelect value={form.country} onChange={v => setForm(f => ({ ...f, country: v }))} className={inputCls} />

              {/* Purpose with add custom */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <select value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} className={`flex-1 ${inputCls}`}>
                    <option value="">Select Purpose</option>
                    {allPurposes.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={() => setShowAddPurpose(!showAddPurpose)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground" title="Add custom purpose"><PlusCircle className="h-4 w-4" /></button>
                </div>
                {showAddPurpose && (
                  <div className="flex gap-1">
                    <input placeholder="New purpose..." value={newPurposeInput} onChange={e => setNewPurposeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddPurpose()} className={`flex-1 ${inputCls} text-xs`} />
                    <button onClick={handleAddPurpose} className="px-2 py-1 rounded-lg bg-primary text-primary-foreground text-xs">Add</button>
                  </div>
                )}
              </div>

              {/* Status with add custom */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={`flex-1 ${inputCls}`}>
                    {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setShowAddStatus(!showAddStatus)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground" title="Add custom status"><PlusCircle className="h-4 w-4" /></button>
                </div>
                {showAddStatus && (
                  <div className="flex gap-1">
                    <input placeholder="New status..." value={newStatusInput} onChange={e => setNewStatusInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddStatus()} className={`flex-1 ${inputCls} text-xs`} />
                    <button onClick={handleAddStatus} className="px-2 py-1 rounded-lg bg-primary text-primary-foreground text-xs">Add</button>
                  </div>
                )}
              </div>

              {/* Added By (presales person) */}
              <select value={form.added_by} onChange={e => setForm(f => ({ ...f, added_by: e.target.value }))} className={inputCls}>
                <option value="">Added By (Pre Sales)</option>
                {usersArr.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}{u.role ? ` (${u.role})` : ''}</option>)}
              </select>

              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className={inputCls}>
                <option value="">Assign To (Sales Manager)</option>
                {usersArr.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}{u.role ? ` (${u.role})` : ''}</option>)}
              </select>

              <input
                placeholder="Source (e.g. Referral, LinkedIn, Trade show)"
                value={form.lead_source}
                onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))}
                className={inputCls}
              />
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-muted-foreground">Next Follow-up</label>
                <input
                  type="datetime-local"
                  value={form.next_followup}
                  onChange={e => setForm(f => ({ ...f, next_followup: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={`w-full ${inputCls} resize-none`} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.full_name} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Create Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-2xl p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Lead</h2>
              <button onClick={() => setShowEdit(null)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Full Name *" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} />
              <input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
              <input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
              <SearchableCountrySelect value={form.country} onChange={v => setForm(f => ({ ...f, country: v }))} className={inputCls} />
              <select value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} className={inputCls}>
                <option value="">Select Purpose</option>
                {allPurposes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={form.added_by} onChange={e => setForm(f => ({ ...f, added_by: e.target.value }))} className={inputCls}>
                <option value="">Added By (Pre Sales)</option>
                {usersArr.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}{u.role ? ` (${u.role})` : ''}</option>)}
              </select>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className={inputCls}>
                <option value="">Assign To (Sales Manager)</option>
                {usersArr.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}{u.role ? ` (${u.role})` : ''}</option>)}
              </select>

              <input
                placeholder="Source (e.g. Referral, LinkedIn, Trade show)"
                value={form.lead_source}
                onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))}
                className={inputCls}
              />
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-muted-foreground">Next Follow-up</label>
                <input
                  type="datetime-local"
                  value={form.next_followup}
                  onChange={e => setForm(f => ({ ...f, next_followup: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={`w-full ${inputCls} resize-none`} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowEdit(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => editMut.mutate({ id: showEdit.id, data: form })} disabled={editMut.isPending || !form.full_name} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {editMut.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold">Delete Lead</h2>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this lead? This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDelete(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => deleteMut.mutate(showDelete)} disabled={deleteMut.isPending} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConvert && (
        <ConvertLeadModal lead={showConvert} onClose={() => setShowConvert(null)} />
      )}

      {/* Manage Statuses Modal */}
      {showManageStatuses && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Manage Statuses</h2>
              <button onClick={() => setShowManageStatuses(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {allStatuses.map(s => {
                const isDefault = defaultStatuses.includes(s);
                return (
                  <div key={s} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-secondary/50 group">
                    <span className={`text-sm ${isDefault ? 'text-muted-foreground' : ''}`}>{s}</span>
                    {isDefault
                      ? <span className="text-[10px] text-muted-foreground/50">default</span>
                      : <button
                          onClick={async () => { await removeStatus(s); toast.success(`Status "${s}" removed`); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-destructive transition-all"
                          title="Delete status"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    }
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Add new status</p>
              <div className="flex gap-2">
                <input
                  placeholder="e.g. Follow Up, On Hold..."
                  value={newStatusInput}
                  onChange={e => setNewStatusInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { handleAddStatus(); } }}
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  onClick={() => { handleAddStatus(); }}
                  disabled={!newStatusInput.trim()}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
