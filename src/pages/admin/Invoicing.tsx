import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Plus, X, Send, Trash2, DollarSign, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import StatCard from '@/components/ui/StatCard';
import { useModulePermission } from '@/hooks/usePermission';

const statusTabs = ['All', 'Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export default function Invoicing() {
  const perm = useModulePermission('invoicing');
  const [tab, setTab] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const qc = useQueryClient();

  const [form, setForm] = useState({
    client_id: '',
    due_date: '',
    currency: 'USD',
    discount_pct: 0,
    tax_pct: 0,
    notes: '',
  });
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, unit_price: 0 }]);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', tab],
    queryFn: () => api.get('/invoices', { params: { status: tab === 'All' ? undefined : tab } }).then(r => r.data),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients').then(r => r.data?.clients || r.data || []),
  });

  const invoices = data?.invoices || (Array.isArray(data) ? data : []);
  const stats = data?.stats || {};
  const clientsArr = Array.isArray(clients) ? clients : [];

  const createMut = useMutation({
    mutationFn: () => api.post('/invoices', { ...form, items: items.filter(i => i.description) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setShowCreate(false);
      setItems([{ description: '', quantity: 1, unit_price: 0 }]);
      toast.success('Invoice created');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const sendMut = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/send`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice sent'); },
  });

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const discount = subtotal * (form.discount_pct / 100);
  const taxable = subtotal - discount;
  const tax = taxable * (form.tax_pct / 100);
  const total = taxable + tax;

  const addItem = () => setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof LineItem, value: string | number) =>
    setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const viewDetail = async (inv: any) => {
    try {
      const { data } = await api.get(`/invoices/${inv.id}`);
      setShowDetail(data);
    } catch {
      setShowDetail(inv);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Invoices</h1><p className="page-subtitle">Manage billing and payments</p></div>
        {perm.canCreate && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> New Invoice
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Billed" value={`$${Number(stats.total_billed || 0).toLocaleString()}`} icon={DollarSign} />
        <StatCard label="Collected" value={`$${Number(stats.collected || 0).toLocaleString()}`} icon={CheckCircle} iconColor="text-success" />
        <StatCard label="Outstanding" value={`$${Number(stats.outstanding || 0).toLocaleString()}`} icon={Clock} iconColor="text-warning" />
        <StatCard label="Overdue" value={`$${Number(stats.overdue || 0).toLocaleString()}`} icon={AlertTriangle} iconColor="text-destructive" />
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {statusTabs.map(s => (
          <button key={s} onClick={() => setTab(s)} className={`text-xs px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${tab === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>{s}</button>
        ))}
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="p-4">Invoice #</th><th className="p-4">Client</th><th className="p-4">Amount</th><th className="p-4">Due Date</th><th className="p-4">Status</th><th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={6} className="p-4"><div className="h-4 bg-secondary rounded animate-pulse" /></td></tr>) :
            (Array.isArray(invoices) ? invoices : []).map((inv: any) => (
              <tr key={inv.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => viewDetail(inv)}>
                <td className="p-4 font-medium">{inv.invoice_number || `INV-${inv.id?.slice(0, 6)}`}</td>
                <td className="p-4">{inv.client_name || '—'}</td>
                <td className="p-4 font-medium">${Number(inv.total || inv.amount || 0).toLocaleString()}</td>
                <td className="p-4 text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                <td className="p-4">
                  <span className={inv.status === 'Paid' ? 'badge-success' : inv.status === 'Overdue' ? 'badge-danger' : inv.status === 'Sent' ? 'badge-info' : inv.status === 'Cancelled' ? 'badge-neutral' : 'badge-warning'}>{inv.status}</span>
                </td>
                <td className="p-4" onClick={e => e.stopPropagation()}>
                  {inv.status === 'Draft' && (
                    <button onClick={() => sendMut.mutate(inv.id)} className="text-xs flex items-center gap-1 text-primary hover:underline">
                      <Send className="h-3 w-3" /> Send
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-2xl p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Invoice</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">Select Client</option>
                {clientsArr.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="INR">INR</option><option value="AED">AED</option>
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Line Items</label>
                <button onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Add Item</button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <input placeholder="Description" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="w-20 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" min="1" />
                  <input type="number" placeholder="Price" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} className="w-28 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" min="0" step="0.01" />
                  <span className="py-2 text-sm font-medium w-24 text-right">${(item.quantity * item.unit_price).toFixed(2)}</span>
                  {items.length > 1 && <button onClick={() => removeItem(idx)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Discount %</label>
                <input type="number" value={form.discount_pct} onChange={e => setForm(f => ({ ...f, discount_pct: Number(e.target.value) }))} className="w-20 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" min="0" max="100" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Tax %</label>
                <input type="number" value={form.tax_pct} onChange={e => setForm(f => ({ ...f, tax_pct: Number(e.target.value) }))} className="w-20 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" min="0" max="100" />
              </div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              {form.discount_pct > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount ({form.discount_pct}%)</span><span className="text-destructive">-${discount.toFixed(2)}</span></div>}
              {form.tax_pct > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax ({form.tax_pct}%)</span><span>${tax.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border"><span>Total</span><span>${total.toFixed(2)}</span></div>
            </div>
            <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-2xl p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Invoice {showDetail.invoice_number || ''}</h2>
              <button onClick={() => setShowDetail(null)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="bg-secondary/30 rounded-xl p-6 space-y-4">
              <div className="flex justify-between">
                <div><div className="text-xs text-muted-foreground">Bill To</div><div className="font-medium">{showDetail.client_name || 'Client'}</div></div>
                <div className="text-right"><div className="text-xs text-muted-foreground">Due Date</div><div>{showDetail.due_date ? new Date(showDetail.due_date).toLocaleDateString() : '—'}</div></div>
              </div>
              <div className="flex justify-between">
                <div><div className="text-xs text-muted-foreground">Status</div><span className={showDetail.status === 'Paid' ? 'badge-success' : showDetail.status === 'Overdue' ? 'badge-danger' : 'badge-warning'}>{showDetail.status}</span></div>
                <div className="text-right"><div className="text-xs text-muted-foreground">Currency</div><div>{showDetail.currency || 'USD'}</div></div>
              </div>
              {showDetail.items && (
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-muted-foreground border-b border-border"><th className="text-left pb-2">Description</th><th className="text-right pb-2">Qty</th><th className="text-right pb-2">Price</th><th className="text-right pb-2">Total</th></tr></thead>
                  <tbody>
                    {(showDetail.items as any[]).map((item: any, i: number) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2">{item.description}</td><td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 text-right">${Number(item.unit_price || 0).toFixed(2)}</td>
                        <td className="py-2 text-right font-medium">${(item.quantity * item.unit_price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="text-right space-y-1 pt-2"><div className="text-2xl font-bold">${Number(showDetail.total || 0).toLocaleString()}</div></div>
            </div>
            <div className="flex gap-2 justify-end">
              {showDetail.status === 'Draft' && (
                <button onClick={() => { sendMut.mutate(showDetail.id); setShowDetail(null); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all flex items-center gap-2">
                  <Send className="h-4 w-4" /> Send Invoice
                </button>
              )}
              <button onClick={() => setShowDetail(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
