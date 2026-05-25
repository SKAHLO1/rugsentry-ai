import { cn } from '../lib/utils';
import type { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: 'purple' | 'red' | 'orange' | 'green' | 'blue';
}

const colorMap = {
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-400', text: 'text-purple-400' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-400', text: 'text-red-400' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: 'text-orange-400', text: 'text-orange-400' },
  green: { bg: 'bg-green-500/10', border: 'border-green-500/20', icon: 'text-green-400', text: 'text-green-400' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-400', text: 'text-blue-400' },
};

export default function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'purple' }: Props) {
  const colors = colorMap[color];
  return (
    <div className={cn('rounded-xl border p-5 bg-gray-900', colors.border)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 font-medium">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span className={cn('text-xs font-semibold', trend.value > 0 ? 'text-red-400' : 'text-green-400')}>
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn('p-2.5 rounded-lg', colors.bg)}>
          <Icon className={cn('w-5 h-5', colors.icon)} />
        </div>
      </div>
    </div>
  );
}
