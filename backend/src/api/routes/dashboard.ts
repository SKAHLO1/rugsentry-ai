import { Router, Request, Response } from 'express';
import { getDb } from '../../config/firebase';
import { FIREBASE_COLLECTIONS } from '@rugsentry/shared/constants';
import type { FlaggedPost, Alert, DashboardMetrics, ModerationLog } from '@rugsentry/shared/types';

const router = Router();

router.get('/metrics/:subreddit', async (req: Request, res: Response) => {
  try {
    const { subreddit } = req.params;
    const period = (req.query.period as string) || '7d';
    const hoursMap: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 };
    const hours = hoursMap[period] || 168;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const db = getDb();

    const [postsSnap, alertsSnap, logsSnap] = await Promise.allSettled([
      db.collection(FIREBASE_COLLECTIONS.FLAGGED_POSTS)
        .where('subreddit', '==', subreddit)
        .where('flaggedAt', '>=', cutoff)
        .orderBy('flaggedAt', 'desc')
        .limit(200)
        .get(),
      db.collection(FIREBASE_COLLECTIONS.ALERTS)
        .where('subreddit', '==', subreddit)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get(),
      db.collection(FIREBASE_COLLECTIONS.MODERATION_LOGS)
        .where('subreddit', '==', subreddit)
        .where('createdAt', '>=', cutoff)
        .limit(100)
        .get(),
    ]);

    const posts: FlaggedPost[] = postsSnap.status === 'fulfilled'
      ? postsSnap.value.docs.map(d => d.data() as FlaggedPost)
      : [];
    const alerts: Alert[] = alertsSnap.status === 'fulfilled'
      ? alertsSnap.value.docs.map(d => d.data() as Alert)
      : [];
    const logs: ModerationLog[] = logsSnap.status === 'fulfilled'
      ? logsSnap.value.docs.map(d => d.data() as ModerationLog)
      : [];

    const totalFlagged = posts.length;
    const totalActioned = posts.filter(p => p.status === 'actioned').length;
    const totalDismissed = posts.filter(p => p.status === 'dismissed').length;

    const highRiskPosts = posts.filter(p => p.riskScore.score >= 61);
    const avgRiskScore = posts.length > 0
      ? posts.reduce((acc, p) => acc + p.riskScore.score, 0) / posts.length
      : 0;

    const honeypotCount = posts.filter(p => p.tokenAnalysis?.isHoneypot).length;
    const shillCount = posts.filter(p => p.shillCampaign?.campaignDetected).length;

    const scamExposureScore = Math.min(100, Math.round(
      (highRiskPosts.length / Math.max(1, totalFlagged)) * 60 +
      (honeypotCount * 5) +
      (avgRiskScore * 0.4)
    ));

    const botActivityScore = Math.min(100, Math.round(
      posts.filter(p => (p.accountAgeDays || 999) < 30).length /
      Math.max(1, totalFlagged) * 100
    ));

    const coordinatedAttackScore = Math.min(100, Math.round(
      (shillCount / Math.max(1, totalFlagged)) * 80 +
      (shillCount > 0 ? 20 : 0)
    ));

    const tokenFreqMap: Record<string, number> = {};
    posts.forEach(p => {
      p.extractedEntities?.contractAddresses?.forEach((addr: string) => {
        tokenFreqMap[addr] = (tokenFreqMap[addr] || 0) + 1;
      });
    });

    const highRiskTokens = Object.entries(tokenFreqMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([addr]) => addr);

    const timeSeriesMap: Record<string, number> = {};
    posts.forEach(p => {
      const hour = new Date(p.flaggedAt).toISOString().slice(0, 13) + ':00:00Z';
      timeSeriesMap[hour] = (timeSeriesMap[hour] || 0) + 1;
    });

    const tokenSpamFrequency = Object.entries(timeSeriesMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([timestamp, value]) => ({ timestamp, value }));

    const heatmap: Array<{ hour: number; day: number; value: number }> = [];
    const heatmapMap: Record<string, number> = {};
    posts.forEach(p => {
      const d = new Date(p.flaggedAt);
      const key = `${d.getDay()}-${d.getHours()}`;
      heatmapMap[key] = (heatmapMap[key] || 0) + 1;
    });
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        heatmap.push({ day, hour, value: heatmapMap[`${day}-${hour}`] || 0 });
      }
    }

    const metrics: DashboardMetrics = {
      subreddit,
      period: period as DashboardMetrics['period'],
      scamExposureScore,
      botActivityScore,
      coordinatedAttackScore,
      totalFlaggedPosts: totalFlagged,
      totalActioned,
      totalDismissed,
      totalCampaigns: shillCount,
      highRiskTokens,
      topThreats: posts.filter(p => p.riskScore.score >= 60).slice(0, 5),
      recentAlerts: alerts.slice(0, 10),
      tokenSpamFrequency,
      manipulationHeatmap: heatmap,
    };

    return res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('[dashboard/metrics]', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch metrics' });
  }
});

router.get('/flagged/:subreddit', async (req: Request, res: Response) => {
  try {
    const { subreddit } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const status = req.query.status as string;

    const db = getDb();
    let query = db.collection(FIREBASE_COLLECTIONS.FLAGGED_POSTS)
      .where('subreddit', '==', subreddit)
      .orderBy('flaggedAt', 'desc')
      .limit(limit);

    if (status) {
      query = query.where('status', '==', status) as typeof query;
    }

    const snapshot = await query.get();
    const posts = snapshot.docs.map(d => d.data() as FlaggedPost);
    return res.json({ success: true, data: posts });
  } catch (error) {
    console.error('[dashboard/flagged]', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch flagged posts' });
  }
});

router.patch('/flagged/:postId/status', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { status, reviewedBy } = req.body;

    const validStatuses = ['pending', 'actioned', 'reviewed', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const db = getDb();
    await db.collection(FIREBASE_COLLECTIONS.FLAGGED_POSTS).doc(postId).update({
      status,
      reviewedBy: reviewedBy || 'moderator',
      reviewedAt: new Date().toISOString(),
    });

    return res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('[dashboard/flagged/status]', error);
    return res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

router.get('/logs/:subreddit', async (req: Request, res: Response) => {
  try {
    const { subreddit } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const db = getDb();
    const snapshot = await db.collection(FIREBASE_COLLECTIONS.MODERATION_LOGS)
      .where('subreddit', '==', subreddit)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const logs = snapshot.docs.map(d => d.data() as ModerationLog);
    return res.json({ success: true, data: logs });
  } catch (error) {
    console.error('[dashboard/logs]', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
});

export default router;
