export interface RiskScore {
  score: number;
  level: string;
  flags: string[];
  summary: string;
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
  riskScore: RiskScore;
  tokenAnalysis?: {
    tokenName?: string;
    tokenSymbol?: string;
    isHoneypot?: boolean;
    contractAddress?: string;
  };
  shillCampaign?: {
    campaignDetected?: boolean;
    accountsInvolved?: number;
    confidenceScore?: number;
  };
  aiExplanation?: string;
  moderationAction?: { type: string; reason: string };
  status: string;
  flaggedAt: string;
  extractedEntities?: {
    contractAddresses?: string[];
    telegramLinks?: string[];
  };
}

export interface DashboardMetrics {
  subreddit: string;
  period: string;
  scamExposureScore: number;
  botActivityScore: number;
  coordinatedAttackScore: number;
  totalFlaggedPosts: number;
  totalActioned: number;
  totalDismissed: number;
  totalCampaigns: number;
  highRiskTokens: string[];
  topThreats: unknown[];
  recentAlerts: unknown[];
  tokenSpamFrequency: { timestamp: string; value: number }[];
  manipulationHeatmap: unknown[];
}

export interface Alert {
  id: string;
  subreddit: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  postId?: string;
  postUrl?: string;
  tokenAddress?: string;
  read: boolean;
  createdAt: string;
}

export interface SubredditConfig {
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
    onHighRisk: string[];
    onCriticalRisk: string[];
    onShillDetected: string[];
  };
  whitelistedTokens: string[];
  trustedDomains: string[];
}

export interface ModerationLog {
  id: string;
  postId: string;
  postTitle: string;
  subreddit: string;
  actionType: string;
  reason: string;
  automated: boolean;
  performedBy: string;
  riskScore: number;
  timestamp: string;
}
