import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ClientFormModal, { type ClientFormData } from '@/components/clients/ClientFormModal';
import { useAuthStore } from '@/stores/authStore';
import PortalAccessSection from '@/components/clients/PortalAccessSection';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const userRole = useAuthStore(s => s.user?.role);
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

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

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users').then(r => r.data?.users || r.data || []),
  });

  const editMut = useMutation({
    mutationFn: (d: ClientFormData) => api.put(`/clients/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client', id] }); qc.invalidateQueries({ queryKey: ['clients'] }); setShowEdit(false); toast.success('Client updated'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/clients/${id}`, { skipConfirm: true } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted');
      navigate('/admin/clients');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete'),
  });

  if (isLoading) return <div className="page-container"><div className="glass-card h-64 animate-pulse" /></div>;
  if (!client) return <div className="page-container"><p className="text-muted-foreground">Client not found</p></div>;

  const invoicesArr = Array.isArray(invoices) ? invoices : [];
  const leadsArr = Array.isArray(leads) ? leads : [];
  const SALES_ROLES = new Set(['sales_manager', 'sales_rep']);
  const usersArr = (Array.isArray(users) ? users : []).filter((u: any) => SALES_ROLES.has((u.role || '').toLowerCase()));
  const contacts = client.contacts || [];
  const address = [client.address_line1, client.address_line2, client.city, client.state, client.postal_code, client.country].filter(Boolean).join(', ');

  return (
    <div className="page-container">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Client header */}
          <div className="glass-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
                  {client.company_name?.[0] || 'C'}
                </div>
                <div>
                  <h1 className="text-xl font-bold">{client.company_name || 'Unnamed Client'}</h1>
                  <p className="text-muted-foreground text-sm">{client.industry || 'No industry'}</p>
                  <div className="flex gap-2 mt-2">
                    {client.client_type && <span className={client.client_type === 'VIP' ? 'badge-warning' : client.client_type === 'At-Risk' ? 'badge-danger' : 'badge-info'}>{client.client_type}</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {client.email && <div><span className="text-muted-foreground">Email</span><div>{client.email}</div></div>}
              {client.phone && <div><span className="text-muted-foreground">Phone</span><div>{client.phone}</div></div>}
              {client.website && <div><span className="text-muted-foreground">Website</span><div><a href={client.website} target="_blank" className="text-primary hover:underline">{client.website}</a></div></div>}
              {client.account_manager_name && <div><span className="text-muted-foreground">Account Manager</span><div>{client.account_manager_name}</div></div>}
              {client.total_spend != null && <div><span className="text-muted-foreground">Total Spend</span><div className="font-bold text-lg">${Number(client.total_spend).toLocaleString()}</div></div>}
              {client.contact_name && <div><span className="text-muted-foreground">Contact Person</span><div>{client.contact_name}</div></div>}
            </div>
          </div>

          {/* Address & Tax */}
          {(address || client.gst_number || client.pan_number) && (
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold mb-3">Billing & Tax</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {address && <div><span className="text-muted-foreground">Billing Address</span><div>{address}</div></div>}
                {client.gst_number && <div><span className="text-muted-foreground">GST Number</span><div className="font-mono">{client.gst_number}</div></div>}
                {client.pan_number && <div><span className="text-muted-foreground">PAN Number</span><div className="font-mono">{client.pan_number}</div></div>}
              </div>
            </div>
          )}

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
          {client.notes && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-2">Internal Notes</h3>
              <p className="text-sm text-muted-foreground">{client.notes}</p>
            </div>
          )}

          {isAdmin && id && (
            <PortalAccessSection
              clientId={id}
              clientName={client.company_name}
              contactName={client.contact_name}
              contactEmail={client.email}
            />
          )}
        </div>
      </div>

      <ClientFormModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSubmit={(d) => editMut.mutate(d)}
        isPending={editMut.isPending}
        users={usersArr}
        initial={client}
        isEdit
      />


      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold">Delete Client</h2>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{client.company_name || 'this client'}</strong>? This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
