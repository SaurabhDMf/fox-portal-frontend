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

  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
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
      fd.append('client_id', clientId);
      if (amount) fd.append('amount', amount);
      if (currency) fd.append('currency', currency);
      if (issueDate) fd.append('issue_date', issueDate);
      if (dueDate) fd.append('due_date', dueDate);
      if (file) fd.append('file', file);
      return api.post('/invoices/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice uploaded — visible in client portal');
      onClose();
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || 'Upload failed'),
  });

  const submit = () => {
    if (!clientId) return toast.error('Select a client');
    if (!file) return toast.error('Choose a PDF file');
    if (file.size > 20 * 1024 * 1024) return toast.error('PDF must be ≤ 20MB');
    uploadMut.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Upload Invoice PDF</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The client will see the exact PDF you upload — no other fields needed.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium">
              Client *
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
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

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground font-medium">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls + ' w-full mt-1'}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputCls + ' w-full mt-1'}
              >
                <option value="USD">USD</option>
                <option value="INR">INR</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <label className="text-xs text-muted-foreground font-medium">Issue Date</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className={inputCls + ' w-full mt-1 min-w-[160px]'}
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-xs text-muted-foreground font-medium">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputCls + ' w-full mt-1 min-w-[160px]'}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium">
              Invoice PDF * (≤ 20MB)
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="mt-1 border border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-secondary/50 transition-colors"
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
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-muted-foreground text-xs">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground text-sm">
                  <Upload className="h-6 w-6" />
                  <span>Click to upload PDF</span>
                  <span className="text-xs">This file will be shown as-is in the client portal</span>
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
