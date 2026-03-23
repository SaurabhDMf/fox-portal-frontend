import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useState } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['client-invoices', id],
    queryFn: () => api.get('/invoices', { params: { client_id: id } }).then(r => r.data?.invoices || r.data || []),
    enabled: !!id,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['client-leads', id],
    queryFn: () => api.get('/leads', { params: { client_id: id } }).then(r => r.data?.leads || r.data || []),
    enabled: !!id,
  });

  if (isLoading) return <div className="page-container"><div className="glass-card h-64 animate-pulse" /></div>;
  if (!client) return <div className="page-container"><p className="text-muted-foreground">Client not found</p></div>;

  const invoicesArr = Array.isArray(invoices) ? invoices : [];
  const leadsArr = Array.isArray(leads) ? leads : [];
  const contacts = client.contacts || [];

  return (
    <div className="page-container">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Client header */}
          <div className="glass-card p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
                {client.company_name?.[0]}
              </div>
              <div>
                <h1 className="text-xl font-bold">{client.company_name}</h1>
                <p className="text-muted-foreground text-sm">{client.industry || 'No industry'}</p>
                <div className="flex gap-2 mt-2">
                  {client.client_type && <span className={client.client_type === 'VIP' ? 'badge-warning' : client.client_type === 'At-Risk' ? 'badge-danger' : 'badge-info'}>{client.client_type}</span>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {client.website && <div><span className="text-muted-foreground">Website</span><div><a href={client.website} target="_blank" className="text-primary hover:underline">{client.website}</a></div></div>}
              {client.account_manager_name && <div><span className="text-muted-foreground">Account Manager</span><div>{client.account_manager_name}</div></div>}
              {client.total_spend != null && <div><span className="text-muted-foreground">Total Spend</span><div className="font-bold text-lg">${Number(client.total_spend).toLocaleString()}</div></div>}
            </div>
          </div>

          {/* Contacts */}
          {contacts.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold mb-3">Contacts</h2>
              <div className="space-y-2">
                {contacts.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">{c.name?.[0]}</div>
                    <div><div className="text-sm font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.email} {c.role ? `• ${c.role}` : ''}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoice History */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold mb-3">Invoice History</h2>
            {invoicesArr.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No invoices</p> : (
              <div className="space-y-2">
                {invoicesArr.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50">
                    <div><div className="text-sm font-medium">{inv.invoice_number || inv.id?.slice(0, 8)}</div></div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">${Number(inv.total || 0).toLocaleString()}</span>
                      <span className={inv.status === 'Paid' ? 'badge-success' : inv.status === 'Overdue' ? 'badge-danger' : 'badge-warning'}>{inv.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Linked Leads */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-3">Linked Leads</h3>
            {leadsArr.length === 0 ? <p className="text-xs text-muted-foreground">No leads</p> : (
              <div className="space-y-2">
                {leadsArr.map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between text-sm">
                    <span>{l.full_name}</span>
                    <span className="badge-info">{l.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-2">Internal Notes</h3>
              <p className="text-sm text-muted-foreground">{client.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
