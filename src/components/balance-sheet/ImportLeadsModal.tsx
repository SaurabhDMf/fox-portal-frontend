import { useState, useMemo } from 'react';
import { X, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  importedLeadIds: Set<string>;
}

export default function ImportLeadsModal({ open, onClose, importedLeadIds }: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data = [] } = useQuery({
    queryKey: ['leads-all'],
    queryFn: () => api.get('/leads').then(r => r.data?.leads || r.data || []),
    enabled: open,
  });

  const wonLeads = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    return list
      .filter((l: any) => (l.status === 'Closed Won' || l.converted) && Number(l.deal_value || 0) > 0)
      .filter((l: any) => !importedLeadIds.has(String(l.id)))
      .sort((a: any, b: any) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''));
  }, [data, importedLeadIds]);

  const importMut = useMutation({
    mutationFn: async (leads: any[]) => {
      const payloads = leads.map(l => ({
        title: `Lead Won: ${l.name || l.company_name || 'Untitled'}`,
        source: 'Lead Closed',
        amount: Number(l.deal_value || 0),
        income_date: (l.updated_at || l.created_at || new Date().toISOString()).slice(0, 10),
        client_name: l.company_name || l.name || null,
        payment_method: 'Bank Transfer',
        reference_no: null,
        notes: `Auto-imported from CRM lead #${l.id}`,
        lead_id: String(l.id),
      }));
      await Promise.all(payloads.map(p => api.post('/income', p)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income'] });
      toast.success(`${selected.size} income entries imported`);
      setSelected(new Set());
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Import failed'),
  });

  if (!open) return null;

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === wonLeads.length) setSelected(new Set());
    else setSelected(new Set(wonLeads.map((l: any) => String(l.id))));
  };

  const selectedTotal = wonLeads
    .filter((l: any) => selected.has(String(l.id)))
    .reduce((s: number, l: any) => s + Number(l.deal_value || 0), 0);

  const handleImport = () => {
    const toImport = wonLeads.filter((l: any) => selected.has(String(l.id)));
    if (toImport.length === 0) return toast.error('Select at least one lead');
    importMut.mutate(toImport);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Import Won Leads as Income</h2>
            <p className="text-xs text-muted-foreground mt-1">Select closed-won leads to add as income entries</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded-md text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {wonLeads.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No new closed-won leads to import. All have been imported, or none have a deal value.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 w-10">
                    <input type="checkbox" checked={selected.size === wonLeads.length && wonLeads.length > 0} onChange={toggleAll} />
                  </th>
                  <th className="text-left px-4 py-3">Lead</th>
                  <th className="text-left px-4 py-3">Company</th>
                  <th className="text-left px-4 py-3">Closed Date</th>
                  <th className="text-right px-4 py-3">Deal Value</th>
                </tr>
              </thead>
              <tbody>
                {wonLeads.map((l: any) => (
                  <tr key={l.id} onClick={() => toggle(String(l.id))} className="border-t border-border hover:bg-secondary/20 cursor-pointer">
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.has(String(l.id))} onChange={() => toggle(String(l.id))} /></td>
                    <td className="px-4 py-3 font-medium">{l.name || 'Untitled'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.company_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{(l.updated_at || l.created_at || '').slice(0, 10)}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{Number(l.deal_value || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-secondary/20">
          <div className="text-sm">
            <span className="text-muted-foreground">Selected: </span>
            <span className="font-semibold">{selected.size}</span>
            <span className="text-muted-foreground"> · Total: </span>
            <span className="font-semibold text-success">₹{selectedTotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
            <button onClick={handleImport} disabled={importMut.isPending || selected.size === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
              <Download className="h-4 w-4" /> {importMut.isPending ? 'Importing...' : `Import ${selected.size} Lead${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
