import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ModerationAutomationService } from '../../services/ModerationAutomationService';
import { DEFAULT_SUBREDDIT_CONFIG } from '@rugsentry/shared/constants';
import type { SubredditConfig } from '@rugsentry/shared/types';
import { generateId } from '@rugsentry/shared/utils';

const router = Router();
const moderationService = new ModerationAutomationService();

router.get('/:subreddit', async (req: Request, res: Response) => {
  try {
    const { subreddit } = req.params;
    const config = await moderationService.getSubredditConfig(subreddit);

    if (!config) {
      const defaultConfig = {
        ...DEFAULT_SUBREDDIT_CONFIG,
        subredditId: subreddit,
        subredditName: subreddit,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as SubredditConfig;
      return res.json({ success: true, data: defaultConfig });
    }

    return res.json({ success: true, data: config });
  } catch (error) {
    console.error('[config/get]', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch config' });
  }
});

const configSchema = z.object({
  subredditName: z.string().min(1),
  enabled: z.boolean(),
  autoModerate: z.boolean(),
  riskThresholds: z.object({
    autoRemove: z.number().min(0).max(100),
    sendToQueue: z.number().min(0).max(100),
    addFlair: z.number().min(0).max(100),
    alertMods: z.number().min(0).max(100),
  }),
  actions: z.object({
    onHighRisk: z.array(z.string()),
    onCriticalRisk: z.array(z.string()),
    onShillDetected: z.array(z.string()),
  }),
  whitelistedTokens: z.array(z.string()),
  trustedDomains: z.array(z.string()),
  customRules: z.array(z.any()).optional(),
});

router.put('/:subreddit', async (req: Request, res: Response) => {
  try {
    const { subreddit } = req.params;
    const parsed = configSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid config', details: parsed.error.issues });
    }

    const existing = await moderationService.getSubredditConfig(subreddit);
    const config = {
      ...DEFAULT_SUBREDDIT_CONFIG,
      ...existing,
      ...parsed.data,
      customRules: parsed.data.customRules || existing?.customRules || [],
      subredditId: existing?.subredditId || generateId(),
      subredditName: subreddit,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as SubredditConfig;

    await moderationService.saveSubredditConfig(config);
    return res.json({ success: true, data: config });
  } catch (error) {
    console.error('[config/put]', error);
    return res.status(500).json({ success: false, error: 'Failed to save config' });
  }
});

export default router;
