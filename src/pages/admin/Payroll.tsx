import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Plus, X, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useModulePermission } from '@/hooks/usePermission';

export default function Payroll() {
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ period_label: '', period_start: '', period_end: '' });
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs').then(r => r.data?.runs || r.data || []),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/payroll/runs', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); setShowCreate(false); toast.success('Payroll run created'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); toast.success('Approved'); },
  });

  const viewDetail = async (run: any) => {
    try {
      const { data } = await api.get(`/payroll/runs/${run.id}`);
      setSelectedRun(data);
    } catch {
      setSelectedRun(run);
    }
  };

  const runs = Array.isArray(data) ? data : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Payroll</h1><p className="page-subtitle">Manage payroll runs and payslips</p></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
          <Plus className="h-4 w-4" /> New Run
        </button>
      </div>

      {!selectedRun ? (
        <div className="space-y-3">
          {isLoading ? [...Array(3)].map((_, i) => <div key={i} className="glass-card h-20 animate-pulse" />) :
          runs.map((run: any) => (
            <div key={run.id} onClick={() => viewDetail(run)} className="glass-card-hover p-5 flex items-center justify-between cursor-pointer">
              <div>
                <h3 className="font-semibold text-sm">{run.period_label}</h3>
                <p className="text-xs text-muted-foreground">
                  {run.period_start && new Date(run.period_start).toLocaleDateString()} — {run.period_end && new Date(run.period_end).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {run.total_net && <span className="text-sm font-medium">${Number(run.total_net).toLocaleString()}</span>}
                <span className={run.status === 'Paid' ? 'badge-success' : run.status === 'Approved' ? 'badge-info' : run.status === 'Pending' ? 'badge-warning' : 'badge-neutral'}>{run.status}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
          {runs.length === 0 && !isLoading && <div className="text-center py-12 text-muted-foreground text-sm">No payroll runs</div>}
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setSelectedRun(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back to runs</button>
          <div className="glass-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{selectedRun.period_label}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedRun.period_start && new Date(selectedRun.period_start).toLocaleDateString()} — {selectedRun.period_end && new Date(selectedRun.period_end).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={selectedRun.status === 'Paid' ? 'badge-success' : selectedRun.status === 'Approved' ? 'badge-info' : 'badge-warning'}>{selectedRun.status}</span>
                {(selectedRun.status === 'Pending' || selectedRun.status === 'Draft') && (
                  <button onClick={() => approveMut.mutate(selectedRun.id)} className="px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs font-medium hover:bg-success/25 transition-colors">Approve</button>
                )}
              </div>
            </div>
            {selectedRun.employees ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="pb-3 pr-4">Employee</th><th className="pb-3 pr-4 text-right">Base Pay</th><th className="pb-3 pr-4 text-right">Deductions</th><th className="pb-3 text-right">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedRun.employees as any[]).map((emp: any, i: number) => (
                      <tr key={emp.id || i} className="border-b border-border/50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">{emp.full_name?.[0]}</div>
                            <span className="font-medium">{emp.full_name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right">${Number(emp.base_pay || 0).toLocaleString()}</td>
                        <td className="py-3 pr-4 text-right text-destructive">${Number(emp.deductions || 0).toLocaleString()}</td>
                        <td className="py-3 text-right font-bold">${Number(emp.net_pay || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td className="py-3 font-bold">Total</td>
                      <td className="py-3 text-right font-bold">${(selectedRun.employees as any[]).reduce((s: number, e: any) => s + Number(e.base_pay || 0), 0).toLocaleString()}</td>
                      <td className="py-3 text-right font-bold text-destructive">${(selectedRun.employees as any[]).reduce((s: number, e: any) => s + Number(e.deductions || 0), 0).toLocaleString()}</td>
                      <td className="py-3 text-right font-bold">${(selectedRun.employees as any[]).reduce((s: number, e: any) => s + Number(e.net_pay || 0), 0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No employee data available</p>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Payroll Run</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Period Label (e.g. March 2026)" value={form.period_label} onChange={e => setForm(f => ({ ...f, period_label: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Period Start</label>
                <input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Period End</label>
                <input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Create Run'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
