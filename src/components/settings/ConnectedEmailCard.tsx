import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Mail, ExternalLink } from 'lucide-react';
import { emailApi } from '@/lib/api';
import { usePortalBase } from '@/hooks/usePortalBase';

const fmtDate = (iso?: string) => {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleString();
};

export default function ConnectedEmailCard() {
  const manageHref = `${usePortalBase()}/email`;

  const { data, isLoading } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => emailApi.getAccounts().then((r) => r.data?.data ?? r.data ?? []),
  });
  const accounts: any[] = Array.isArray(data) ? data : [];
  const primary = accounts.find((a) => a.is_default) || accounts[0];

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Connected Email Account
        </h3>
        <Link
          to={manageHref}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          Manage Email <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="h-10 bg-secondary/50 rounded-lg animate-pulse" />
      ) : primary ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 border border-border">
          <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold uppercase">
            {(primary.email_address || primary.email || '?')[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {primary.email_address || primary.email}
            </div>
            <div className="text-xs text-muted-foreground">
              Last synced: {fmtDate(primary.last_synced_at)}
            </div>
          </div>
          {primary.is_default && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
              Default
            </span>
          )}
        </div>
      ) : (
        <div className="text-center py-6 px-4 rounded-lg bg-secondary/30 border border-dashed border-border">
          <p className="text-sm text-muted-foreground mb-2">
            No personal email account connected yet.
          </p>
          <Link
            to={manageHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            Connect your inbox <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
