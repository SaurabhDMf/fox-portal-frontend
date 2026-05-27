import { useState, useEffect, useCallback } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  onUse?: (password: string) => void;
  onClose?: () => void;
}

interface GenOpts {
  upper: boolean;
  lower: boolean;
  nums: boolean;
  syms: boolean;
  noAmbig: boolean;
}

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong', 'Very Strong'];
  const colors = ['', 'bg-destructive', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500', 'bg-green-500'];
  return {
    label: labels[s] || 'Weak',
    color: colors[s] || 'bg-destructive',
    pct: Math.min(100, s * 17),
  };
}

function generate(len: number, opts: GenOpts): string {
  let chars = '';
  if (opts.upper) chars += opts.noAmbig ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (opts.lower) chars += opts.noAmbig ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  if (opts.nums)  chars += opts.noAmbig ? '23456789' : '0123456789';
  if (opts.syms)  chars += '!@#$%^&*()-_=+[]{}|;:,.<>?';
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const DEFAULT_OPTS: GenOpts = { upper: true, lower: true, nums: true, syms: false, noAmbig: false };

export default function PasswordGenerator({ onUse, onClose }: Props) {
  const [len, setLen] = useState(16);
  const [opts, setOpts] = useState<GenOpts>(DEFAULT_OPTS);
  const [pw, setPw] = useState('');
  const [copied, setCopied] = useState(false);

  const regen = useCallback(() => setPw(generate(len, opts)), [len, opts]);

  useEffect(() => { regen(); }, [regen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Password copied');
  };

  const str = strength(pw);

  const togglePill = (key: keyof GenOpts) =>
    setOpts(o => ({ ...o, [key]: !o[key] }));

  return (
    <div className="glass-card p-4 space-y-4">
      {/* Length */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Length</span>
          <span className="text-sm font-semibold tabular-nums w-7 text-right">{len}</span>
        </div>
        <input
          type="range"
          min={8}
          max={64}
          value={len}
          onChange={e => setLen(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-secondary cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
          <span>8</span>
          <span>64</span>
        </div>
      </div>

      {/* Toggle pills */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: 'upper', label: 'A–Z' },
            { key: 'lower', label: 'a–z' },
            { key: 'nums',  label: '0–9' },
            { key: 'syms',  label: '!@#' },
          ] as { key: keyof GenOpts; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => togglePill(key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              opts[key]
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => togglePill('noAmbig')}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            opts.noAmbig
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'
          }`}
          title="Exclude 0/O, 1/l/I"
        >
          No ambiguous
        </button>
      </div>

      {/* Password display */}
      <div className="font-mono text-sm bg-secondary rounded-lg p-3 break-all select-all text-foreground leading-relaxed min-h-[3rem]">
        {pw}
      </div>

      {/* Strength bar */}
      {pw && (
        <div className="space-y-1">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${str.color}`}
              style={{ width: `${str.pct}%` }}
            />
          </div>
          <span className={`text-xs font-medium`} style={{ color: 'inherit' }}>
            <span className={`text-xs font-medium ${str.color.replace('bg-', 'text-').replace('bg-destructive', 'text-destructive')}`}>
              {str.label}
            </span>
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={regen}
          className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
          title="Regenerate"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm transition-colors"
        >
          <Copy className="h-4 w-4" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {onUse && (
          <button
            onClick={() => onUse(pw)}
            className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all"
          >
            Use this password
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
