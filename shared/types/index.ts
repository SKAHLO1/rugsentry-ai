export type RiskLevel = 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskScore {
  score: number;
  level: RiskLevel;
  flags: string[];
  summary: string;
}

export interface TokenAnalysis {
  id: string;
  contractAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  chain?: string;
  riskScore: RiskScore;
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
  source: string;
  analyzedAt: string;
  rawData?: Record<string, unknown>;
}

export interface WalletProfile {
  address: string;
  riskScore: number;
  linkedRugs: number;
  transactionCount: number;
  ageInDays: number;
  suspiciousActivity: string[];
  associatedTokens: string[];
  analyzedAt: string;
}

export interface ShillCampaign {
  id: string;
  campaignDetected: boolean;
  accountsInvolved: number;
  confidenceScore: number;
  relatedWallets: string[];
  relatedTokens: string[];
  behaviorPatterns: string[];
  subreddit: string;
  detectedAt: string;
  posts: string[];
}

export interface FlaggedPost {
  id: string;
  postId: string;
  postTitle: string;
  postUrl: string;
  authorName: string;
  authorKarma?: number;
  accountAgeDays?: number;
  subreddit: string;
  content: string;
  extractedEntities: ExtractedEntities;
  tokenAnalysis?: TokenAnalysis;
  shillCampaign?: Partial<ShillCampaign>;
  riskScore: RiskScore;
  moderationAction?: ModerationAction;
  aiExplanation?: string;
  status: 'pending' | 'actioned' | 'reviewed' | 'dismissed';
  flaggedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface ExtractedEntities {
  contractAddresses: string[];
  walletAddresses: string[];
  dexScreenerLinks: string[];
  pumpFunLinks: string[];
  telegramLinks: string[];
  twitterLinks: string[];
  coinUrls: string[];
  tokenSymbols: string[];
}

export interface ModerationAction {
  type: ModerationActionType;
  reason: string;
  triggeredBy: 'auto' | 'manual';
  triggeredAt: string;
  moderator?: string;
  ruleId?: string;
}

export type ModerationActionType =
  | 'remove_post'
  | 'lock_comments'
  | 'add_flair'
  | 'send_modmail'
  | 'mute_user'
  | 'ban_recommendation'
  | 'queue_escalation'
  | 'no_action';

export interface SubredditConfig {
  subredditId: string;
  subredditName: string;
  enabled: boolean;
  autoModerate: boolean;
  riskThresholds: {
    autoRemove: number;
    sendToQueue: number;
    addFlair: number;
    alertMods: number;
  };
  actions: {
    onHighRisk: ModerationActionType[];
    onCriticalRisk: ModerationActionType[];
    onShillDetected: ModerationActionType[];
  };
  whitelistedTokens: string[];
  trustedDomains: string[];
  customRules: CustomRule[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  actions: ModerationActionType[];
  enabled: boolean;
}

export interface RuleCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'contains' | 'matches';
  value: string | number | boolean;
}

export interface ModerationLog {
  id: string;
  postId: string;
  subreddit: string;
  action: ModerationAction;
  riskScore: RiskScore;
  autoModRuleId?: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  subreddit: string;
  type: AlertType;
  severity: RiskLevel;
  title: string;
  message: string;
  postId?: string;
  postUrl?: string;
  tokenAddress?: string;
  read: boolean;
  createdAt: string;
}

export type AlertType =
  | 'scam_token'
  | 'coordinated_shill'
  | 'honeypot'
  | 'rugpull_risk'
  | 'bot_activity'
  | 'wallet_cluster'
  | 'high_risk_post';

export interface DashboardMetrics {
  subreddit: string;
  period: '24h' | '7d' | '30d';
  scamExposureScore: number;
  botActivityScore: number;
  coordinatedAttackScore: number;
  totalFlaggedPosts: number;
  totalActioned: number;
  totalDismissed: number;
  totalCampaigns: number;
  highRiskTokens: string[];
  topThreats: FlaggedPost[];
  recentAlerts: Alert[];
  tokenSpamFrequency: TimeSeriesData[];
  manipulationHeatmap: HeatmapData[];
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  label?: string;
}

export interface HeatmapData {
  hour: number;
  day: number;
  value: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AnalyzePostRequest {
  postId: string;
  postTitle: string;
  postContent: string;
  postUrl: string;
  authorName: string;
  subreddit: string;
  authorKarma?: number;
  accountAgeDays?: number;
}

export interface AnalyzeTokenRequest {
  input: string;
  chain?: string;
}

export interface AutoModRule {
  remove: {
    keywords?: string[];
    domains?: string[];
    contractAddresses?: string[];
  };
  ban: {
    repeatedPromoters?: boolean;
    minOffenses?: number;
  };
  flair: {
    highRisk?: string;
    scam?: string;
  };
}
