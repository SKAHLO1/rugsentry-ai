import { Devvit } from '@devvit/public-api';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

Devvit.configure({
  redditAPI: true,
  http: true,
  kvStore: true,
});

Devvit.addSettings([
  {
    name: 'geminiApiKey',
    type: 'string',
    label: 'Gemini API Key',
    helpText: 'Get a free key at https://aistudio.google.com/apikey — enables AI-powered scam classification',
    isSecret: true,
    scope: 'app',
  },
  {
    name: 'autoRemoveThreshold',
    type: 'number',
    label: 'Auto-Remove Risk Threshold (0-100)',
    helpText: 'Posts scoring above this are auto-removed. Set to 0 to disable auto-removal.',
    defaultValue: 85,
    scope: 'installation',
  },
  {
    name: 'alertThreshold',
    type: 'number',
    label: 'Mod Alert Threshold (0-100)',
    helpText: 'Posts scoring above this trigger a modmail alert.',
    defaultValue: 65,
    scope: 'installation',
  },
  {
    name: 'goPlusApiKey',
    type: 'string',
    label: 'GoPlus API Key (optional)',
    helpText: 'Optional — increases rate limits for on-chain token scanning. Free tier works without a key.',
    isSecret: true,
    scope: 'app',
  },
]);

// ═══════════════════════════════════════════════════════════════
// CONSTANTS & PATTERNS
// ═══════════════════════════════════════════════════════════════

const SCAM_KEYWORDS = [
  'rug pull', 'rugpull', 'pump and dump', '100x guaranteed', '1000x',
  'presale only', 'get in early', 'safe moon', 'moonshot', 'airdrop free',
  'send eth get back', 'investment opportunity', 'early investor',
  'whitelist only', 'limited spots', 'next big thing', 'gem alert',
  'degen play', 'low cap gem', 'x100 easy', 'stealth launch',
  'guaranteed profit', 'no risk', 'act fast', 'going to moon',
  'buy now before', 'dont miss out', 'free money', 'passive income crypto',
];

const HIGH_RISK_DOMAINS = ['pump.fun', 't.me', 'discord.gg'];

const CHAIN_IDS: Record<string, string> = {
  ethereum: '1',
  bsc: '56',
  polygon: '137',
  arbitrum: '42161',
  base: '8453',
  solana: 'solana',
};

interface TokenScanResult {
  tokenName?: string;
  tokenSymbol?: string;
  isHoneypot: boolean;
  hasMintFunction: boolean;
  hasBlacklistFunction: boolean;
  hasTradingRestrictions: boolean;
  hiddenOwner: boolean;
  canReclaimOwnership: boolean;
  deployerLinkedToRugs: boolean;
  topWalletPercent: number;
  liquidityUSD: number;
  sellTax: number;
  buyTax: number;
  score: number;
  flags: string[];
}

const ENTITY_PATTERNS = {
  EVM_ADDRESS: /0x[a-fA-F0-9]{40}/g,
  SOLANA_ADDRESS: /[1-9A-HJ-NP-Za-km-z]{32,44}/g,
  DEXSCREENER_URL: /https?:\/\/(www\.)?dexscreener\.com\/[^\s]*/g,
  PUMPFUN_URL: /https?:\/\/(www\.)?pump\.fun\/[^\s]*/g,
  TELEGRAM_URL: /https?:\/\/t\.me\/[^\s]*/g,
  TWITTER_URL: /https?:\/\/(www\.)?(twitter|x)\.com\/[^\s]*/g,
  TOKEN_SYMBOL: /\$[A-Z]{2,10}/g,
};

type RiskLevel = 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface RiskResult {
  score: number;
  level: RiskLevel;
  flags: string[];
  summary: string;
  aiExplanation?: string;
}

// ═══════════════════════════════════════════════════════════════
// REPEAT OFFENDER TRACKER
// ═══════════════════════════════════════════════════════════════

interface OffenderRecord {
  strikes: number;
  lastFlagged: string;
  riskHistory: { score: number; postId: string; date: string }[];
}

async function getOffenderRecord(kvStore: any, username: string): Promise<OffenderRecord> {
  const stored = await kvStore.get(`offender:${username}`);
  if (stored) return JSON.parse(stored as string);
  return { strikes: 0, lastFlagged: '', riskHistory: [] };
}

async function recordStrike(
  kvStore: any,
  username: string,
  postId: string,
  riskScore: number
): Promise<OffenderRecord> {
  const record = await getOffenderRecord(kvStore, username);
  record.strikes += 1;
  record.lastFlagged = new Date().toISOString();
  record.riskHistory.push({ score: riskScore, postId, date: record.lastFlagged });
  // Keep only last 20 entries
  if (record.riskHistory.length > 20) record.riskHistory = record.riskHistory.slice(-20);
  await kvStore.put(`offender:${username}`, JSON.stringify(record));
  return record;
}

