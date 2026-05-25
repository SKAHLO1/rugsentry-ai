import { Router, Request, Response } from 'express';
import { PostAnalyzer } from '../../analyzers/PostAnalyzer';
import { sanitizeInput } from '@rugsentry/shared/utils';

const router = Router();
const postAnalyzer = new PostAnalyzer();

router.post('/reddit/post', async (req: Request, res: Response) => {
  try {
    const { postId, postTitle, postContent, postUrl, authorName, subreddit, authorKarma, accountAgeDays } = req.body;

    if (!postId || !postTitle || !authorName || !subreddit) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const result = await postAnalyzer.analyzePost({
      postId,
      postTitle: sanitizeInput(postTitle),
      postContent: sanitizeInput(postContent || ''),
      postUrl: postUrl || `https://reddit.com/r/${subreddit}/comments/${postId}`,
      authorName,
      subreddit,
      authorKarma: authorKarma !== undefined ? parseInt(authorKarma) : undefined,
      accountAgeDays: accountAgeDays !== undefined ? parseInt(accountAgeDays) : undefined,
    });

    return res.json({
      success: true,
      data: {
        postId: result.postId,
        riskScore: result.riskScore,
        moderationAction: result.moderationAction,
        aiExplanation: result.aiExplanation,
        flaggedAt: result.flaggedAt,
      },
    });
  } catch (error) {
    console.error('[webhook/reddit/post]', error);
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

router.post('/devvit', async (req: Request, res: Response) => {
  try {
    const event = req.body;

    if (event.type === 'PostCreate') {
      const { postId, title, content, author, subredditName, authorKarma, authorAccountAge } = event.data || {};

      if (!postId || !title || !author || !subredditName) {
        return res.status(400).json({ success: false, error: 'Missing Devvit event fields' });
      }

      const result = await postAnalyzer.analyzePost({
        postId,
        postTitle: sanitizeInput(title),
        postContent: sanitizeInput(content || ''),
        postUrl: `https://reddit.com/r/${subredditName}/comments/${postId}`,
        authorName: author,
        subreddit: subredditName,
        authorKarma: authorKarma,
        accountAgeDays: authorAccountAge,
      });

      return res.json({
        success: true,
        data: {
          riskScore: result.riskScore,
          moderationAction: result.moderationAction,
          aiExplanation: result.aiExplanation,
        },
      });
    }

    return res.json({ success: true, message: 'Event received, no action needed' });
  } catch (error) {
    console.error('[webhook/devvit]', error);
    return res.status(500).json({ success: false, error: 'Devvit webhook processing failed' });
  }
});

export default router;
