import { ArrowRightLeft } from 'lucide-react';

interface Props {
  handoffInfo?: string | null;
  className?: string;
}

/**
 * Parses `handoff_info` formatted as "Name|||Stage" and renders a compact badge.
 * Returns null if no handoff info exists.
 */
export default function HandoffBadge({ handoffInfo, className = '' }: Props) {
  if (!handoffInfo || typeof handoffInfo !== 'string') return null;

  const [name, stage] = handoffInfo.split('|||').map(s => s?.trim()).filter(Boolean);
  if (!name && !stage) return null;

  const tooltip = `Handed off to ${name || 'someone'}${stage ? ` (stage: ${stage})` : ''}`;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent/15 text-accent-foreground border border-accent/30 whitespace-nowrap ${className}`}
      title={tooltip}
    >
      <ArrowRightLeft className="h-2.5 w-2.5" />
      <span className="truncate max-w-[160px]">
        Handed off to {name || '—'}
        {stage ? <span className="text-muted-foreground"> · {stage}</span> : null}
      </span>
    </span>
  );
}