function getStrikeAction(strikes: number): 'warn' | 'remove' | 'ban_suggest' {
  if (strikes >= 3) return 'ban_suggest';
  if (strikes >= 2) return 'remove';
  return 'warn';
}

// ═══════════════════════════════════════════════════════════════
// COORDINATED SHILL DETECTION
// ═══════════════════════════════════════════════════════════════

interface ShillMention {
  author: string;
  postId: string;
  timestamp: number;
}

interface ShillAlert {
  token: string;
  mentions: ShillMention[];
  uniqueAuthors: number;
  timeWindowMinutes: number;
}

const SHILL_TIME_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SHILL_THRESHOLD = 3; // 3+ unique authors = alert

async function trackTokenMention(
  kvStore: any,
  token: string,
  author: string,
  postId: string
): Promise<ShillAlert | null> {
  const key = `shill:${token.toLowerCase()}`;
  const stored = await kvStore.get(key);
  const mentions: ShillMention[] = stored ? JSON.parse(stored as string) : [];

  const now = Date.now();
  // Prune old mentions outside the time window
  const recent = mentions.filter(m => now - m.timestamp < SHILL_TIME_WINDOW_MS);

  // Add current mention
  recent.push({ author, postId, timestamp: now });
  await kvStore.put(key, JSON.stringify(recent));

  // Check for coordinated activity
  const uniqueAuthors = new Set(recent.map(m => m.author));
  if (uniqueAuthors.size >= SHILL_THRESHOLD) {
    return {
      token,
      mentions: recent,
      uniqueAuthors: uniqueAuthors.size,
      timeWindowMinutes: Math.round(SHILL_TIME_WINDOW_MS / 60000),
    };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// COMMUNITY STATS TRACKER
// ═══════════════════════════════════════════════════════════════

async function incrementStat(kvStore: any, stat: string, amount: number = 1): Promise<void> {
  const key = `stats:${stat}`;
  const current = await kvStore.get(key);
  const value = current ? parseInt(current as string, 10) + amount : amount;
  await kvStore.put(key, String(value));
}

async function getStat(kvStore: any, stat: string): Promise<number> {
  const stored = await kvStore.get(`stats:${stat}`);
  return stored ? parseInt(stored as string, 10) : 0;
}

// ═══════════════════════════════════════════════════════════════
// ANALYSIS ENGINE (runs entirely within Devvit)
// ═══════════════════════════════════════════════════════════════

function getRiskLevel(score: number): RiskLevel {
  if (score <= 20) return 'SAFE';
  if (score <= 40) return 'LOW';
  if (score <= 60) return 'MEDIUM';
  if (score <= 80) return 'HIGH';
  return 'CRITICAL';
}

function extractEntities(text: string) {
  const evmMatches = text.match(ENTITY_PATTERNS.EVM_ADDRESS) || [];
  const solanaMatches = text.match(ENTITY_PATTERNS.SOLANA_ADDRESS) || [];
  const dexMatches = text.match(ENTITY_PATTERNS.DEXSCREENER_URL) || [];
  const pumpMatches = text.match(ENTITY_PATTERNS.PUMPFUN_URL) || [];
  const telegramMatches = text.match(ENTITY_PATTERNS.TELEGRAM_URL) || [];
  const symbolMatches = text.match(ENTITY_PATTERNS.TOKEN_SYMBOL) || [];

  return {
    contractAddresses: [...new Set(evmMatches)],
    solanaAddresses: [...new Set(solanaMatches)],
    dexScreenerLinks: [...new Set(dexMatches)],
    pumpFunLinks: [...new Set(pumpMatches)],
    telegramLinks: [...new Set(telegramMatches)],
    tokenSymbols: [...new Set(symbolMatches)],
  };
}

function analyzePostLocally(
  title: string,
  content: string,
  accountAgeDays?: number,
  authorKarma?: number
): RiskResult {
  const fullText = `${title} ${content}`.toLowerCase();
  let score = 0;
  const flags: string[] = [];

  // Keyword analysis
  const keywordHits = SCAM_KEYWORDS.filter(kw => fullText.includes(kw.toLowerCase()));
  if (keywordHits.length > 0) {
    score += Math.min(30, keywordHits.length * 8);
    flags.push(`Scam keywords detected: ${keywordHits.slice(0, 3).join(', ')}`);
  }

  // Account age
  if (accountAgeDays !== undefined && accountAgeDays < 30) {
    score += 15;
    flags.push(`New account (${accountAgeDays} days old)`);
  }

  // Low karma
  if (authorKarma !== undefined && authorKarma < 100) {
    score += 10;
    flags.push(`Low karma account (${authorKarma})`);
  }

  // Entity extraction
  const entities = extractEntities(`${title} ${content}`);

  if (entities.contractAddresses.length > 0) {
    score += 5;
    flags.push(`Contains ${entities.contractAddresses.length} contract address(es)`);
  }

  if (entities.telegramLinks.length > 0) {
    score += 10;
    flags.push('Telegram link(s) detected');
  }

  if (entities.pumpFunLinks.length > 0) {
    score += 20;
    flags.push('Pump.fun link — high-risk launch platform');
  }

  if (entities.dexScreenerLinks.length > 0) {
    score += 5;
    flags.push('DexScreener link detected');
  }

  if (entities.tokenSymbols.length > 2) {
    score += 10;
    flags.push(`Multiple token symbols mentioned (${entities.tokenSymbols.length})`);
  }

  // High-risk domain check
  for (const domain of HIGH_RISK_DOMAINS) {
    if (fullText.includes(domain)) {
      score += 5;
    }
  }

  // Urgency language patterns
  const urgencyPatterns = [
    /act now|hurry|limited time|last chance|don'?t miss/i,
    /\d+x\s*(guaranteed|easy|potential)/i,
    /guaranteed\s*(returns?|profit|gains?)/i,
  ];
  for (const pattern of urgencyPatterns) {
    if (pattern.test(fullText)) {
      score += 8;
      flags.push('Urgency/pressure language detected');
      break;
    }
  }

  // Excessive emojis (common in scam posts)
  const emojiCount = (fullText.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu) || []).length;
  if (emojiCount > 10) {
    score += 5;
    flags.push('Excessive emoji usage (common in scam promotions)');
  }

  score = Math.min(100, Math.max(0, Math.round(score)));
  const level = getRiskLevel(score);
  const summary = flags.length > 0
    ? `${flags.length} risk factor(s) detected.`
    : 'No significant risk factors found.';

  return { score, level, flags, summary };
}

// ═══════════════════════════════════════════════════════════════
// ON-CHAIN TOKEN SCANNING (GoPlus + DexScreener + Honeypot.is)
// ═══════════════════════════════════════════════════════════════

function extractContractFromDexScreener(url: string): { chain: string; address: string } | null {
  const match = url.match(/dexscreener\.com\/([^/]+)\/([^/?#]+)/);
  return match ? { chain: match[1], address: match[2] } : null;
}

function extractContractFromPumpFun(url: string): string | null {
  const match = url.match(/pump\.fun\/([^/?#]+)/);
  return match ? match[1] : null;
}

async function fetchGoPlus(address: string, chain: string): Promise<Record<string, any> | null> {
  try {
    const chainId = CHAIN_IDS[chain] || '1';
    const response = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data?.result?.[address.toLowerCase()] || null;
  } catch {
    return null;
  }
}

async function fetchDexScreener(address: string): Promise<Record<string, any> | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const pairs = data?.pairs || [];
    return pairs[0] || null;
  } catch {
    return null;
  }
}

async function fetchHoneypotIs(address: string): Promise<Record<string, any> | null> {
  try {
    const response = await fetch(
      `https://api.honeypot.is/v2/IsHoneypot?address=${address}`
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function scanToken(address: string, chain: string): Promise<TokenScanResult> {
  const [goPlusData, dexData, honeypotData] = await Promise.all([
    fetchGoPlus(address, chain),
    fetchDexScreener(address),
    chain !== 'solana' ? fetchHoneypotIs(address) : Promise.resolve(null),
  ]);

  const flags: string[] = [];
  let score = 10;

  // Honeypot detection
  const isHoneypot = honeypotData?.isHoneypot === true || goPlusData?.is_honeypot === '1';
  if (isHoneypot) {
    flags.push('HONEYPOT DETECTED — cannot sell tokens');
    score += 40;
  }

  // Mint function
  const hasMintFunction = goPlusData?.is_mintable === '1';
  if (hasMintFunction) {
    flags.push('Token has mint function — supply can be inflated');
    score += 15;
  }

  // Blacklist function
  const hasBlacklistFunction = goPlusData?.is_blacklisted === '1';
  if (hasBlacklistFunction) {
    flags.push('Blacklist function — wallets can be blocked');
    score += 10;
  }

  // Trading restrictions
  const hasTradingRestrictions =
    goPlusData?.cannot_buy === '1' ||
    goPlusData?.cannot_sell_all === '1' ||
    goPlusData?.transfer_pausable === '1' ||
    goPlusData?.trading_cooldown === '1';
  if (hasTradingRestrictions) {
    flags.push('Trading restrictions found on contract');
    score += 15;
  }

  // Hidden owner
  const hiddenOwner = goPlusData?.hidden_owner === '1';
  if (hiddenOwner) {
    flags.push('Hidden owner detected');
    score += 15;
  }

  // Can reclaim ownership
  const canReclaimOwnership = goPlusData?.can_take_back_ownership === '1';
  if (canReclaimOwnership) {
    flags.push('Ownership can be reclaimed by deployer');
    score += 15;
  }

  // Deployer linked to rugs
  const deployerLinkedToRugs = goPlusData?.honeypot_with_same_creator === '1';
  if (deployerLinkedToRugs) {
    flags.push('Deployer linked to previous honeypots/rugs');
    score += 20;
  }

  // Holder concentration
  const holders = goPlusData?.holders || [];
  const topHolder = holders[0];
  const topWalletPercent = topHolder ? parseFloat(topHolder.percent) * 100 : 0;
  if (topWalletPercent > 50) {
    flags.push(`Top wallet holds ${topWalletPercent.toFixed(1)}% of supply`);
    score += 20;
  } else if (topWalletPercent > 30) {
    flags.push(`High wallet concentration: ${topWalletPercent.toFixed(1)}%`);
    score += 10;
  }

  // Liquidity
  const liquidityUSD = dexData?.liquidity?.usd || 0;
  if (liquidityUSD === 0) {
    flags.push('No liquidity pool detected');
    score += 25;
  } else if (liquidityUSD < 10000) {
    flags.push(`Very low liquidity: $${liquidityUSD.toFixed(0)}`);
    score += 15;
  }

  // Taxes
  const buyTax = parseFloat(goPlusData?.buy_tax || '0') * 100;
  const sellTax = parseFloat(goPlusData?.sell_tax || '0') * 100;
  if (sellTax > 10) {
    flags.push(`High sell tax: ${sellTax.toFixed(1)}%`);
    score += 15;
  }
  if (buyTax > 10) {
    flags.push(`High buy tax: ${buyTax.toFixed(1)}%`);
    score += 5;
  }

  if (flags.length === 0) {
    flags.push('No major on-chain risk flags detected');
  }

  return {
    tokenName: dexData?.baseToken?.name,
    tokenSymbol: dexData?.baseToken?.symbol,
    isHoneypot,
    hasMintFunction,
    hasBlacklistFunction,
    hasTradingRestrictions,
    hiddenOwner,
    canReclaimOwnership,
    deployerLinkedToRugs,
    topWalletPercent,
    liquidityUSD,
    sellTax,
    buyTax,
    score: Math.min(100, score),
    flags,
  };
}

// ═══════════════════════════════════════════════════════════════
// AI CLASSIFICATION (Gemini)
// ═══════════════════════════════════════════════════════════════

async function classifyWithGemini(
  content: string,
  geminiApiKey: string
): Promise<{ isScam: boolean; confidence: number; reasons: string[] } | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are RugSentry AI, a crypto scam detection system for Reddit. Analyze this Reddit post and determine if it promotes a scam, rug pull, honeypot token, or coordinated shill campaign.

Post content: "${content.slice(0, 2000)}"

Respond ONLY in JSON:
{"isScam": boolean, "confidence": number_0_to_100, "reasons": ["reason1", "reason2"]}`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 300,
          }
        }),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // AI classification is non-critical
  }
  return null;
}

async function analyzePost(
  title: string,
  content: string,
  accountAgeDays: number | undefined,
  authorKarma: number | undefined,
  geminiApiKey?: string
): Promise<RiskResult> {
  const fullText = `${title} ${content}`;

  // Step 1: Local pattern-matching analysis
  const result = analyzePostLocally(title, content, accountAgeDays, authorKarma);

  // Step 2: On-chain token scanning for any contract addresses or links found
  const entities = extractEntities(fullText);
  const scanTargets: { address: string; chain: string }[] = [];

  for (const addr of entities.contractAddresses) {
    scanTargets.push({ address: addr, chain: 'ethereum' });
  }
  for (const url of entities.dexScreenerLinks) {
    const info = extractContractFromDexScreener(url);
    if (info) scanTargets.push(info);
  }
  for (const url of entities.pumpFunLinks) {
    const addr = extractContractFromPumpFun(url);
    if (addr) scanTargets.push({ address: addr, chain: 'solana' });
  }

  if (scanTargets.length > 0) {
    try {
      // Scan up to 2 tokens to avoid rate limits
      const scans = await Promise.all(
        scanTargets.slice(0, 2).map(t => scanToken(t.address, t.chain))
      );
      for (const scan of scans) {
        const label = scan.tokenName ? `[${scan.tokenSymbol || 'TOKEN'}] ` : '';
        for (const flag of scan.flags) {
          const prefixed = `${label}${flag}`;
          if (!result.flags.includes(prefixed)) {
            result.flags.push(prefixed);
          }
        }
        // Use the highest token scan score if it exceeds current
        if (scan.score > result.score) {
          result.score = scan.score;
        }
      }
    } catch {
      // Token scanning is non-critical
    }
  }

  // Step 3: AI classification (if API key configured)
  if (geminiApiKey && result.score >= 20) {
    const aiResult = await classifyWithGemini(`${title}\n\n${content}`, geminiApiKey);
    if (aiResult) {
      if (aiResult.isScam && aiResult.confidence > 60) {
        result.score = Math.min(100, result.score + Math.round(aiResult.confidence * 0.3));
        result.flags.push(`AI classification: scam (${aiResult.confidence}% confidence)`);
        for (const reason of aiResult.reasons.slice(0, 2)) {
          if (!result.flags.includes(reason)) {
            result.flags.push(reason);
          }
        }
        result.aiExplanation = aiResult.reasons.join('. ');
      } else if (!aiResult.isScam && aiResult.confidence > 70) {
        result.score = Math.max(0, result.score - 10);
        result.flags.push('AI review: likely legitimate content');
      }
    }
  }

  // Finalize
  result.score = Math.min(100, Math.max(0, Math.round(result.score)));
  result.level = getRiskLevel(result.score);
  result.summary = result.flags.length > 0
    ? `${result.flags.length} risk factor(s) detected.`
    : 'No significant risk factors found.';

  return result;
}

// ═══════════════════════════════════════════════════════════════
// TRIGGERS
// ═══════════════════════════════════════════════════════════════

Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    const { post, subreddit, author } = event;
    if (!post || !subreddit || !author) return;

    try {
      const settings = await context.settings.getAll();
      const geminiApiKey = (settings.geminiApiKey as string) || '';
      const autoRemoveThreshold = (settings.autoRemoveThreshold as number) || 85;
      const alertThreshold = (settings.alertThreshold as number) || 65;

      const authorInfo = await context.reddit.getUserById(author.id);
      const accountAgeDays = authorInfo?.createdAt
        ? Math.floor((Date.now() - authorInfo.createdAt.getTime()) / 86400000)
        : undefined;

      const risk = await analyzePost(
        post.title || '',
        post.selftext || '',
        accountAgeDays,
        authorInfo?.linkKarma,
        geminiApiKey
      );

      // Store result
      await context.kvStore.put(`risk:${post.id}`, JSON.stringify({
        score: risk.score,
        level: risk.level,
        flags: risk.flags,
        summary: risk.summary,
        aiExplanation: risk.aiExplanation,
        analyzedAt: new Date().toISOString(),
      }));

      // ── Stats tracking ──
      await incrementStat(context.kvStore, 'postsScanned');
      if (risk.score >= alertThreshold) {
        await incrementStat(context.kvStore, 'scamsCaught');
      }

      // ── Coordinated shill detection ──
      const postEntities = extractEntities(`${post.title} ${post.selftext}`);
      const tokensToTrack = [
        ...postEntities.contractAddresses,
        ...postEntities.tokenSymbols,
      ];
      for (const token of tokensToTrack.slice(0, 3)) {
        try {
          const shillAlert = await trackTokenMention(
            context.kvStore, token, author.name, post.id
          );
          if (shillAlert) {
            risk.score = Math.min(100, risk.score + 20);
            risk.flags.push(
              `COORDINATED SHILL: ${shillAlert.uniqueAuthors} accounts promoted "${token}" within ${shillAlert.timeWindowMinutes}min`
            );
            risk.level = getRiskLevel(risk.score);
            await incrementStat(context.kvStore, 'shillCampaigns');

            // Alert mods about coordinated campaign
            try {
              const subInfo = await context.reddit.getSubredditById(subreddit.id);
              if (subInfo) {
                const authorList = [...new Set(shillAlert.mentions.map(m => `u/${m.author}`))].join(', ');
                await context.reddit.sendPrivateMessage({
                  to: `/r/${subInfo.name}`,
                  subject: `[RugSentry] COORDINATED SHILL CAMPAIGN Detected`,
                  text: [
                    `**🚨 Coordinated Shill Campaign Alert**`,
                    ``,
                    `**${shillAlert.uniqueAuthors} accounts** are promoting the same token/contract within the last hour:`,
                    ``,
                    `**Token/Contract:** \`${token}\``,
                    `**Accounts involved:** ${authorList}`,
                    ``,
                    `This pattern strongly suggests coordinated manipulation. Consider banning these accounts.`,
                  ].join('\n'),
                });
              }
            } catch { /* non-critical */ }
          }
        } catch { /* non-critical */ }
      }

      // Skip moderation for safe/low risk
      if (risk.score < alertThreshold) return;

      // ── Repeat offender tracking ──
      const offender = await recordStrike(context.kvStore, author.name, post.id, risk.score);
      const strikeAction = getStrikeAction(offender.strikes);

      // Boost score for repeat offenders
      if (offender.strikes >= 2) {
        risk.score = Math.min(100, risk.score + offender.strikes * 5);
        risk.flags.push(`Repeat offender: strike ${offender.strikes} (${strikeAction})`);
        risk.level = getRiskLevel(risk.score);
        await incrementStat(context.kvStore, 'repeatOffenders');
      }

      // Update stored result with offender/shill adjustments
      await context.kvStore.put(`risk:${post.id}`, JSON.stringify({
        score: risk.score,
        level: risk.level,
        flags: risk.flags,
        summary: risk.summary,
        aiExplanation: risk.aiExplanation,
        offenderStrikes: offender.strikes,
        analyzedAt: new Date().toISOString(),
      }));

      // Send modmail alert for high risk
      if (risk.level === 'HIGH' || risk.level === 'CRITICAL') {
        try {
          const subredditInfo = await context.reddit.getSubredditById(subreddit.id);
          if (subredditInfo) {
            const strikeInfo = offender.strikes > 1
              ? `\n**⚠️ REPEAT OFFENDER** — Strike ${offender.strikes} | Action: ${strikeAction}\n`
              : '';
            await context.reddit.sendPrivateMessage({
              to: `/r/${subredditInfo.name}`,
              subject: `[RugSentry] ${risk.level} Risk Post Detected${offender.strikes > 1 ? ' (REPEAT OFFENDER)' : ''}`,
              text: [
                `**RugSentry AI Alert** — ${risk.level} Risk (${risk.score}/100)`,
                strikeInfo,
                `**Post:** ${post.title}`,
                `**Author:** u/${author.name} (${accountAgeDays ?? '?'} days old)`,
                `**Subreddit:** r/${subreddit.name}`,
                ``,
                `**Risk Flags:**`,
                ...risk.flags.map((f: string) => `- ${f}`),
                ``,
                `**Summary:** ${risk.summary}`,
                risk.aiExplanation ? `\n**AI Analysis:** ${risk.aiExplanation}` : '',
                ``,
                `[View Post](https://reddit.com${post.permalink || ''})`,
              ].join('\n'),
            });
          }
        } catch (err) {
          console.error('[RugSentry] Failed to send modmail:', err);
        }
      }

      // Auto-remove for critical posts or repeat offenders (strike 2+)
      const shouldRemove =
        (autoRemoveThreshold > 0 && risk.score >= autoRemoveThreshold) ||
        strikeAction === 'remove' ||
        strikeAction === 'ban_suggest';

      if (shouldRemove) {
        try {
          await context.reddit.remove(post.id, false);
          await incrementStat(context.kvStore, 'postsRemoved');
          const strikeMsg = offender.strikes >= 2
            ? `\n\nThis is strike ${offender.strikes} for this account.`
            : '';
          await context.reddit.submitComment({
            id: post.id,
            text: [
              '⚠️ **This post has been automatically removed by RugSentry AI.**',
              '',
              'Our AI moderation system flagged this post as high-risk for the following reasons:',
              ...risk.flags.slice(0, 3).map((f: string) => `- ${f}`),
              strikeMsg,
              '',
              'If you believe this was a mistake, please message the moderators.',
            ].join('\n'),
          });
        } catch (err) {
          console.error('[RugSentry] Failed to auto-remove:', err);
        }
      }

      // Suggest ban for 3+ strikes
      if (strikeAction === 'ban_suggest') {
        try {
          const subInfo = await context.reddit.getSubredditById(subreddit.id);
          if (subInfo) {
            await context.reddit.sendPrivateMessage({
              to: `/r/${subInfo.name}`,
              subject: `[RugSentry] BAN RECOMMENDED: u/${author.name}`,
              text: [
                `**🚫 Ban Recommendation**`,
                ``,
                `User **u/${author.name}** has reached **${offender.strikes} strikes** for posting high-risk/scam content.`,
                ``,
                `**Strike history:**`,
                ...offender.riskHistory.slice(-5).map(h => `- Score ${h.score}/100 on ${h.date.slice(0, 10)}`),
                ``,
                `Consider banning this user from the subreddit.`,
              ].join('\n'),
            });
          }
        } catch { /* non-critical */ }
      }
    } catch (err) {
      console.error('[RugSentry] PostSubmit trigger error:', err);
    }
  },
});

Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: async (event, context) => {
    const { comment, post, subreddit, author } = event;
    if (!comment || !post || !subreddit || !author) return;

    const content = comment.body || '';
    const entities = extractEntities(content);

    // Only analyze comments with crypto-related entities
    if (
      entities.contractAddresses.length === 0 &&
      entities.pumpFunLinks.length === 0 &&
      entities.dexScreenerLinks.length === 0
    ) return;

    try {
      const settings = await context.settings.getAll();
      const geminiApiKey = (settings.geminiApiKey as string) || '';

      const risk = await analyzePost(
        `[Comment on: ${post.title || ''}]`,
        content,
        undefined,
        undefined,
        geminiApiKey
      );

      if (risk.score >= 60) {
        await context.kvStore.put(`risk:comment:${comment.id}`, JSON.stringify({
          score: risk.score,
          level: risk.level,
          flags: risk.flags,
          postId: post.id,
          analyzedAt: new Date().toISOString(),
        }));
      }
    } catch (err) {
      console.error('[RugSentry] CommentSubmit trigger error:', err);
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// MENU ITEMS (Moderator Actions)
// ═══════════════════════════════════════════════════════════════

Devvit.addMenuItem({
  label: 'RugSentry: Analyze Post',
  location: 'post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const postId = event.targetId;
    if (!postId) return;

    const post = await context.reddit.getPostById(postId);
    if (!post) return;

    // Check cache first
    const stored = await context.kvStore.get(`risk:${postId}`);
    if (stored) {
      const risk = JSON.parse(stored as string);
      context.ui.showToast(`Risk: ${risk.level} (${risk.score}/100) — analyzed ${risk.analyzedAt?.slice(0, 10)}`);
      return;
    }

    context.ui.showToast('Analyzing post with RugSentry AI...');

    try {
      const settings = await context.settings.getAll();
      const geminiApiKey = (settings.geminiApiKey as string) || '';

      const author = await context.reddit.getUserByUsername(post.authorName);
      const accountAgeDays = author?.createdAt
        ? Math.floor((Date.now() - author.createdAt.getTime()) / 86400000)
        : undefined;

      const risk = await analyzePost(
        post.title,
        post.body || '',
        accountAgeDays,
        author?.linkKarma,
        geminiApiKey
      );

      await context.kvStore.put(`risk:${postId}`, JSON.stringify({
        score: risk.score,
        level: risk.level,
        flags: risk.flags,
        summary: risk.summary,
        aiExplanation: risk.aiExplanation,
        analyzedAt: new Date().toISOString(),
      }));

      context.ui.showToast(`RugSentry: ${risk.level} risk (${risk.score}/100)`);
    } catch {
      context.ui.showToast('Analysis failed. Please try again.');
    }
  },
});

Devvit.addMenuItem({
  label: 'RugSentry: View Risk Report',
  location: 'post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const postId = event.targetId;
    if (!postId) return;

    const stored = await context.kvStore.get(`risk:${postId}`);
    if (!stored) {
      context.ui.showToast('No risk data found. Run "Analyze Post" first.');
      return;
    }

    const risk = JSON.parse(stored as string);
    const flagList = (risk.flags as string[]).map((f: string) => `• ${f}`).join('; ');
    const report = `${risk.level} (${risk.score}/100) | Flags: ${flagList}${risk.aiExplanation ? ` | AI: ${risk.aiExplanation}` : ''}`;
    context.ui.showToast(report.slice(0, 250));
  },
});

