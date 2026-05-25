import axios from 'axios';
import { API_ENDPOINTS, CHAIN_IDS } from '@rugsentry/shared/constants';
import { buildRiskScore, extractContractFromDexScreener, extractContractFromPumpFun, isEvmAddress } from '@rugsentry/shared/utils';
import type { TokenAnalysis } from '@rugsentry/shared/types';
import { generateId } from '@rugsentry/shared/utils';

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  volume?: { h24: number };
  liquidity?: { usd: number };
  fdv?: number;
  marketCap?: number;
  info?: {
    socials?: Array<{ type: string; url: string }>;
  };
}

interface GoPlusTokenSecurity {
  is_honeypot?: string;
  honeypot_with_same_creator?: string;
  is_blacklisted?: string;
  is_mintable?: string;
  owner_address?: string;
  is_open_source?: string;
  is_proxy?: string;
  is_whitelisted?: string;
  buy_tax?: string;
  sell_tax?: string;
  cannot_buy?: string;
  cannot_sell_all?: string;
  creator_address?: string;
  creator_balance?: string;
  holder_count?: string;
  total_supply?: string;
  lp_holder_count?: string;
  lp_total_supply?: string;
  is_true_token?: string;
  is_airdrop_scam?: string;
  trust_list?: string;
  other_potential_risks?: string;
  note?: string;
  holders?: Array<{ address: string; tag?: string; is_contract: number; balance: string; percent: string; is_locked: number }>;
  lp_holders?: Array<{ address: string; tag?: string; is_contract: number; balance: string; percent: string; is_locked: number }>;
  owner_change_balance?: string;
  can_take_back_ownership?: string;
  hidden_owner?: string;
  selfdestruct?: string;
  external_call?: string;
  gas_abuse?: string;
  transfer_pausable?: string;
  anti_whale_modifiable?: string;
  is_anti_whale?: string;
  trading_cooldown?: string;
  personal_slippage_modifiable?: string;
  slippage_modifiable?: string;
}

interface HoneypotResult {
  isHoneypot?: boolean;
  simulationResult?: {
    buyTax?: number;
    sellTax?: number;
    transferTax?: number;
  };
  token?: {
    name?: string;
    symbol?: string;
    totalHolders?: number;
  };
  pair?: {
    reserves0?: string;
    reserves1?: string;
  };
}

export class TokenAnalysisService {
  async analyzeInput(input: string, chain?: string): Promise<TokenAnalysis> {
    const cleanInput = input.trim();

    if (extractContractFromDexScreener(cleanInput)) {
      const info = extractContractFromDexScreener(cleanInput)!;
      return this.analyzeContract(info.address, info.chain);
    }

    const pumpAddr = extractContractFromPumpFun(cleanInput);
    if (pumpAddr) {
      return this.analyzeContract(pumpAddr, 'solana');
    }

    if (isEvmAddress(cleanInput)) {
      return this.analyzeContract(cleanInput, chain || 'ethereum');
    }

    return this.analyzeBySymbol(cleanInput);
  }

  async analyzeContract(address: string, chain: string): Promise<TokenAnalysis> {
    const [dexData, goPlusData, honeypotData] = await Promise.allSettled([
      this.fetchDexScreener(address, chain),
      this.fetchGoPlus(address, chain),
      chain !== 'solana' ? this.fetchHoneypot(address) : Promise.resolve(null),
    ]);

    const dex = dexData.status === 'fulfilled' ? dexData.value : null;
    const goplus = goPlusData.status === 'fulfilled' ? goPlusData.value : null;
    const honeypot = honeypotData.status === 'fulfilled' ? honeypotData.value : null;

    return this.buildAnalysis(address, chain, dex, goplus, honeypot);
  }

