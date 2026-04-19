import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useState } from 'react';
import { ArrowLeft, Phone, Mail, Building2, Plus, X, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import ConvertLeadModal from '@/components/crm/ConvertLeadModal';

const activityTypes = ['Call', 'Email', 'Meeting', 'Note', 'Follow-up'];
const CONVERT_ROLES = ['super_admin', 'admin', 'sales_manager'];

function getLeadCountry(lead: any): string {
  return lead?.country || lead?.country_name || lead?.lead_country || lead?.location || lead?.meta?.country || '';
}

function getLeadPurpose(lead: any): string {
  return lead?.purpose || lead?.purpose_name || lead?.lead_purpose || lead?.service || lead?.meta?.purpose || '';
}

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const userRole = useAuthStore(s => s.user?.role);
  const [showActivity, setShowActivity] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [actForm, setActForm] = useState({ type: 'Call', title: '', description: '', duration_mins: 0, outcome: '' });

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get(`/leads/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const activityMut = useMutation({
    mutationFn: (d: typeof actForm) => api.post(`/leads/${id}/activities`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      setShowActivity(false);
      toast.success('Activity logged');
    },
  });

  if (isLoading) return <div className="page-container"><div className="glass-card h-64 animate-pulse" /></div>;
  if (!lead) return <div className="page-container"><p className="text-muted-foreground">Lead not found</p></div>;

  const priorities: Record<string, string> = { Critical: 'badge-danger', High: 'badge-warning', Medium: 'badge-info', Low: 'badge-neutral' };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to CRM
        </button>
        {CONVERT_ROLES.includes(userRole || '') && lead.status !== 'Closed Won' && (
          <button
            onClick={() => setShowConvert(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all"
          >
            <UserCheck className="h-4 w-4" /> Convert to Client
          </button>
        )}
        {lead.status === 'Closed Won' && lead.client_id && (
          <button
            onClick={() => navigate(`/admin/clients/${lead.client_id}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success/10 text-success text-sm font-medium hover:bg-success/20 transition-all"
          >
            <UserCheck className="h-4 w-4" /> View Client
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold">{lead.full_name}</h1>
                {lead.company_name && <p className="text-muted-foreground">{lead.company_name}</p>}
              </div>
              <div className="flex gap-2">
                <span className={priorities[lead.priority] || 'badge-neutral'}>{lead.priority}</span>
                <span className="badge-info">{lead.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {lead.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />{lead.email}</div>}
              {lead.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{lead.phone}</div>}
              {getLeadCountry(lead) && <div className="text-muted-foreground">Country: {getLeadCountry(lead)}</div>}
              {getLeadPurpose(lead) && <div className="text-muted-foreground">Purpose: {getLeadPurpose(lead)}</div>}
              {lead.company_name && <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-4 w-4" />{lead.company_name}</div>}
              {lead.deal_value && <div className="text-success font-semibold text-lg">${Number(lead.deal_value).toLocaleString()}</div>}
            </div>

            {lead.notes && (
              <div className="mt-4 p-3 rounded-lg bg-secondary/50 text-sm text-muted-foreground">{lead.notes}</div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Activity Timeline</h2>
              <button onClick={() => setShowActivity(true)} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Log Activity</button>
            </div>

            <div className="space-y-4">
              {(lead.activities || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No activities yet. Log your first interaction.</p>
              ) : (
                (lead.activities as any[]).map((act: any, i: number) => (
                  <div key={act.id || i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">{act.type?.[0]}</div>
                      {i < lead.activities.length - 1 && <div className="w-px flex-1 bg-border mt-2" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{act.title}</div>
                        <span className="text-xs text-muted-foreground">{act.created_at ? new Date(act.created_at).toLocaleDateString() : ''}</span>
                      </div>
                      <span className="text-[10px] badge-neutral">{act.type}</span>
                      {act.description && <p className="text-sm text-muted-foreground mt-1">{act.description}</p>}
                      {act.outcome && <p className="text-xs text-muted-foreground mt-1">Outcome: {act.outcome}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span>{lead.lead_source || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Country</span><span>{getLeadCountry(lead) || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Purpose</span><span>{getLeadPurpose(lead) || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Assigned</span><span>{lead.assigned_to_name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Next Follow-up</span><span>{lead.next_followup ? new Date(lead.next_followup).toLocaleDateString() : '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Modal */}
      {showActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Log Activity</h2>
              <button onClick={() => setShowActivity(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <select value={actForm.type} onChange={e => setActForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              {activityTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Title" value={actForm.title} onChange={e => setActForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <textarea placeholder="Description" value={actForm.description} onChange={e => setActForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Duration (mins)" value={actForm.duration_mins || ''} onChange={e => setActForm(f => ({ ...f, duration_mins: Number(e.target.value) }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input placeholder="Outcome" value={actForm.outcome} onChange={e => setActForm(f => ({ ...f, outcome: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowActivity(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => activityMut.mutate(actForm)} disabled={activityMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {activityMut.isPending ? 'Logging...' : 'Log Activity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
