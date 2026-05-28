const STATUS_CONFIG: Record<string, { color: string; label: string; textColor: string }> = {
  online:  { color: 'bg-green-500',  label: 'Online',        textColor: 'text-green-500' },
  away:    { color: 'bg-yellow-400', label: 'Away',          textColor: 'text-yellow-400' },
  busy:    { color: 'bg-red-500',    label: 'Busy',          textColor: 'text-red-500' },
  break:   { color: 'bg-orange-400', label: 'On a Break',    textColor: 'text-orange-400' },
  offline: { color: 'bg-gray-500',   label: 'Offline',       textColor: 'text-muted-foreground' },
  custom:  { color: 'bg-purple-500', label: 'Custom',        textColor: 'text-purple-500' },
};

interface StatusBadgeProps {
  status: string;
  statusText?: string | null;
  showLabel?: boolean;
  size?: 'xs' | 'sm';
}

export default function StatusBadge({ status, statusText, showLabel = true, size = 'sm' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.offline;
  const dotSize = size === 'xs' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  const textSize = size === 'xs' ? 'text-[10px]' : 'text-xs';
  const displayLabel = statusText || cfg.label;

  if (status === 'online' && !statusText) {
    return <span className={`inline-block ${dotSize} rounded-full ${cfg.color} flex-shrink-0`} />;
  }

  return (
    <span className="inline-flex items-center gap-1 flex-shrink-0">
      <span className={`inline-block ${dotSize} rounded-full ${cfg.color}`} />
      {showLabel && (
        <span className={`${textSize} font-medium ${cfg.textColor}`}>
          {displayLabel}
        </span>
      )}
    </span>
  );
}
