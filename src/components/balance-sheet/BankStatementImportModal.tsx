import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle2, Loader2, ArrowRight, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/components/expenses/ExpenseFormModal';
import { INCOME_SOURCES } from './IncomeFormModal';

const PDFJS_VERSION = '4.0.379';
const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/legacy/build`;
let pdfJsPromise: Promise<any> | null = null;

function loadPdfJs(): Promise<any> {
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      return resolve((window as any).pdfjsLib);
    }
    const script = document.createElement('script');
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) return reject(new Error('Failed to load pdfjs'));
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      resolve(lib);
    };
    script.onerror = () => reject(new Error('Failed to load pdfjs from CDN'));
    document.head.appendChild(script);
  });
  return pdfJsPromise;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

interface ParsedRow {
  _id: string;
  raw: Record<string, any>;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  reference?: string;
  include: boolean;
}

interface ColumnMap {
  date: string;
  description: string;
  debit: string;
  credit: string;
  amount: string;
  reference: string;
}

const FIELD_HINTS: Record<keyof ColumnMap, string[]> = {
  date: ['date', 'txn date', 'transaction date', 'value date', 'posting date', 'tran date'],
  description: ['description', 'narration', 'particulars', 'details', 'remarks', 'memo'],
  debit: ['debit', 'withdrawal', 'dr', 'paid out', 'money out', 'withdrawal amt'],
  credit: ['credit', 'deposit', 'cr', 'paid in', 'money in', 'deposit amt'],
  amount: ['amount', 'amt', 'value'],
  reference: ['reference', 'ref no', 'cheque', 'chq', 'utr', 'transaction id', 'txn id'],
};

const NONE = '__none__';

// ── Gateway format detection & parsing ──────────────────────────────────────

type GatewayFormat = 'auto' | 'bank' | 'stripe' | 'razorpay';

function detectGatewayFormat(headers: string[]): GatewayFormat {
  const norm = (s: string) => s.toLowerCase().trim();
  const nh = headers.map(norm);

  // Stripe — two known shapes:
  //   1. Balance transactions export: has "net" + "fee" + "available_on"
  //   2. Payments export (your file): has "captured" + "converted amount" + "customer email"
  if (nh.some(h => h === 'available_on' || h === 'available on') && nh.some(h => h === 'net' || h === 'fee')) return 'stripe';
  if (nh.some(h => h === 'captured') && nh.some(h => h.includes('converted amount'))) return 'stripe';
  if (nh.some(h => h.startsWith('created date')) && nh.some(h => h === 'customer email')) return 'stripe';

  // Razorpay — two known shapes:
  //   1. Settlements export: has "payment id" + "settlement amount"
  //   2. Payments export (your file): has "id" + "auth_code" / "payments_arn" / "payments_rrn"
  if (nh.some(h => h.includes('payment id') || h === 'payment_id') && nh.some(h => h.includes('settlement'))) return 'razorpay';
  if (nh.includes('auth_code') || nh.includes('payments_arn') || nh.includes('payments_rrn')) return 'razorpay';

  return 'bank';
}

function parseStripeRows(rows: Record<string, any>[], fileName: string): ParsedRow[] {
  return rows
    .filter(r => {
      // Skip declined/failed payments, refunds, etc.
      const status = String(r['Status'] ?? r['status'] ?? '').toLowerCase();
      const captured = String(r['Captured'] ?? r['captured'] ?? '').toLowerCase();
      if (status && status !== 'paid' && status !== 'succeeded' && status !== 'available') return false;
      if (captured === 'false') return false;
      const type = String(r['type'] || r['Type'] || '').toLowerCase();
      return !type || type === 'charge' || type === 'payment' || type === 'transfer';
    })
    .map((r, idx) => {
      // Prefer Converted Amount (in INR for Indian Stripe accounts) since the
      // user's balance sheet is in INR. Fall back to Amount + Currency,
      // then Net (balance-transactions export).
      const convertedRaw = r['Converted Amount'] ?? r['converted amount'] ?? r['converted_amount'];
      const amountRaw    = r['Amount'] ?? r['amount'];
      const netRaw       = r['net'] ?? r['Net'];

      let amount = 0;
      let isCents = false;
      if (convertedRaw !== undefined && convertedRaw !== '') {
        amount = parseAmount(convertedRaw);
      } else if (amountRaw !== undefined && amountRaw !== '') {
        amount = parseAmount(amountRaw);
      } else if (netRaw !== undefined && netRaw !== '') {
        amount = parseAmount(netRaw);
        isCents = true; // Balance-transactions export uses cents
      }
      if (amount <= 0) return null;
      if (isCents) amount = amount / 100;

      const createdRaw =
        r['Created date (UTC)'] ?? r['Created Date (UTC)'] ?? r['Created'] ??
        r['created'] ?? r['available_on'] ?? r['Available On'] ?? '';
      const date = parseDateCell(createdRaw);
      if (!date) return null;

      const customerEmail = r['Customer Email'] ?? r['customer_email'] ?? '';
      const description   = r['Description'] ?? r['description'] ?? r['statement_descriptor'] ?? '';
      const invoiceId     = r['Invoice ID'] ?? r['invoice_id'] ?? '';
      const desc = [description, customerEmail].filter(Boolean).join(' — ') || invoiceId || 'Stripe payment';

      const ref = r['id'] ?? r['Id'] ?? r['source'] ?? r['Source'] ?? '';

      return {
        _id: `stripe-${idx}`,
        raw: r,
        date,
        description: String(desc).trim().slice(0, 120),
        amount,
        type: 'income' as const,
        reference: String(ref).trim(),
        include: true,
      };
    })
    .filter(Boolean) as ParsedRow[];
}

function parseRazorpayRows(rows: Record<string, any>[], fileName: string): ParsedRow[] {
  return rows
    .filter(r => {
      const status = String(r['status'] ?? r['Status'] ?? r['Payment Status'] ?? '').toLowerCase();
      // Only include successful payments. Razorpay 'captured' = payment completed.
      return !status || status === 'captured' || status === 'settled' || status === 'success' || status === 'authorized';
    })
    .map((r, idx) => {
      // Razorpay Payments export amounts are decimal (e.g. 300.00), not paise.
      // Settlements export uses paise. Detect by checking for very large
      // integer values (> 100,000) without decimals — those are paise.
      const settlementRaw = r['Settlement Amount'] ?? r['settlement_amount'];
      const amountRaw     = r['Amount'] ?? r['amount'];

      let amount = 0;
      if (settlementRaw !== undefined && settlementRaw !== '') {
        // Settlements export — paise
        amount = parseAmount(settlementRaw) / 100;
      } else if (amountRaw !== undefined && amountRaw !== '') {
        // Payments export — already decimal in selected currency
        amount = parseAmount(amountRaw);
      }
      if (amount <= 0) return null;

      const dateRaw =
        r['created_at'] ?? r['Created At'] ?? r['Settled At'] ??
        r['settled_at'] ?? r['Date'] ?? '';
      const date = parseDateCell(dateRaw);
      if (!date) return null;

      const email   = r['email'] ?? r['Email'] ?? r['contact'] ?? r['Contact'] ?? '';
      const method  = r['method'] ?? r['Method'] ?? '';
      const description = r['description'] ?? r['Description'] ?? '';
      const currency    = r['currency'] ?? r['Currency'] ?? '';

      const parts = [description || `Razorpay${method ? ` (${method})` : ''}`];
      if (email) parts.push(email);
      if (currency && currency !== 'INR') parts.push(currency);
      const desc = parts.filter(Boolean).join(' — ');

      const ref = r['id'] ?? r['Id'] ?? r['Payment ID'] ?? r['payment_id'] ?? r['Order ID'] ?? r['order_id'] ?? '';

      return {
        _id: `rzp-${idx}`,
        raw: r,
        date,
        description: desc.slice(0, 120),
        amount,
        type: 'income' as const,
        reference: String(ref).trim(),
        include: true,
      };
    })
    .filter(Boolean) as ParsedRow[];
}

function autoDetect(headers: string[]): ColumnMap {
  const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
  const map: ColumnMap = { date: NONE, description: NONE, debit: NONE, credit: NONE, amount: NONE, reference: NONE };
  (Object.keys(FIELD_HINTS) as (keyof ColumnMap)[]).forEach((field) => {
    for (const h of headers) {
      const nh = norm(h);
      if (FIELD_HINTS[field].some((hint) => nh === hint || nh.includes(hint))) {
        map[field] = h;
        return;
      }
    }
  });
  return map;
}

function parseDateCell(v: any): string {
  if (!v && v !== 0) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();

  // Strip any time component first ("01/04/2026 18:57:29" → "01/04/2026")
  // so the date-only regex matches even when timestamps are appended.
  const datePart = s.split(/[\sT]/)[0];

  // ISO format: yyyy-mm-dd (recognise this BEFORE the dd/mm/yyyy branch
  // since both share the same separators)
  const iso = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, mo, d] = iso;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Day-first: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy (Indian/UK/AU convention).
  // This is the format Razorpay uses ("13/04/2026 11:16:10") and ICICI uses
  // ("01/Apr/2026"). We treat the first segment as DAY because most of our
  // imports come from Indian banks/gateways.
  const dmy = datePart.match(/^(\d{1,2})[\/\-.](\d{1,2}|[A-Za-z]{3,9})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let [, d, mo, y] = dmy;
    if (y.length === 2) y = '20' + y;
    let monthNum: string;
    if (/^\d+$/.test(mo)) {
      monthNum = mo.padStart(2, '0');
    } else {
      // Month abbreviation like "Apr" → 04
      const monthIdx = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
        .indexOf(mo.slice(0, 3).toLowerCase());
      if (monthIdx < 0) return '';
      monthNum = String(monthIdx + 1).padStart(2, '0');
    }
    return `${y}-${monthNum}-${d.padStart(2, '0')}`;
  }

  // Fallback: let JS try (handles "Apr 13, 2026" etc.). Note: JS interprets
  // "01/04/2026" as Jan 4 (US format) — we deliberately matched dd/mm above
  // first so this fallback is safe for unusual inputs only.
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

function parseAmount(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[₹$,\s]/g, '').replace(/[()]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export default function BankStatementImportModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [gatewayFormat, setGatewayFormat] = useState<GatewayFormat>('auto');
  const [detectedFormat, setDetectedFormat] = useState<GatewayFormat>('bank');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [colMap, setColMap] = useState<ColumnMap>({ date: NONE, description: NONE, debit: NONE, credit: NONE, amount: NONE, reference: NONE });
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [defaultCategory, setDefaultCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [defaultSource, setDefaultSource] = useState<string>('Bank Transfer');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, success: 0, failed: 0 });
  const [parseError, setParseError] = useState<string>('');

  useEffect(() => {
    if (!open) {
      setStep('upload');
      setFileName(''); setHeaders([]); setRows([]); setParsed([]);
      setColMap({ date: NONE, description: NONE, debit: NONE, credit: NONE, amount: NONE, reference: NONE });
      setParseError('');
      setGatewayFormat('auto');
      setDetectedFormat('bank');
      setProgress({ done: 0, total: 0, success: 0, failed: 0 });
    }
  }, [open]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError('');
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
        // Find first row that looks like a header (most non-empty text cells)
        let headerIdx = 0;
        let bestScore = 0;
        for (let i = 0; i < Math.min(json.length, 15); i++) {
          const score = json[i].filter((c) => typeof c === 'string' && c.trim().length > 0).length;
          if (score > bestScore) { bestScore = score; headerIdx = i; }
        }
        const hdrs = json[headerIdx].map((h, i) => String(h || `Column ${i + 1}`).trim());
        const dataRows = json.slice(headerIdx + 1)
          .filter((r) => r.some((c) => c !== '' && c !== null && c !== undefined))
          .map((r) => {
            const obj: Record<string, any> = {};
            hdrs.forEach((h, i) => { obj[h] = r[i]; });
            return obj;
          });
        setHeaders(hdrs);
        setRows(dataRows);

        // Detect gateway format and skip column mapping for known formats
        const resolved: GatewayFormat = gatewayFormat === 'auto' ? detectGatewayFormat(hdrs) : gatewayFormat;
        setDetectedFormat(resolved);

        if (resolved === 'stripe') {
          setParsed(parseStripeRows(dataRows, file.name));
          setStep('preview');
        } else if (resolved === 'razorpay') {
          setParsed(parseRazorpayRows(dataRows, file.name));
          setStep('preview');
        } else {
          setColMap(autoDetect(hdrs));
          setStep('mapping');
        }
      } else if (ext === 'pdf') {
        await parsePdf(file);
      } else {
        setParseError('Unsupported format. Please upload .xlsx, .xls, .csv or .pdf');
      }
    } catch (e: any) {
      setParseError(e.message || 'Failed to parse file');
    }
  };

  const parsePdf = async (file: File) => {
    try {
      const pdfjs: any = await loadPdfJs();
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      const lines: string[][] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        // Group items by Y to reconstruct rows
        const byY = new Map<number, { x: number; text: string }[]>();
        tc.items.forEach((it: any) => {
          const y = Math.round(it.transform[5]);
          if (!byY.has(y)) byY.set(y, []);
          byY.get(y)!.push({ x: it.transform[4], text: it.str });
        });
        const ys = Array.from(byY.keys()).sort((a, b) => b - a);
        ys.forEach((y) => {
          const cells = byY.get(y)!.sort((a, b) => a.x - b.x).map((c) => c.text.trim()).filter(Boolean);
          if (cells.length > 1) lines.push(cells);
        });
      }
      if (lines.length === 0) {
        setParseError('No tabular data found in PDF. Try Excel/CSV export instead.');
        return;
      }
      // Pick header row: row with most text cells in top 20
      let headerIdx = 0;
      let bestScore = 0;
      for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const score = lines[i].filter((c) => /[a-zA-Z]/.test(c) && !/^\d/.test(c)).length;
        if (score > bestScore) { bestScore = score; headerIdx = i; }
      }
      const hdrs = lines[headerIdx].map((h, i) => h || `Column ${i + 1}`);
      const dataRows = lines.slice(headerIdx + 1).map((r) => {
        const obj: Record<string, any> = {};
        hdrs.forEach((h, i) => { obj[h] = r[i] ?? ''; });
        return obj;
      });
      setHeaders(hdrs);
      setRows(dataRows);
      const resolved: GatewayFormat = gatewayFormat === 'auto' ? detectGatewayFormat(hdrs) : gatewayFormat;
      setDetectedFormat(resolved);
      if (resolved === 'stripe') {
        setParsed(parseStripeRows(dataRows, file.name));
        setStep('preview');
      } else if (resolved === 'razorpay') {
        setParsed(parseRazorpayRows(dataRows, file.name));
        setStep('preview');
      } else {
        setColMap(autoDetect(hdrs));
        setStep('mapping');
      }
    } catch (e: any) {
      setParseError('PDF parse failed: ' + (e.message || 'unknown'));
    }
  };

  const buildParsed = () => {
    const out: ParsedRow[] = [];
    rows.forEach((r, idx) => {
      const date = parseDateCell(colMap.date !== NONE ? r[colMap.date] : '');
      const description = colMap.description !== NONE ? String(r[colMap.description] || '').trim() : '';
      const reference = colMap.reference !== NONE ? String(r[colMap.reference] || '').trim() : '';
      let amount = 0;
      let type: 'income' | 'expense' = 'expense';
      if (colMap.debit !== NONE || colMap.credit !== NONE) {
        const debit = parseAmount(colMap.debit !== NONE ? r[colMap.debit] : 0);
        const credit = parseAmount(colMap.credit !== NONE ? r[colMap.credit] : 0);
        if (credit > 0) { amount = credit; type = 'income'; }
        else if (debit > 0) { amount = debit; type = 'expense'; }
      } else if (colMap.amount !== NONE) {
        const a = parseAmount(r[colMap.amount]);
        amount = Math.abs(a);
        type = a >= 0 ? 'income' : 'expense';
      }
      if (!date || !amount) return;
      out.push({
        _id: `r-${idx}`,
        raw: r,
        date,
        description: description || 'Bank transaction',
        amount,
        type,
        category: type === 'expense' ? defaultCategory : undefined,
        reference,
        include: true,
      });
    });
    setParsed(out);
    setStep('preview');
  };

  const includedCount = useMemo(() => parsed.filter((p) => p.include).length, [parsed]);
  const incomeTotal = useMemo(() => parsed.filter((p) => p.include && p.type === 'income').reduce((s, p) => s + p.amount, 0), [parsed]);
  const expenseTotal = useMemo(() => parsed.filter((p) => p.include && p.type === 'expense').reduce((s, p) => s + p.amount, 0), [parsed]);

  const updateRow = (id: string, patch: Partial<ParsedRow>) => {
    setParsed((prev) => prev.map((p) => (p._id === id ? { ...p, ...patch } : p)));
  };

  const importNow = async () => {
    const items = parsed.filter((p) => p.include);
    if (items.length === 0) { toast.error('No rows selected to import'); return; }
    setImporting(true);
    setStep('importing');
    setProgress({ done: 0, total: items.length, success: 0, failed: 0 });

    let success = 0, failed = 0;
    for (let i = 0; i < items.length; i++) {
      const r = items[i];
      try {
        if (r.type === 'income') {
          const source = detectedFormat === 'stripe' ? 'Stripe'
            : detectedFormat === 'razorpay' ? 'Razorpay'
            : defaultSource;
          await api.post('/income', {
            title: r.description.slice(0, 120),
            source,
            amount: r.amount,
            income_date: r.date,
            payment_method: detectedFormat === 'stripe' ? 'Card' : detectedFormat === 'razorpay' ? 'Razorpay' : 'Bank Transfer',
            reference_no: r.reference || null,
            notes: `Imported from ${fileName}`,
          });
        } else {
          await api.post('/expenses', {
            title: r.description.slice(0, 120),
            category: r.category || defaultCategory,
            amount: r.amount,
            expense_date: r.date,
            payment_method: 'Bank Transfer',
            vendor: null,
            reference_no: r.reference || null,
            notes: `Imported from ${fileName}`,
          });
        }
        success++;
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: items.length, success, failed });
    }

    qc.invalidateQueries({ queryKey: ['income'] });
    qc.invalidateQueries({ queryKey: ['expenses'] });
    setImporting(false);
    setStep('done');
    if (failed === 0) toast.success(`Imported ${success} entries`);
    else toast.error(`${success} imported, ${failed} failed`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Import Bank Statement
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === 'upload' && 'Upload bank statement, Stripe, or Razorpay export'}
              {step === 'mapping' && 'Confirm column mapping'}
              {step === 'preview' && (
                <span>
                  {detectedFormat === 'stripe' && <span className="text-purple-500 font-medium">Stripe export · </span>}
                  {detectedFormat === 'razorpay' && <span className="text-blue-500 font-medium">Razorpay export · </span>}
                  {includedCount} of {parsed.length} transactions ready
                </span>
              )}
              {step === 'importing' && `Importing ${progress.done} / ${progress.total}...`}
              {step === 'done' && 'Import complete'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-secondary/20 text-xs">
          {(['upload', 'mapping', 'preview', 'importing'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold
                ${step === s ? 'bg-primary text-primary-foreground' :
                  (['upload', 'mapping', 'preview', 'importing'].indexOf(step) > i ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground')}`}>
                {i + 1}
              </div>
              <span className={step === s ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Map' : s === 'preview' ? 'Review' : 'Import'}
              </span>
              {i < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Click or drag & drop your statement</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv, .pdf · up to 10MB</p>
                <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv,.pdf"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
              {parseError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5" /> {parseError}
                </div>
              )}

              {/* Format selector */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">File format</p>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { value: 'auto', label: 'Auto-detect', sub: 'Let system decide' },
                    { value: 'bank', label: 'Bank Statement', sub: 'Manual mapping' },
                    { value: 'stripe', label: 'Stripe Export', sub: 'Balance transactions CSV' },
                    { value: 'razorpay', label: 'Razorpay Export', sub: 'Payments CSV' },
                  ] as { value: GatewayFormat; label: string; sub: string }[]).map(f => (
                    <button key={f.value} onClick={() => setGatewayFormat(f.value)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                        gatewayFormat === f.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:border-primary/50'
                      }`}>
                      <p className="font-semibold">{f.label}</p>
                      <p className="text-[10px] mt-0.5 opacity-70">{f.sub}</p>
                    </button>
                  ))}
                </div>
                {gatewayFormat === 'stripe' && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 ml-0.5">
                    From Stripe Dashboard → Reports → Balance → Download CSV
                  </p>
                )}
                {gatewayFormat === 'razorpay' && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 ml-0.5">
                    From Razorpay Dashboard → Transactions → Payments → Export
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-5">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">{fileName} · {rows.length} rows detected</p>
                  <p className="text-muted-foreground">We've auto-mapped columns. Adjust if needed.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(Object.keys(FIELD_HINTS) as (keyof ColumnMap)[]).map((field) => (
                  <div key={field}>
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {field === 'debit' ? 'Debit / Withdrawal' : field === 'credit' ? 'Credit / Deposit' : field}
                      {(field === 'date' || field === 'description') && <span className="text-destructive ml-1">*</span>}
                    </label>
                    <select value={colMap[field]} onChange={(e) => setColMap({ ...colMap, [field]: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none">
                      <option value={NONE}>— Not mapped —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground p-3 rounded-lg bg-secondary/40 border border-border">
                <strong>Tip:</strong> Map either <em>Debit + Credit</em> (separate columns) <em>or</em> <em>Amount</em> (single column with +/-).
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Default expense category</label>
                  <select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none">
                    {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Default income source</label>
                  <select value={defaultSource} onChange={(e) => setDefaultSource(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none">
                    {INCOME_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Preview first 3 rows */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Sample (first 3 rows)</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 text-muted-foreground">
                      <tr>{headers.map((h) => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 3).map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          {headers.map((h) => <td key={h} className="px-3 py-2 whitespace-nowrap">{String(r[h] ?? '')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-xs text-muted-foreground">Income</p>
                  <p className="text-lg font-bold text-success">+₹{incomeTotal.toLocaleString('en-IN')}</p>
                </div>
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-xs text-muted-foreground">Expenses</p>
                  <p className="text-lg font-bold text-destructive">-₹{expenseTotal.toLocaleString('en-IN')}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Net</p>
                  <p className="text-lg font-bold text-primary">₹{(incomeTotal - expenseTotal).toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border max-h-[50vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/60 sticky top-0 text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-2 py-2 text-left w-8"><input type="checkbox" checked={parsed.every((p) => p.include)}
                        onChange={(e) => setParsed(parsed.map((p) => ({ ...p, include: e.target.checked })))} /></th>
                      <th className="px-2 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-left">Description</th>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-left">Category</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No valid rows. Check column mapping.</td></tr>
                    ) : parsed.map((r) => (
                      <tr key={r._id} className={`border-t border-border ${!r.include ? 'opacity-40' : ''}`}>
                        <td className="px-2 py-1.5"><input type="checkbox" checked={r.include}
                          onChange={(e) => updateRow(r._id, { include: e.target.checked })} /></td>
                        <td className="px-2 py-1.5">
                          <input type="date" value={r.date} onChange={(e) => updateRow(r._id, { date: e.target.value })}
                            className="bg-transparent border-0 px-1 py-0.5 text-xs focus:bg-background focus:border focus:border-primary rounded" />
                        </td>
                        <td className="px-2 py-1.5 max-w-[280px]">
                          <input value={r.description} onChange={(e) => updateRow(r._id, { description: e.target.value })}
                            className="w-full bg-transparent border-0 px-1 py-0.5 text-xs focus:bg-background focus:border focus:border-primary rounded" />
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={r.type} onChange={(e) => updateRow(r._id, { type: e.target.value as any })}
                            className={`bg-transparent border-0 px-1 py-0.5 text-xs rounded font-medium ${r.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          {r.type === 'expense' ? (
                            <select value={r.category || ''} onChange={(e) => updateRow(r._id, { category: e.target.value })}
                              className="bg-transparent border-0 px-1 py-0.5 text-xs rounded">
                              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : <span className="text-muted-foreground text-[10px]">—</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input type="number" value={r.amount} onChange={(e) => updateRow(r._id, { amount: Number(e.target.value) })}
                            className={`w-24 text-right bg-transparent border-0 px-1 py-0.5 text-xs focus:bg-background focus:border focus:border-primary rounded font-medium ${r.type === 'income' ? 'text-success' : 'text-destructive'}`} />
                        </td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => setParsed(parsed.filter((p) => p._id !== r._id))}
                            className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3 w-3" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium">Importing transactions...</p>
                <p className="text-xs text-muted-foreground mt-1">{progress.done} of {progress.total}</p>
              </div>
              <div className="w-full max-w-md h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="py-12 flex flex-col items-center gap-3">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <div className="text-center">
                <p className="text-base font-semibold">Import complete</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {progress.success} imported · {progress.failed > 0 && <span className="text-destructive">{progress.failed} failed</span>}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-secondary/20">
          <div className="text-xs text-muted-foreground">
            {fileName && <span className="flex items-center gap-1.5"><FileSpreadsheet className="h-3 w-3" /> {fileName}</span>}
          </div>
          <div className="flex items-center gap-2">
            {step === 'mapping' && (
              <>
                <button onClick={() => setStep('upload')} className="px-4 py-2 rounded-lg text-sm hover:bg-secondary">Back</button>
                <button onClick={buildParsed} disabled={colMap.date === NONE || colMap.description === NONE || (colMap.amount === NONE && colMap.debit === NONE && colMap.credit === NONE)}
                  className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                  Continue
                </button>
              </>
            )}
            {step === 'preview' && (
              <>
                <button
                  onClick={() => setStep(detectedFormat === 'stripe' || detectedFormat === 'razorpay' ? 'upload' : 'mapping')}
                  className="px-4 py-2 rounded-lg text-sm hover:bg-secondary">Back</button>
                <button onClick={importNow} disabled={includedCount === 0}
                  className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  Import {includedCount} entries
                </button>
              </>
            )}
            {step === 'done' && (
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90">Done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
