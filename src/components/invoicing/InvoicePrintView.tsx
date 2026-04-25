import { X, Printer, Building2, Mail, Phone, MapPin, CreditCard, Link2, Wallet, Globe, Trash2 } from 'lucide-react';

interface Props {
  invoice: any;
  onClose: () => void;
  onDelete?: () => void;
}

export default function InvoicePrintView({ invoice, onClose, onDelete }: Props) {
  // Backend already returns `company` alongside the invoice — no extra API call needed
  const company: any = invoice.company || {};
  const companyName = company.name || company.company_name || '';
  const items = invoice.items || [];
  const currency = invoice.currency_symbol || invoice.currency || company.currency_symbol || '$';
  const fmt = (n: number) =>
    `${currency}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const subtotal = items.reduce((s: number, i: any) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const discountAmt = Number(invoice.discount_amount) || (subtotal * (Number(invoice.discount_pct) || 0)) / 100;
  const taxableAmt = subtotal - discountAmt;
  const taxAmt = Number(invoice.tax_amount) || (taxableAmt * (Number(invoice.tax_pct) || 0)) / 100;
  const total = Number(invoice.total) || taxableAmt + taxAmt;
  const amountPaid = Number(invoice.amount_paid) || 0;
  const amountDue = total - amountPaid;
  const isPaid = invoice.status === 'Paid' || amountDue <= 0;

  const statusStyles: Record<string, string> = {
    Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Overdue: 'bg-red-50 text-red-700 ring-red-200',
    Sent: 'bg-blue-50 text-blue-700 ring-blue-200',
    Viewed: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    'Partially Paid': 'bg-amber-50 text-amber-700 ring-amber-200',
    Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  };
  const statusCls = statusStyles[invoice.status] || 'bg-slate-50 text-slate-700 ring-slate-200';

  const companyAddress = [company.address_line1, company.address_line2, company.city, company.state, company.postal_code, company.country]
    .filter(Boolean)
    .join(', ');

  // Payment link comes ONLY from the invoice (Stripe/Razorpay checkout URL set by backend).
  // If null/undefined, the Pay Now button is hidden — never fall back to an internal route.
  const paymentLink: string = invoice.payment_link || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static">
      <div className="w-full max-w-4xl max-h-[95vh] overflow-y-auto print:max-h-none print:overflow-visible">
        {/* Action bar - hidden in print */}
        <div className="flex gap-2 justify-end mb-3 print:hidden">
          {!isPaid && paymentLink && (
            <button
              type="button"
              onClick={() => window.open(paymentLink, '_blank', 'noopener,noreferrer')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all"
            >
              <CreditCard className="h-4 w-4" /> Pay Now
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all"
          >
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Invoice document */}
        <div
          className="bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none"
          id="invoice-print-area"
        >
          {/* Branded header band */}
          <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white px-10 py-8 print:bg-slate-900">
            <div className="flex justify-between items-start gap-6 flex-wrap">
              <div className="flex items-start gap-4">
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={companyName || 'Company logo'}
                    style={{ maxHeight: 48 }}
                    className="rounded-lg bg-white p-1 object-contain shadow-md"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{companyName || '—'}</h2>
                  {company.tagline && <p className="text-xs text-white/70 mt-0.5">{company.tagline}</p>}
                  {company.gst_number && <p className="text-[11px] text-white/60 mt-1">GSTIN: {company.gst_number}</p>}
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-3xl font-bold tracking-tight">INVOICE</h1>
                <p className="text-sm text-white/80 font-medium mt-0.5">{invoice.invoice_number || '—'}</p>
                <span
                  className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${statusCls}`}
                >
                  {invoice.status || 'Draft'}
                </span>
              </div>
            </div>
          </div>

          <div className="px-10 py-8 space-y-8">
            {/* Meta strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 -mt-2">
              <Meta label="Issue Date" value={invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : '—'} />
              <Meta label="Due Date" value={invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'} />
              <Meta label="Invoice #" value={invoice.invoice_number || '—'} />
              <Meta label="Amount Due" value={fmt(amountDue)} highlight={!isPaid} />
            </div>

            {/* Bill From / Bill To */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Party
                label="Bill From"
                name={companyName || '—'}
                address={companyAddress}
                email={company.email}
                phone={company.phone}
              />
              <Party
                label="Bill To"
                name={invoice.client?.company_name || invoice.client_name || 'Client'}
                contact={invoice.billing_contact_name || invoice.client?.contact_name}
                address={invoice.billing_address || invoice.client?.address || ''}
                email={invoice.billing_email || invoice.client?.email}
                phone={invoice.billing_phone || invoice.client?.phone}
                gst={invoice.client?.gst_number}
              />
            </div>

            {/* Line Items */}
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-20">
                      Qty
                    </th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-32">
                      Unit Price
                    </th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-32">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                        No line items
                      </td>
                    </tr>
                  ) : (
                    items.map((item: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-slate-800">{item.description}</div>
                          {item.details && <div className="text-xs text-slate-500 mt-0.5">{item.details}</div>}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 align-top">{Number(item.quantity).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-700 align-top">{fmt(item.unit_price)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 align-top">
                          {fmt(Number(item.quantity || 0) * Number(item.unit_price || 0))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full sm:w-80 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-5 space-y-2 text-sm">
                <Row label="Subtotal" value={fmt(subtotal)} />
                {discountAmt > 0 && (
                  <Row
                    label={`Discount${invoice.discount_pct ? ` (${invoice.discount_pct}%)` : ''}`}
                    value={`-${fmt(discountAmt)}`}
                    valueClass="text-red-600"
                  />
                )}
                {taxAmt > 0 && (
                  <Row
                    label={`Tax${invoice.tax_pct ? ` (${invoice.tax_pct}%)` : ''}`}
                    value={fmt(taxAmt)}
                  />
                )}
                <div className="border-t border-slate-200 pt-2">
                  <Row label="Total" value={fmt(total)} bold />
                </div>
                {amountPaid > 0 && (
                  <Row label="Amount Paid" value={`-${fmt(amountPaid)}`} valueClass="text-emerald-600" />
                )}
                <div className="border-t-2 border-slate-300 pt-2 mt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700">Amount Due</span>
                    <span className={`text-xl font-bold ${isPaid ? 'text-emerald-600' : 'text-blue-700'}`}>
                      {fmt(amountDue)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Section */}
            {!isPaid && (
              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-600 text-white">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Make a Payment</h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Pay securely online via card, UPI, or bank transfer.
                      </p>
                    </div>
                  </div>
                  {paymentLink && (
                    <button
                      type="button"
                      onClick={() => window.open(paymentLink, '_blank', 'noopener,noreferrer')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors print:hidden"
                    >
                      <CreditCard className="h-4 w-4" /> Pay {fmt(amountDue)}
                    </button>
                  )}
                </div>

                {paymentLink && (
                  <div className="mt-4 pt-4 border-t border-blue-200 hidden print:block">
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <Link2 className="h-3.5 w-3.5" />
                      <span className="font-semibold">Payment Link:</span>
                      <span className="font-mono break-all">{paymentLink}</span>
                    </div>
                  </div>
                )}

                {(company.bank_name || company.bank_account || company.upi_id) && (
                  <div className="mt-4 pt-4 border-t border-blue-200 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    <p className="font-semibold text-slate-700 col-span-full mb-1">Bank Transfer Details</p>
                    {company.bank_name && <DetailRow label="Bank" value={company.bank_name} />}
                    {company.bank_account_name && <DetailRow label="Account Name" value={company.bank_account_name} />}
                    {company.bank_account && <DetailRow label="Account #" value={company.bank_account} />}
                    {company.ifsc && <DetailRow label="IFSC" value={company.ifsc} />}
                    {company.swift && <DetailRow label="SWIFT" value={company.swift} />}
                    {company.upi_id && <DetailRow label="UPI" value={company.upi_id} />}
                  </div>
                )}
              </div>
            )}

            {/* Notes & Terms */}
            {(invoice.notes || invoice.payment_terms || company.payment_terms) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {(invoice.payment_terms || company.payment_terms) && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Payment Terms</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {invoice.payment_terms || company.payment_terms}
                    </p>
                  </div>
                )}
                {invoice.notes && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Thank you */}
            <div className="text-center py-3">
              <p className="text-base font-semibold text-slate-800">Thank you for your business!</p>
              <p className="text-xs text-slate-500 mt-1">
                If you have any questions about this invoice, please contact us.
              </p>
            </div>

            {/* Company contact details footer (inside card) */}
            {(company?.address_line1 ||
              company?.address_line2 ||
              company?.city ||
              company?.phone ||
              company?.email ||
              company?.website ||
              company?.gst_number ||
              company?.tax_id ||
              company?.pan_number) && (
              <div className="border-t border-slate-200 pt-4 mt-2">
                <div className="space-y-1 text-center text-[11px] text-slate-500 leading-relaxed">
                  {(() => {
                    const addressLine = [
                      company.address_line1,
                      company.address_line2,
                      company.city,
                      company.state,
                      company.postal_code,
                      company.country,
                    ]
                      .filter(Boolean)
                      .join(', ');
                    const taxParts = [
                      company.gst_number && `GST: ${company.gst_number}`,
                      company.tax_id && `Tax ID: ${company.tax_id}`,
                      company.pan_number && `PAN: ${company.pan_number}`,
                    ].filter(Boolean);
                    const contactParts = [
                      company.phone && `📞 ${company.phone}`,
                      company.email && `✉ ${company.email}`,
                      company.website && `🌐 ${company.website}`,
                    ].filter(Boolean);
                    return [
                      addressLine,
                      contactParts.join(' · '),
                      taxParts.join(' · '),
                    ]
                      .filter(Boolean)
                      .map((line, i) => <p key={i}>{line as string}</p>);
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-10 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
              <div className="flex items-center gap-4 flex-wrap">
                {companyName && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" /> {companyName}
                  </span>
                )}
                {companyAddress && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" /> {companyAddress}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                {company.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" /> {company.email}
                  </span>
                )}
                {company.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> {company.phone}
                  </span>
                )}
                {company.website && (
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-3 w-3" /> {company.website}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print isolation */}
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

function Meta({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-white ring-1 ring-slate-200 px-3 py-2 shadow-sm">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-blue-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function Party({
  label,
  name,
  contact,
  address,
  email,
  phone,
  gst,
}: {
  label: string;
  name: string;
  contact?: string;
  address?: string;
  email?: string;
  phone?: string;
  gst?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-sm font-bold text-slate-900">{name}</p>
      {contact && <p className="text-xs text-slate-600 mt-0.5">{contact}</p>}
      {address && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{address}</p>}
      <div className="mt-1.5 space-y-0.5">
        {email && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Mail className="h-3 w-3" /> {email}
          </p>
        )}
        {phone && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Phone className="h-3 w-3" /> {phone}
          </p>
        )}
        {gst && <p className="text-[11px] text-slate-500">GSTIN: {gst}</p>}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  valueClass = '',
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClass?: string;
}) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-500 min-w-[80px]">{label}:</span>
      <span className="font-medium text-slate-800 break-all">{value}</span>
    </div>
  );
}
