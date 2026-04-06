import { X, Printer } from 'lucide-react';

interface Props {
  invoice: any;
  onClose: () => void;
}

export default function InvoicePrintView({ invoice, onClose }: Props) {
  const company = invoice.company || {};
  const items = invoice.items || [];
  const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0);
  const discountAmt = invoice.discount_amount || (subtotal * (invoice.discount_pct || 0) / 100);
  const taxableAmt = subtotal - discountAmt;
  const taxAmt = invoice.tax_amount || (taxableAmt * (invoice.tax_pct || 0) / 100);
  const total = invoice.total || (taxableAmt + taxAmt);
  const amountPaid = invoice.amount_paid || 0;
  const amountDue = total - amountPaid;

  const statusColor = invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : invoice.status === 'Overdue' ? 'bg-red-100 text-red-700' : invoice.status === 'Sent' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[95vh] overflow-y-auto">
        {/* Action bar - hidden in print */}
        <div className="flex gap-2 justify-end mb-3 print:hidden">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {/* Invoice document */}
        <div className="bg-white text-gray-900 rounded-xl shadow-lg p-8 space-y-6 print:shadow-none print:rounded-none print:p-0" id="invoice-print-area">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              {company.logo_url && <img src={company.logo_url} alt="Logo" className="h-12 mb-2 object-contain" />}
              <h2 className="text-lg font-bold text-gray-900">{company.company_name || 'Your Company'}</h2>
              <p className="text-xs text-gray-500 max-w-[220px]">
                {[company.address_line1, company.address_line2, company.city, company.state, company.postal_code, company.country].filter(Boolean).join(', ')}
              </p>
              {company.gst_number && <p className="text-xs text-gray-500">GST: {company.gst_number}</p>}
              {company.phone && <p className="text-xs text-gray-500">Phone: {company.phone}</p>}
              {company.email && <p className="text-xs text-gray-500">Email: {company.email}</p>}
            </div>
            <div className="text-right space-y-1">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">INVOICE</h1>
              <p className="text-sm font-medium">{invoice.invoice_number || ''}</p>
              <p className="text-xs text-gray-500">Issue: {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : '—'}</p>
              <p className="text-xs text-gray-500">Due: {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}</p>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>{invoice.status}</span>
            </div>
          </div>

          {/* Bill To */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
            <p className="text-sm font-bold">{invoice.client?.company_name || invoice.client_name || 'Client'}</p>
            {invoice.billing_address && <p className="text-xs text-gray-500 max-w-[280px]">{invoice.billing_address}</p>}
            {(invoice.billing_contact_name || invoice.client?.contact_name) && <p className="text-xs text-gray-500">{invoice.billing_contact_name || invoice.client?.contact_name}</p>}
            {(invoice.billing_email || invoice.client?.email) && <p className="text-xs text-gray-500">{invoice.billing_email || invoice.client?.email}</p>}
            {(invoice.billing_phone || invoice.client?.phone) && <p className="text-xs text-gray-500">{invoice.billing_phone || invoice.client?.phone}</p>}
          </div>

          {/* Line Items */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Description</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase w-16">Qty</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase w-28">Unit Price</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, i: number) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2.5">{item.description}</td>
                  <td className="py-2.5 text-right">{item.quantity}</td>
                  <td className="py-2.5 text-right">${Number(item.unit_price || 0).toFixed(2)}</td>
                  <td className="py-2.5 text-right font-medium">${(item.quantity * item.unit_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              {discountAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount{invoice.discount_pct ? ` (${invoice.discount_pct}%)` : ''}</span><span className="text-red-600">-${discountAmt.toFixed(2)}</span></div>}
              {taxAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">Tax (GST){invoice.tax_pct ? ` ${invoice.tax_pct}%` : ''}</span><span>${taxAmt.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200"><span>Total</span><span>${total.toLocaleString()}</span></div>
              {amountPaid > 0 && <div className="flex justify-between text-gray-500"><span>Amount Paid</span><span>${amountPaid.toLocaleString()}</span></div>}
              <div className="flex justify-between font-bold text-lg pt-1 border-t border-gray-300 text-blue-700"><span>Amount Due</span><span>${amountDue.toLocaleString()}</span></div>
            </div>
          </div>

          {/* Payment Info */}
          {(company.bank_name || company.bank_account) && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Payment Information</p>
              <div className="text-xs text-gray-600 space-y-0.5">
                {company.bank_name && <p>Bank: {company.bank_name}</p>}
                {company.bank_account && <p>Account: {company.bank_account}</p>}
                {company.ifsc && <p>IFSC: {company.ifsc}</p>}
              </div>
            </div>
          )}

          {/* Footer */}
          {(invoice.notes || invoice.payment_terms || company.payment_terms) && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              {(invoice.payment_terms || company.payment_terms) && (
                <div><p className="text-xs font-semibold text-gray-400 uppercase">Payment Terms</p><p className="text-xs text-gray-600">{invoice.payment_terms || company.payment_terms}</p></div>
              )}
              {invoice.notes && (
                <div><p className="text-xs font-semibold text-gray-400 uppercase">Notes</p><p className="text-xs text-gray-600 whitespace-pre-wrap">{invoice.notes}</p></div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
