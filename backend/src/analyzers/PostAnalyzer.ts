import { TokenAnalysisService } from '../services/TokenAnalysisService';
import { ShillDetectionService } from '../services/ShillDetectionService';
import { GeminiModerationService } from '../services/GeminiModerationService';
import { ModerationAutomationService } from '../services/ModerationAutomationService';
import { AlertService } from '../services/AlertService';
import { extractEntities, buildRiskScore, generateId } from '@rugsentry/shared/utils';
import { SCAM_KEYWORDS, DEFAULT_SUBREDDIT_CONFIG, FIREBASE_COLLECTIONS } from '@rugsentry/shared/constants';
import type { FlaggedPost, AnalyzePostRequest, SubredditConfig } from '@rugsentry/shared/types';
import { getDb } from '../config/firebase';

export class PostAnalyzer {
  private tokenService = new TokenAnalysisService();
  private shillService = new ShillDetectionService();
  private geminiService = new GeminiModerationService();
  private moderationService = new ModerationAutomationService();
  private alertService = new AlertService();

  async analyzePost(request: AnalyzePostRequest): Promise<FlaggedPost> {
    const fullText = `${request.postTitle} ${request.postContent}`;
    const entities = extractEntities(fullText);

    let baseScore = 0;
    const flags: string[] = [];

    const keywordHits = SCAM_KEYWORDS.filter(kw => fullText.toLowerCase().includes(kw.toLowerCase()));
    if (keywordHits.length > 0) {
      baseScore += Math.min(30, keywordHits.length * 8);
      flags.push(`Contains ${keywordHits.length} scam indicator keyword(s): ${keywordHits.slice(0, 3).join(', ')}`);
    }

    if (request.accountAgeDays !== undefined && request.accountAgeDays < 30) {
      baseScore += 15;
      flags.push(`New account (${request.accountAgeDays} days old)`);
    }

    if (request.authorKarma !== undefined && request.authorKarma < 100) {
      baseScore += 10;
      flags.push(`Low karma account (${request.authorKarma} karma)`);
    }

    if (entities.contractAddresses.length > 0) {
      baseScore += 5;
      flags.push(`Contains ${entities.contractAddresses.length} contract address(es)`);
    }

    if (entities.telegramLinks.length > 0) {
      baseScore += 10;
      flags.push(`Telegram link(s) detected`);
    }

    if (entities.pumpFunLinks.length > 0) {
      baseScore += 20;
      flags.push(`Pump.fun link detected — high-risk launch platform`);
    }

    let tokenAnalysis = undefined;
    const allInputs = [
      ...entities.contractAddresses,
      ...entities.dexScreenerLinks,
      ...entities.pumpFunLinks,
    ];

    if (allInputs.length > 0) {
      try {
        tokenAnalysis = await this.tokenService.analyzeInput(allInputs[0]);
        if (tokenAnalysis.riskScore.score > baseScore) {
          baseScore = Math.max(baseScore, tokenAnalysis.riskScore.score);
        }
        for (const flag of tokenAnalysis.riskScore.flags) {
          if (!flags.includes(flag)) flags.push(flag);
        }
      } catch {
        /* non-critical */
      }
    }

    const riskScore = buildRiskScore(
      Math.min(100, baseScore),
      flags,
      flags.length > 0 ? `${flags.length} risk factor(s) detected.` : 'No significant risk factors found.'
    );

    const post: FlaggedPost = {
      id: generateId(),
      postId: request.postId,
      postTitle: request.postTitle,
      postUrl: request.postUrl,
      authorName: request.authorName,
      authorKarma: request.authorKarma,
      accountAgeDays: request.accountAgeDays,
      subreddit: request.subreddit,
      content: fullText,
      extractedEntities: entities,
      tokenAnalysis,
      riskScore,
      status: 'pending',
      flaggedAt: new Date().toISOString(),
    };

    const recentPosts = await this.shillService.getRecentPostsFromDb(request.subreddit);
    const shillCampaign = await this.shillService.detectCampaign(post, recentPosts);
    if (shillCampaign) {
      post.shillCampaign = shillCampaign;
      if (shillCampaign.confidenceScore > 50) {
        const newScore = Math.min(100, post.riskScore.score + 15);
        post.riskScore = buildRiskScore(
          newScore,
          [...post.riskScore.flags, `Coordinated shill activity detected (${shillCampaign.confidenceScore}% confidence)`],
          post.riskScore.summary
        );
      }
    }

    if (post.riskScore.score >= 40) {
      try {
        const insight = await this.geminiService.generateModerationInsight(post, tokenAnalysis, shillCampaign || undefined);
        post.aiExplanation = insight.explanation;
      } catch {
        /* non-critical */
      }
    }

    await this.savePost(post);

    if (post.riskScore.score >= 60) {
      await this.alertService.createPostAlert(post);
    }

    const config = await this.moderationService.getSubredditConfig(request.subreddit);
    const effectiveConfig: SubredditConfig = config || ({
      ...DEFAULT_SUBREDDIT_CONFIG,
      subredditId: request.subreddit,
      subredditName: request.subreddit,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as SubredditConfig);

    if (effectiveConfig.autoModerate && post.riskScore.score >= effectiveConfig.riskThresholds.sendToQueue) {
      const actions = await this.moderationService.determineActions(post, effectiveConfig);
      if (actions.length > 0 && actions[0] !== 'no_action') {
        const action = await this.moderationService.executeAction(post, actions[0]);
        post.moderationAction = action;
        post.status = 'actioned';
        await this.updatePostStatus(post.id, 'actioned', action);
      }
    }

    return post;
  }

  private async savePost(post: FlaggedPost): Promise<void> {
    try {
      const db = getDb();
      await db.collection(FIREBASE_COLLECTIONS.FLAGGED_POSTS).doc(post.id).set(post);
    } catch {
      /* non-critical */
    }
  }

  private async updatePostStatus(
    postId: string,
    status: FlaggedPost['status'],
    action?: FlaggedPost['moderationAction']
  ): Promise<void> {
    try {
      const db = getDb();
      const update: Partial<FlaggedPost> = { status };
      if (action) update.moderationAction = action;
      await db.collection(FIREBASE_COLLECTIONS.FLAGGED_POSTS).doc(postId).update(update);
    } catch {
      /* non-critical */
    }
  }
}
