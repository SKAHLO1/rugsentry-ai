import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '../config/env';
import type { FlaggedPost, TokenAnalysis, ShillCampaign } from '@rugsentry/shared/types';

interface ModerationInsight {
  explanation: string;
  keyFindings: string[];
  recommendedAction: string;
  autoModRuleYaml?: string;
}

export class GeminiModerationService {
  private genAI: GoogleGenerativeAI | null = null;

  private getClient(): GoogleGenerativeAI {
    if (!this.genAI) {
      if (!ENV.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
      }
      this.genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);
    }
    return this.genAI;
  }

  async generateModerationInsight(
    post: FlaggedPost,
    tokenAnalysis?: TokenAnalysis,
    shillCampaign?: Partial<ShillCampaign>
  ): Promise<ModerationInsight> {
    try {
      const client = this.getClient();
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = this.buildInsightPrompt(post, tokenAnalysis, shillCampaign);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return this.parseInsightResponse(text, post, tokenAnalysis, shillCampaign);
    } catch (error) {
      return this.buildFallbackInsight(post, tokenAnalysis, shillCampaign);
    }
  }

  async classifyContent(content: string): Promise<{ isScam: boolean; confidence: number; reasons: string[] }> {
    try {
      const client = this.getClient();
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `You are a crypto scam detection AI. Analyze the following Reddit post content and determine if it's a scam, rug pull promotion, coordinated shill, or legitimate content.

Content: "${content.slice(0, 2000)}"

Respond in JSON format only:
{
  "isScam": boolean,
  "confidence": number (0-100),
  "reasons": ["reason1", "reason2"]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      /* fallback */
    }

    return { isScam: false, confidence: 0, reasons: ['AI analysis unavailable'] };
  }

  async generateAutoModRule(post: FlaggedPost, tokenAnalysis?: TokenAnalysis): Promise<string> {
    try {
      const client = this.getClient();
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const flaggedKeywords = post.extractedEntities.tokenSymbols.join(', ');
      const flaggedAddresses = post.extractedEntities.contractAddresses.join(', ');
      const flaggedDomains = [
        ...post.extractedEntities.telegramLinks.map(l => {
          try { return new URL(l).hostname; } catch { return ''; }
        }),
        ...post.extractedEntities.pumpFunLinks.map(l => {
          try { return new URL(l).hostname; } catch { return ''; }
        }),
      ].filter(Boolean).join(', ');

      const prompt = `Generate an AutoMod YAML rule to block this scam token/campaign.

Token: ${tokenAnalysis?.tokenName || 'Unknown'} (${tokenAnalysis?.tokenSymbol || 'N/A'})
Contract: ${flaggedAddresses || 'N/A'}
Keywords: ${flaggedKeywords || 'N/A'}
Domains: ${flaggedDomains || 'N/A'}
Risk Score: ${post.riskScore.score}

Generate a Reddit AutoMod compatible YAML rule. Keep it concise.`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch {
      return this.buildFallbackAutoModRule(post, tokenAnalysis);
    }
  }

  async detectAIGeneratedContent(content: string): Promise<{ isAIGenerated: boolean; confidence: number }> {
    try {
      const client = this.getClient();
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `Analyze this text and determine if it was AI-generated (e.g., ChatGPT, Claude). Look for patterns like overly formal structure, generic enthusiasm, lack of specific personal details, and repetitive promotional language.

Text: "${content.slice(0, 1500)}"

Respond in JSON: {"isAIGenerated": boolean, "confidence": number}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      /* fallback */
    }

    return { isAIGenerated: false, confidence: 0 };
  }

  private buildInsightPrompt(
    post: FlaggedPost,
    tokenAnalysis?: TokenAnalysis,
    shillCampaign?: Partial<ShillCampaign>
  ): string {
    const parts = [
      `You are RugSentry AI, an expert crypto scam detection system for Reddit moderators.`,
      `Analyze this flagged Reddit post and provide actionable moderation insights.`,
      ``,
      `POST DETAILS:`,
      `Title: ${post.postTitle}`,
      `Author: ${post.authorName} (karma: ${post.authorKarma || 'unknown'}, age: ${post.accountAgeDays || 'unknown'} days)`,
      `Subreddit: r/${post.subreddit}`,
      `Content: ${post.content.slice(0, 1000)}`,
      `Risk Score: ${post.riskScore.score}/100 (${post.riskScore.level})`,
      `Risk Flags: ${post.riskScore.flags.join(', ')}`,
    ];

    if (tokenAnalysis) {
      parts.push(
        ``,
        `TOKEN ANALYSIS:`,
        `Token: ${tokenAnalysis.tokenName} (${tokenAnalysis.tokenSymbol})`,
        `Contract: ${tokenAnalysis.contractAddress || 'N/A'}`,
        `Honeypot: ${tokenAnalysis.isHoneypot}`,
        `Liquidity Locked: ${tokenAnalysis.liquidityLocked}`,
        `Top Wallet %: ${tokenAnalysis.topWalletPercent.toFixed(1)}%`,
        `Has Mint Function: ${tokenAnalysis.hasMintFunction}`,
        `Deployer Risk: ${tokenAnalysis.deployerRisk}`,
      );
    }

    if (shillCampaign?.campaignDetected) {
      parts.push(
        ``,
        `SHILL CAMPAIGN DETECTED:`,
        `Accounts Involved: ${shillCampaign.accountsInvolved}`,
        `Confidence: ${shillCampaign.confidenceScore}%`,
        `Patterns: ${shillCampaign.behaviorPatterns?.join(', ')}`,
      );
    }

    parts.push(
      ``,
      `Provide a response in JSON format:`,
      `{`,
      `  "explanation": "2-3 sentence moderator-friendly explanation",`,
      `  "keyFindings": ["finding1", "finding2", "finding3"],`,
      `  "recommendedAction": "specific action recommendation"`,
      `}`,
    );

    return parts.join('\n');
  }

  private parseInsightResponse(
    text: string,
    post: FlaggedPost,
    tokenAnalysis?: TokenAnalysis,
    shillCampaign?: Partial<ShillCampaign>
  ): ModerationInsight {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          explanation: parsed.explanation || '',
          keyFindings: parsed.keyFindings || [],
          recommendedAction: parsed.recommendedAction || '',
        };
      }
    } catch {
      /* fallback */
    }
    return this.buildFallbackInsight(post, tokenAnalysis, shillCampaign);
  }

  private buildFallbackInsight(
    post: FlaggedPost,
    tokenAnalysis?: TokenAnalysis,
    shillCampaign?: Partial<ShillCampaign>
  ): ModerationInsight {
    const findings: string[] = [...post.riskScore.flags];

    if (tokenAnalysis?.isHoneypot) findings.push('Token confirmed as honeypot');
    if (tokenAnalysis?.deployerRisk) findings.push('Deployer has history of rug pulls');
    if (shillCampaign?.campaignDetected) findings.push(`Coordinated campaign: ${shillCampaign.accountsInvolved} accounts`);

    const score = post.riskScore.score;
    let explanation = '';
    let recommendedAction = '';

    if (score >= 81) {
      explanation = `This post has a critical risk score of ${score}/100. Multiple severe red flags detected including: ${findings.slice(0, 2).join(', ')}. Immediate moderation action recommended.`;
      recommendedAction = 'Remove post immediately and send mod alert. Consider temporary user mute.';
    } else if (score >= 61) {
      explanation = `High risk post detected with score ${score}/100. Suspicious activity patterns found: ${findings.slice(0, 2).join(', ')}. Review and action recommended.`;
      recommendedAction = 'Move to mod queue. Add warning flair. Alert moderators.';
    } else {
      explanation = `Medium risk indicators detected (score: ${score}/100). This post warrants closer review.`;
      recommendedAction = 'Add to mod queue for manual review.';
    }

    return { explanation, keyFindings: findings.slice(0, 5), recommendedAction };
  }

  private buildFallbackAutoModRule(post: FlaggedPost, tokenAnalysis?: TokenAnalysis): string {
    const keywords = post.extractedEntities.tokenSymbols.map(s => s.replace('$', '')).join('", "');
    const addresses = post.extractedEntities.contractAddresses.join('", "');

    return `---
# RugSentry AI Generated AutoMod Rule
# Token: ${tokenAnalysis?.tokenName || 'Unknown'} | Risk Score: ${post.riskScore.score}/100
# Generated: ${new Date().toISOString()}

type: submission
action: remove
action_reason: "RugSentry AI: High risk crypto promotion detected"

~body+title (includes):
  - "${keywords}"
  
~author_flair_text (includes):
  - "${addresses}"
  
message: "Your post has been removed as it may promote a high-risk cryptocurrency. Please review our community rules."
`;
  }
}
