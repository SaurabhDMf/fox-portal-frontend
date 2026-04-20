import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, X, Trash2 } from 'lucide-react';

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface Props {
  onClose: () => void;
}

const inputCls = 'px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

export default function InvoiceCreateModal({ onClose }: Props) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    client_id: '',
    due_date: '',
    currency: 'USD',
    discount_pct: 0,
    tax_pct: 0,
    notes: '',
    billing_address: '',
  });
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, unit_price: 0 }]);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients').then(r => {
      const d = r.data;
      const arr = Array.isArray(d) ? d : (d?.data || d?.clients || []);
      return Array.isArray(arr) ? arr : [];
    }),
  });

  const { data: company } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => api.get('/company').then(r => r.data),
  });

  // Set default currency from company
  useEffect(() => {
    if (company?.default_currency && !form.client_id) {
      setForm(f => ({ ...f, currency: company.default_currency }));
    }
  }, [company]);

  const clientsArr = Array.isArray(clients) ? clients : [];

  // Auto-fill billing address from selected client
  useEffect(() => {
    if (form.client_id) {
      const client = clientsArr.find((c: any) => c.id === form.client_id);
      if (client) {
        const addr = client.billing_address || client.address ||
          [client.address_line1, client.address_line2, client.city, client.state, client.postal_code, client.country].filter(Boolean).join(', ');
        setForm(f => ({ ...f, billing_address: addr || '' }));
      }
    }
  }, [form.client_id]);

  const createMut = useMutation({
    mutationFn: () => api.post('/invoices', { ...form, items: items.filter(i => i.description) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      onClose();
      toast.success('Invoice created');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-2xl p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Invoice</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className={inputCls}>
            <option value="">Select Client</option>
            {clientsArr.map((c: any) => <option key={c.id} value={c.id}>{c.company_name || c.name || c.contact_name || c.email || c.id}</option>)}
          </select>
          <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputCls} />
          <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className={inputCls}>
            <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="INR">INR</option><option value="AED">AED</option>
          </select>
        </div>

        {/* Billing Address Preview */}
        {form.client_id && (
          <div>
            <label className="text-xs text-muted-foreground font-medium">Billing Address</label>
            <textarea
              value={form.billing_address}
              onChange={e => setForm(f => ({ ...f, billing_address: e.target.value }))}
              rows={2}
              className={inputCls + ' w-full mt-1 resize-none'}
              placeholder="Auto-filled from client — edit if needed"
            />
          </div>
        )}

        {/* Line Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Line Items</label>
            <button onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Add Item</button>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <input placeholder="Description" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className={'flex-1 ' + inputCls} />
              <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className={'w-20 ' + inputCls} min="1" />
              <input type="number" placeholder="Price" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} className={'w-28 ' + inputCls} min="0" step="0.01" />
              <span className="py-2 text-sm font-medium w-24 text-right">${(item.quantity * item.unit_price).toFixed(2)}</span>
              {items.length > 1 && <button onClick={() => removeItem(idx)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Discount %</label>
            <input type="number" value={form.discount_pct} onChange={e => setForm(f => ({ ...f, discount_pct: Number(e.target.value) }))} className={'w-20 ' + inputCls} min="0" max="100" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Tax %</label>
            <input type="number" value={form.tax_pct} onChange={e => setForm(f => ({ ...f, tax_pct: Number(e.target.value) }))} className={'w-20 ' + inputCls} min="0" max="100" />
          </div>
        </div>

        <div className="bg-secondary/50 rounded-lg p-4 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          {form.discount_pct > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount ({form.discount_pct}%)</span><span className="text-destructive">-${discount.toFixed(2)}</span></div>}
          {form.tax_pct > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax ({form.tax_pct}%)</span><span>${tax.toFixed(2)}</span></div>}
          <div className="flex justify-between font-bold text-base pt-2 border-t border-border"><span>Total</span><span>${total.toFixed(2)}</span></div>
        </div>

        <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls + ' w-full resize-none'} />

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
          <button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {createMut.isPending ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
