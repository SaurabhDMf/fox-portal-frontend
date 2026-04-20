import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { X, Send } from 'lucide-react';

interface Props {
  invoice: any;
  onClose: () => void;
}

const inputCls =
  'px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

export default function SendInvoiceModal({ invoice, onClose }: Props) {
  const qc = useQueryClient();
  const [recipient, setRecipient] = useState(
    invoice.client?.email || invoice.billing_email || invoice.client_email || ''
  );
  const [includeLink, setIncludeLink] = useState(true);

  const sendMut = useMutation({
    mutationFn: () =>
      api.post(`/invoices/${invoice.id}/send`, {
        include_payment_link: includeLink,
        recipient_email: recipient || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(
        res.data?.email_sent
          ? `Sent to ${res.data.recipient || recipient}`
          : 'Invoice marked as sent'
      );
      onClose();
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || 'Failed to send'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Send Invoice</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-sm text-muted-foreground">
          Sending <span className="font-medium text-foreground">{invoice.invoice_number}</span>
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium">
            Recipient Email
          </label>
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className={inputCls + ' w-full mt-1'}
            placeholder="client@example.com"
          />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={includeLink}
            onChange={(e) => setIncludeLink(e.target.checked)}
            className="rounded border-border"
          />
          Include online payment link
        </label>

        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => sendMut.mutate()}
            disabled={sendMut.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Send className="h-3.5 w-3.5" />
            {sendMut.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
