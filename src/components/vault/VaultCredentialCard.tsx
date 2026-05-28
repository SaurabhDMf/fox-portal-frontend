import { useState } from 'react';
import { Lock, Eye, EyeOff, Copy, Star, CreditCard, FileText, User } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  login:        <Lock className="h-4 w-4 text-muted-foreground" />,
  secure_note:  <FileText className="h-4 w-4 text-muted-foreground" />,
  payment_card: <CreditCard className="h-4 w-4 text-muted-foreground" />,
  identity:     <User className="h-4 w-4 text-muted-foreground" />,
};

interface Credential {
  id: string;
  title: string;
  username?: string;
  url?: string;
  category?: string;
  item_type?: string;
  is_favorite?: boolean | number;
  is_owner?: boolean | number | string;
  shared_can_edit?: boolean | number | string;
}

interface Props {
  cred: Credential;
  selected: boolean;
  onClick: () => void;
  onFavorite: (id: string) => void;
}

let clipTimer: ReturnType<typeof setTimeout>;
function copyToClip(text: string, label: string) {
  clearTimeout(clipTimer);
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied — clears in 30s`);
  clipTimer = setTimeout(() => navigator.clipboard.writeText(''), 30_000);
}

export default function VaultCredentialCard({ cred, selected, onClick, onFavorite }: Props) {
  const type = cred.item_type || 'login';
  const isFav = Boolean(cred.is_favorite);

  let faviconUrl: string | null = null;
  let urlHostname: string | null = null;
  try {
    if (cred.url) {
      const parsed = new URL(cred.url.startsWith('http') ? cred.url : `https://${cred.url}`);
      urlHostname = parsed.hostname;
      faviconUrl = `https://www.google.com/s2/favicons?domain=${urlHostname}&sz=32`;
    }
  } catch { /* invalid url */ }

  const quickCopyUsername = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cred.username) copyToClip(cred.username, 'Username');
  };

  const quickCopyPassword = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data } = await api.get(`/vault/credentials/${cred.id}/reveal`);
      copyToClip(data.password || '', 'Password');
    } catch { toast.error('Cannot copy password'); }
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors group ${
        selected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary border border-transparent'
      }`}
    >
      {/* Favicon / type icon */}
      <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
        {faviconUrl ? (
          <img src={faviconUrl} alt="" className="w-5 h-5 rounded"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        ) : TYPE_ICONS[type]}
      </div>

      {/* Title + subtitle */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-tight">{cred.title}</p>
        <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
          {cred.username || urlHostname || type}
        </p>
      </div>

      {/* Actions — visible on hover or selected */}
      <div className={`flex items-center gap-0.5 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
        {cred.username && (
          <button onClick={quickCopyUsername} className="p-1.5 rounded-md hover:bg-background/60 text-muted-foreground" title="Copy username">
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
        {type === 'login' && (
          <button onClick={quickCopyPassword} className="p-1.5 rounded-md hover:bg-background/60 text-muted-foreground" title="Copy password">
            <Lock className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onFavorite(cred.id); }}
          className="p-1.5 rounded-md hover:bg-background/60"
          title={isFav ? 'Unfavorite' : 'Favorite'}
        >
          <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
        </button>
      </div>
    </button>
  );
}
