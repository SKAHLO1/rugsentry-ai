import { getDb } from '../config/firebase';
import { FIREBASE_COLLECTIONS } from '@rugsentry/shared/constants';
import type {
  FlaggedPost,
  SubredditConfig,
  ModerationAction,
  ModerationActionType,
  ModerationLog,
} from '@rugsentry/shared/types';
import { generateId } from '@rugsentry/shared/utils';

export class ModerationAutomationService {
  async determineActions(post: FlaggedPost, config: SubredditConfig): Promise<ModerationActionType[]> {
    const score = post.riskScore.score;
    const actions: ModerationActionType[] = [];

    if (!config.autoModerate) return actions;

    const whitelisted = config.whitelistedTokens.some(token =>
      post.extractedEntities.contractAddresses.includes(token) ||
      post.extractedEntities.tokenSymbols.some(s => s.replace('$', '').toUpperCase() === token.toUpperCase())
    );

    if (whitelisted) return ['no_action'];

    if (score >= config.riskThresholds.autoRemove) {
      actions.push(...config.actions.onCriticalRisk);
    } else if (score >= config.riskThresholds.sendToQueue) {
      actions.push(...config.actions.onHighRisk);
    } else if (score >= config.riskThresholds.addFlair) {
      actions.push('add_flair');
    }

    if (post.shillCampaign?.campaignDetected) {
      for (const action of config.actions.onShillDetected) {
        if (!actions.includes(action)) {
          actions.push(action);
        }
      }
    }

    for (const rule of config.customRules) {
      if (!rule.enabled) continue;
      if (this.evaluateCustomRule(rule, post)) {
        for (const action of rule.actions) {
          if (!actions.includes(action)) {
            actions.push(action);
          }
        }
      }
    }

    return [...new Set(actions)];
  }

  private evaluateCustomRule(rule: SubredditConfig['customRules'][0], post: FlaggedPost): boolean {
    return rule.conditions.every(condition => {
      const value = this.getFieldValue(condition.field, post);
      switch (condition.operator) {
        case 'gt': return typeof value === 'number' && value > (condition.value as number);
        case 'lt': return typeof value === 'number' && value < (condition.value as number);
        case 'eq': return value === condition.value;
        case 'contains':
          return typeof value === 'string' && value.toLowerCase().includes(String(condition.value).toLowerCase());
        case 'matches':
          try {
            return typeof value === 'string' && new RegExp(String(condition.value)).test(value);
          } catch {
            return false;
          }
        default: return false;
      }
    });
  }

  private getFieldValue(field: string, post: FlaggedPost): string | number | boolean | undefined {
    const map: Record<string, unknown> = {
      'riskScore': post.riskScore.score,
      'authorKarma': post.authorKarma,
      'accountAgeDays': post.accountAgeDays,
      'content': post.content,
      'postTitle': post.postTitle,
      'isHoneypot': post.tokenAnalysis?.isHoneypot,
      'holderConcentration': post.tokenAnalysis?.holderConcentration,
    };
    return map[field] as string | number | boolean | undefined;
  }

  async executeAction(
    post: FlaggedPost,
    actionType: ModerationActionType,
    triggeredBy: 'auto' | 'manual' = 'auto',
    moderator?: string
  ): Promise<ModerationAction> {
    const action: ModerationAction = {
      type: actionType,
      reason: `RugSentry AI: Risk score ${post.riskScore.score}/100 — ${post.riskScore.level}`,
      triggeredBy,
      triggeredAt: new Date().toISOString(),
      moderator,
    };

    await this.logAction(post, action);
    return action;
  }

  async logAction(post: FlaggedPost, action: ModerationAction): Promise<void> {
    try {
      const db = getDb();
      const log: ModerationLog = {
        id: generateId(),
        postId: post.postId,
        subreddit: post.subreddit,
        action,
        riskScore: post.riskScore,
        createdAt: new Date().toISOString(),
      };
      await db.collection(FIREBASE_COLLECTIONS.MODERATION_LOGS).doc(log.id).set(log);
    } catch {
      /* non-critical */
    }
  }

  async getSubredditConfig(subredditName: string): Promise<SubredditConfig | null> {
    try {
      const db = getDb();
      const snapshot = await db.collection(FIREBASE_COLLECTIONS.SUBREDDIT_SETTINGS)
        .where('subredditName', '==', subredditName)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return snapshot.docs[0].data() as SubredditConfig;
      }
    } catch {
      /* fallback */
    }
    return null;
  }

  async saveSubredditConfig(config: SubredditConfig): Promise<void> {
    const db = getDb();
    await db.collection(FIREBASE_COLLECTIONS.SUBREDDIT_SETTINGS)
      .doc(config.subredditId)
      .set({ ...config, updatedAt: new Date().toISOString() });
  }

  buildModmailMessage(post: FlaggedPost): string {
    return `🚨 RugSentry AI Alert — Risk Score: ${post.riskScore.score}/100 (${post.riskScore.level})

Post: "${post.postTitle}"
Author: u/${post.authorName}
URL: ${post.postUrl}

Risk Flags:
${post.riskScore.flags.map(f => `• ${f}`).join('\n')}

${post.aiExplanation ? `\nAI Analysis:\n${post.aiExplanation}` : ''}

${post.tokenAnalysis ? `\nToken: ${post.tokenAnalysis.tokenName} (${post.tokenAnalysis.tokenSymbol})
Contract: ${post.tokenAnalysis.contractAddress || 'N/A'}
Honeypot: ${post.tokenAnalysis.isHoneypot ? 'YES ⚠️' : 'No'}
Liquidity: $${(post.tokenAnalysis.liquidityUSD || 0).toLocaleString()}` : ''}

This alert was generated automatically by RugSentry AI.
Review at your moderation dashboard.`;
  }

  buildFlairText(riskLevel: string): string {
    const flairs: Record<string, string> = {
      CRITICAL: '🚨 HIGH RISK — Potential Scam',
      HIGH: '⚠️ HIGH RISK Token',
      MEDIUM: '⚠️ MEDIUM RISK — Exercise Caution',
      LOW: '🔍 Under Review',
      SAFE: '✅ Verified',
    };
    return flairs[riskLevel] || '⚠️ Flagged by RugSentry';
  }
}
