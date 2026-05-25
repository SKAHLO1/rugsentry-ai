import { getDb } from '../config/firebase';
import { FIREBASE_COLLECTIONS } from '@rugsentry/shared/constants';
import type { Alert, AlertType, FlaggedPost, RiskLevel } from '@rugsentry/shared/types';
import { generateId } from '@rugsentry/shared/utils';

export class AlertService {
  async createAlert(
    subreddit: string,
    type: AlertType,
    severity: RiskLevel,
    title: string,
    message: string,
    extras?: { postId?: string; postUrl?: string; tokenAddress?: string }
  ): Promise<Alert> {
    const alert: Alert = {
      id: generateId(),
      subreddit,
      type,
      severity,
      title,
      message,
      postId: extras?.postId,
      postUrl: extras?.postUrl,
      tokenAddress: extras?.tokenAddress,
      read: false,
      createdAt: new Date().toISOString(),
    };

    try {
      const db = getDb();
      await db.collection(FIREBASE_COLLECTIONS.ALERTS).doc(alert.id).set(alert);
    } catch {
      /* non-critical */
    }

    return alert;
  }

  async createPostAlert(post: FlaggedPost): Promise<Alert> {
    const severity = post.riskScore.level;
    const type: AlertType = post.shillCampaign?.campaignDetected
      ? 'coordinated_shill'
      : post.tokenAnalysis?.isHoneypot
      ? 'honeypot'
      : 'high_risk_post';

    const title = `${severity} Risk: "${post.postTitle.slice(0, 60)}${post.postTitle.length > 60 ? '...' : ''}"`;
    const message = `Post by u/${post.authorName} flagged with risk score ${post.riskScore.score}/100.\nTop flags: ${post.riskScore.flags.slice(0, 3).join(', ')}`;

    return this.createAlert(post.subreddit, type, severity, title, message, {
      postId: post.postId,
      postUrl: post.postUrl,
      tokenAddress: post.extractedEntities.contractAddresses[0],
    });
  }

  async getAlerts(subreddit: string, limit = 50, unreadOnly = false): Promise<Alert[]> {
    try {
      const db = getDb();
      let query = db.collection(FIREBASE_COLLECTIONS.ALERTS)
        .where('subreddit', '==', subreddit)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (unreadOnly) {
        query = query.where('read', '==', false) as typeof query;
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => doc.data() as Alert);
    } catch {
      return [];
    }
  }

  async markAsRead(alertId: string): Promise<void> {
    try {
      const db = getDb();
      await db.collection(FIREBASE_COLLECTIONS.ALERTS).doc(alertId).update({ read: true });
    } catch {
      /* non-critical */
    }
  }

  async markAllAsRead(subreddit: string): Promise<void> {
    try {
      const db = getDb();
      const snapshot = await db.collection(FIREBASE_COLLECTIONS.ALERTS)
        .where('subreddit', '==', subreddit)
        .where('read', '==', false)
        .get();

      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.update(doc.ref, { read: true }));
      await batch.commit();
    } catch {
      /* non-critical */
    }
  }

  async getUnreadCount(subreddit: string): Promise<number> {
    try {
      const db = getDb();
      const snapshot = await db.collection(FIREBASE_COLLECTIONS.ALERTS)
        .where('subreddit', '==', subreddit)
        .where('read', '==', false)
        .get();
      return snapshot.size;
    } catch {
      return 0;
    }
  }
}
