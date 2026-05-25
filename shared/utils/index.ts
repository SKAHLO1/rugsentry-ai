import { ENTITY_PATTERNS, RISK_THRESHOLDS } from '../constants';
import type { ExtractedEntities, RiskLevel, RiskScore } from '../types';

export function getRiskLevel(score: number): RiskLevel {
  if (score <= RISK_THRESHOLDS.SAFE.max) return 'SAFE';
  if (score <= RISK_THRESHOLDS.LOW.max) return 'LOW';
  if (score <= RISK_THRESHOLDS.MEDIUM.max) return 'MEDIUM';
  if (score <= RISK_THRESHOLDS.HIGH.max) return 'HIGH';
  return 'CRITICAL';
}

export function buildRiskScore(score: number, flags: string[], summary: string): RiskScore {
  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    level: getRiskLevel(score),
    flags,
    summary,
  };
}

export function extractEntities(text: string): ExtractedEntities {
  const evmMatches = text.match(ENTITY_PATTERNS.EVM_ADDRESS) || [];
  const solanaMatches = text.match(ENTITY_PATTERNS.SOLANA_ADDRESS) || [];
  const dexMatches = text.match(ENTITY_PATTERNS.DEXSCREENER_URL) || [];
  const pumpMatches = text.match(ENTITY_PATTERNS.PUMPFUN_URL) || [];
  const telegramMatches = text.match(ENTITY_PATTERNS.TELEGRAM_URL) || [];
  const twitterMatches = text.match(ENTITY_PATTERNS.TWITTER_URL) || [];
  const symbolMatches = text.match(ENTITY_PATTERNS.TOKEN_SYMBOL) || [];

  const contractAddresses = evmMatches.filter(addr => isLikelyContract(addr));
  const walletAddresses = [...evmMatches.filter(addr => !isLikelyContract(addr)), ...solanaMatches];

  return {
    contractAddresses: [...new Set(contractAddresses)],
    walletAddresses: [...new Set(walletAddresses)],
    dexScreenerLinks: [...new Set(dexMatches)],
    pumpFunLinks: [...new Set(pumpMatches)],
    telegramLinks: [...new Set(telegramMatches)],
    twitterLinks: [...new Set(twitterMatches)],
    coinUrls: [],
    tokenSymbols: [...new Set(symbolMatches)],
  };
}

export function isLikelyContract(address: string): boolean {
  if (!address.startsWith('0x')) return false;
  const lower = address.toLowerCase();
  const zeroCount = (lower.match(/0/g) || []).length;
  return zeroCount < 20;
}

export function isEvmAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

export function isSolanaAddress(input: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input);
}

export function isDexScreenerUrl(input: string): boolean {
  return /https?:\/\/(www\.)?dexscreener\.com\//i.test(input);
}

export function isPumpFunUrl(input: string): boolean {
  return /https?:\/\/(www\.)?pump\.fun\//i.test(input);
}

export function extractContractFromDexScreener(url: string): { chain: string; address: string } | null {
  const match = url.match(/dexscreener\.com\/([^/]+)\/([^/?#]+)/);
  if (match) {
    return { chain: match[1], address: match[2] };
  }
  return null;
}

export function extractContractFromPumpFun(url: string): string | null {
  const match = url.match(/pump\.fun\/([^/?#]+)/);
  return match ? match[1] : null;
}

export function formatRiskScore(score: number): string {
  if (score <= 20) return 'Safe';
  if (score <= 40) return 'Low Risk';
  if (score <= 60) return 'Medium Risk';
  if (score <= 80) return 'High Risk';
  return 'Critical Risk';
}

export function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
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

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function sanitizeInput(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim().slice(0, 10000);
}
