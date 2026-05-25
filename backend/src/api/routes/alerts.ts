import { Router, Request, Response } from 'express';
import { AlertService } from '../../services/AlertService';

const router = Router();
const alertService = new AlertService();

router.get('/:subreddit', async (req: Request, res: Response) => {
  try {
    const { subreddit } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const unreadOnly = req.query.unreadOnly === 'true';

    const alerts = await alertService.getAlerts(subreddit, limit, unreadOnly);
    const unreadCount = await alertService.getUnreadCount(subreddit);
    return res.json({ success: true, data: { alerts, unreadCount } });
  } catch (error) {
    console.error('[alerts/get]', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

router.patch('/:alertId/read', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    await alertService.markAsRead(alertId);
    return res.json({ success: true });
  } catch (error) {
    console.error('[alerts/read]', error);
    return res.status(500).json({ success: false, error: 'Failed to mark alert as read' });
  }
});

router.post('/read-all/:subreddit', async (req: Request, res: Response) => {
  try {
    const { subreddit } = req.params;
    await alertService.markAllAsRead(subreddit);
    return res.json({ success: true });
  } catch (error) {
    console.error('[alerts/read-all]', error);
    return res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
});

export default router;
