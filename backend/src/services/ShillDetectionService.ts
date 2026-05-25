import { generateId } from '@rugsentry/shared/utils';
import { SCAM_KEYWORDS } from '@rugsentry/shared/constants';
import type { ShillCampaign, FlaggedPost } from '@rugsentry/shared/types';
import { getDb } from '../config/firebase';
import { FIREBASE_COLLECTIONS } from '@rugsentry/shared/constants';

interface PostSignal {
  postId: string;
  authorName: string;
  subreddit: string;
  content: string;
  contractAddresses: string[];
  telegramLinks: string[];
  twitterLinks: string[];
  createdAt: string;
}

interface SimilarityResult {
  similarity: number;
  sharedTokens: string[];
  sharedLinks: string[];
}

export class ShillDetectionService {
  async detectCampaign(post: FlaggedPost, recentPosts: PostSignal[]): Promise<ShillCampaign | null> {
    const signals: string[] = [];
    let confidenceScore = 0;
    const relatedWallets: string[] = [];
    const relatedTokens: string[] = [...post.extractedEntities.contractAddresses];
    const involvedAccounts: Set<string> = new Set();

    const tokenAddresses = post.extractedEntities.contractAddresses;
    const telegramLinks = post.extractedEntities.telegramLinks;
    const twitterLinks = post.extractedEntities.twitterLinks;

    for (const recentPost of recentPosts) {
      if (recentPost.postId === post.postId) continue;

      const similarity = this.computeSimilarity(post, recentPost);

      const sharedTokens = tokenAddresses.filter(addr =>
        recentPost.contractAddresses.includes(addr)
      );
      const sharedTelegram = telegramLinks.filter(link =>
        recentPost.telegramLinks.includes(link)
      );
      const sharedTwitter = twitterLinks.filter(link =>
        recentPost.twitterLinks.includes(link)
      );

      if (sharedTokens.length > 0 || sharedTelegram.length > 0 || similarity.similarity > 0.6) {
        involvedAccounts.add(recentPost.authorName);
        relatedTokens.push(...sharedTokens);
        confidenceScore += 20;

        if (sharedTokens.length > 0) signals.push(`Same token promoted by ${recentPost.authorName}`);
        if (sharedTelegram.length > 0) signals.push(`Shared Telegram link with ${recentPost.authorName}`);
        if (similarity.similarity > 0.6) signals.push(`High content similarity (${(similarity.similarity * 100).toFixed(0)}%) with post by ${recentPost.authorName}`);
      }
    }

    const scamKeywordCount = SCAM_KEYWORDS.filter(kw =>
      post.content.toLowerCase().includes(kw.toLowerCase())
    ).length;

    if (scamKeywordCount >= 2) {
      signals.push(`Contains ${scamKeywordCount} shill keywords`);
      confidenceScore += scamKeywordCount * 10;
    }

    if (post.accountAgeDays !== undefined && post.accountAgeDays < 30) {
      signals.push(`Account is only ${post.accountAgeDays} days old`);
      confidenceScore += 15;
    }

    if (post.authorKarma !== undefined && post.authorKarma < 100) {
      signals.push(`Low karma account (${post.authorKarma})`);
      confidenceScore += 10;
    }

    if (involvedAccounts.size === 0 && confidenceScore < 30) {
      return null;
    }

    involvedAccounts.add(post.authorName);

    const finalScore = Math.min(100, confidenceScore);

    return {
      id: generateId(),
      campaignDetected: finalScore >= 40,
      accountsInvolved: involvedAccounts.size,
      confidenceScore: finalScore,
      relatedWallets,
      relatedTokens: [...new Set(relatedTokens)],
      behaviorPatterns: signals,
      subreddit: post.subreddit,
      detectedAt: new Date().toISOString(),
      posts: [post.postId, ...recentPosts.filter(p => involvedAccounts.has(p.authorName)).map(p => p.postId)],
    };
  }

  private computeSimilarity(post: FlaggedPost, other: PostSignal): SimilarityResult {
    const words1 = new Set(post.content.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const words2 = new Set(other.content.toLowerCase().split(/\W+/).filter(w => w.length > 3));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;

    const sharedTokens = post.extractedEntities.contractAddresses.filter(addr =>
      other.contractAddresses.includes(addr)
    );
    const sharedLinks = post.extractedEntities.telegramLinks.filter(link =>
      other.telegramLinks.includes(link)
    );

    return {
      similarity: jaccardSimilarity,
      sharedTokens,
      sharedLinks,
    };
  }

  async getRecentPostsFromDb(subreddit: string, hoursBack = 24): Promise<PostSignal[]> {
    try {
      const db = getDb();
      const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      const snapshot = await db.collection(FIREBASE_COLLECTIONS.FLAGGED_POSTS)
        .where('subreddit', '==', subreddit)
        .where('flaggedAt', '>=', cutoff)
        .limit(100)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data() as FlaggedPost;
        return {
          postId: data.postId,
          authorName: data.authorName,
          subreddit: data.subreddit,
          content: data.content,
          contractAddresses: data.extractedEntities?.contractAddresses || [],
          telegramLinks: data.extractedEntities?.telegramLinks || [],
          twitterLinks: data.extractedEntities?.twitterLinks || [],
          createdAt: data.flaggedAt,
        };
      });
    } catch {
      return [];
    }
  }

  analyzeBotLikelihood(authorName: string, karma: number, accountAgeDays: number, postCount24h: number): number {
    let score = 0;

    if (accountAgeDays < 7) score += 40;
    else if (accountAgeDays < 30) score += 25;
    else if (accountAgeDays < 90) score += 10;

    if (karma < 10) score += 30;
    else if (karma < 100) score += 15;
    else if (karma < 500) score += 5;

    if (postCount24h > 20) score += 30;
    else if (postCount24h > 10) score += 15;
    else if (postCount24h > 5) score += 5;

    const numericPattern = /\d{4,}/.test(authorName);
    const underscoreNumbers = /[_-]\d{2,}$/.test(authorName);
    if (numericPattern || underscoreNumbers) score += 10;

    return Math.min(100, score);
  }
}
