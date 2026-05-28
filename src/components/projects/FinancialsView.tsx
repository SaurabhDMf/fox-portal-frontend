import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Pencil, Save, X, Plus, Link as LinkIcon, Unlink, IndianRupee, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react';

const fmtINR = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

interface Props {
  projectId: string;
}

export default function FinancialsView({ projectId }: Props) {
  const qc = useQueryClient();
  const [editCost, setEditCost] = useState(false);
  const [costVal, setCostVal] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [pickInvoice, setPickInvoice] = useState('');

  const { data: financials, isLoading } = useQuery({
    queryKey: ['project-financials', projectId],
    queryFn: () =>
      api.get(`/projects/${projectId}/financials`).then(r => r.data?.data ?? r.data ?? {}),
    enabled: !!projectId,
  });

  const { data: allInvoices = [] } = useQuery({
    queryKey: ['invoices-link-pool'],
    queryFn: () =>
      api.get('/invoices').then(r => {
        const d = r.data;
        return d?.invoices ?? d?.data ?? (Array.isArray(d) ? d : []);
      }),
    enabled: showLink,
  });

  const f = financials || {};
  const linkedInvoices: any[] = Array.isArray(f.invoices) ? f.invoices : [];
  const totalCost = Number(f.total_cost || 0);
  const invoiced = Number(f.invoiced_amount || 0);
  const collected = Number(f.collected_amount || 0);
  const outstanding = Number(f.outstanding_amount || Math.max(0, invoiced - collected));
  const pct = totalCost > 0 ? Math.min(Math.round((invoiced / totalCost) * 100), 100) : 0;

  const available = useMemo(() => {
    const linkedIds = new Set(linkedInvoices.map(li => li.id));
    return (Array.isArray(allInvoices) ? allInvoices : []).filter(
      (inv: any) => inv.status !== 'Cancelled' && !linkedIds.has(inv.id),
    );
  }, [allInvoices, linkedInvoices]);

  const updateCost = useMutation({
    mutationFn: () => api.put(`/projects/${projectId}/cost`, { total_cost: Number(costVal) || 0 }),
    onSuccess: () => {
      toast.success('Budget updated');
      qc.invalidateQueries({ queryKey: ['project-financials', projectId] });
      setEditCost(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.response?.data?.message || 'Update failed'),
  });

  const linkMut = useMutation({
    mutationFn: (invoice_id: string) => api.post(`/projects/${projectId}/invoices`, { invoice_id }),
    onSuccess: () => {
      toast.success('Invoice linked');
      qc.invalidateQueries({ queryKey: ['project-financials', projectId] });
      setShowLink(false);
      setPickInvoice('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.response?.data?.message || 'Link failed'),
  });

  const unlinkMut = useMutation({
    mutationFn: (invId: string) => api.delete(`/projects/${projectId}/invoices/${invId}`),
    onSuccess: () => {
      toast.success('Invoice unlinked');
      qc.invalidateQueries({ queryKey: ['project-financials', projectId] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.response?.data?.message || 'Unlink failed'),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse bg-muted rounded-xl h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Budget"
          value={editCost ? null : fmtINR(totalCost)}
          icon={IndianRupee}
          accent="text-primary"
          action={
            !editCost ? (
              <button
                onClick={() => { setEditCost(true); setCostVal(String(totalCost || '')); }}
                className="p-1 rounded hover:bg-secondary text-muted-foreground"
                aria-label="Edit budget"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null
          }
        >
          {editCost && (
            <div className="flex items-center gap-1 mt-2">
              <input
                type="number"
                value={costVal}
                onChange={e => setCostVal(e.target.value)}
                className="flex-1 px-2 py-1 rounded bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="0"
              />
              <button
                onClick={() => updateCost.mutate()}
                disabled={updateCost.isPending}
                className="p-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setEditCost(false)}
                className="p-1.5 rounded bg-secondary hover:bg-secondary/80"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </StatCard>
        <StatCard label="Invoiced" value={fmtINR(invoiced)} icon={TrendingUp} accent="text-info" />
        <StatCard label="Collected" value={fmtINR(collected)} icon={CheckCircle} accent="text-success" />
        <StatCard label="Outstanding" value={fmtINR(outstanding)} icon={AlertTriangle} accent="text-destructive" />
      </div>

      {/* Budget utilisation */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium">Budget Utilisation</span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-warning' : 'bg-primary'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {fmtINR(invoiced)} invoiced of {fmtINR(totalCost)} budget
        </p>
      </div>

      {/* Linked Invoices */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Linked Invoices</h3>
          <button
            onClick={() => setShowLink(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> Link Invoice
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Invoice #</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-right px-4 py-3 font-medium">Paid</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Due</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {linkedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                    No invoices linked yet
                  </td>
                </tr>
              ) : (
                linkedInvoices.map((inv: any) => (
                  <tr key={inv.id} className="border-t border-border hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{inv.invoice_number || inv.id?.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-right">{fmtINR(Number(inv.total_amount || inv.total || 0))}</td>
                    <td className="px-4 py-3 text-right text-success">{fmtINR(Number(inv.amount_paid || 0))}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(inv.due_date)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => unlinkMut.mutate(inv.id)}
                        disabled={unlinkMut.isPending}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        <Unlink className="h-3 w-3" /> Unlink
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Link modal */}
      {showLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <LinkIcon className="h-4 w-4" /> Link Invoice
              </h2>
              <button
                onClick={() => { setShowLink(false); setPickInvoice(''); }}
                className="p-1 rounded-md hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Choose invoice</label>
              <select
                value={pickInvoice}
                onChange={e => setPickInvoice(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Select an invoice…</option>
                {available.map((inv: any) => (
                  <option key={inv.id} value={inv.id}>
                    {(inv.invoice_number || inv.id?.slice(0, 8))} — {inv.client_name || inv.company_name || '—'} — {fmtINR(Number(inv.total_amount || inv.total || 0))}
                  </option>
                ))}
              </select>
              {available.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  No available invoices to link.
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowLink(false); setPickInvoice(''); }}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => pickInvoice && linkMut.mutate(pickInvoice)}
                disabled={!pickInvoice || linkMut.isPending}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {linkMut.isPending ? 'Linking…' : 'Link Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'text-primary',
  action,
  children,
}: {
  label: string;
  value: string | null;
  icon: any;
  accent?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <div className="flex items-center gap-1">
          <Icon className={`h-4 w-4 ${accent}`} />
          {action}
        </div>
      </div>
      {value !== null && <p className={`text-xl font-bold ${accent}`}>{value}</p>}
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Paid'
      ? 'bg-success/15 text-success'
      : status === 'Overdue'
      ? 'bg-destructive/15 text-destructive'
      : status === 'Sent'
      ? 'bg-info/15 text-info'
      : status === 'Cancelled'
      ? 'bg-secondary text-muted-foreground'
      : 'bg-warning/15 text-warning';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status || '—'}</span>;
}
