import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState, useRef, useEffect } from 'react';
import { Plus, Send, DollarSign, CheckCircle, Clock, AlertTriangle, FileText, Upload, Download, Trash2, Link2, MoreHorizontal, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import StatCard from '@/components/ui/StatCard';
import { useModulePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/stores/authStore';
import { useCompanyCurrency } from '@/hooks/useCompanyCurrency';
import { confirmAction } from '@/lib/confirmDialog';

import InvoiceCreateModal from '@/components/invoicing/InvoiceCreateModal';
import InvoiceUploadModal from '@/components/invoicing/InvoiceUploadModal';
import InvoicePrintView from '@/components/invoicing/InvoicePrintView';
import SendInvoiceModal from '@/components/invoicing/SendInvoiceModal';
import ShareInvoiceModal from '@/components/invoicing/ShareInvoiceModal';

const statusTabs = ['All', 'Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];

type Period = 'all' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'last_year' | 'custom';

/** Return [from, toExclusive) date range for the chosen period, or null for "all". */
function periodRange(p: Period, customFrom?: string, customTo?: string): [Date, Date] | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (p) {
    case 'all':         return null;
    case 'this_month':  return [new Date(y, m, 1), new Date(y, m + 1, 1)];
    case 'last_month':  return [new Date(y, m - 1, 1), new Date(y, m, 1)];
    case 'this_quarter': { const q = Math.floor(m / 3); return [new Date(y, q * 3, 1), new Date(y, q * 3 + 3, 1)]; }
    case 'this_year':   return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
    case 'last_year':   return [new Date(y - 1, 0, 1), new Date(y, 0, 1)];
    case 'custom': {
      if (!customFrom && !customTo) return null;
      const from = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(2000, 0, 1);
      // End-of-day for the "to" date so inclusive
      const to = customTo ? new Date(new Date(customTo + 'T00:00:00').getTime() + 86400000) : new Date(2100, 0, 1);
      return [from, to];
    }
  }
}

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

const API_BASE = import.meta.env.VITE_API_URL || 'https://foxportal.in/api/v1';

function buildPdfUrl(id: string) {
  return `${API_BASE}/invoices/${id}/pdf`;
}

async function downloadPdf(inv: any) {
  try {
    const res = await api.get(`/invoices/${inv.id}/pdf`, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.invoice_number || inv.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('No PDF available for this invoice');
  }
}

const fmtNum = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function Invoicing() {
  const perm = useModulePermission('invoicing');
  const role = useAuthStore(s => s.user?.role);
  const userId = useAuthStore(s => s.user?.id);
  const { currencySymbol, companyCurrency } = useCompanyCurrency();
  const isAdmin = role === 'admin' || role === 'super_admin';
  const canDelete = (inv: any) =>
    isAdmin || (inv.status !== 'Paid' && inv.status !== 'Partially Paid');
  const [tab, setTab] = useState('All');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'status' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [period, setPeriod] = useState<Period>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showPrint, setShowPrint] = useState<any>(null);
  const [showSend, setShowSend] = useState<any>(null);
  const [showShare, setShowShare] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!openMenuId) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMenuId]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: (_res, id) => {
      qc.setQueryData(['invoices', tab], (old: any) => {
        if (!old) return old;
        const list = old?.invoices || old?.data || (Array.isArray(old) ? old : []);
        const filtered = (Array.isArray(list) ? list : []).filter((i: any) => i.id !== id);
        if (Array.isArray(old)) return filtered;
        if (old?.invoices) return { ...old, invoices: filtered };
        if (old?.data) return { ...old, data: filtered };
        return old;
      });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setShowPrint(null);
      toast.success('Invoice deleted');
    },
    onError: (e: any) => {
      if (e?.response?.status === 403) toast.error(e?.response?.data?.error || 'Only admins can delete paid invoices');
      else toast.error(e?.response?.data?.message || 'Failed to delete invoice');
    },
  });

  const handleDelete = async (inv: any) => {
    const number = inv.invoice_number || `INV-${inv.id?.slice(0, 6)}`;
    const ok = await confirmAction({
      title: 'Delete invoice',
      description: `Permanently delete invoice ${number}? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deleteMut.mutate(inv.id);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', tab],
    queryFn: () => api.get('/invoices', { params: { status: tab === 'All' ? undefined : tab } }).then(r => r.data),
  });

  // Current-month target + received for this user (matches MyDashboard)
  const currentDate = new Date();
  const { data: targetData } = useQuery({
    queryKey: ['invoicing-target', userId, currentDate.getFullYear(), currentDate.getMonth() + 1],
    queryFn: () => api.get('/performance-targets', {
      params: { user_id: userId, year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 },
    }).then(r => r.data),
    enabled: !!userId,
  });

  const rawInvoices = data?.invoices || data?.data || (Array.isArray(data) ? data : []);
  const allInvoices: any[] = Array.isArray(rawInvoices) ? rawInvoices : [];

  // Filter by reporting period. Paid invoices are attributed to their
  // payment month (paid_at); unpaid ones to their issue month. So a
  // June-issued invoice paid in July belongs to July, both in the listing
  // and in the stat tiles.
  const range = periodRange(period, customFrom, customTo);
  const filteredInvoices = range
    ? allInvoices.filter((inv: any) => {
        const d = new Date(inv.paid_at || inv.issue_date || inv.created_at);
        if (isNaN(d.getTime())) return false;
        return d >= range[0] && d < range[1];
      })
    : allInvoices;

  // Sort
  const STATUS_ORDER: Record<string, number> = {
    Overdue: 0, Sent: 1, 'Partially Paid': 2, Viewed: 3, Draft: 4, Paid: 5, Cancelled: 6,
  };
  const invoices = [...filteredInvoices].sort((a: any, b: any) => {
    if (sortBy === 'status') {
      return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    }
    if (sortBy === 'amount_desc' || sortBy === 'amount_asc') {
      const av = Number(a.total_amount || a.amount || 0);
      const bv = Number(b.total_amount || b.amount || 0);
      return sortBy === 'amount_desc' ? bv - av : av - bv;
    }
    // date_desc / date_asc
    const at = new Date(a.issue_date || a.created_at || 0).getTime();
    const bt = new Date(b.issue_date || b.created_at || 0).getTime();
    return sortBy === 'date_asc' ? at - bt : bt - at;
  });

  // Recompute the 4 stat tiles for the filtered period when one is selected;
  // otherwise use the API's full-period totals. The filter above already
  // attributes each invoice to a single reporting month (paid_at for paid
  // invoices, issue_date otherwise), so summing here is straightforward.
  const stats = range
    ? invoices.reduce((acc: any, inv: any) => {
        const total = Number(inv.total_amount || inv.total || inv.amount || 0);
        // Clamp paid at total — a past duplicate-payment bug can leave
        // amount_paid stored higher than the invoice's actual total.
        const paid  = Math.min(Number(inv.amount_paid || 0), total);
        acc.total_billed += total;
        acc.collected   += paid;
        if (inv.status !== 'Paid' && inv.status !== 'Cancelled') {
          acc.outstanding += Math.max(0, total - paid);
        }
        if (inv.status === 'Overdue') acc.overdue += Math.max(0, total - paid);
        return acc;
      }, { total_billed: 0, collected: 0, outstanding: 0, overdue: 0 })
    : (data?.stats || { total_billed: 0, collected: 0, outstanding: 0, overdue: 0 });

  const viewDetail = async (inv: any) => {
    try {
      const { data } = await api.get(`/invoices/${inv.id}`);
      setShowPrint(data);
    } catch {
      setShowPrint(inv);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Invoices</h1><p className="page-subtitle">Manage billing and payments</p></div>
        {perm.canCreate && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/70 active:scale-[0.97] transition-all">
              <Upload className="h-4 w-4" /> Upload PDF
            </button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
              <Plus className="h-4 w-4" /> New Invoice
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Billed" value={Number(stats.total_billed || 0).toLocaleString()} icon={FileText} />
        <StatCard label="Collected" value={Number(stats.collected || 0).toLocaleString()} icon={CheckCircle} iconColor="text-success" />
        <StatCard label="Outstanding" value={Number(stats.outstanding || 0).toLocaleString()} icon={Clock} iconColor="text-warning" />
        <StatCard label="Overdue" value={Number(stats.overdue || 0).toLocaleString()} icon={AlertTriangle} iconColor="text-destructive" />
      </div>

      {/* Monthly Target vs Received — current user, current month */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()} — Target vs Received</h2>
        </div>
        {(() => {
          const t = Number(targetData?.target_value || 0);
          const a = Number(targetData?.actual_sale  || 0);
          const pct = t > 0 ? Math.min(100, (a / t) * 100) : 0;
          const pending = Math.max(0, t - a);
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Target</p>
                <p className="text-xl font-bold mt-1">{fmtNum(t)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Received</p>
                <p className="text-xl font-bold mt-1 text-success">{fmtNum(a)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
                <p className="text-xl font-bold mt-1 text-warning">{fmtNum(pending)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Progress</p>
                <p className="text-xl font-bold mt-1">{pct.toFixed(1)}%</p>
                <div className="w-full bg-secondary h-2 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto">
          {statusTabs.map(s => (
            <button key={s} onClick={() => setTab(s)} className={`text-xs px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${tab === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="text-xs px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none">
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="status">By status</option>
            <option value="amount_desc">Amount: high to low</option>
            <option value="amount_asc">Amount: low to high</option>
          </select>
          <select value={period} onChange={e => setPeriod(e.target.value as Period)}
            className="text-xs px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none">
            <option value="all">All Time</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_year">This Year</option>
            <option value="last_year">Last Year</option>
            <option value="custom">Custom…</option>
          </select>
          {period === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="text-xs px-2 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none" />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="text-xs px-2 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none" />
            </>
          )}
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="px-3 py-4 whitespace-nowrap">Invoice Number</th><th className="px-3 py-4 whitespace-nowrap">Created Date</th><th className="px-3 py-4">Client</th><th className="px-3 py-4 whitespace-nowrap">Due Date</th><th className="px-3 py-4 whitespace-nowrap">Payment Date</th><th className="px-3 py-4 whitespace-nowrap">Amount</th><th className="px-3 py-4">Status</th><th className="px-3 py-4 w-12 whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={8} className="p-4"><div className="h-4 bg-secondary rounded animate-pulse" /></td></tr>) :
            (Array.isArray(invoices) ? invoices : []).map((inv: any) => {
              const clientLabel = inv.client_name || inv.company_name || '—';
              return (
              <tr key={inv.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => viewDetail(inv)}>
                <td className="px-3 py-4 font-medium whitespace-nowrap">{inv.invoice_number || `INV-${inv.id?.slice(0, 6)}`}</td>
                <td className="px-3 py-4 text-muted-foreground whitespace-nowrap">{(inv.issue_date || inv.created_at) ? new Date(inv.issue_date || inv.created_at).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-4 max-w-[180px]" title={clientLabel}><div className="truncate">{clientLabel}</div></td>
                <td className="px-3 py-4 text-muted-foreground whitespace-nowrap">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-4 text-muted-foreground whitespace-nowrap">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-4 font-medium whitespace-nowrap">{fmtAmount(Number(inv.total || inv.total_amount || inv.amount || 0), inv.currency)}</td>
                <td className="p-4">
                  {(() => {
                    const isSavedNotSent = inv.status === 'Sent' && !inv.sent_at;
                    const label = isSavedNotSent ? 'Saved' : inv.status;
                    const cls = inv.status === 'Paid' ? 'badge-success'
                      : inv.status === 'Overdue' ? 'badge-danger'
                      : isSavedNotSent ? 'badge-neutral'
                      : inv.status === 'Sent' ? 'badge-info'
                      : inv.status === 'Cancelled' ? 'badge-neutral'
                      : 'badge-warning';
                    return <span className={cls}>{label}</span>;
                  })()}
                </td>
                <td className="p-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    {inv.source === 'uploaded' ? (
                      <span title="Uploaded" className="text-info"><Upload className="h-4 w-4" /></span>
                    ) : (
                      <span title="Generated" className="text-muted-foreground"><FileText className="h-4 w-4" /></span>
                    )}
                    <div className="relative" ref={openMenuId === inv.id ? menuRef : undefined}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {openMenuId === inv.id && (
                      <div className="absolute right-0 top-8 z-50 min-w-[150px] bg-popover border border-border rounded-lg shadow-lg py-1 text-sm">
                        <button
                          onClick={() => { setOpenMenuId(null); viewDetail(inv); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary text-left"
                        >
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" /> View
                        </button>
                        {inv.has_pdf && (
                          <button
                            onClick={() => { setOpenMenuId(null); downloadPdf(inv); }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary text-left"
                          >
                            <Download className="h-3.5 w-3.5 text-muted-foreground" /> Download PDF
                          </button>
                        )}
                        {(inv.status === 'Draft' || inv.status === 'Sent' || inv.status === 'Overdue') && (
                          <button
                            onClick={() => { setOpenMenuId(null); setShowSend(inv); }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary text-left text-primary"
                          >
                            <Send className="h-3.5 w-3.5" /> Send Invoice
                          </button>
                        )}
                        <button
                          onClick={() => { setOpenMenuId(null); setShowShare(inv); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary text-left"
                        >
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground" /> Share Link
                        </button>
                        {canDelete(inv) && (
                          <>
                            <div className="my-1 border-t border-border" />
                            <button
                              onClick={() => { setOpenMenuId(null); handleDelete(inv); }}
                              disabled={deleteMut.isPending}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary text-left text-destructive disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <InvoiceCreateModal onClose={() => setShowCreate(false)} />}
      {showUpload && <InvoiceUploadModal onClose={() => setShowUpload(false)} />}
      {showPrint && <InvoicePrintView invoice={showPrint} onClose={() => setShowPrint(null)} onDelete={canDelete(showPrint) ? () => handleDelete(showPrint) : undefined} />}
      {showSend && <SendInvoiceModal invoice={showSend} onClose={() => setShowSend(null)} />}
      {showShare && <ShareInvoiceModal invoiceId={showShare.id} invoiceNumber={showShare.invoice_number} onClose={() => setShowShare(null)} />}
    </div>
  );
}
