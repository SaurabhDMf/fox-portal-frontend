import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, Pencil, Trash2, XCircle, RefreshCw, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmt = (v: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300',
  past_due:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  paused:    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

// ── Plan Modal ─────────────────────────────────────────────────────────────
function PlanModal({ plan, onClose, onSaved }: { plan?: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    amount: plan?.amount || '',
    currency: plan?.currency || 'INR',
    billing_interval: plan?.billing_interval || 'monthly',
    is_active: plan?.is_active ?? 1,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name || !form.amount) return toast.error('Name and amount are required');
    setSaving(true);
    try {
      if (plan?.id) {
        await api.put(`/subscriptions/plans/${plan.id}`, form);
      } else {
        await api.post('/subscriptions/plans', form);
      }
      toast.success(plan?.id ? 'Plan updated' : 'Plan created');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save plan');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-4">{plan?.id ? 'Edit Plan' : 'New Plan'}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Plan Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. Monthly Retainer" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Amount *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="5000" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Billing Interval</label>
            <select value={form.billing_interval} onChange={e => setForm(f => ({ ...f, billing_interval: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Saving…' : 'Save Plan'}</Button>
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ── Create Subscription Modal ──────────────────────────────────────────────
function CreateSubModal({ clients, plans, onClose, onSaved }: {
  clients: any[]; plans: any[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    client_id: '',
    plan_id: '',
    name: '',
    amount: '',
    currency: 'INR',
    billing_interval: 'monthly',
    gateway: 'stripe',
    tax_percent: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const applyPlan = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      setForm(f => ({ ...f, plan_id: planId, name: plan.name, amount: plan.amount, currency: plan.currency, billing_interval: plan.billing_interval }));
    } else {
      setForm(f => ({ ...f, plan_id: planId }));
    }
  };

  const save = async () => {
    if (!form.client_id || !form.amount || !form.gateway) return toast.error('Client, amount and gateway required');
    setSaving(true);
    try {
      await api.post('/subscriptions', form);
      toast.success('Subscription created');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create subscription');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-4">Create Subscription</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Client *</label>
            <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Use a Plan (optional)</label>
            <select value={form.plan_id} onChange={e => applyPlan(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              <option value="">Custom / no plan</option>
              {plans.filter(p => p.is_active).map(p => (
                <option key={p.id} value={p.id}>{p.name} — {fmt(p.amount, p.currency)}/{p.billing_interval}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Subscription Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. Monthly Retainer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Amount *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tax % (e.g. 18 for GST)</label>
              <input type="number" min="0" max="100" step="0.5" value={form.tax_percent}
                onChange={e => setForm(f => ({ ...f, tax_percent: e.target.value }))}
                placeholder="0"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex items-end pb-2">
              {form.amount && Number(form.tax_percent) > 0 && (
                <span className="text-xs text-muted-foreground">
                  Total: {fmt(Number(form.amount) * (1 + Number(form.tax_percent) / 100), form.currency)}
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Billing Interval</label>
            <select value={form.billing_interval} onChange={e => setForm(f => ({ ...f, billing_interval: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Payment Gateway *</label>
            <select value={form.gateway} onChange={e => setForm(f => ({ ...f, gateway: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              <option value="stripe">Stripe (International)</option>
              <option value="razorpay">Razorpay (India)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none resize-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Creating…' : 'Create Subscription'}</Button>
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Subscriptions() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'subscriptions' | 'plans'>('subscriptions');
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: subsData } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api.get('/subscriptions').then(r => r.data?.data || []),
    staleTime: 30_000,
  });
  const { data: plansData } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => api.get('/subscriptions/plans').then(r => r.data?.data || []),
    staleTime: 60_000,
  });
  const { data: clientsData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients').then(r => r.data?.data || r.data || []),
    staleTime: 60_000,
  });

  const subs: any[]    = subsData || [];
  const plans: any[]   = plansData || [];
  const clients: any[] = Array.isArray(clientsData) ? clientsData : [];

  const cancelSub = async (id: string) => {
    if (!confirm('Cancel this subscription? This will stop future billing.')) return;
    try {
      await api.patch(`/subscriptions/${id}/cancel`);
      toast.success('Subscription cancelled');
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel');
    }
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this plan?')) return;
    try {
      await api.delete(`/subscriptions/plans/${id}`);
      toast.success('Plan deleted');
      qc.invalidateQueries({ queryKey: ['subscription-plans'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-subtitle">Manage recurring billing for clients</p>
        </div>
        <div className="flex gap-2">
          {tab === 'plans' ? (
            <Button size="sm" onClick={() => { setEditPlan(null); setShowPlanModal(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" /> New Plan
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowCreateSub(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> New Subscription
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {(['subscriptions', 'plans'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t} {t === 'subscriptions' ? `(${subs.length})` : `(${plans.length})`}
          </button>
        ))}
      </div>

      {/* Subscriptions tab */}
      {tab === 'subscriptions' && (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-3">Client</th>
                <th className="p-3">Plan / Name</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Gateway</th>
                <th className="p-3">Status</th>
                <th className="p-3">Next Billing</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">No subscriptions yet.</td></tr>
              ) : subs.map(s => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="p-3 font-medium">{s.client_name}</td>
                  <td className="p-3">
                    <div>{s.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{s.billing_interval}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-semibold">{fmt(s.amount, s.currency)}</div>
                    {Number(s.tax_percent) > 0 && (
                      <div className="text-xs text-muted-foreground">+{s.tax_percent}% tax = {fmt(Number(s.amount) * (1 + Number(s.tax_percent) / 100), s.currency)}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.gateway === 'stripe' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                      {s.gateway}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] || 'bg-muted text-muted-foreground'}`}>
                      {s.status}
                    </span>
                    {s.status === 'pending' && s.razorpay_short_url && (
                      <button onClick={() => copyUrl(s.razorpay_short_url, s.id)}
                        className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline">
                        {copiedId === s.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copiedId === s.id ? 'Copied' : 'Copy link'}
                      </button>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{fmtDate(s.next_billing_date)}</td>
                  <td className="p-3">
                    {s.status !== 'cancelled' && (
                      <button onClick={() => cancelSub(s.id)}
                        className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
                        <XCircle className="h-3.5 w-3.5" /> Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Plans tab */}
      {tab === 'plans' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-3 py-8 text-center">No plans yet. Create one to reuse across clients.</p>
          ) : plans.map(p => (
            <div key={p.id} className="glass-card p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-sm">{p.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{p.billing_interval}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditPlan(p); setShowPlanModal(true); }}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deletePlan(p.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-2xl font-bold">{fmt(p.amount, p.currency)}</div>
              {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${p.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-muted text-muted-foreground'}`}>
                {p.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      )}

      {showPlanModal && (
        <PlanModal plan={editPlan} onClose={() => { setShowPlanModal(false); setEditPlan(null); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['subscription-plans'] })} />
      )}
      {showCreateSub && (
        <CreateSubModal clients={clients} plans={plans} onClose={() => setShowCreateSub(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['subscriptions'] })} />
      )}
    </div>
  );
}
