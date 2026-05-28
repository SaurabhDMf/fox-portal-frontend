import { useState } from 'react';
import {
  Lock, Eye, EyeOff, Copy, ExternalLink, Share2, Pencil,
  Trash2, Star, RefreshCw, RotateCcw,
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import PasswordGenerator from './PasswordGenerator';

export interface Credential {
  id: string;
  title: string;
  username?: string;
  url?: string;
  category?: string;
  notes?: string;
  folder_id?: string;
  is_owner?: boolean | number;
  shared_can_edit?: boolean | number;
  is_favorite?: boolean | number;
  item_type?: string;
  // decrypted extra fields
  cardholder_name?: string;
  card_number?: string;
  expiry?: string;
  cvv?: string;
  full_name?: string;
  phone?: string;
  address?: string;
  note_body?: string;
}

interface Props {
  cred: Credential;
  onEdit: (cred: Credential) => void;
  onTrash: (id: string) => void;
  onRestore?: (id: string) => void;
  onShare: (id: string) => void;
  onFavorite: (id: string) => void;
  onClose: () => void;
  canEdit: boolean;
  canDelete: boolean;
  inTrash?: boolean;
}

function getStrength(pw: string) {
  if (!pw) return { label: '', color: '', pct: 0 };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong', 'Very Strong'];
  const colors = ['', 'bg-destructive', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500', 'bg-green-500'];
  const textColors = ['', 'text-destructive', 'text-orange-500', 'text-yellow-500', 'text-blue-500', 'text-green-500', 'text-green-500'];
  return {
    label: labels[s] || 'Weak',
    color: colors[s] || 'bg-destructive',
    textColor: textColors[s] || 'text-destructive',
    pct: Math.min(100, s * 17),
  };
}

const isEnabled = (v: boolean | number | undefined) => v === true || v === 1;

let clipTimer: ReturnType<typeof setTimeout>;

function FieldRow({
  label, value, onCopy, action,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center px-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium truncate">
          {value || <span className="text-muted-foreground italic">—</span>}
        </p>
      </div>
      <div className="flex items-center gap-1 ml-2">
        {action}
        <button
          onClick={onCopy}
          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
          title={`Copy ${label}`}
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function VaultDetailPanel({
  cred,
  onEdit,
  onTrash,
  onRestore,
  onShare,
  onFavorite,
  onClose,
  canEdit,
  canDelete,
  inTrash,
}: Props) {
  const [revealedPw, setRevealedPw] = useState('');
  const [pwVisible, setPwVisible] = useState(false);
  const [loadingReveal, setLoadingReveal] = useState(false);
  const [showGen, setShowGen] = useState(false);

  const isOwner = cred.is_owner === undefined ? true : isEnabled(cred.is_owner);
  const sharedCanEdit = isEnabled(cred.shared_can_edit);
  const isFavorite = isEnabled(cred.is_favorite as boolean | number | undefined);
  const showEdit = canEdit && (isOwner || sharedCanEdit);
  const itemType = cred.item_type || 'login';

  let faviconUrl: string | null = null;
  let urlHostname: string | null = null;
  try {
    if (cred.url) {
      const parsed = new URL(cred.url.startsWith('http') ? cred.url : `https://${cred.url}`);
      urlHostname = parsed.hostname;
      faviconUrl = `https://www.google.com/s2/favicons?domain=${urlHostname}&sz=64`;
    }
  } catch {}

  const copyToClip = (text: string, label: string) => {
    clearTimeout(clipTimer);
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied — clears in 30s`);
    clipTimer = setTimeout(() => navigator.clipboard.writeText(''), 30000);
  };

  const handleReveal = async () => {
    if (pwVisible && revealedPw) {
      setPwVisible(false);
      return;
    }
    if (revealedPw) {
      setPwVisible(true);
      return;
    }
    setLoadingReveal(true);
    try {
      const { data } = await api.get(`/vault/credentials/${cred.id}/reveal`);
      setRevealedPw(data.password || '');
      setPwVisible(true);
    } catch {
      toast.error('Could not reveal password');
    } finally {
      setLoadingReveal(false);
    }
  };

  const handleCopyPw = async () => {
    let pw = revealedPw;
    if (!pw) {
      try {
        const { data } = await api.get(`/vault/credentials/${cred.id}/reveal`);
        pw = data.password || '';
        setRevealedPw(pw);
      } catch {
        toast.error('Could not copy password');
        return;
      }
    }
    copyToClip(pw, 'Password');
  };

  const handleGenUse = (generated: string) => {
    copyToClip(generated, 'Generated password');
    setShowGen(false);
  };

  const pwDisplay = pwVisible && revealedPw ? revealedPw : '••••••••••';
  const str = getStrength(revealedPw);

  const isEmail = cred.username?.includes('@');

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top identity section */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
            {faviconUrl ? (
              <img
                src={faviconUrl}
                alt=""
                className="w-8 h-8"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-base font-semibold leading-tight truncate">
              {urlHostname || cred.title}
            </p>
            {urlHostname && (
              <p className="text-sm text-muted-foreground truncate mt-0.5">{cred.title}</p>
            )}
          </div>
          <button
            onClick={() => onFavorite(cred.id)}
            className={`p-1.5 rounded-md transition-colors ${isFavorite ? 'text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'}`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`h-5 w-5 ${isFavorite ? 'fill-yellow-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">

        {/* Login details card */}
        {itemType === 'login' && (
          <div className="glass-card rounded-xl overflow-hidden divide-y divide-border">
            <div className="px-4 py-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Login details
              </span>
            </div>

            {/* Username / Email */}
            {cred.username && (
              <FieldRow
                label={isEmail ? 'Email' : 'Username'}
                value={cred.username}
                onCopy={() => copyToClip(cred.username!, isEmail ? 'Email' : 'Username')}
              />
            )}

            {/* Password row */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Password</p>
                  <p className="text-sm font-mono font-medium tracking-widest truncate">
                    {loadingReveal ? (
                      <span className="text-muted-foreground text-xs">Loading...</span>
                    ) : pwDisplay}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={handleReveal}
                    className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
                    title={pwVisible ? 'Hide password' : 'Show password'}
                  >
                    {pwVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={handleCopyPw}
                    className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
                    title="Copy password"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowGen(v => !v)}
                    className={`p-1.5 rounded-md hover:bg-secondary transition-colors ${showGen ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
                    title="Generate new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Strength bar — shown once password is revealed */}
              {revealedPw && (
                <div className="mt-2 space-y-1">
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${str.color}`}
                      style={{ width: `${str.pct}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-medium ${str.textColor}`}>{str.label}</span>
                </div>
              )}
            </div>

            {/* Inline generator */}
            {showGen && (
              <div className="px-4 py-3 bg-secondary/30">
                <PasswordGenerator
                  onUse={handleGenUse}
                  onClose={() => setShowGen(false)}
                />
              </div>
            )}

            {/* Website row */}
            {cred.url && (
              <div className="flex items-center px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Website</p>
                  <p className="text-sm font-medium text-primary truncate">{urlHostname || cred.url}</p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <a
                    href={cred.url.startsWith('http') ? cred.url : `https://${cred.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
                    title="Open website"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => copyToClip(cred.url!, 'URL')}
                    className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
                    title="Copy URL"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Secure note */}
        {itemType === 'secure_note' && (
          <div className="glass-card rounded-xl overflow-hidden divide-y divide-border">
            <div className="px-4 py-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Note
              </span>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm whitespace-pre-wrap break-words text-foreground leading-relaxed">
                {cred.note_body || <span className="text-muted-foreground italic">No content</span>}
              </p>
            </div>
          </div>
        )}

        {/* Payment card */}
        {itemType === 'payment_card' && (
          <div className="glass-card rounded-xl overflow-hidden divide-y divide-border">
            <div className="px-4 py-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Card details
              </span>
            </div>
            {cred.cardholder_name && (
              <FieldRow
                label="Cardholder name"
                value={cred.cardholder_name}
                onCopy={() => copyToClip(cred.cardholder_name!, 'Cardholder name')}
              />
            )}
            {cred.card_number && (
              <FieldRow
                label="Card number"
                value={`•••• •••• •••• ${cred.card_number.slice(-4)}`}
                onCopy={() => copyToClip(cred.card_number!, 'Card number')}
              />
            )}
            {cred.expiry && (
              <FieldRow
                label="Expiry"
                value={cred.expiry}
                onCopy={() => copyToClip(cred.expiry!, 'Expiry')}
              />
            )}
            {cred.cvv && (
              <FieldRow
                label="CVV"
                value="•••"
                onCopy={() => copyToClip(cred.cvv!, 'CVV')}
              />
            )}
          </div>
        )}

        {/* Identity */}
        {itemType === 'identity' && (
          <div className="glass-card rounded-xl overflow-hidden divide-y divide-border">
            <div className="px-4 py-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Identity
              </span>
            </div>
            {cred.full_name && (
              <FieldRow
                label="Full name"
                value={cred.full_name}
                onCopy={() => copyToClip(cred.full_name!, 'Full name')}
              />
            )}
            {cred.phone && (
              <FieldRow
                label="Phone"
                value={cred.phone}
                onCopy={() => copyToClip(cred.phone!, 'Phone')}
              />
            )}
            {cred.address && (
              <FieldRow
                label="Address"
                value={cred.address}
                onCopy={() => copyToClip(cred.address!, 'Address')}
              />
            )}
          </div>
        )}

        {/* Notes */}
        {cred.notes && (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Notes
              </span>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground leading-relaxed">
                {cred.notes}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="px-4 py-3 border-t border-border bg-background/80 backdrop-blur-sm flex items-center gap-2">
        {/* Left — trash or restore */}
        {inTrash ? (
          <button
            onClick={() => onRestore?.(cred.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-foreground bg-secondary hover:bg-secondary/80 transition-colors"
            title="Restore"
          >
            <RotateCcw className="h-4 w-4" />
            Restore
          </button>
        ) : (
          <button
            onClick={() => onTrash(cred.id)}
            disabled={!canDelete}
            className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="Move to trash"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}

        {/* Middle — share (owners only) */}
        {isOwner && (
          <button
            onClick={() => onShare(cred.id)}
            className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        )}

        <div className="flex-1" />

        {/* Right — edit + close */}
        {showEdit && (
          <button
            onClick={() => onEdit(cred)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        )}
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
