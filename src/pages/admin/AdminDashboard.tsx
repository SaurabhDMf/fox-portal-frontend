import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import { DollarSign, Users, Target, AlertTriangle, FileText, MessageSquare, Clock, LayoutDashboard, User, FolderOpen, LifeBuoy, CalendarOff, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

import MyDashboard from '@/pages/MyDashboard';

export default function AdminDashboard() {
  const [view, setView] = useState<'personal' | 'org'>('personal');
  const navigate = useNavigate();
  const canCreate = useAuthStore(s => s.canCreate);

  if (view === 'personal') {
    return (
      <div>
        {/* View Toggle */}
        <div className="page-container">
          <div className="flex gap-1 mb-0">
            <button onClick={() => setView('personal')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground">
              <User className="h-4 w-4" /> My Dashboard
            </button>
            <button onClick={() => setView('org')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              <LayoutDashboard className="h-4 w-4" /> Organization
            </button>
          </div>
        </div>
        <MyDashboard />
      </div>
    );
  }

  return <OrgDashboard onSwitchView={() => setView('personal')} />;
}

function OrgDashboard({ onSwitchView }: { onSwitchView: () => void }) {
  const navigate = useNavigate();
  const canCreate = useAuthStore(s => s.canCreate);

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/dashboard/admin').then(r => r.data),
  });
  const { data: recentLeads = [] } = useQuery({
    queryKey: ['recent-leads'],
    queryFn: () => api.get('/leads', { params: { limit: 5 } }).then(r => r.data?.leads || r.data || []),
  });
  const { data: overdueInvoices = [] } = useQuery({
    queryKey: ['overdue-invoices'],
    queryFn: () => api.get('/invoices', { params: { status: 'Overdue' } }).then(r => r.data?.invoices || r.data || []),
  });

  const s = stats || {};
  const leadsArr = Array.isArray(recentLeads) ? recentLeads : [];
  const overdueArr = Array.isArray(overdueInvoices) ? overdueInvoices : [];

  const quickActions = [
    { label: 'New Lead', icon: Target, path: '/admin/crm', show: canCreate('crm') },
    { label: 'New Invoice', icon: FileText, path: '/admin/invoicing', show: canCreate('invoicing') },
    { label: 'Open Chat', icon: MessageSquare, path: '/admin/chat', show: true },
    { label: 'Log Time', icon: Clock, path: '/admin/tracker', show: true },
  ].filter(a => a.show);

  return (
    <div className="page-container">
      {/* View Toggle */}
      <div className="flex gap-1 mb-4">
        <button onClick={onSwitchView} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <Users className="h-4 w-4" /> My Dashboard
        </button>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground">
          <LayoutDashboard className="h-4 w-4" /> Organization
        </button>
      </div>

      <div className="page-header">
        <div><h1 className="page-title">Organization Dashboard</h1><p className="page-subtitle">Business overview</p></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Revenue MTD" value={s.revenue_mtd ? `$${Number(s.revenue_mtd).toLocaleString()}` : '$0'} icon={DollarSign} iconColor="text-success" trend={s.revenue_trend} />
        <StatCard label="Active Clients" value={s.active_clients ?? 0} icon={Users} iconColor="text-info" />
        <StatCard label="Open Leads" value={s.open_leads ?? 0} icon={Target} iconColor="text-warning" />
        <StatCard label="Overdue" value={s.overdue_amount ? `$${Number(s.overdue_amount).toLocaleString()}` : '$0'} icon={AlertTriangle} iconColor="text-destructive" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map(a => (
          <button key={a.label} onClick={() => navigate(a.path)} className="glass-card-hover p-4 flex items-center gap-3 text-sm font-medium">
            <div className="p-2 rounded-lg bg-primary/10"><a.icon className="h-4 w-4 text-primary" /></div>
            {a.label}
          </button>
        ))}
      </div>

      {/* Recent Activity Feed */}
      <RecentActivityCard activity={s.recentActivity || s.recent_activity || []} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Recent Leads</h2>
            <button onClick={() => navigate('/admin/crm')} className="text-xs text-primary hover:underline">View all</button>
          </div>
          <div className="space-y-2">
            {leadsArr.slice(0, 5).map((lead: any) => (
              <div key={lead.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                <div>
                  <div className="text-sm font-medium">{lead.full_name}</div>
                  <div className="text-xs text-muted-foreground">{lead.company_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{lead.deal_value ? `$${Number(lead.deal_value).toLocaleString()}` : '—'}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${lead.status === 'Closed Won' ? 'badge-success' : lead.status === 'Closed Lost' ? 'badge-danger' : 'badge-info'}`}>{lead.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Overdue Invoices</h2>
            <button onClick={() => navigate('/admin/invoicing')} className="text-xs text-primary hover:underline">View all</button>
          </div>
          <div className="space-y-2">
            {overdueArr.slice(0, 5).map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                <div>
                  <div className="text-sm font-medium">{inv.invoice_number || inv.id}</div>
                  <div className="text-xs text-muted-foreground">{inv.client_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-destructive">${Number(inv.total || 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : ''}</div>
                </div>
              </div>
            ))}
            {overdueArr.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No overdue invoices</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
const ACTIVITY_ICONS: Record<string, any> = {
  invoice: FileText,
  project: FolderOpen,
  lead: Target,
  ticket: LifeBuoy,
  leave: CalendarOff,
};

function RecentActivityCard({ activity }: { activity: Array<{ type: string; label: string; time: string }> }) {
  const items = Array.isArray(activity) ? activity : [];
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Recent Activity</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 8).map((a, i) => {
            const Icon = ACTIVITY_ICONS[a.type] || Activity;
            return (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                <div className="p-1.5 rounded-md bg-primary/10 flex-shrink-0">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
