import { useState } from 'react';
import { Search, Scan, AlertTriangle, CheckCircle, ExternalLink, Copy } from 'lucide-react';
import { analyzeToken } from '../lib/api';
import RiskBadge from '../components/RiskBadge';
import RiskGauge from '../components/RiskGauge';
import { cn, formatUSD, truncateAddress } from '../lib/utils';

interface TokenResult {
  id: string;
  contractAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  chain?: string;
  riskScore: { score: number; level: string; flags: string[]; summary: string };
  liquidityLocked: boolean;
  holderConcentration: number;
  topWalletPercent: number;
  isHoneypot: boolean;
  ownershipRenounced: boolean;
  hasBlacklistFunction: boolean;
  hasMintFunction: boolean;
  hasTradingRestrictions: boolean;
  deployerRisk: boolean;
  liquidityUSD?: number;
  marketCapUSD?: number;
  volume24h?: number;
  priceUSD?: number;
  analyzedAt: string;
}

const CHAINS = ['ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'solana'];

const FLAG_ICONS: Record<string, { label: string; good: boolean }> = {
  isHoneypot: { label: 'Honeypot', good: false },
  liquidityLocked: { label: 'Liquidity Locked', good: true },
  ownershipRenounced: { label: 'Ownership Renounced', good: true },
  hasBlacklistFunction: { label: 'Blacklist Function', good: false },
  hasMintFunction: { label: 'Mint Function', good: false },
  hasTradingRestrictions: { label: 'Trading Restrictions', good: false },
  deployerRisk: { label: 'Deployer Risk', good: false },
};

export default function TokenAnalyzerPage() {
  const [input, setInput] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TokenResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await analyzeToken(input.trim(), chain);
      if (res.success) {
        setResult(res.data);
      } else {
        setError(res.error || 'Analysis failed');
      }
    } catch (e) {
      setError('Failed to connect to backend. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const booleanChecks = result
    ? Object.entries(FLAG_ICONS).map(([key, meta]) => ({
        key,
        label: meta.label,
        value: result[key as keyof TokenResult] as boolean,
        good: meta.good,
      }))
    : [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Scan className="w-6 h-6 text-purple-400" />
          Token Risk Analyzer
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Paste a contract address, DexScreener link, Pump.fun link, or token symbol
        </p>
      </div>

      {/* Input */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder="0xabc123... or https://dexscreener.com/... or $TOKEN"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
          >
            {CHAINS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={handleAnalyze}
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analyzing...</>
            ) : (
              <><Scan className="w-4 h-4" />Analyze</>
            )}
          </button>
        </div>

        <div className="text-xs text-gray-600">
          Supported: EVM contract addresses, Solana addresses, DexScreener URLs, Pump.fun URLs, token symbols
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">Analysis Error</p>
            <p className="text-xs text-red-300 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Token header */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-bold text-white">
                    {result.tokenName || 'Unknown Token'}
                  </h2>
                  {result.tokenSymbol && (
                    <span className="text-sm font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                      ${result.tokenSymbol}
                    </span>
                  )}
                  <RiskBadge level={result.riskScore.level} size="md" />
                </div>
                {result.contractAddress && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-mono text-gray-400">{truncateAddress(result.contractAddress, 10)}</span>
                    <button
                      onClick={() => handleCopy(result.contractAddress!)}
                      className="text-gray-600 hover:text-gray-300 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {copied && <span className="text-xs text-green-400">Copied!</span>}
                  </div>
                )}
                <p className="text-sm text-gray-400 mt-2">{result.riskScore.summary}</p>
              </div>
              <RiskGauge score={result.riskScore.score} size={110} label="Risk Score" />
            </div>

            {/* Token metrics */}
            {(result.liquidityUSD !== undefined || result.marketCapUSD !== undefined || result.priceUSD !== undefined) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-800">
                {result.priceUSD !== undefined && (
                  <div>
                    <p className="text-xs text-gray-500">Price</p>
                    <p className="text-sm font-semibold text-gray-200">${result.priceUSD.toFixed(8)}</p>
                  </div>
                )}
                {result.liquidityUSD !== undefined && (
                  <div>
                    <p className="text-xs text-gray-500">Liquidity</p>
                    <p className="text-sm font-semibold text-gray-200">{formatUSD(result.liquidityUSD)}</p>
                  </div>
                )}
                {result.marketCapUSD !== undefined && (
                  <div>
                    <p className="text-xs text-gray-500">Market Cap</p>
                    <p className="text-sm font-semibold text-gray-200">{formatUSD(result.marketCapUSD)}</p>
                  </div>
                )}
                {result.volume24h !== undefined && (
                  <div>
                    <p className="text-xs text-gray-500">24h Volume</p>
                    <p className="text-sm font-semibold text-gray-200">{formatUSD(result.volume24h)}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Risk flags */}
          {result.riskScore.flags.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                Risk Flags ({result.riskScore.flags.length})
              </h3>
              <ul className="space-y-2">
                {result.riskScore.flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                    <span className="text-gray-300">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Security checks grid */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-400" />
              Security Checks
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {booleanChecks.map(({ key, label, value, good }) => {
                const isGood = good ? value : !value;
                return (
                  <div
                    key={key}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-lg border text-sm',
                      isGood
                        ? 'bg-green-500/10 border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    )}
                  >
                    {isGood
                      ? <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    }
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                );
              })}
              <div className={cn(
                'flex items-center gap-2 p-2.5 rounded-lg border text-sm',
                result.topWalletPercent < 30
                  ? 'bg-green-500/10 border-green-500/20 text-green-400'
                  : result.topWalletPercent < 50
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              )}>
                <span className="text-xs font-medium">Top Wallet: {result.topWalletPercent.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* DexScreener link */}
          {result.contractAddress && result.chain && (
            <a
              href={`https://dexscreener.com/${result.chain}/${result.contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View on DexScreener
            </a>
          )}
        </div>
      )}
    </div>
  );
}