Devvit.addMenuItem({
  label: 'RugSentry: Check User Strikes',
  location: 'post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const postId = event.targetId;
    if (!postId) return;

    const post = await context.reddit.getPostById(postId);
    if (!post) return;

    const record = await getOffenderRecord(context.kvStore, post.authorName);
    if (record.strikes === 0) {
      context.ui.showToast(`u/${post.authorName}: Clean record — no strikes.`);
      return;
    }

    const history = record.riskHistory
      .slice(-3)
      .map(h => `${h.score}/100 on ${h.date.slice(0, 10)}`)
      .join(', ');
    const action = getStrikeAction(record.strikes);
    context.ui.showToast(
      `u/${post.authorName}: ${record.strikes} strike(s) | Next action: ${action} | Recent: ${history}`.slice(0, 250)
    );
  },
});

Devvit.addMenuItem({
  label: 'RugSentry: Remove + Report',
  location: 'post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const postId = event.targetId;
    if (!postId) return;

    try {
      await context.reddit.remove(postId, false);
      await context.reddit.submitComment({
        id: postId,
        text: '⚠️ **This post was removed by a moderator following a RugSentry AI risk review.**\n\nIf you believe this was a mistake, please message the moderators.',
      });
      context.ui.showToast('Post removed and warning comment added.');
    } catch {
      context.ui.showToast('Failed to remove post. Check permissions.');
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// CUSTOM POST TYPE (Dynamic Dashboard Widget)
// ═══════════════════════════════════════════════════════════════

Devvit.addCustomPostType({
  name: 'RugSentry Dashboard',
  description: 'Live community safety dashboard powered by RugSentry AI',
  render: (context: Devvit.Context) => {
    const subredditName = context.subredditName || 'community';

    const [stats] = context.useState(async () => {
      const [scanned, caught, removed, shills, offenders] = await Promise.all([
        getStat(context.kvStore, 'postsScanned'),
        getStat(context.kvStore, 'scamsCaught'),
        getStat(context.kvStore, 'postsRemoved'),
        getStat(context.kvStore, 'shillCampaigns'),
        getStat(context.kvStore, 'repeatOffenders'),
      ]);
      return { scanned, caught, removed, shills, offenders };
    });

    const safetyScore = stats.scanned > 0
      ? Math.round(((stats.scanned - stats.caught) / stats.scanned) * 100)
      : 100;

    return (
      <blocks height="tall">
        <vstack
          width="100%"
          height="100%"
          alignment="center middle"
          backgroundColor="#0f172a"
          padding="medium"
          gap="medium"
        >
          {/* Header */}
          <hstack alignment="center middle" gap="small">
            <icon name="topic-crypto" size="large" color="#a855f7" />
            <vstack>
              <text style="heading" size="xlarge" color="white" weight="bold">
                RugSentry AI
              </text>
              <text size="small" color="#9ca3af">
                r/{subredditName} • Live Protection Dashboard
              </text>
            </vstack>
          </hstack>

          {/* Live Stats Row 1 */}
          <hstack width="100%" gap="small">
            <vstack backgroundColor="#1e293b" cornerRadius="medium" padding="small" grow alignment="center middle">
              <text size="small" color="#94a3b8">Posts Scanned</text>
              <text style="heading" size="xlarge" color="#60a5fa">{String(stats.scanned)}</text>
            </vstack>
            <vstack backgroundColor="#1e293b" cornerRadius="medium" padding="small" grow alignment="center middle">
              <text size="small" color="#94a3b8">Scams Caught</text>
              <text style="heading" size="xlarge" color="#f87171">{String(stats.caught)}</text>
            </vstack>
            <vstack backgroundColor="#1e293b" cornerRadius="medium" padding="small" grow alignment="center middle">
              <text size="small" color="#94a3b8">Auto-Removed</text>
              <text style="heading" size="xlarge" color="#fbbf24">{String(stats.removed)}</text>
            </vstack>
          </hstack>

          {/* Live Stats Row 2 */}
          <hstack width="100%" gap="small">
            <vstack backgroundColor="#1e293b" cornerRadius="medium" padding="small" grow alignment="center middle">
              <text size="small" color="#94a3b8">Shill Campaigns</text>
              <text style="heading" size="large" color="#fb923c">{String(stats.shills)}</text>
            </vstack>
            <vstack backgroundColor="#1e293b" cornerRadius="medium" padding="small" grow alignment="center middle">
              <text size="small" color="#94a3b8">Repeat Offenders</text>
              <text style="heading" size="large" color="#e879f9">{String(stats.offenders)}</text>
            </vstack>
            <vstack backgroundColor="#1e293b" cornerRadius="medium" padding="small" grow alignment="center middle">
              <text size="small" color="#94a3b8">Safety Score</text>
              <text style="heading" size="large" color={safetyScore >= 90 ? '#4ade80' : safetyScore >= 70 ? '#fbbf24' : '#f87171'}>
                {String(safetyScore)}%
              </text>
            </vstack>
          </hstack>

          {/* Detection Capabilities */}
          <vstack
            width="100%"
            backgroundColor="#1e293b"
            cornerRadius="medium"
            padding="medium"
            gap="small"
          >
            <text style="heading" size="medium" color="white">
              Active Protections
            </text>
            <hstack gap="small">
              <icon name="ai" size="small" color="#a855f7" />
              <text size="small" color="#c4b5fd">Gemini 2.5 Flash AI Classification</text>
            </hstack>
            <hstack gap="small">
              <icon name="blockchain" size="small" color="#60a5fa" />
              <text size="small" color="#93c5fd">On-Chain Token Scanning (GoPlus + DexScreener)</text>
            </hstack>
            <hstack gap="small">
              <icon name="users" size="small" color="#fb923c" />
              <text size="small" color="#fdba74">Coordinated Shill Detection</text>
            </hstack>
            <hstack gap="small">
              <icon name="mod" size="small" color="#f87171" />
              <text size="small" color="#fca5a5">Repeat Offender Strike System</text>
            </hstack>
            <hstack gap="small">
              <icon name="keyword" size="small" color="#4ade80" />
              <text size="small" color="#86efac">Scam Keyword + Pattern Matching</text>
            </hstack>
          </vstack>

          <text size="xsmall" color="#475569" alignment="center">
            Powered by Gemini AI • GoPlus • DexScreener • Honeypot.is
          </text>
        </vstack>
      </blocks>
    );
  },
});

export default Devvit;
