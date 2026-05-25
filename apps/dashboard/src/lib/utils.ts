import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRiskColor(level: string): string {
  const map: Record<string, string> = {
    SAFE: 'text-green-400',
    LOW: 'text-lime-400',
    MEDIUM: 'text-yellow-400',
    HIGH: 'text-orange-400',
    CRITICAL: 'text-red-400',
  };
  return map[level] || 'text-gray-400';
}

export function getRiskBg(level: string): string {
  const map: Record<string, string> = {
    SAFE: 'bg-green-500/10 border-green-500/30',
    LOW: 'bg-lime-500/10 border-lime-500/30',
    MEDIUM: 'bg-yellow-500/10 border-yellow-500/30',
    HIGH: 'bg-orange-500/10 border-orange-500/30',
    CRITICAL: 'bg-red-500/10 border-red-500/30',
  };
  return map[level] || 'bg-gray-500/10 border-gray-500/30';
}

export function getRiskHex(level: string): string {
  const map: Record<string, string> = {
    SAFE: '#22c55e',
    LOW: '#84cc16',
    MEDIUM: '#f59e0b',
    HIGH: '#f97316',
    CRITICAL: '#ef4444',
  };
  return map[level] || '#6b7280';
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}
