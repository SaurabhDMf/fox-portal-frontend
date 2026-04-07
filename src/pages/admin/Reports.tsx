import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';


const CHART_COLORS = ['hsl(244, 94%, 62%)', 'hsl(157, 87%, 46%)', 'hsl(213, 100%, 62%)', 'hsl(35, 100%, 63%)', 'hsl(4, 100%, 64%)', 'hsl(240, 20%, 55%)'];

const tooltipStyle = {
  contentStyle: {
    background: 'hsl(240, 30%, 10%)',
    border: '1px solid hsl(240, 25%, 14%)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'hsl(240, 60%, 96%)',
  },
};

export default function Reports() {
  const { data: leadsData = [] } = useQuery({
    queryKey: ['leads-all'],
    queryFn: () => api.get('/leads').then(r => r.data?.leads || r.data || []),
  });

  const { data: invoicesData = [] } = useQuery({
    queryKey: ['invoices-all'],
    queryFn: () => api.get('/invoices').then(r => r.data?.invoices || r.data || []),
  });

  const leads = Array.isArray(leadsData) ? leadsData : [];
  const invoices = Array.isArray(invoicesData) ? invoicesData : [];

  // Sales funnel
  const funnelStatuses = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'];
  const funnelData = funnelStatuses.map(status => ({
    stage: status,
    count: leads.filter((l: any) => l.status === status).length,
  }));

  // Revenue over time (aggregate invoices by month)
  const revenueByMonth: Record<string, number> = {};
  invoices.forEach((inv: any) => {
    if (inv.created_at || inv.due_date) {
      const d = new Date(inv.created_at || inv.due_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth[key] = (revenueByMonth[key] || 0) + Number(inv.total || 0);
    }
  });
  const revenueData = Object.entries(revenueByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, amount]) => ({ month, amount }));

  // Lead source distribution
  const sourceCount: Record<string, number> = {};
  leads.forEach((l: any) => {
    const src = l.lead_source || 'Other';
    sourceCount[src] = (sourceCount[src] || 0) + 1;
  });
  const sourceData = Object.entries(sourceCount).map(([name, value]) => ({ name, value }));

  // Conversion rate
  const totalLeads = leads.length || 1;
  const won = leads.filter((l: any) => l.status === 'Closed Won').length;
  const conversionRate = ((won / totalLeads) * 100).toFixed(1);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Business analytics and insights</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Leads</p>
          <p className="text-2xl font-bold mt-1">{leads.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Conversion Rate</p>
          <p className="text-2xl font-bold mt-1 text-success">{conversionRate}%</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-bold mt-1">${invoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales Funnel */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-4">Sales Funnel by Stage</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240,25%,14%)" />
              <XAxis type="number" tick={{ fill: 'hsl(240,20%,55%)', fontSize: 11 }} />
              <YAxis dataKey="stage" type="category" tick={{ fill: 'hsl(240,20%,55%)', fontSize: 11 }} width={100} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="hsl(244, 94%, 62%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Over Time */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-4">Revenue Over Time</h2>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240,25%,14%)" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(240,20%,55%)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(240,20%,55%)', fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(value: number) => `$${value.toLocaleString()}`} />
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(157, 87%, 46%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(157, 87%, 46%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="amount" stroke="hsl(157, 87%, 46%)" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">No invoice data</div>
          )}
        </div>

        {/* Lead Source Distribution */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-4">Lead Sources</h2>
          {sourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {sourceData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">No lead data</div>
          )}
        </div>

        {/* Pipeline Value */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-4">Pipeline Value by Stage</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelStatuses.filter(s => s !== 'Closed Lost').map(stage => ({
              stage: stage.replace('Closed ', ''),
              value: leads.filter((l: any) => l.status === stage).reduce((s: number, l: any) => s + Number(l.deal_value || 0), 0),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240,25%,14%)" />
              <XAxis dataKey="stage" tick={{ fill: 'hsl(240,20%,55%)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'hsl(240,20%,55%)', fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tooltipStyle} formatter={(value: number) => `$${value.toLocaleString()}`} />
              <Bar dataKey="value" fill="hsl(213, 100%, 62%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
