import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Copy, Share2, Pencil, Trash2, ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

function getStrength(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak', color: 'bg-destructive', width: '20%' };
  if (score <= 2) return { label: 'Fair', color: 'bg-[hsl(var(--warning))]', width: '40%' };
  if (score <= 3) return { label: 'Good', color: 'bg-[hsl(var(--info))]', width: '60%' };
  if (score <= 4) return { label: 'Strong', color: 'bg-[hsl(var(--success))]', width: '80%' };
  return { label: 'Very Strong', color: 'bg-[hsl(var(--success))]', width: '100%' };
}

const categoryColors: Record<string, string> = {
  Login: 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]',
  'API Key': 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]',
  Database: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]',
  SSH: 'bg-primary/15 text-primary',
  Other: 'bg-secondary text-muted-foreground',
  'Social Media': 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]',
  Finance: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]',
  'Dev Tools': 'bg-primary/15 text-primary',
  Email: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]',
  CRM: 'bg-destructive/15 text-destructive',
};

interface Credential {
  id: string;
  title: string;
  username: string;
  url?: string;
  category?: string;
  password_strength?: string;
  is_owner?: boolean | number | string;
  shared_can_edit?: boolean | number | string;
}

interface Props {
  cred: Credential;
  onEdit: (cred: Credential) => void;
  onShare: (id: string) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export default function VaultCredentialCard({ cred, onEdit, onShare, onDelete, canEdit, canDelete }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [revealedPw, setRevealedPw] = useState('');

  // is_owner: 1/true = owner, 0/false = shared. If undefined, assume owner.
  const isOwner = cred.is_owner === undefined || cred.is_owner === null
    ? true
    : (cred.is_owner === true || cred.is_owner === 1 || (cred.is_owner as any) === '1');
  const isShared = !isOwner;
  const sharedCanEdit = cred.shared_can_edit === true || cred.shared_can_edit === 1 as any || (cred.shared_can_edit as any) === '1';
  const showEdit = canEdit && (isOwner || sharedCanEdit);
  const showDelete = canDelete && isOwner;
  const showShare = isOwner;

  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => { setRevealed(false); setRevealedPw(''); }, 10000);
    return () => clearTimeout(t);
  }, [revealed]);

  const handleReveal = async () => {
    if (revealed) { setRevealed(false); setRevealedPw(''); return; }
    try {
      const { data } = await api.get(`/vault/credentials/${cred.id}/reveal`);
      setRevealedPw(data.password || '••••••');
      setRevealed(true);
    } catch { toast.error('Cannot reveal password'); }
  };

  const copyPw = async () => {
    if (!revealed) {
      try {
        const { data } = await api.get(`/vault/credentials/${cred.id}/reveal`);
        navigator.clipboard.writeText(data.password || '');
        toast.success('Password copied');
      } catch { toast.error('Cannot copy'); }
    } else {
      navigator.clipboard.writeText(revealedPw);
      toast.success('Password copied');
    }
  };

  let faviconUrl: string | null = null;
  let urlHostname: string | null = null;
  try {
    if (cred.url) {
      const parsed = new URL(cred.url);
      urlHostname = parsed.hostname;
      faviconUrl = `https://www.google.com/s2/favicons?domain=${urlHostname}&sz=32`;
    }
  } catch { /* invalid URL */ }
  const strength = getStrength(revealedPw || cred.password_strength || '');
  const catColor = categoryColors[cred.category || 'Other'] || categoryColors.Other;

  return (
    <div className="glass-card-hover p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
        {faviconUrl ? <img src={faviconUrl} alt="" className="w-5 h-5 rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'; }} /> : <Lock className="h-4 w-4 text-muted-foreground" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{cred.title}</span>
          {isShared && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] font-medium">Shared</span>}
          {cred.category && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${catColor}`}>{cred.category}</span>}
        </div>
        <div className="text-xs text-muted-foreground truncate">{cred.username}</div>
        {urlHostname && (
          <a href={cred.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary truncate flex items-center gap-1 hover:underline">
            {urlHostname} <ExternalLink className="h-3 w-3 inline" />
          </a>
        )}
        {(revealedPw || cred.password_strength) && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-16 h-1 bg-secondary rounded-full overflow-hidden"><div className={`h-full ${strength.color} rounded-full`} style={{ width: strength.width }} /></div>
            <span className="text-[10px] text-muted-foreground">{strength.label}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <span className="text-sm font-mono text-muted-foreground">{revealed ? revealedPw : '••••••••'}</span>
        <button onClick={handleReveal} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title={revealed ? 'Hide' : 'Reveal'}>
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button onClick={copyPw} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="Copy password">
          <Copy className="h-4 w-4" />
        </button>
        {showEdit && (
          <button onClick={() => onEdit(cred)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {showShare && (
          <button onClick={() => onShare(cred.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="Share">
            <Share2 className="h-4 w-4" />
          </button>
        )}
        {showDelete && (
          <button onClick={() => onDelete(cred.id)} className="p-1.5 rounded-md hover:bg-secondary text-destructive" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