  private async fetchDexScreener(address: string, chain: string): Promise<DexScreenerPair | null> {
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.DEXSCREENER}/dex/tokens/${address}`,
        { timeout: 8000 }
      );
      const pairs: DexScreenerPair[] = response.data?.pairs || [];
      const chainPairs = pairs.filter((p) => p.chainId === chain);
      return chainPairs.length > 0 ? chainPairs[0] : pairs[0] || null;
    } catch {
      return null;
    }
  }

  private async fetchGoPlus(address: string, chain: string): Promise<GoPlusTokenSecurity | null> {
    try {
      const chainId = CHAIN_IDS[chain as keyof typeof CHAIN_IDS] || '1';
      const response = await axios.get(
        `${API_ENDPOINTS.GOPLUSLABS}/token_security/${chainId}?contract_addresses=${address}`,
        { timeout: 8000 }
      );
      const result = response.data?.result?.[address.toLowerCase()];
      return result || null;
    } catch {
      return null;
    }
  }

  private async fetchHoneypot(address: string): Promise<HoneypotResult | null> {
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.HONEYPOT_IS}/IsHoneypot?address=${address}`,
        { timeout: 8000 }
      );
      return response.data || null;
    } catch {
      return null;
    }
  }

  private async analyzeBySymbol(symbol: string): Promise<TokenAnalysis> {
    const cleanSymbol = symbol.replace('$', '').toLowerCase();
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.COINGECKO}/search?query=${cleanSymbol}`,
        { timeout: 8000 }
      );
      const coins = response.data?.coins || [];
      if (coins.length > 0) {
        const coin = coins[0];
        const flags: string[] = [];
        if (coin.market_cap_rank === null) flags.push('No market cap ranking');
        if (coin.large === null) flags.push('No logo/image found');

        return {
          id: generateId(),
          contractAddress: undefined,
          tokenName: coin.name,
          tokenSymbol: coin.symbol?.toUpperCase(),
          chain: 'unknown',
          riskScore: buildRiskScore(30, flags, `Token "${coin.name}" found on CoinGecko. Limited on-chain data available.`),
          liquidityLocked: false,
          holderConcentration: 0,
          topWalletPercent: 0,
          isHoneypot: false,
          ownershipRenounced: false,
          hasBlacklistFunction: false,
          hasMintFunction: false,
          hasTradingRestrictions: false,
          deployerRisk: false,
          source: 'coingecko',
          analyzedAt: new Date().toISOString(),
        };
      }
    } catch {
      /* ignore */
    }

    return this.buildUnknownAnalysis(symbol);
  }

  private buildAnalysis(
    address: string,
    chain: string,
    dex: DexScreenerPair | null,
    goplus: GoPlusTokenSecurity | null,
    honeypot: HoneypotResult | null
  ): TokenAnalysis {
    const flags: string[] = [];
    let score = 10;

    const isHoneypot = honeypot?.isHoneypot === true || goplus?.is_honeypot === '1';
    if (isHoneypot) {
      flags.push('Honeypot detected — cannot sell tokens');
      score += 40;
    }

    const hasMintFunction = goplus?.is_mintable === '1';
    if (hasMintFunction) {
      flags.push('Token has mint function — supply can be inflated');
      score += 15;
    }

    const hasBlacklistFunction = goplus?.is_blacklisted === '1';
    if (hasBlacklistFunction) {
      flags.push('Blacklist function present — wallets can be blocked');
      score += 10;
    }

    const ownershipRenounced = !goplus?.owner_address || goplus.owner_address === '0x0000000000000000000000000000000000000000';

    const hasTradingRestrictions =
      goplus?.cannot_buy === '1' ||
      goplus?.cannot_sell_all === '1' ||
      goplus?.transfer_pausable === '1' ||
      goplus?.trading_cooldown === '1';
    if (hasTradingRestrictions) {
      flags.push('Trading restrictions found on contract');
      score += 15;
    }

    const holders = goplus?.holders || [];
    const topHolder = holders[0];
    const topWalletPercent = topHolder ? parseFloat(topHolder.percent) * 100 : 0;
    const holderConcentration = holders.length > 0
      ? holders.slice(0, 5).reduce((acc, h) => acc + parseFloat(h.percent) * 100, 0)
      : 0;

    if (topWalletPercent > 50) {
      flags.push(`Top wallet holds ${topWalletPercent.toFixed(1)}% of supply`);
      score += 20;
    } else if (topWalletPercent > 30) {
      flags.push(`High wallet concentration: ${topWalletPercent.toFixed(1)}%`);
      score += 10;
    }

    const liquidityUSD = dex?.liquidity?.usd || 0;
    const liquidityLocked = false;
    if (liquidityUSD < 10000 && liquidityUSD > 0) {
      flags.push(`Very low liquidity: $${liquidityUSD.toFixed(0)}`);
      score += 15;
    } else if (liquidityUSD === 0) {
      flags.push('No liquidity pool detected');
      score += 25;
    }

    if (!liquidityLocked) {
      flags.push('Liquidity is not locked');
      score += 10;
    }

    const buyTax = parseFloat(goplus?.buy_tax || '0') * 100;
    const sellTax = parseFloat(goplus?.sell_tax || '0') * 100;
    if (sellTax > 10) {
      flags.push(`High sell tax: ${sellTax.toFixed(1)}%`);
      score += 15;
    }
    if (buyTax > 10) {
      flags.push(`High buy tax: ${buyTax.toFixed(1)}%`);
      score += 5;
    }

    if (goplus?.hidden_owner === '1') {
      flags.push('Hidden owner detected');
      score += 15;
    }

    if (goplus?.can_take_back_ownership === '1') {
      flags.push('Ownership can be reclaimed by deployer');
      score += 15;
    }

    const deployerRisk = goplus?.honeypot_with_same_creator === '1';
    if (deployerRisk) {
      flags.push('Deployer linked to previous honeypots/rugs');
      score += 20;
    }

    if (flags.length === 0) {
      flags.push('No major risk flags detected');
    }

    const finalScore = Math.min(100, score);
    const summary = this.generateSummary(finalScore, flags);

    return {
      id: generateId(),
      contractAddress: address,
      tokenName: dex?.baseToken?.name || goplus?.trust_list || 'Unknown',
      tokenSymbol: dex?.baseToken?.symbol || 'Unknown',
      chain,
      riskScore: buildRiskScore(finalScore, flags, summary),
      liquidityLocked,
      holderConcentration,
      topWalletPercent,
      isHoneypot,
      ownershipRenounced,
      hasBlacklistFunction,
      hasMintFunction,
      hasTradingRestrictions,
      deployerRisk,
      liquidityUSD,
      marketCapUSD: dex?.marketCap || dex?.fdv,
      volume24h: dex?.volume?.h24,
      priceUSD: dex?.priceUsd ? parseFloat(dex.priceUsd) : undefined,
      source: 'multi-api',
      analyzedAt: new Date().toISOString(),
      rawData: { dex, goplus, honeypot },
    };
  }

  private buildUnknownAnalysis(input: string): TokenAnalysis {
    return {
      id: generateId(),
      contractAddress: isEvmAddress(input) ? input : undefined,
      tokenName: 'Unknown Token',
      tokenSymbol: 'UNKNOWN',
      chain: 'unknown',
      riskScore: buildRiskScore(50, ['Unable to fetch on-chain data', 'Token not found in any database'], 'This token could not be verified. Exercise extreme caution.'),
      liquidityLocked: false,
      holderConcentration: 0,
      topWalletPercent: 0,
      isHoneypot: false,
      ownershipRenounced: false,
      hasBlacklistFunction: false,
      hasMintFunction: false,
      hasTradingRestrictions: false,
      deployerRisk: false,
      source: 'unknown',
      analyzedAt: new Date().toISOString(),
    };
  }

  private generateSummary(score: number, flags: string[]): string {
    if (score >= 81) return `Critical risk detected. ${flags.length} major red flags found. Do not interact with this token.`;
    if (score >= 61) return `High risk token. Multiple suspicious indicators detected. Extreme caution advised.`;
    if (score >= 41) return `Medium risk. Some concerning factors present. Research thoroughly before proceeding.`;
    if (score >= 21) return `Low risk indicators found. Standard due diligence recommended.`;
    return `Token appears relatively safe based on available data. Always do your own research.`;
  }
}
