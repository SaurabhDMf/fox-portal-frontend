import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState, useEffect, useRef } from 'react';
import { useModulePermission } from '@/hooks/usePermission';
import { useCompanyCurrency } from '@/hooks/useCompanyCurrency';
import { Plus, Search, X, Calendar, Trash2, Pencil, CheckCircle2, Repeat } from 'lucide-react';
import toast from 'react-hot-toast';

const inputCls = "px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

const currencies = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'AUD', 'CAD', 'SGD'];

const fmtAmount = (amount: number, currency?: string) => {
  const cur = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency', currency: cur,
      minimumFractionDigits: 0, maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${cur} ${Number(amount).toLocaleString()}`;
  }
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(payment: any): boolean {
  return payment.status === 'Pending' && payment.expected_date && payment.expected_date.slice(0, 10) < todayISO();
}

// Typeahead that finds a lead by name or email using the existing /leads
// search endpoint — the same data source the CRM list search box uses.
function LeadSearchSelect({ value, onChange, disabled }: { value: any; onChange: (lead: any) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['lead-search', debouncedQ],
    queryFn: () => api.get('/leads', { params: { search: debouncedQ, page: 1, limit: 10 } }).then(r => r.data?.data || []),
    enabled: open && debouncedQ.trim().length >= 2,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
        className={`${inputCls} flex items-center justify-between w-full text-left disabled:opacity-60`}>
        <span className={value ? '' : 'text-muted-foreground'}>
          {value ? `${value.full_name}${value.email ? ' · ' + value.email : ''}` : 'Search lead by name or email...'}
        </span>
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
      </button>
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b border-border">
            <input autoFocus placeholder="Type at least 2 characters..." value={q} onChange={e => setQ(e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div className="overflow-y-auto max-h-52">
            {debouncedQ.trim().length < 2 && <div className="px-3 py-4 text-xs text-muted-foreground text-center">Type a name or email to search</div>}
            {debouncedQ.trim().length >= 2 && !isFetching && results.length === 0 && <div className="px-3 py-4 text-xs text-muted-foreground text-center">No leads found</div>}
            {results.map((lead: any) => (
              <button type="button" key={lead.id} onClick={() => { onChange(lead); setOpen(false); setQ(''); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/80 border-b border-border/50 last:border-0">
                <div className="font-medium truncate">{lead.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{lead.email || '—'}{lead.company_name ? ` · ${lead.company_name}` : ''}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const emptyForm = { lead: null as any, payment_type: 'one_time', amount: '', currency: 'USD', expected_date: '', notes: '' };

export default function LeadPayments() {
  const perm = useModulePermission('crm');
  const { companyCurrency } = useCompanyCurrency();
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [showReceive, setShowReceive] = useState<any>(null);
  const [receivedDate, setReceivedDate] = useState(todayISO());

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['lead-payments', search, statusFilter, monthFilter],
    queryFn: () => api.get('/lead-payments', {
      params: {
        search: search || undefined,
        status: statusFilter || undefined,
        month: monthFilter || undefined,
      },
    }).then(r => r.data?.data || []),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['lead-payments'] });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/lead-payments', {
      lead_id: d.lead.id, payment_type: d.payment_type, amount: d.amount,
      currency: d.currency, expected_date: d.expected_date, notes: d.notes || null,
    }).then(r => r.data),
    onSuccess: () => { invalidate(); closeForm(); toast.success('Payment added'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error creating payment'),
  });

  const editMut = useMutation({
    mutationFn: (d: { id: string; data: typeof form }) => api.put(`/lead-payments/${d.id}`, {
      payment_type: d.data.payment_type, amount: d.data.amount,
      currency: d.data.currency, expected_date: d.data.expected_date, notes: d.data.notes || null,
    }).then(r => r.data),
    onSuccess: () => { invalidate(); closeForm(); toast.success('Payment updated'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error updating payment'),
  });

  const receiveMut = useMutation({
    mutationFn: ({ id, received_date }: { id: string; received_date: string }) =>
      api.post(`/lead-payments/${id}/receive`, { received_date }).then(r => r.data),
    onSuccess: (res: any) => {
      invalidate();
      setShowReceive(null);
      toast.success(res?.next_payment ? 'Payment received — next month scheduled' : 'Payment marked received');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error updating payment'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/lead-payments/${id}`).then(() => id),
    onSuccess: () => { invalidate(); setShowDelete(null); toast.success('Payment deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error deleting payment'),
  });

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm({ ...emptyForm, currency: companyCurrency }); };

  const openCreate = () => { setForm({ ...emptyForm, currency: companyCurrency }); setEditingId(null); setShowForm(true); };

  const openEdit = (p: any) => {
    setForm({
      lead: { id: p.lead_id, full_name: p.lead_name, email: p.lead_email, company_name: p.lead_company },
      payment_type: p.payment_type, amount: String(p.amount), currency: p.currency,
      expected_date: (p.expected_date || '').slice(0, 10), notes: p.notes || '',
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const submitForm = () => {
    if (!form.lead || !form.amount || !form.expected_date) return;
    if (editingId) editMut.mutate({ id: editingId, data: form });
    else createMut.mutate(form);
  };

  const statusBadgeCls = (p: any) => {
    if (p.status === 'Received') return 'badge-success';
    if (p.status === 'Cancelled') return 'badge-danger';
    if (isOverdue(p)) return 'badge-danger';
    return 'badge-info';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Upcoming Payments</h1><p className="page-subtitle">Track expected payments from leads, one-time or recurring monthly</p></div>
        {perm.canCreate && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> New Payment
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search by lead name or email..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputCls}>
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Received">Received</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className={`${inputCls} w-40`} title="Filter by expected month" />
          {monthFilter && <button onClick={() => setMonthFilter('')} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="px-3 py-4">Lead</th>
              <th className="px-3 py-4 whitespace-nowrap">Type</th>
              <th className="px-3 py-4 whitespace-nowrap">Amount</th>
              <th className="px-3 py-4 whitespace-nowrap">Expected Date</th>
              <th className="px-3 py-4 whitespace-nowrap">Status</th>
              <th className="px-3 py-4 whitespace-nowrap">Received Date</th>
              <th className="px-3 py-4">Notes</th>
              <th className="px-3 py-4 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? [...Array(4)].map((_, i) => <tr key={i}><td colSpan={8} className="p-4"><div className="h-4 bg-secondary rounded animate-pulse" /></td></tr>) :
            payments.map((p: any) => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                <td className="px-3 py-4">
                  <div className="font-medium truncate max-w-[180px]" title={p.lead_name}>{p.lead_name}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[180px]" title={p.lead_email || ''}>{p.lead_email || '—'}</div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  {p.payment_type === 'recurring'
                    ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Repeat className="h-3 w-3" /> Recurring</span>
                    : <span className="text-xs text-muted-foreground">One-time</span>}
                </td>
                <td className="px-3 py-4 font-medium whitespace-nowrap">{fmtAmount(Number(p.amount), p.currency)}</td>
                <td className={`px-3 py-4 whitespace-nowrap ${isOverdue(p) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  {p.expected_date ? new Date(p.expected_date).toLocaleDateString() : '—'}
                  {isOverdue(p) && <span className="ml-1 text-[10px] uppercase tracking-wide">Overdue</span>}
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <span className={statusBadgeCls(p)}>{isOverdue(p) ? 'Overdue' : p.status}</span>
                </td>
                <td className="px-3 py-4 text-muted-foreground whitespace-nowrap">{p.received_date ? new Date(p.received_date).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-4 text-muted-foreground"><div className="truncate max-w-[200px]" title={p.notes || ''}>{p.notes || '—'}</div></td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {perm.canEdit && p.status === 'Pending' && (
                      <button onClick={() => { setShowReceive(p); setReceivedDate(todayISO()); }} className="p-1.5 rounded-md hover:bg-success/10 text-muted-foreground hover:text-success transition-colors" title="Mark as Received">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                    {perm.canEdit && (
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {perm.canDelete && (
                      <button onClick={() => setShowDelete(p.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {payments.length === 0 && !isLoading && (
              <tr><td colSpan={8} className="p-12 text-center">
                <div className="text-muted-foreground text-sm mb-3">No upcoming payments found</div>
                {perm.canCreate && <button onClick={openCreate} className="text-sm text-primary hover:underline">Add your first payment →</button>}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Payment' : 'New Upcoming Payment'}</h2>
              <button onClick={closeForm} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Lead *</label>
              <LeadSearchSelect value={form.lead} onChange={lead => setForm(f => ({ ...f, lead }))} disabled={!!editingId} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Payment Type</label>
                <select value={form.payment_type} onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))} className={`w-full ${inputCls}`}>
                  <option value="one_time">One-time</option>
                  <option value="recurring">Recurring (Monthly)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Expected Payment Date *</label>
                <input type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} className={`w-full ${inputCls}`} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Amount *</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={`w-full ${inputCls}`} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Currency</label>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className={`w-full ${inputCls}`}>
                  {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Notes</label>
              <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={`w-full ${inputCls} resize-none`} />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={closeForm} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button
                onClick={submitForm}
                disabled={createMut.isPending || editMut.isPending || !form.lead || !form.amount || !form.expected_date}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {createMut.isPending || editMut.isPending ? 'Saving...' : editingId ? 'Save Changes' : 'Add Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Received Modal */}
      {showReceive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Mark Payment Received</h2>
              <button onClick={() => setShowReceive(null)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground">
              {fmtAmount(Number(showReceive.amount), showReceive.currency)} from <span className="font-medium text-foreground">{showReceive.lead_name}</span>
              {showReceive.payment_type === 'recurring' && <> — next month's payment will be scheduled automatically.</>}
            </p>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Date Payment Was Made *</label>
              <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} className={`w-full ${inputCls}`} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReceive(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button
                onClick={() => receiveMut.mutate({ id: showReceive.id, received_date: receivedDate })}
                disabled={receiveMut.isPending || !receivedDate}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {receiveMut.isPending ? 'Saving...' : 'Confirm Received'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold">Delete Payment</h2>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this payment entry? This action cannot be undone.</p>
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
