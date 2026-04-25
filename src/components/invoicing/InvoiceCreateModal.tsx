import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, X, Trash2, Save, Send, Eraser, Hash } from 'lucide-react';

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface Props {
  onClose: () => void;
}

const inputCls =
  'px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

const currencySymbol = (c: string) =>
  c === 'USD' ? '$' : c === 'EUR' ? '€' : c === 'GBP' ? '£' : c === 'AED' ? 'AED ' : '₹';

export default function InvoiceCreateModal({ onClose }: Props) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    client_id: '',
    due_date: '',
    currency: 'USD',
    discount_pct: 0,
    tax_pct: 0,
    notes: '',
    terms: '',
    billing_address: '',
    billing_email: '',
    billing_contact_name: '',
    invoice_number: '',
  });
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, unit_price: 0 }]);
  const [signatureData, setSignatureData] = useState<string>('');

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () =>
      api.get('/clients').then((r) => {
        const d = r.data;
        const arr = Array.isArray(d) ? d : d?.data || d?.clients || [];
        return Array.isArray(arr) ? arr : [];
      }),
  });

  const { data: company } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => api.get('/company').then((r) => r.data?.data ?? r.data ?? {}),
  });

  // Defaults from company
  useEffect(() => {
    if (!company) return;
    setForm((f) => ({
      ...f,
      currency: f.currency || company.default_currency || 'USD',
      terms: f.terms || company.payment_terms || '',
      notes: f.notes || company.invoice_notes || '',
      invoice_number:
        f.invoice_number ||
        `${company.invoice_prefix || 'INV'}-${String(Date.now()).slice(-6)}`,
    }));
  }, [company]);

  const companyName = company?.name || company?.company_name || 'Your Company';
  const companyAddress = [
    company?.address_line1 || company?.address?.line1,
    company?.address_line2 || company?.address?.line2,
    company?.city,
    company?.state,
    company?.postal_code,
    company?.country,
  ].filter(Boolean).join(', ');

  const clientsArr = Array.isArray(clients) ? clients : [];
  const selectedClient = clientsArr.find((c: any) => c.id === form.client_id);

  // Auto-fill billing details from client
  useEffect(() => {
    if (!selectedClient) return;
    const addr =
      selectedClient.billing_address ||
      selectedClient.address ||
      [
        selectedClient.address_line1,
        selectedClient.address_line2,
        selectedClient.city,
        selectedClient.state,
        selectedClient.postal_code,
        selectedClient.country,
      ]
        .filter(Boolean)
        .join(', ');
    setForm((f) => ({
      ...f,
      billing_address: addr || '',
      billing_email: selectedClient.email || '',
      billing_contact_name: selectedClient.contact_name || selectedClient.name || '',
    }));
  }, [form.client_id]);

  // Signature pad handlers
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const point = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    return {
      x: ((point.clientX - rect.left) * canvas.width) / rect.width,
      y: ((point.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    drawingRef.current = true;
    lastPtRef.current = getPos(e);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pt = getPos(e);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (lastPtRef.current) ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPtRef.current = pt;
  };
  const endDraw = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPtRef.current = null;
    const canvas = canvasRef.current!;
    setSignatureData(canvas.toDataURL('image/png'));
  };
  const clearSig = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  };

  const buildPayload = (extra: Record<string, any> = {}) => {
    const cleanItems = items.filter((i) => i.description.trim());
    const payload: any = {
      ...form,
      items: cleanItems,
      signature: signatureData || null,
      ...extra,
    };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '' || payload[k] === undefined) payload[k] = null;
    });
    return payload;
  };

  const validate = () => {
    if (!form.client_id) return 'Select a client';
    if (!items.some((i) => i.description.trim())) return 'Add at least one line item';
    return null;
  };

  const saveMut = useMutation({
    mutationFn: (status: 'Draft' | 'Sent') =>
      api.post('/invoices', buildPayload({ status })),
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(status === 'Sent' ? 'Invoice created & sent' : 'Invoice saved as draft');
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error creating invoice'),
  });

  const handleSave = (status: 'Draft' | 'Sent') => {
    const err = validate();
    if (err) return toast.error(err);
    saveMut.mutate(status);
  };

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const discount = subtotal * (form.discount_pct / 100);
  const taxable = subtotal - discount;
  const tax = taxable * (form.tax_pct / 100);
  const total = taxable + tax;
  const sym = currencySymbol(form.currency);

  const addItem = () => setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof LineItem, value: string | number) =>
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-3xl flex flex-col max-h-[92vh] animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Create Invoice</h2>
            <p className="text-xs text-muted-foreground">Fill in details, add a signature, then save or send</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto p-5 space-y-5">
          {/* Top: company snapshot + invoice meta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-3 bg-secondary/30">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">From</p>
              <div className="flex items-start gap-3">
                {company?.logo_url && (
                  <img src={company.logo_url} alt="Logo" className="h-10 w-10 object-contain rounded bg-background p-1" />
                )}
                <div className="text-sm">
                  <p className="font-semibold">{company?.company_name || 'Your Company'}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                    {[company?.address_line1, company?.city, company?.country].filter(Boolean).join(', ') || '—'}
                  </p>
                  {company?.email && <p className="text-xs text-muted-foreground">{company.email}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Invoice Number
                </label>
                <input
                  value={form.invoice_number}
                  onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
                  className={inputCls + ' w-full mt-1'}
                  placeholder="INV-000123"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                    className={inputCls + ' w-full mt-1'}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Currency</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className={inputCls + ' w-full mt-1'}
                  >
                    {['USD', 'EUR', 'GBP', 'INR', 'AED'].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Bill To</p>
            <select
              value={form.client_id}
              onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
              className={inputCls + ' w-full'}
            >
              <option value="">Select Client</option>
              {clientsArr.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.name || c.contact_name || c.email || c.id}
                </option>
              ))}
            </select>

            {form.client_id && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  placeholder="Contact name"
                  value={form.billing_contact_name}
                  onChange={(e) => setForm((f) => ({ ...f, billing_contact_name: e.target.value }))}
                  className={inputCls}
                />
                <input
                  placeholder="Client email"
                  type="email"
                  value={form.billing_email}
                  onChange={(e) => setForm((f) => ({ ...f, billing_email: e.target.value }))}
                  className={inputCls}
                />
                <textarea
                  value={form.billing_address}
                  onChange={(e) => setForm((f) => ({ ...f, billing_address: e.target.value }))}
                  rows={2}
                  className={inputCls + ' md:col-span-2 resize-none'}
                  placeholder="Billing address"
                />
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Items</label>
              <button onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add Item
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(idx, 'description', e.target.value)}
                  className={'flex-1 ' + inputCls}
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                  className={'w-20 ' + inputCls}
                  min="1"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={item.unit_price}
                  onChange={(e) => updateItem(idx, 'unit_price', Number(e.target.value))}
                  className={'w-28 ' + inputCls}
                  min="0"
                  step="0.01"
                />
                <span className="py-2 text-sm font-medium w-24 text-right">
                  {sym}
                  {(item.quantity * item.unit_price).toFixed(2)}
                </span>
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(idx)}
                    className="p-2 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Discount / Tax */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Discount %</label>
              <input
                type="number"
                value={form.discount_pct}
                onChange={(e) => setForm((f) => ({ ...f, discount_pct: Number(e.target.value) }))}
                className={'w-24 ' + inputCls}
                min="0"
                max="100"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Tax %</label>
              <input
                type="number"
                value={form.tax_pct}
                onChange={(e) => setForm((f) => ({ ...f, tax_pct: Number(e.target.value) }))}
                className={'w-24 ' + inputCls}
                min="0"
                max="100"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="bg-secondary/50 rounded-lg p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>
                {sym}
                {subtotal.toFixed(2)}
              </span>
            </div>
            {form.discount_pct > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount ({form.discount_pct}%)</span>
                <span className="text-destructive">
                  -{sym}
                  {discount.toFixed(2)}
                </span>
              </div>
            )}
            {form.tax_pct > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({form.tax_pct}%)</span>
                <span>
                  {sym}
                  {tax.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
              <span>Total</span>
              <span>
                {sym}
                {total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Terms & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium">Terms & Conditions</label>
              <textarea
                value={form.terms}
                onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
                rows={3}
                className={inputCls + ' w-full mt-1 resize-none'}
                placeholder="e.g. Payment due within 30 days. Late fee 1.5%/month."
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className={inputCls + ' w-full mt-1 resize-none'}
                placeholder="Thank you for your business!"
              />
            </div>
          </div>

          {/* Digital Signature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Digital Signature</label>
              <button
                onClick={clearSig}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Eraser className="h-3 w-3" /> Clear
              </button>
            </div>
            <div className="rounded-lg border border-dashed border-border bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={140}
                className="w-full h-[140px] rounded-lg cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Sign above using mouse or touch.</p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-secondary/20 rounded-b-xl">
          <p className="text-xs text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{sym}{total.toFixed(2)}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave('Draft')}
              disabled={saveMut.isPending}
              className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/70 active:scale-[0.97] transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Save className="h-4 w-4" /> Save Draft
            </button>
            <button
              onClick={() => handleSave('Sent')}
              disabled={saveMut.isPending}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Send className="h-4 w-4" /> {saveMut.isPending ? 'Saving...' : 'Save & Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
