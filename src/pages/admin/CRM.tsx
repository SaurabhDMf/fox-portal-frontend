import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useModulePermission } from '@/hooks/usePermission';
import { Plus, Search, List, LayoutGrid, X, Calendar, Trash2, PlusCircle, ChevronDown, Check } from 'lucide-react';
import toast from 'react-hot-toast';

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

  return { allStatuses, allPurposes, addStatus, addPurpose };
}

export default function CRM() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const perm = useModulePermission('crm');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [newStatusInput, setNewStatusInput] = useState('');
  const [newPurposeInput, setNewPurposeInput] = useState('');
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [showAddPurpose, setShowAddPurpose] = useState(false);
  const qc = useQueryClient();

  const { allStatuses, allPurposes, addStatus, addPurpose } = useCustomFields(user?.id);

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', country: '', purpose: '',
    status: 'New', assigned_to: '', added_by: '', notes: '',
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', search, statusFilter, countryFilter, assignedFilter, dateFrom, dateTo],
    queryFn: () => api.get('/leads', {
      params: {
        search: search || undefined,
        status: statusFilter || undefined,
        country: countryFilter || undefined,
        assigned_to: assignedFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      },
    }).then(r => {
      console.log('[CRM] GET /leads raw response:', r.data);
      const result = r.data?.leads || r.data?.data || r.data || [];
      console.log('[CRM] Parsed leads array:', result, 'isArray:', Array.isArray(result));
      return result;
    }),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users').then(r => r.data?.users || r.data || []),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/leads', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setShowCreate(false);
      setForm({ full_name: '', email: '', phone: '', country: '', purpose: '', status: 'New', assigned_to: '', added_by: '', notes: '' });
      toast.success('Lead created successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.response?.data?.error || 'Error creating lead'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setShowDelete(null);
      toast.success('Lead deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error deleting lead'),
  });

  const leadsArr = Array.isArray(leads) ? leads : [];
  const usersArr = Array.isArray(users) ? users : [];

  const inputCls = "px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  const handleAddStatus = () => {
    if (newStatusInput.trim()) {
      addStatus(newStatusInput.trim());
      setNewStatusInput('');
      setShowAddStatus(false);
      toast.success(`Status "${newStatusInput.trim()}" added`);
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
        <div><h1 className="page-title">Sales CRM</h1><p className="page-subtitle">Manage your sales pipeline</p></div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary'} transition-colors`} title="List View"><List className="h-4 w-4" /></button>
            <button onClick={() => setView('kanban')} className={`p-2 ${view === 'kanban' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary'} transition-colors`} title="Kanban View"><LayoutGrid className="h-4 w-4" /></button>
          </div>
          {perm.canCreate && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
              <Plus className="h-4 w-4" /> New Lead
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
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
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={`${inputCls} w-36`} title="From Date" />
          <span className="text-muted-foreground text-xs">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={`${inputCls} w-36`} title="To Date" />
        </div>
      </div>

      {/* List View */}
      {view === 'list' && (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-4">Created</th>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Country</th>
                <th className="p-4">Purpose</th>
                <th className="p-4">Status</th>
                <th className="p-4">Added By</th>
                <th className="p-4">Assigned To</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={10} className="p-4"><div className="h-4 bg-secondary rounded animate-pulse" /></td></tr>) :
              leadsArr.map((lead: any) => {
                const stale = isStale(lead);
                return (
                  <tr key={lead.id}
                    className={`border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer ${stale ? 'bg-destructive/5' : ''}`}>
                    <td className={`p-4 text-muted-foreground ${stale ? 'text-destructive font-medium' : ''}`} onClick={() => navigate(`/admin/crm/${lead.id}`)}>
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className={`p-4 font-medium ${stale ? 'text-destructive' : ''}`} onClick={() => navigate(`/admin/crm/${lead.id}`)}>{lead.full_name}</td>
                    <td className="p-4 text-muted-foreground" onClick={() => navigate(`/admin/crm/${lead.id}`)}>{lead.email || '—'}</td>
                    <td className="p-4 text-muted-foreground" onClick={() => navigate(`/admin/crm/${lead.id}`)}>{lead.phone || '—'}</td>
                    <td className="p-4 text-muted-foreground" onClick={() => navigate(`/admin/crm/${lead.id}`)}>{lead.country || '—'}</td>
                    <td className="p-4 text-muted-foreground" onClick={() => navigate(`/admin/crm/${lead.id}`)}>{lead.purpose || '—'}</td>
                    <td className="p-4" onClick={() => navigate(`/admin/crm/${lead.id}`)}>
                      <span className={lead.status === 'Closed Won' ? 'badge-success' : lead.status === 'Closed Lost' ? 'badge-danger' : 'badge-info'}>{lead.status}</span>
                    </td>
                    <td className="p-4 text-muted-foreground" onClick={() => navigate(`/admin/crm/${lead.id}`)}>{lead.lead_by_name || lead.added_by_name || '—'}</td>
                    <td className="p-4 text-muted-foreground" onClick={() => navigate(`/admin/crm/${lead.id}`)}>{lead.assigned_to_name || '—'}</td>
                    <td className="p-4">
                      <button onClick={(e) => { e.stopPropagation(); setShowDelete(lead.id); }} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {leadsArr.length === 0 && !isLoading && (
                <tr><td colSpan={10} className="p-12 text-center">
                  <div className="text-muted-foreground text-sm mb-3">No leads found</div>
                  {perm.canCreate && <button onClick={() => setShowCreate(true)} className="text-sm text-primary hover:underline">Create your first lead →</button>}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
          {allStatuses.map(status => {
            const col = leadsArr.filter((l: any) => l.status === status);
            return (
              <div key={status} className="min-w-[280px] flex-shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{status}</h3>
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((lead: any) => {
                    const stale = isStale(lead);
                    return (
                      <div key={lead.id} onClick={() => navigate(`/admin/crm/${lead.id}`)}
                        className={`glass-card-hover p-3 space-y-2 cursor-pointer ${stale ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div className={`font-medium text-sm ${stale ? 'text-destructive' : ''}`}>{lead.full_name}</div>
                        </div>
                        {lead.purpose && <div className="text-xs text-muted-foreground">{lead.purpose}</div>}
                        {lead.country && <div className="text-xs text-muted-foreground">{lead.country}</div>}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          {lead.assigned_to_name && <span>→ {lead.assigned_to_name}</span>}
                          {lead.created_at && <span>{new Date(lead.created_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {col.length === 0 && <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">No leads</div>}
                </div>
              </div>
            );
          })}
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
                <option value="">Added By (Presales)</option>
                {usersArr.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>

              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className={inputCls}>
                <option value="">Assign To</option>
                {usersArr.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
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
    </div>
  );
}
