import { useEffect, useState } from 'react';
import { X, Copy, Link2, Loader2, Trash2, ExternalLink, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface Props {
  invoiceId: string;
  invoiceNumber?: string;
  onClose: () => void;
}

export default function ShareInvoiceModal({ invoiceId, invoiceNumber, onClose }: Props) {
  const [shareUrl, setShareUrl] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const createLink = async () => {
    setCreating(true);
    try {
      const { data } = await api.post(`/invoices/${invoiceId}/share`, {}, {
        // bypass global DELETE confirm prompt — not applicable to POST anyway
      } as any);
      const url = data?.share_url || data?.data?.share_url || data?.url || '';
      if (!url) {
        toast.error('No share URL returned');
      } else {
        setShareUrl(url);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create share link');
    } finally {
      setCreating(false);
    }
  };

  // Auto-create on open
  useEffect(() => {
    createLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard');
    } catch {
      // fallback
      const el = document.getElementById('share-url-input') as HTMLInputElement | null;
      if (el) {
        el.select();
        document.execCommand('copy');
        toast.success('Link copied');
      }
    }
  };

  const revoke = async () => {
    if (!shareUrl) {
      onClose();
      return;
    }
    setRevoking(true);
    try {
      await api.delete(`/invoices/${invoiceId}/share`, { skipConfirm: true } as any);
      toast.success('Share link revoked');
      setShareUrl('');
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to revoke link');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Share invoice</h2>
              <p className="text-xs text-muted-foreground">
                {invoiceNumber ? `Public link for ${invoiceNumber}` : 'Generate a public payment link'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-foreground">
            <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p>Anyone with this link can view and pay this invoice without logging in.</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium">Share link</label>
            <div className="mt-1 flex gap-2">
              <input
                id="share-url-input"
                readOnly
                value={creating ? 'Generating link…' : shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 truncate"
                placeholder="No link yet"
              />
              <button
                type="button"
                onClick={copyLink}
                disabled={!shareUrl || creating}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
            {shareUrl && (
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> Open public page
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-secondary/20 rounded-b-xl">
          <button
            type="button"
            onClick={revoke}
            disabled={revoking || creating || !shareUrl}
            className="px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 active:scale-[0.97] transition-all disabled:opacity-50 inline-flex items-center gap-2"
          >
            {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Revoke Link
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={createLink}
              disabled={creating}
              className="px-3 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/70 active:scale-[0.97] transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Regenerate
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
