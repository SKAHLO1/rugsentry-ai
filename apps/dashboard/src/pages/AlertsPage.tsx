import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, BellOff, CheckCheck, AlertTriangle, Shield, Bot, Users, ExternalLink } from 'lucide-react';
import { getAlerts, markAlertRead, markAllAlertsRead } from '../lib/api';
import { timeAgo, getRiskColor, cn } from '../lib/utils';

interface Alert {
  id: string;
  subreddit: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  postId?: string;
  postUrl?: string;
  tokenAddress?: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  scam_token: AlertTriangle,
  coordinated_shill: Users,
  honeypot: Shield,
  rugpull_risk: AlertTriangle,
  bot_activity: Bot,
  wallet_cluster: Users,
  high_risk_post: AlertTriangle,
};

const MOCK_ALERTS: Alert[] = [
  { id: '1', subreddit: 'cryptomarkets', type: 'honeypot', severity: 'CRITICAL', title: 'CRITICAL Risk: "🚀 $MOONRUG just launched..."', message: 'Post by u/cryptobot2024 flagged with risk score 91/100.\nTop flags: Honeypot detected, Deployer linked to prior rugs', postUrl: 'https://reddit.com', read: false, createdAt: new Date(Date.now() - 300000).toISOString() },
  { id: '2', subreddit: 'cryptomarkets', type: 'coordinated_shill', severity: 'HIGH', title: 'Coordinated Shill: 14 accounts promoting same token', message: 'Coordinated campaign detected with 91% confidence. 14 accounts involved.', read: false, createdAt: new Date(Date.now() - 900000).toISOString() },
  { id: '3', subreddit: 'cryptomarkets', type: 'scam_token', severity: 'HIGH', title: 'HIGH Risk: "Early gem alert: $SAFEAI presale..."', message: 'Post by u/defi_hunter99 flagged with risk score 67/100.\nTop flags: Low liquidity, New account', read: true, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: '4', subreddit: 'cryptomarkets', type: 'bot_activity', severity: 'MEDIUM', title: 'Bot Activity Spike Detected', message: 'Unusual posting pattern from 6 accounts in the last hour. Possible coordinated bot activity.', read: true, createdAt: new Date(Date.now() - 7200000).toISOString() },
];

export default function AlertsPage() {
  const { subreddit = 'cryptomarkets' } = useParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await getAlerts(subreddit, 50, showUnreadOnly);
      if (res.success) {
        setAlerts(res.data.alerts);
        setUnreadCount(res.data.unreadCount);
      } else {
        setAlerts(MOCK_ALERTS);
        setUnreadCount(MOCK_ALERTS.filter(a => !a.read).length);
      }
    } catch {
      setAlerts(MOCK_ALERTS);
      setUnreadCount(MOCK_ALERTS.filter(a => !a.read).length);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAlerts(); }, [subreddit, showUnreadOnly]);

  const handleMarkRead = async (alertId: string) => {
    try {
      await markAlertRead(alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAlertsRead(subreddit);
      setAlerts(prev => prev.map(a => ({ ...a, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  const displayed = showUnreadOnly ? alerts.filter(a => !a.read) : alerts;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-yellow-400" />
            Alerts
            {unreadCount > 0 && (
              <span className="text-sm bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold">{unreadCount}</span>
            )}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">r/{subreddit} — {displayed.length} alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border', showUnreadOnly ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200')}
          >
            {showUnreadOnly ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            {showUnreadOnly ? 'Unread only' : 'All alerts'}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((alert) => {
            const Icon = TYPE_ICONS[alert.type] || AlertTriangle;
            return (
              <div
                key={alert.id}
                className={cn(
                  'bg-gray-900 rounded-xl border p-4 flex items-start gap-4 transition-colors',
                  !alert.read ? 'border-gray-700' : 'border-gray-800 opacity-60'
                )}
              >
                <div className={cn('p-2 rounded-lg shrink-0', {
                  'bg-red-500/10': alert.severity === 'CRITICAL',
                  'bg-orange-500/10': alert.severity === 'HIGH',
                  'bg-yellow-500/10': alert.severity === 'MEDIUM',
                  'bg-blue-500/10': alert.severity === 'LOW',
                })}>
                  <Icon className={cn('w-5 h-5', getRiskColor(alert.severity))} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={cn('text-sm font-semibold', !alert.read ? 'text-white' : 'text-gray-400')}>
                        {alert.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{alert.message}</p>
                    </div>
                    <span className="text-xs text-gray-600 shrink-0">{timeAgo(alert.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {alert.postUrl && (
                      <a href={alert.postUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300">
                        <ExternalLink className="w-3 h-3" /> View Post
                      </a>
                    )}
                    {!alert.read && (
                      <button onClick={() => handleMarkRead(alert.id)}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
                {!alert.read && <div className="w-2 h-2 rounded-full bg-yellow-400 shrink-0 mt-1" />}
              </div>
            );
          })}
          {displayed.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No alerts found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
