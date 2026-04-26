import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, X, Trash2, Save, Send, Eraser, Hash, Loader2 } from 'lucide-react';

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  unit?: string;
  hsn_code?: string;
}

interface Props {
  onClose: () => void;
  existing?: any; // when provided, the modal is in "edit" mode and PUTs to /invoices/:id
}

const inputCls =
  'px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

const currencySymbol = (c: string) => {
  switch (c) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'AED': return 'AED ';
    case 'SGD': return 'S$';
    case 'CAD': return 'C$';
    case 'AUD': return 'A$';
    case 'INR': return '₹';
    default: return '';
  }
};

const PAYMENT_TERMS_PRESETS = ['Due on Receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Custom'];
const UNIT_OPTIONS = ['hrs', 'days', 'pcs', 'kg', 'l', 'm', 'sqft', 'fixed'];
const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'CAD', 'AUD'];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function InvoiceCreateModal({ onClose, existing }: Props) {
  const qc = useQueryClient();
  const isEdit = !!existing?.id;

  const [form, setForm] = useState({
    client_id: '',
    project_id: '',
    issue_date: todayISO(),
    due_date: '',
    po_number: '',
    currency: 'USD',
    discount_pct: 0,
    tax_pct: 0,
    tax_label: '',
    payment_terms: '',
    payment_terms_custom: '',
    notes: '',
    terms: '',
    billing_address: '',
    billing_email: '',
    billing_phone: '',
    billing_contact_name: '',
    billing_company_name: '',
    billing_gst_number: '',
    invoice_number: '',
  });
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0, unit: '', hsn_code: '' },
  ]);
  const [signatureData, setSignatureData] = useState<string>('');
  const [clientProjects, setClientProjects] = useState<Array<{ id: string; name: string; status?: string }>>([]);

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

  // Defaults from company (skipped in edit mode — existing values win)
  useEffect(() => {
    if (!company || isEdit) return;
    setForm((f) => {
      const companyTerms: string = company.payment_terms || '';
      const isPreset = PAYMENT_TERMS_PRESETS.includes(companyTerms);
      return {
        ...f,
        currency: f.currency || company.default_currency || 'USD',
        terms: f.terms || company.payment_terms || '',
        notes: f.notes || company.invoice_notes || '',
        payment_terms: f.payment_terms || (companyTerms ? (isPreset ? companyTerms : 'Custom') : ''),
        payment_terms_custom: f.payment_terms_custom || (companyTerms && !isPreset ? companyTerms : ''),
        invoice_number:
          f.invoice_number ||
          `${company.invoice_prefix || 'INV'}-${String(Date.now()).slice(-6)}`,
      };
    });
  }, [company, isEdit]);

  // Prefill from existing invoice when editing
  useEffect(() => {
    if (!existing) return;
    const e: any = existing;
    const terms: string = e.payment_terms || '';
    const isPreset = PAYMENT_TERMS_PRESETS.includes(terms);
    setForm({
      client_id: e.client_id || e.client?.id || '',
      project_id: e.project_id || e.project?.id || '',
      issue_date: (e.issue_date || e.created_at || '').slice(0, 10) || todayISO(),
      due_date: (e.due_date || '').slice(0, 10),
      po_number: e.po_number || '',
      currency: e.currency || 'USD',
      discount_pct: Number(e.discount_pct) || 0,
      tax_pct: Number(e.tax_pct) || 0,
      tax_label: e.tax_label || '',
      payment_terms: terms ? (isPreset ? terms : 'Custom') : '',
      payment_terms_custom: terms && !isPreset ? terms : '',
      notes: e.notes || '',
      terms: e.terms || '',
      billing_address: e.billing_address || '',
      billing_email: e.billing_email || '',
      billing_phone: e.billing_phone || '',
      billing_contact_name: e.billing_contact_name || '',
      billing_company_name: e.billing_company_name || e.billing_name || '',
      billing_gst_number: e.billing_gst_number || '',
      invoice_number: e.invoice_number || '',
    });
    if (Array.isArray(e.items) && e.items.length) {
      setItems(
        e.items.map((it: any) => ({
          description: it.description || '',
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          unit: it.unit || '',
          hsn_code: it.hsn_code || '',
        })),
      );
    }
    if (e.signature) setSignatureData(e.signature);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

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

  // Fetch full invoice-data for the selected client and auto-fill billing fields
  const { data: invoiceData, isFetching: loadingClientData } = useQuery({
    queryKey: ['client-invoice-data', form.client_id],
    enabled: !!form.client_id,
    queryFn: () =>
      api
        .get(`/clients/${form.client_id}/invoice-data`)
        .then((r) => r.data?.data ?? r.data ?? {}),
  });

  useEffect(() => {
    if (!invoiceData) return;
    const d: any = invoiceData;

    // Build address: prefer structured billing_address, otherwise compose from fields
    let addr = '';
    const ba = d.billing_address;
    if (ba && typeof ba === 'object') {
      addr = [ba.line1 || ba.address_line1, ba.line2 || ba.address_line2, ba.city, ba.state, ba.postal_code || ba.zip, ba.country]
        .filter(Boolean)
        .join(', ');
    } else if (typeof ba === 'string' && ba.trim()) {
      addr = ba;
    }
    if (!addr) {
      addr = [d.address_line1, d.address_line2, d.city, d.state, d.postal_code, d.country]
        .filter(Boolean)
        .join(', ');
    }

    setForm((f) => ({
      ...f,
      billing_company_name: d.company_name || f.billing_company_name,
      billing_contact_name: d.contact_name || f.billing_contact_name,
      billing_email: d.contact_email || d.email || f.billing_email,
      billing_phone: d.contact_phone || d.phone || f.billing_phone,
      billing_address: addr || f.billing_address,
      billing_gst_number: d.gst_number || f.billing_gst_number,
      project_id: '', // reset project selection on client change
    }));

    setClientProjects(Array.isArray(d.projects) ? d.projects : []);
  }, [invoiceData]);

  // Reset projects + project_id immediately when client cleared
  useEffect(() => {
    if (!form.client_id) {
      setClientProjects([]);
      setForm((f) => ({ ...f, project_id: '' }));
    }
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

  const effectivePaymentTerms = () =>
    form.payment_terms === 'Custom' ? form.payment_terms_custom : form.payment_terms;

  const buildPayload = (extra: Record<string, any> = {}) => {
    const cleanItems = items
      .filter((i) => i.description.trim())
      .map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        unit: i.unit || null,
        hsn_code: i.hsn_code || null,
      }));
    const { payment_terms_custom, ...rest } = form;
    const payload: any = {
      ...rest,
      payment_terms: effectivePaymentTerms() || null,
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

  const addItem = () => setItems([...items, { description: '', quantity: 1, unit_price: 0, unit: '', hsn_code: '' }]);
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
                {company?.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt="Logo"
                    className="h-12 w-12 object-contain rounded bg-background p-1 border border-border shrink-0"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = 'none';
                      const fallback = img.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="h-12 w-12 rounded bg-background border border-border items-center justify-center text-xs font-semibold text-muted-foreground shrink-0"
                  style={{ display: company?.logo_url ? 'none' : 'flex' }}
                >
                  {companyName.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-sm min-w-0 flex-1">
                  <p className="font-semibold truncate">{companyName}</p>
                  {companyAddress && (
                    <p className="text-xs text-muted-foreground leading-tight mt-0.5 break-words">{companyAddress}</p>
                  )}
                  {company?.email && <p className="text-xs text-muted-foreground truncate">{company.email}</p>}
                  {company?.phone && <p className="text-xs text-muted-foreground">{company.phone}</p>}
                  {(company?.gst_number || company?.tax_id) && (
                    <p className="text-xs text-muted-foreground">GST: {company.gst_number || company.tax_id}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
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
                <div>
                  <label className="text-xs text-muted-foreground font-medium">PO / Reference No.</label>
                  <input
                    value={form.po_number}
                    onChange={(e) => setForm((f) => ({ ...f, po_number: e.target.value }))}
                    className={inputCls + ' w-full mt-1'}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Issue Date</label>
                  <input
                    type="date"
                    value={form.issue_date}
                    onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))}
                    className={inputCls + ' w-full mt-1'}
                  />
                </div>
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
                    {CURRENCY_OPTIONS.map((c) => (
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
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Bill To</p>
              {loadingClientData && (
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading client…
                </span>
              )}
            </div>
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
              <>
                {/* Project picker (optional) */}
                <div>
                  <label className="text-[11px] text-muted-foreground">Link to Project (optional)</label>
                  <select
                    value={form.project_id}
                    onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                    className={inputCls + ' w-full mt-1'}
                    disabled={loadingClientData}
                  >
                    <option value="">— No project —</option>
                    {clientProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.status ? ` (${p.status})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${loadingClientData ? 'opacity-60' : ''}`}>
                  <input
                    placeholder="Company / Bill to name"
                    value={form.billing_company_name}
                    onChange={(e) => setForm((f) => ({ ...f, billing_company_name: e.target.value }))}
                    className={inputCls}
                  />
                  <input
                    placeholder="Contact person"
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
                  <input
                    placeholder="Client phone"
                    value={form.billing_phone}
                    onChange={(e) => setForm((f) => ({ ...f, billing_phone: e.target.value }))}
                    className={inputCls}
                  />
                  <input
                    placeholder="GST Number (optional)"
                    value={form.billing_gst_number}
                    onChange={(e) => setForm((f) => ({ ...f, billing_gst_number: e.target.value }))}
                    className={inputCls + ' md:col-span-2'}
                  />
                  <div className="md:col-span-2 relative">
                    <textarea
                      value={form.billing_address}
                      onChange={(e) => setForm((f) => ({ ...f, billing_address: e.target.value }))}
                      rows={2}
                      className={inputCls + ' w-full resize-none'}
                      placeholder="Billing address"
                    />
                    {loadingClientData && (
                      <Loader2 className="h-4 w-4 animate-spin absolute top-2 right-2 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </>
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
            {items.map((item, idx) => {
              const isCustomUnit = !!item.unit && !UNIT_OPTIONS.includes(item.unit);
              return (
                <div key={idx} className="flex gap-2 items-start flex-wrap md:flex-nowrap">
                  <input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    className={'flex-1 min-w-[160px] ' + inputCls}
                  />
                  <select
                    value={isCustomUnit ? '__custom__' : (item.unit || '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__custom__') updateItem(idx, 'unit', ' ');
                      else updateItem(idx, 'unit', v);
                    }}
                    className={'w-24 ' + inputCls}
                    title="Unit"
                  >
                    <option value="">Unit</option>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    <option value="__custom__">custom…</option>
                  </select>
                  {isCustomUnit && (
                    <input
                      placeholder="unit"
                      value={item.unit || ''}
                      onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                      className={'w-20 ' + inputCls}
                    />
                  )}
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
                  {form.billing_gst_number && (
                    <input
                      placeholder="HSN/SAC"
                      value={item.hsn_code || ''}
                      onChange={(e) => updateItem(idx, 'hsn_code', e.target.value)}
                      className={'w-24 ' + inputCls}
                    />
                  )}
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
              );
            })}
          </div>

          {/* Discount / Tax */}
          <div className="space-y-3">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium">Tax Label</label>
                <input
                  value={form.tax_label}
                  onChange={(e) => setForm((f) => ({ ...f, tax_label: e.target.value }))}
                  className={inputCls + ' w-full mt-1'}
                  placeholder="e.g. GST, IGST 18%, VAT"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">Payment Terms</label>
                <select
                  value={form.payment_terms}
                  onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))}
                  className={inputCls + ' w-full mt-1'}
                >
                  <option value="">Select…</option>
                  {PAYMENT_TERMS_PRESETS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {form.payment_terms === 'Custom' && (
                  <input
                    value={form.payment_terms_custom}
                    onChange={(e) => setForm((f) => ({ ...f, payment_terms_custom: e.target.value }))}
                    className={inputCls + ' w-full mt-2'}
                    placeholder="Enter custom payment terms"
                  />
                )}
              </div>
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxable Amount</span>
              <span>
                {sym}
                {taxable.toFixed(2)}
              </span>
            </div>
            {form.tax_pct > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {form.tax_label ? form.tax_label : 'Tax'} ({form.tax_pct}%)
                </span>
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
