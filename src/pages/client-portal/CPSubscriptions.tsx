import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { RefreshCw, ExternalLink } from 'lucide-react';

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

const STATUS_LABELS: Record<string, string> = {
  active:    'Active',
  pending:   'Pending Setup',
  cancelled: 'Cancelled',
  past_due:  'Past Due',
  paused:    'Paused',
};

export default function CPSubscriptions() {
  const { data, isLoading } = useQuery({
    queryKey: ['cp-subscriptions'],
    queryFn: () => api.get('/subscriptions').then(r => r.data?.data || []),
    staleTime: 60_000,
  });

  const subs: any[] = data || [];
  const activeSubs = subs.filter(s => s.status === 'active');
  const totalMonthly = activeSubs.reduce((sum, s) => {
    const monthly = s.billing_interval === 'yearly' ? s.amount / 12
      : s.billing_interval === 'quarterly' ? s.amount / 3
      : s.amount;
    return sum + monthly;
  }, 0);

  if (isLoading) return (
    <div className="page-container">
      <div className="text-center py-20 text-muted-foreground text-sm">Loading…</div>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-subtitle">Your active recurring services</p>
        </div>
      </div>

      {/* Summary cards */}
      {subs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Active Plans</p>
            <p className="text-2xl font-bold">{activeSubs.length}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Monthly Value</p>
            <p className="text-2xl font-bold">{fmt(totalMonthly, subs[0]?.currency)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Next Billing</p>
            <p className="text-2xl font-bold">
              {activeSubs.length > 0
                ? fmtDate(activeSubs.sort((a, b) => new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime())[0]?.next_billing_date)
                : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Subscription cards */}
      {subs.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <RefreshCw className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-foreground">No subscriptions yet</p>
          <p className="text-xs text-muted-foreground mt-1">Contact your account manager to set up recurring billing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map(s => (
            <div key={s.id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{s.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] || 'bg-muted text-muted-foreground'}`}>
                    {STATUS_LABELS[s.status] || s.status}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.gateway === 'stripe' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                    {s.gateway === 'stripe' ? 'Card' : 'Razorpay'}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span>Billed <span className="capitalize">{s.billing_interval}</span></span>
                  {s.next_billing_date && s.status === 'active' && (
                    <span>Next charge: <span className="text-foreground font-medium">{fmtDate(s.next_billing_date)}</span></span>
                  )}
                  {s.cancelled_at && (
                    <span>Cancelled: {fmtDate(s.cancelled_at)}</span>
                  )}
                </div>
                {/* Razorpay pending — show auth link */}
                {s.status === 'pending' && s.razorpay_short_url && (
                  <a href={s.razorpay_short_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline font-medium">
                    <ExternalLink className="h-3 w-3" /> Activate subscription →
                  </a>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-xl font-bold">
                  {Number(s.tax_percent) > 0
                    ? fmt(Number(s.amount) * (1 + Number(s.tax_percent) / 100), s.currency)
                    : fmt(s.amount, s.currency)}
                </div>
                {Number(s.tax_percent) > 0 && (
                  <div className="text-xs text-muted-foreground">{fmt(s.amount, s.currency)} + {s.tax_percent}% tax</div>
                )}
                <div className="text-xs text-muted-foreground capitalize">per {s.billing_interval === 'monthly' ? 'month' : s.billing_interval === 'quarterly' ? 'quarter' : 'year'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
