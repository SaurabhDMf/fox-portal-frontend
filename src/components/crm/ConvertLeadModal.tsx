import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface Props {
  lead: any;
  onClose: () => void;
}

function getLeadCountry(lead: any): string {
  return lead?.country || lead?.country_name || lead?.lead_country || lead?.location || lead?.meta?.country || '';
}

export default function ConvertLeadModal({ lead, onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    company_name: '',
    email: '',
    phone: '',
    country: '',
    industry: '',
    website: '',
    address: '',
  });

  useEffect(() => {
    if (!lead) return;
    setForm({
      company_name: lead.company_name || lead.full_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      country: getLeadCountry(lead),
      industry: lead.industry || '',
      website: lead.website || '',
      address: lead.address || '',
    });
  }, [lead]);

  const convertMut = useMutation({
    mutationFn: () => api.post(`/leads/${lead.id}/convert`, {
      company_name: form.company_name || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      country: form.country || undefined,
      industry: form.industry || undefined,
      website: form.website || undefined,
      address: form.address || undefined,
    }),
    onSuccess: (res) => {
      const data = res.data?.client || res.data?.data || res.data || {};
      const clientId = data.id || data.client_id;
      const alreadyExisted = res.data?.already_existed || data.already_existed;

      // Optimistically reflect "Closed Won" in the lead lists
      qc.setQueriesData({ queryKey: ['leads'] }, (old: any) => {
        if (!old) return old;
        const update = (l: any) => l.id === lead.id ? { ...l, status: 'Closed Won', client_id: clientId } : l;
        if (Array.isArray(old)) return old.map(update);
        if (old?.leads) return { ...old, leads: old.leads.map(update) };
        if (old?.data) return { ...old, data: old.data.map(update) };
        return old;
      });
      qc.setQueryData(['lead', lead.id], (old: any) => old ? { ...old, status: 'Closed Won', client_id: clientId } : old);
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead', lead.id] });
      qc.invalidateQueries({ queryKey: ['clients'] });

      if (alreadyExisted) {
        toast.success('Already a client');
      } else {
        toast.success('Lead converted to client');
      }
      onClose();
      if (clientId) navigate(`/admin/clients/${clientId}`);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.response?.data?.error || 'Failed to convert lead'),
  });

  const inputCls = "px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-xl p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10 text-primary"><UserCheck className="h-5 w-5" /></div>
            <h2 className="text-lg font-semibold">Convert to Client</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-muted-foreground">Review & edit the details below. Empty fields will use the lead's data.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Company Name</label>
            <input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Country</label>
            <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Industry</label>
            <input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} className={inputCls} placeholder="e.g. Healthcare" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Website</label>
            <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className={inputCls} placeholder="https://..." />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Address</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button
            onClick={() => convertMut.mutate()}
            disabled={convertMut.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {convertMut.isPending ? 'Converting...' : 'Convert to Client'}
          </button>
        </div>
      </div>
    </div>
  );
}
