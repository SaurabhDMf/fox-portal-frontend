interface StatusDotProps {
  status?: string;
  className?: string;
}

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  break: 'bg-orange-500',
  offline: 'bg-gray-500',
  custom: 'bg-purple-500',
};

export default function StatusDot({ status, className = '' }: StatusDotProps) {
  const color = statusColors[status || 'offline'] || statusColors.offline;
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ring-2 ring-background ${color} ${className}`} />
  );
}
