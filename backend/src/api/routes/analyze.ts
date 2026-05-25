import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PostAnalyzer } from '../../analyzers/PostAnalyzer';
import { TokenAnalysisService } from '../../services/TokenAnalysisService';
import { GeminiModerationService } from '../../services/GeminiModerationService';
import { sanitizeInput } from '@rugsentry/shared/utils';

const router = Router();
const postAnalyzer = new PostAnalyzer();
const tokenService = new TokenAnalysisService();
const geminiService = new GeminiModerationService();

const analyzePostSchema = z.object({
  postId: z.string().min(1),
  postTitle: z.string().min(1),
  postContent: z.string(),
  postUrl: z.string().url(),
  authorName: z.string().min(1),
  subreddit: z.string().min(1),
  authorKarma: z.number().optional(),
  accountAgeDays: z.number().optional(),
});

const analyzeTokenSchema = z.object({
  input: z.string().min(1),
  chain: z.string().optional(),
});

router.post('/post', async (req: Request, res: Response) => {
  try {
    const parsed = analyzePostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.issues });
    }

    const data = parsed.data;
    data.postContent = sanitizeInput(data.postContent);
    data.postTitle = sanitizeInput(data.postTitle);

    const result = await postAnalyzer.analyzePost(data);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[analyze/post]', error);
    return res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

router.post('/token', async (req: Request, res: Response) => {
  try {
    const parsed = analyzeTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }

    const result = await tokenService.analyzeInput(parsed.data.input, parsed.data.chain);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[analyze/token]', error);
    return res.status(500).json({ success: false, error: 'Token analysis failed' });
  }
});

router.post('/ai-classify', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'Content required' });
    }
    const result = await geminiService.classifyContent(sanitizeInput(content));
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[analyze/ai-classify]', error);
    return res.status(500).json({ success: false, error: 'AI classification failed' });
  }
});

router.post('/automod-rule', async (req: Request, res: Response) => {
  try {
    const { postId } = req.body;
    if (!postId) {
      return res.status(400).json({ success: false, error: 'postId required' });
    }

    const { getDb } = await import('../../config/firebase');
    const { FIREBASE_COLLECTIONS } = await import('@rugsentry/shared/constants');
    const db = getDb();
    const doc = await db.collection(FIREBASE_COLLECTIONS.FLAGGED_POSTS).doc(postId).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const post = doc.data() as Parameters<typeof geminiService.generateAutoModRule>[0];
    const rule = await geminiService.generateAutoModRule(post, post.tokenAnalysis);
    return res.json({ success: true, data: { rule } });
  } catch (error) {
    console.error('[analyze/automod-rule]', error);
    return res.status(500).json({ success: false, error: 'AutoMod rule generation failed' });
  }
});

export default router;
