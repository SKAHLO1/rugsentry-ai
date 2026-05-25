import { getRiskHex } from '../lib/utils';

interface Props {
  score: number;
  size?: number;
  label?: string;
}

export default function RiskGauge({ score, size = 120, label }: Props) {
  const radius = (size - 20) / 2;
  const circumference = Math.PI * radius;
  const level = score <= 20 ? 'SAFE' : score <= 40 ? 'LOW' : score <= 60 ? 'MEDIUM' : score <= 80 ? 'HIGH' : 'CRITICAL';
  const color = getRiskHex(level);
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
        <path
          d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke="#1f2937"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">
          {score}
        </text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill={color} fontSize="10" fontWeight="600">
          {level}
        </text>
      </svg>
      {label && <p className="text-xs text-gray-500">{label}</p>}
    </div>
  );
}
