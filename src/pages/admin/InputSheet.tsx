import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Pencil, Trash2, ArrowUpRight, Download, Upload, TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import IncomeFormModal, { type IncomeEntry } from '@/components/balance-sheet/IncomeFormModal';
import ImportLeadsModal from '@/components/balance-sheet/ImportLeadsModal';
import BankStatementImportModal from '@/components/balance-sheet/BankStatementImportModal';

const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Input Sheet — INCOMING payments only.
 * - Lists all income entries (sorted by date desc)
 * - Add income manually, import won leads, upload bank/Stripe/Razorpay statement
 * - Filter by year / month / source
 */
export default function InputSheet() {
  const qc = useQueryClient();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');

  const [incomeModal, setIncomeModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [importModal, setImportModal] = useState(false);
  const [bankImportModal, setBankImportModal] = useState(false);

  const { data: incomeData = [] } = useQuery({
    queryKey: ['income'],
    queryFn: () => api.get('/income').then((r) => r.data?.income || r.data || []),
  });
  const incomes: IncomeEntry[] = Array.isArray(incomeData) ? incomeData : [];

  const importedLeadIds = useMemo(
    () => new Set(incomes.filter((i) => i.lead_id).map((i) => String(i.lead_id))),
    [incomes],
  );

  const inRange = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (d.getFullYear() !== year) return false;
    if (month !== 'all' && d.getMonth() !== month) return false;
    return true;
  };

  const filteredIncome = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incomes
      .filter((i) => inRange(i.income_date))
      .filter((i) => !q || (i.title || '').toLowerCase().includes(q) || (i.source || '').toLowerCase().includes(q) || (i.client_name || '').toLowerCase().includes(q));
  }, [incomes, year, month, search]);

  const totalIncome = useMemo(
    () => filteredIncome.reduce((s, i) => s + Number(i.amount || 0), 0),
    [filteredIncome],
  );

  const deleteIncome = useMutation({
    mutationFn: (id: string) => api.delete(`/income/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income'] });
      toast.success('Income deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete'),
  });

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const periodLabel =
    month === 'all'
      ? `${year}`
      : `${new Date(2000, month, 1).toLocaleString('default', { month: 'long' })} ${year}`;

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-success" /> Input Sheet
          </h1>
          <p className="page-subtitle">
            All incoming payments · <span className="text-foreground font-medium">{periodLabel}</span>
          </p>
        </div>
        <button
          onClick={() => {
            setEditingIncome(null);
            setIncomeModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/90 transition-all"
        >
          <ArrowUpRight className="h-4 w-4" /> Add Income
        </button>
      </div>

      {/* Filters + import actions */}
      <div className="glass-card p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 mr-auto">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
          >
            <option value="all">All Months</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>
                {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setBankImportModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-all"
        >
          <Upload className="h-4 w-4" /> Upload Statement
        </button>
        <button
          onClick={() => setImportModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm hover:bg-secondary/80 transition-all"
        >
          <Download className="h-4 w-4" /> Import Won Leads
        </button>
      </div>

      {/* Total card */}
      <div className="glass-card p-5 relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1 bg-success" />
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-success/5" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
              Total Income — {periodLabel}
            </p>
            <p className="text-3xl font-bold mt-1 text-success">{fmtINR(totalIncome)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredIncome.length} {filteredIncome.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-success/10">
            <TrendingUp className="h-6 w-6 text-success" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search income..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-sm focus:border-primary focus:outline-none transition-colors"
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          Showing <span className="text-foreground font-semibold">{filteredIncome.length}</span> of {incomes.length}
        </span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Source</th>
                <th className="text-left px-4 py-3 font-medium">Client</th>
                <th className="text-left px-4 py-3 font-medium">Method</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncome.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                      <div className="p-3 rounded-full bg-success/10 mb-3">
                        <ArrowUpRight className="h-6 w-6 text-success" />
                      </div>
                      <p className="text-sm font-medium">No income entries</p>
                      <p className="text-xs mt-1">Add income, upload statement, or import won leads</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredIncome.map((i) => (
                  <tr
                    key={i.id}
                    className="border-t border-border hover:bg-secondary/20 transition-colors group"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {i.income_date?.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {i.title}
                      {i.lead_id && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          CRM
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md bg-success/10 text-success text-xs font-medium">
                        {i.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{i.client_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.payment_method || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-success whitespace-nowrap">
                      +{fmtINR(Number(i.amount || 0))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingIncome(i);
                            setIncomeModal(true);
                          }}
                          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => i.id && deleteIncome.mutate(i.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <IncomeFormModal
        open={incomeModal}
        onClose={() => setIncomeModal(false)}
        income={editingIncome}
      />
      <ImportLeadsModal
        open={importModal}
        onClose={() => setImportModal(false)}
        importedLeadIds={importedLeadIds}
      />
      <BankStatementImportModal open={bankImportModal} onClose={() => setBankImportModal(false)} />
    </div>
  );
}
