export const RISK_THRESHOLDS = {
  SAFE: { min: 0, max: 20 },
  LOW: { min: 21, max: 40 },
  MEDIUM: { min: 41, max: 60 },
  HIGH: { min: 61, max: 80 },
  CRITICAL: { min: 81, max: 100 },
} as const;

export const RISK_COLORS = {
  SAFE: '#22c55e',
  LOW: '#84cc16',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
} as const;

export const FIREBASE_COLLECTIONS = {
  FLAGGED_POSTS: 'flagged_posts',
  CAMPAIGN_DETECTIONS: 'campaign_detections',
  TOKEN_ANALYSIS: 'token_analysis',
  WALLET_PROFILES: 'wallet_profiles',
  SUBREDDIT_SETTINGS: 'subreddit_settings',
  MODERATION_ACTIONS: 'moderation_actions',
  ALERTS: 'alerts',
  MODERATION_LOGS: 'moderation_logs',
  USER_PROFILES: 'user_profiles',
  TOKEN_RISK_CACHE: 'token_risk_cache',
} as const;

export const API_ENDPOINTS = {
  DEXSCREENER: 'https://api.dexscreener.com/latest',
  GOPLUSLABS: 'https://api.gopluslabs.io/api/v1',
  RUGCHECK: 'https://api.rugcheck.xyz/v1',
  HONEYPOT_IS: 'https://api.honeypot.is/v2',
  COINGECKO: 'https://api.coingecko.com/api/v3',
} as const;

export const CHAIN_IDS = {
  ethereum: '1',
  bsc: '56',
  polygon: '137',
  arbitrum: '42161',
  base: '8453',
  solana: 'solana',
} as const;

export const ENTITY_PATTERNS = {
  EVM_ADDRESS: /0x[a-fA-F0-9]{40}/g,
  SOLANA_ADDRESS: /[1-9A-HJ-NP-Za-km-z]{32,44}/g,
  DEXSCREENER_URL: /https?:\/\/(www\.)?dexscreener\.com\/[^\s]*/g,
  PUMPFUN_URL: /https?:\/\/(www\.)?pump\.fun\/[^\s]*/g,
  TELEGRAM_URL: /https?:\/\/t\.me\/[^\s]*/g,
  TWITTER_URL: /https?:\/\/(www\.)?(twitter|x)\.com\/[^\s]*/g,
  TOKEN_SYMBOL: /\$[A-Z]{2,10}/g,
} as const;

export const MODERATION_ACTION_LABELS: Record<string, string> = {
  remove_post: 'Remove Post',
  lock_comments: 'Lock Comments',
  add_flair: 'Add Warning Flair',
  send_modmail: 'Send ModMail Alert',
  mute_user: 'Mute User',
  ban_recommendation: 'Recommend Ban',
  queue_escalation: 'Escalate to Queue',
  no_action: 'No Action',
};

export const DEFAULT_SUBREDDIT_CONFIG = {
  enabled: true,
  autoModerate: false,
  riskThresholds: {
    autoRemove: 85,
    sendToQueue: 65,
    addFlair: 45,
    alertMods: 70,
  },
  actions: {
    onHighRisk: ['add_flair', 'queue_escalation', 'send_modmail'],
    onCriticalRisk: ['remove_post', 'send_modmail', 'ban_recommendation'],
    onShillDetected: ['queue_escalation', 'send_modmail'],
  },
  whitelistedTokens: [],
  trustedDomains: ['reddit.com', 'twitter.com', 'coingecko.com'],
  customRules: [],
};

export const SCAM_KEYWORDS = [
  'rug pull', 'rugpull', 'pump and dump', '100x guaranteed', '1000x',
  'presale only', 'get in early', 'safe moon', 'moonshot', 'airdrop free',
  'send eth get back', 'investment opportunity', 'early investor',
  'whitelist only', 'limited spots', 'next big thing', 'gem alert',
  'degen play', 'low cap gem', 'x100 easy', 'stealth launch',
];

export const HIGH_RISK_DOMAINS = [
  'pump.fun',
  't.me',
  'discord.gg',
];

export const CACHE_TTL = {
  TOKEN_ANALYSIS: 60 * 60 * 1000,
  WALLET_PROFILE: 24 * 60 * 60 * 1000,
  DASHBOARD_METRICS: 5 * 60 * 1000,
} as const;
