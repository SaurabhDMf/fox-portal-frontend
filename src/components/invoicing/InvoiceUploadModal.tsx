import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { X, Upload, FileText } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const inputCls =
  'px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

export default function InvoiceUploadModal({ onClose }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    client_id: '',
    invoice_number: '',
    issue_date: '',
    due_date: '',
    amount: '',
    currency: 'USD',
    notes: '',
  });
  const [file, setFile] = useState<File | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () =>
      api.get('/clients').then((r) => {
        const d = r.data;
        const arr = Array.isArray(d) ? d : d?.data || d?.clients || [];
        return Array.isArray(arr) ? arr : [];
      }),
  });
  const clientsArr = Array.isArray(clients) ? clients : [];

  const uploadMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('client_id', form.client_id);
      fd.append('amount', String(form.amount));
      if (form.invoice_number) fd.append('invoice_number', form.invoice_number);
      if (form.issue_date) fd.append('issue_date', form.issue_date);
      if (form.due_date) fd.append('due_date', form.due_date);
      if (form.currency) fd.append('currency', form.currency);
      if (form.notes) fd.append('notes', form.notes);
      if (file) fd.append('file', file);
      return api.post('/invoices/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice uploaded');
      onClose();
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || 'Upload failed'),
  });

  const submit = () => {
    if (!form.client_id) return toast.error('Select a client');
    if (!form.amount || Number(form.amount) <= 0)
      return toast.error('Enter a valid amount');
    if (file && file.size > 20 * 1024 * 1024)
      return toast.error('PDF must be ≤ 20MB');
    uploadMut.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-xl p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upload Existing Invoice</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground font-medium">
              Client *
            </label>
            <select
              value={form.client_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, client_id: e.target.value }))
              }
              className={inputCls + ' w-full mt-1'}
            >
              <option value="">Select Client</option>
              {clientsArr.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.name || c.contact_name || c.email || c.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium">
              Invoice #
            </label>
            <input
              placeholder="Auto-generated if blank"
              value={form.invoice_number}
              onChange={(e) =>
                setForm((f) => ({ ...f, invoice_number: e.target.value }))
              }
              className={inputCls + ' w-full mt-1'}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">
              Currency
            </label>
            <select
              value={form.currency}
              onChange={(e) =>
                setForm((f) => ({ ...f, currency: e.target.value }))
              }
              className={inputCls + ' w-full mt-1'}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
              <option value="AED">AED</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium">
              Issue Date
            </label>
            <input
              type="date"
              value={form.issue_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, issue_date: e.target.value }))
              }
              className={inputCls + ' w-full mt-1'}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">
              Due Date
            </label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, due_date: e.target.value }))
              }
              className={inputCls + ' w-full mt-1'}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground font-medium">
              Amount *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              className={inputCls + ' w-full mt-1'}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground font-medium">
              Notes
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              className={inputCls + ' w-full mt-1 resize-none'}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground font-medium">
              Invoice PDF (optional, ≤ 20MB)
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="mt-1 border border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-secondary/50 transition-colors"
            >
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>{file.name}</span>
                  <span className="text-muted-foreground text-xs">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground text-sm">
                  <Upload className="h-5 w-5" />
                  <span>Click to upload PDF</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={uploadMut.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {uploadMut.isPending ? 'Uploading...' : 'Upload Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
