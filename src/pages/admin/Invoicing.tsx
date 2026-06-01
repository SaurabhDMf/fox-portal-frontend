import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Plus, Send, DollarSign, CheckCircle, Clock, AlertTriangle, FileText, Upload, Download, Trash2, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import StatCard from '@/components/ui/StatCard';
import { useModulePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/stores/authStore';
import { useCompanyCurrency } from '@/hooks/useCompanyCurrency';
import { confirmAction } from '@/lib/confirmDialog';

import InvoiceCreateModal from '@/components/invoicing/InvoiceCreateModal';
import InvoiceUploadModal from '@/components/invoicing/InvoiceUploadModal';
import InvoicePrintView from '@/components/invoicing/InvoicePrintView';
import SendInvoiceModal from '@/components/invoicing/SendInvoiceModal';
import ShareInvoiceModal from '@/components/invoicing/ShareInvoiceModal';

const statusTabs = ['All', 'Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];

const fmtAmount = (amount: number, currency?: string) => {
  const cur = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency', currency: cur,
      minimumFractionDigits: 0, maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${cur} ${Number(amount).toLocaleString()}`;
  }
};

const API_BASE = import.meta.env.VITE_API_URL || 'https://foxportal.in/api/v1';

function buildPdfUrl(id: string) {
  return `${API_BASE}/invoices/${id}/pdf`;
}

async function downloadPdf(inv: any) {
  try {
    const res = await api.get(`/invoices/${inv.id}/pdf`, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.invoice_number || inv.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('No PDF available for this invoice');
  }
}

export default function Invoicing() {
  const perm = useModulePermission('invoicing');
  const role = useAuthStore(s => s.user?.role);
  const { currencySymbol, companyCurrency } = useCompanyCurrency();
  const isAdmin = role === 'admin' || role === 'super_admin';
  const canDelete = (inv: any) =>
    isAdmin || (inv.status !== 'Paid' && inv.status !== 'Partially Paid');
  const [tab, setTab] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showPrint, setShowPrint] = useState<any>(null);
  const [showSend, setShowSend] = useState<any>(null);
  const [showShare, setShowShare] = useState<any>(null);
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: (_res, id) => {
      qc.setQueryData(['invoices', tab], (old: any) => {
        if (!old) return old;
        const list = old?.invoices || old?.data || (Array.isArray(old) ? old : []);
        const filtered = (Array.isArray(list) ? list : []).filter((i: any) => i.id !== id);
        if (Array.isArray(old)) return filtered;
        if (old?.invoices) return { ...old, invoices: filtered };
        if (old?.data) return { ...old, data: filtered };
        return old;
      });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setShowPrint(null);
      toast.success('Invoice deleted');
    },
    onError: (e: any) => {
      if (e?.response?.status === 403) toast.error(e?.response?.data?.error || 'Only admins can delete paid invoices');
      else toast.error(e?.response?.data?.message || 'Failed to delete invoice');
    },
  });

  const handleDelete = async (inv: any) => {
    const number = inv.invoice_number || `INV-${inv.id?.slice(0, 6)}`;
    const ok = await confirmAction({
      title: 'Delete invoice',
      description: `Permanently delete invoice ${number}? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deleteMut.mutate(inv.id);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', tab],
    queryFn: () => api.get('/invoices', { params: { status: tab === 'All' ? undefined : tab } }).then(r => r.data),
  });

  const rawInvoices = data?.invoices || data?.data || (Array.isArray(data) ? data : []);
  const invoices = Array.isArray(rawInvoices) ? rawInvoices : [];
  const stats = data?.stats || { total_billed: 0, collected: 0, outstanding: 0, overdue: 0 };

  const viewDetail = async (inv: any) => {
    try {
      const { data } = await api.get(`/invoices/${inv.id}`);
      setShowPrint(data);
    } catch {
      setShowPrint(inv);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Invoices</h1><p className="page-subtitle">Manage billing and payments</p></div>
        {perm.canCreate && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/70 active:scale-[0.97] transition-all">
              <Upload className="h-4 w-4" /> Upload PDF
            </button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
              <Plus className="h-4 w-4" /> New Invoice
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Billed" value={fmtAmount(Number(stats.total_billed || 0), companyCurrency)} icon={FileText} />
        <StatCard label="Collected" value={fmtAmount(Number(stats.collected || 0), companyCurrency)} icon={CheckCircle} iconColor="text-success" />
        <StatCard label="Outstanding" value={fmtAmount(Number(stats.outstanding || 0), companyCurrency)} icon={Clock} iconColor="text-warning" />
        <StatCard label="Overdue" value={fmtAmount(Number(stats.overdue || 0), companyCurrency)} icon={AlertTriangle} iconColor="text-destructive" />
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
              <th className="p-4">Invoice #</th><th className="p-4">Client</th><th className="p-4">Amount</th><th className="p-4">Due Date</th><th className="p-4">Source</th><th className="p-4">Status</th><th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={7} className="p-4"><div className="h-4 bg-secondary rounded animate-pulse" /></td></tr>) :
            (Array.isArray(invoices) ? invoices : []).map((inv: any) => (
              <tr key={inv.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => viewDetail(inv)}>
                <td className="p-4 font-medium">{inv.invoice_number || `INV-${inv.id?.slice(0, 6)}`}</td>
                <td className="p-4">{inv.client_name || inv.company_name || '—'}</td>
                <td className="p-4 font-medium">{fmtAmount(Number(inv.total || inv.total_amount || inv.amount || 0), inv.currency)}</td>
                <td className="p-4 text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                <td className="p-4">
                  {inv.source === 'uploaded' ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-info/15 text-info"><Upload className="h-3 w-3" /> Uploaded</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Generated</span>
                  )}
                </td>
                <td className="p-4">
                  <span className={inv.status === 'Paid' ? 'badge-success' : inv.status === 'Overdue' ? 'badge-danger' : inv.status === 'Sent' ? 'badge-info' : inv.status === 'Cancelled' ? 'badge-neutral' : 'badge-warning'}>{inv.status}</span>
                </td>
                <td className="p-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => viewDetail(inv)} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
                      <FileText className="h-3 w-3" /> View
                    </button>
                    {inv.has_pdf && (
                      <button onClick={() => downloadPdf(inv)} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        <Download className="h-3 w-3" /> PDF
                      </button>
                    )}
                    {(inv.status === 'Draft' || inv.status === 'Sent' || inv.status === 'Overdue') && (
                      <button onClick={() => setShowSend(inv)} className="text-xs flex items-center gap-1 text-primary hover:underline">
                        <Send className="h-3 w-3" /> Send
                      </button>
                    )}
                    <button onClick={() => setShowShare(inv)} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-primary">
                      <Link2 className="h-3 w-3" /> Share
                    </button>
                    {canDelete(inv) && (
                      <button
                        onClick={() => handleDelete(inv)}
                        disabled={deleteMut.isPending}
                        className="text-xs flex items-center gap-1 text-destructive hover:underline disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <InvoiceCreateModal onClose={() => setShowCreate(false)} />}
      {showUpload && <InvoiceUploadModal onClose={() => setShowUpload(false)} />}
      {showPrint && <InvoicePrintView invoice={showPrint} onClose={() => setShowPrint(null)} onDelete={canDelete(showPrint) ? () => handleDelete(showPrint) : undefined} />}
      {showSend && <SendInvoiceModal invoice={showSend} onClose={() => setShowSend(null)} />}
      {showShare && <ShareInvoiceModal invoiceId={showShare.id} invoiceNumber={showShare.invoice_number} onClose={() => setShowShare(null)} />}
    </div>
  );
}
