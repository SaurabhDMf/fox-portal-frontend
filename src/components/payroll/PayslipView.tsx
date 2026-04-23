import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { X, Printer, Download } from 'lucide-react';
import ThemeLogo from '@/components/ThemeLogo';

const fmtINR = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Number to words (Indian numbering)
function numToWordsIndian(num: number): string {
  if (!num || isNaN(num)) return 'Zero';
  const n = Math.round(num);
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigits = (x: number): string => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
  const threeDigits = (x: number): string => x >= 100
    ? ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + twoDigits(x % 100) : '')
    : twoDigits(x);

  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  let words = '';
  if (crore) words += threeDigits(crore) + ' Crore ';
  if (lakh) words += twoDigits(lakh) + ' Lakh ';
  if (thousand) words += twoDigits(thousand) + ' Thousand ';
  if (rest) words += threeDigits(rest);
  return words.trim();
}

interface Props {
  run: any;
  employee: any;
  onClose: () => void;
}

export default function PayslipView({ run, employee, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data: company } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => api.get('/company').then(r => r.data?.data || r.data || {}),
  });

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const c = company || {};
  const addressLine = [
    c.address_line1 || c.address?.line1,
    c.address_line2 || c.address?.line2,
  ].filter(Boolean).join(', ');
  const cityLine = [
    c.city || c.address?.city,
    c.state || c.address?.state,
    c.postal_code || c.address?.postal_code,
    c.country || c.address?.country,
  ].filter(Boolean).join(', ');

  // Earnings
  const earnings = [
    { label: 'Basic Pay', value: Number(employee.base_pay || 0) },
    { label: 'House Rent Allowance', value: Number(employee.hra || 0) },
    { label: 'Conveyance Allowance', value: Number(employee.conveyance || 0) },
    { label: 'Medical Allowance', value: Number(employee.medical || 0) },
    { label: 'Special Allowance', value: Number(employee.special_allowance || 0) },
    { label: 'Bonus', value: Number(employee.bonus || 0) },
    { label: 'Overtime', value: Number(employee.overtime_amount || 0) },
  ].filter(e => e.value > 0);

  // Deductions
  const deductions = [
    { label: 'Provident Fund (PF)', value: Number(employee.pf || 0) },
    { label: 'ESI', value: Number(employee.esi || 0) },
    { label: 'Professional Tax', value: Number(employee.professional_tax || 0) },
    { label: 'TDS (Income Tax)', value: Number(employee.tds || 0) },
    { label: 'Loan Recovery', value: Number(employee.loan_recovery || 0) },
    { label: 'Loss of Pay', value: Number(employee.lop_amount || 0) },
    { label: 'Other Deductions', value: Number(employee.other_deductions || 0) },
  ].filter(d => d.value > 0);

  const totalEarnings = earnings.reduce((s, e) => s + e.value, 0);
  const totalDeductions = deductions.reduce((s, d) => s + d.value, 0);
  const netPay = Number(employee.net_pay ?? (totalEarnings - totalDeductions));

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;
    const win = window.open('', '', 'width=900,height=1100');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Payslip - ${employee.full_name} - ${run.period_label}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; background: #fff; padding: 32px; font-size: 12px; line-height: 1.5; }
            .ps-wrap { max-width: 800px; margin: 0 auto; background: #fff; }
            .ps-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #0891b2; margin-bottom: 20px; }
            .ps-co-name { font-size: 20px; font-weight: 700; color: #0891b2; margin-bottom: 4px; }
            .ps-co-meta { font-size: 11px; color: #555; line-height: 1.6; }
            .ps-title { text-align: right; }
            .ps-title h1 { font-size: 16px; font-weight: 600; color: #333; letter-spacing: 1px; text-transform: uppercase; }
            .ps-title p { font-size: 11px; color: #666; margin-top: 4px; }
            .ps-logo { max-height: 50px; max-width: 160px; object-fit: contain; }
            .ps-emp { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-bottom: 16px; }
            .ps-emp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 11px; }
            .ps-emp-grid div { display: flex; }
            .ps-emp-grid .lbl { width: 130px; color: #666; font-weight: 500; }
            .ps-emp-grid .val { color: #1a1a1a; font-weight: 600; }
            .ps-tables { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
            .ps-tbl { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
            .ps-tbl-head { background: #0891b2; color: #fff; padding: 10px 14px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
            .ps-tbl-row { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 11px; border-bottom: 1px solid #f1f5f9; }
            .ps-tbl-row:last-child { border-bottom: none; }
            .ps-tbl-row .v { font-weight: 600; }
            .ps-tbl-total { display: flex; justify-content: space-between; padding: 10px 14px; background: #f8fafc; font-size: 12px; font-weight: 700; border-top: 2px solid #cbd5e1; }
            .ps-net { background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: #fff; border-radius: 6px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
            .ps-net-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; }
            .ps-net-amount { font-size: 22px; font-weight: 700; }
            .ps-words { font-size: 11px; color: #555; padding: 10px 14px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #0891b2; margin-bottom: 20px; font-style: italic; }
            .ps-bank { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; margin-bottom: 16px; font-size: 11px; }
            .ps-bank h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-bottom: 8px; }
            .ps-footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #999; text-align: center; line-height: 1.6; }
            @media print { body { padding: 0; } .ps-wrap { max-width: 100%; } }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border w-full max-w-4xl max-h-[95vh] rounded-xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Payslip Preview</h2>
            <p className="text-xs text-muted-foreground">{employee.full_name} · {run.period_label}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
              <Printer className="h-3.5 w-3.5" /> Print / PDF
            </button>
            {employee.payslip_url && (
              <a href={employee.payslip_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Payslip body */}
        <div className="overflow-y-auto p-6 bg-muted/30">
          <div ref={printRef} className="ps-wrap mx-auto bg-white text-[#1a1a1a] rounded-lg shadow-lg p-8" style={{ maxWidth: 800, fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif' }}>
            {/* Header */}
            <div className="ps-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16, borderBottom: '3px solid #0891b2', marginBottom: 20 }}>
              <div>
                {c.logo_url ? (
                  <img src={c.logo_url} alt={c.company_name || 'Company'} className="ps-logo" style={{ maxHeight: 50, maxWidth: 160, objectFit: 'contain', marginBottom: 8 }} />
                ) : (
                  <div style={{ marginBottom: 8 }}>
                    <ThemeLogo className="h-10" />
                  </div>
                )}
                <div className="ps-co-name" style={{ fontSize: 20, fontWeight: 700, color: '#0891b2', marginBottom: 4 }}>
                  {c.company_name || 'Company Name'}
                </div>
                <div className="ps-co-meta" style={{ fontSize: 11, color: '#555', lineHeight: 1.6 }}>
                  {addressLine && <div>{addressLine}</div>}
                  {cityLine && <div>{cityLine}</div>}
                  <div>
                    {c.email && <span>{c.email}</span>}
                    {c.email && c.phone && <span> · </span>}
                    {c.phone && <span>{c.phone}</span>}
                  </div>
                  {(c.gst_number || c.pan) && (
                    <div>
                      {c.gst_number && <span>GSTIN: {c.gst_number}</span>}
                      {c.gst_number && c.pan && <span> · </span>}
                      {c.pan && <span>PAN: {c.pan}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="ps-title" style={{ textAlign: 'right' }}>
                <h1 style={{ fontSize: 16, fontWeight: 600, color: '#333', letterSpacing: 1, textTransform: 'uppercase' }}>Payslip</h1>
                <p style={{ fontSize: 11, color: '#666', marginTop: 4 }}>For the period of</p>
                <p style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 600, marginTop: 2 }}>{run.period_label}</p>
                <p style={{ fontSize: 10, color: '#999', marginTop: 6 }}>
                  {fmtDate(run.period_start)} – {fmtDate(run.period_end)}
                </p>
              </div>
            </div>

            {/* Employee Info */}
            <div className="ps-emp" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 14, marginBottom: 16 }}>
              <div className="ps-emp-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 11 }}>
                <div style={{ display: 'flex' }}><span style={{ width: 130, color: '#666', fontWeight: 500 }}>Employee Name</span><span style={{ color: '#1a1a1a', fontWeight: 600 }}>{employee.full_name}</span></div>
                <div style={{ display: 'flex' }}><span style={{ width: 130, color: '#666', fontWeight: 500 }}>Employee ID</span><span style={{ color: '#1a1a1a', fontWeight: 600 }}>{employee.employee_id || employee.user_id || employee.id || '—'}</span></div>
                <div style={{ display: 'flex' }}><span style={{ width: 130, color: '#666', fontWeight: 500 }}>Designation</span><span style={{ color: '#1a1a1a', fontWeight: 600 }}>{employee.job_title || '—'}</span></div>
                <div style={{ display: 'flex' }}><span style={{ width: 130, color: '#666', fontWeight: 500 }}>Department</span><span style={{ color: '#1a1a1a', fontWeight: 600 }}>{employee.department || '—'}</span></div>
                <div style={{ display: 'flex' }}><span style={{ width: 130, color: '#666', fontWeight: 500 }}>Date of Joining</span><span style={{ color: '#1a1a1a', fontWeight: 600 }}>{fmtDate(employee.date_of_joining || employee.joined_at)}</span></div>
                <div style={{ display: 'flex' }}><span style={{ width: 130, color: '#666', fontWeight: 500 }}>Pay Period</span><span style={{ color: '#1a1a1a', fontWeight: 600 }}>{run.period_label}</span></div>
                <div style={{ display: 'flex' }}><span style={{ width: 130, color: '#666', fontWeight: 500 }}>Working Days</span><span style={{ color: '#1a1a1a', fontWeight: 600 }}>{employee.working_days || 30}</span></div>
                <div style={{ display: 'flex' }}><span style={{ width: 130, color: '#666', fontWeight: 500 }}>LOP Days</span><span style={{ color: '#1a1a1a', fontWeight: 600 }}>{employee.lop_days || 0}</span></div>
              </div>
            </div>

            {/* Earnings & Deductions side-by-side */}
            <div className="ps-tables" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="ps-tbl" style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                <div className="ps-tbl-head" style={{ background: '#0891b2', color: '#fff', padding: '10px 14px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Earnings</div>
                {earnings.length === 0 ? (
                  <div style={{ padding: '14px', fontSize: 11, color: '#999', textAlign: 'center' }}>No earnings recorded</div>
                ) : earnings.map((e, i) => (
                  <div key={i} className="ps-tbl-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: 11, borderBottom: '1px solid #f1f5f9' }}>
                    <span>{e.label}</span>
                    <span style={{ fontWeight: 600 }}>{fmtINR(e.value)}</span>
                  </div>
                ))}
                <div className="ps-tbl-total" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', fontSize: 12, fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                  <span>Total Earnings</span>
                  <span style={{ color: '#16a34a' }}>{fmtINR(totalEarnings)}</span>
                </div>
              </div>

              <div className="ps-tbl" style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                <div className="ps-tbl-head" style={{ background: '#0891b2', color: '#fff', padding: '10px 14px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Deductions</div>
                {deductions.length === 0 ? (
                  <div style={{ padding: '14px', fontSize: 11, color: '#999', textAlign: 'center' }}>No deductions</div>
                ) : deductions.map((d, i) => (
                  <div key={i} className="ps-tbl-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: 11, borderBottom: '1px solid #f1f5f9' }}>
                    <span>{d.label}</span>
                    <span style={{ fontWeight: 600 }}>{fmtINR(d.value)}</span>
                  </div>
                ))}
                <div className="ps-tbl-total" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', fontSize: 12, fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                  <span>Total Deductions</span>
                  <span style={{ color: '#dc2626' }}>{fmtINR(totalDeductions)}</span>
                </div>
              </div>
            </div>

            {/* Net Pay */}
            <div className="ps-net" style={{ background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)', color: '#fff', borderRadius: 6, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div className="ps-net-label" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9 }}>Net Pay</div>
                <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>Total Earnings − Total Deductions</div>
              </div>
              <div className="ps-net-amount" style={{ fontSize: 22, fontWeight: 700 }}>{fmtINR(netPay)}</div>
            </div>

            {/* Amount in words */}
            <div className="ps-words" style={{ fontSize: 11, color: '#555', padding: '10px 14px', background: '#f8fafc', borderRadius: 6, borderLeft: '3px solid #0891b2', marginBottom: 20, fontStyle: 'italic' }}>
              <strong>Amount in Words:</strong> Indian Rupees {numToWordsIndian(netPay)} Only
            </div>

            {/* Bank Details */}
            {(employee.bank_account || employee.bank_name) && (
              <div className="ps-bank" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 14px', marginBottom: 16, fontSize: 11 }}>
                <h4 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#666', marginBottom: 8 }}>Bank Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
                  {employee.bank_name && <div><span style={{ color: '#666' }}>Bank: </span><strong>{employee.bank_name}</strong></div>}
                  {employee.bank_account && <div><span style={{ color: '#666' }}>A/C: </span><strong>{employee.bank_account}</strong></div>}
                  {employee.ifsc && <div><span style={{ color: '#666' }}>IFSC: </span><strong>{employee.ifsc}</strong></div>}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="ps-footer" style={{ marginTop: 30, paddingTop: 12, borderTop: '1px solid #e2e8f0', fontSize: 10, color: '#999', textAlign: 'center', lineHeight: 1.6 }}>
              <p>This is a computer-generated payslip and does not require a signature.</p>
              <p>Generated on {fmtDate(new Date().toISOString())} · {c.company_name || 'Company'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
