import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
  iconColor?: string;
}

export default function StatCard({ label, value, icon: Icon, trend, iconColor = 'text-primary' }: StatCardProps) {
  return (
    <div className="stat-card animate-slide-up">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl bg-secondary ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3 text-xs">
          {trend.direction === 'up' && <TrendingUp className="h-3.5 w-3.5 text-success" />}
          {trend.direction === 'down' && <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
          {trend.direction === 'neutral' && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className={trend.direction === 'up' ? 'text-success' : trend.direction === 'down' ? 'text-destructive' : 'text-muted-foreground'}>
            {trend.value}
          </span>
          <span className="text-muted-foreground">vs last period</span>
        </div>
      )}
    </div>
  );
}
