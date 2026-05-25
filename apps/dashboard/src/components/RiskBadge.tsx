import { cn, getRiskColor, getRiskBg } from '../lib/utils';

interface Props {
  level: string;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function RiskBadge({ level, score, size = 'md' }: Props) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-semibold',
      getRiskBg(level),
      getRiskColor(level),
      sizeClasses[size]
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', {
        'bg-green-400': level === 'SAFE',
        'bg-lime-400': level === 'LOW',
        'bg-yellow-400': level === 'MEDIUM',
        'bg-orange-400': level === 'HIGH',
        'bg-red-400': level === 'CRITICAL',
      })} />
      {score !== undefined ? `${score}/100` : level}
    </span>
  );
}
