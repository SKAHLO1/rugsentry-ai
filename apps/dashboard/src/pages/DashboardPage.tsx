import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle, Shield, Bot, Users, TrendingUp, Activity, RefreshCw, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import StatCard from '../components/StatCard';
import RiskBadge from '../components/RiskBadge';
import RiskGauge from '../components/RiskGauge';
import { getDashboardMetrics, getFlaggedPosts } from '../lib/api';
import { timeAgo, getRiskColor, truncateAddress } from '../lib/utils';
import type { DashboardMetrics, FlaggedPost } from '../types';

type Period = '24h' | '7d' | '30d';

export default function DashboardPage() {
  const { subreddit = 'cryptomarkets' } = useParams();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentPosts, setRecentPosts] = useState<FlaggedPost[]>([]);
  const [period, setPeriod] = useState<Period>('7d');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metricsRes, postsRes] = await Promise.allSettled([
        getDashboardMetrics(subreddit, period),
        getFlaggedPosts(subreddit, 10),
      ]);
      if (metricsRes.status === 'fulfilled' && metricsRes.value.success) {
        setMetrics(metricsRes.value.data);
      }
      if (postsRes.status === 'fulfilled' && postsRes.value.success) {
        setRecentPosts(postsRes.value.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => { fetchData(); }, [subreddit, period]);

  const MOCK_METRICS: DashboardMetrics = {
    subreddit,
    period,
    scamExposureScore: 72,
    botActivityScore: 45,
    coordinatedAttackScore: 38,
    totalFlaggedPosts: 143,
    totalActioned: 89,
    totalDismissed: 12,
    totalCampaigns: 7,
    highRiskTokens: ['0xabc123...', '0xdef456...', '0x789abc...'],
    topThreats: [],
    recentAlerts: [],
    tokenSpamFrequency: Array.from({ length: 14 }, (_, i) => ({
      timestamp: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
      value: Math.floor(Math.random() * 25 + 3),
    })),
    manipulationHeatmap: [],
  };

  const data = metrics || MOCK_METRICS;
  const chartData = data.tokenSpamFrequency.map(d => ({
    date: d.timestamp.slice(5),
    flags: d.value,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Moderation Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">r/{subreddit} — Real-time scam intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-800 overflow-hidden">
            {(['24h', '7d', '30d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${period === p ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Last refresh */}
      <div className="flex items-center gap-1.5 text-xs text-gray-600">
        <Clock className="w-3 h-3" />
        Last updated {timeAgo(lastRefresh.toISOString())}
        {loading && <span className="ml-2 text-purple-400">Loading...</span>}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Flagged Posts"
          value={data.totalFlaggedPosts}
          subtitle={`${data.totalActioned} actioned`}
          icon={AlertTriangle}
          color="orange"
          trend={{ value: 12, label: 'vs last period' }}
        />
        <StatCard
          title="Scam Exposure Score"
          value={`${data.scamExposureScore}/100`}
          subtitle="Community safety index"
          icon={Shield}
          color="red"
        />
        <StatCard
          title="Bot Activity Score"
          value={`${data.botActivityScore}/100`}
          subtitle="Automated account detection"
          icon={Bot}
          color="purple"
        />
        <StatCard
          title="Coordinated Campaigns"
          value={data.totalCampaigns}
          subtitle="Shill networks detected"
          icon={Users}
          color="blue"
        />
      </div>

      {/* Risk gauges + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gauges */}
        <div className="lg:col-span-1 bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            Community Safety Metrics
          </h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-300">Scam Exposure</div>
                <div className="text-xs text-gray-500 mt-0.5">High-risk token activity</div>
              </div>
              <RiskGauge score={data.scamExposureScore} size={90} />
            </div>
            <div className="border-t border-gray-800" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-300">Bot Activity</div>
                <div className="text-xs text-gray-500 mt-0.5">Automated accounts</div>
              </div>
              <RiskGauge score={data.botActivityScore} size={90} />
            </div>
            <div className="border-t border-gray-800" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-300">Attack Score</div>
                <div className="text-xs text-gray-500 mt-0.5">Coordinated shilling</div>
              </div>
              <RiskGauge score={data.coordinatedAttackScore} size={90} />
            </div>
          </div>
        </div>

        {/* Spam frequency chart */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            Token Spam Frequency
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="flagGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#4b5563" tick={{ fontSize: 11 }} />
              <YAxis stroke="#4b5563" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#a855f7' }}
              />
              <Area type="monotone" dataKey="flags" stroke="#a855f7" fill="url(#flagGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent flagged posts + high-risk tokens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Flagged Posts */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            Recent Flagged Posts
          </h2>
          {recentPosts.length === 0 ? (
            <div className="text-center py-10 text-gray-600">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No flagged posts yet</p>
              <p className="text-xs mt-1">Posts will appear here when analyzed</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentPosts.map((post) => (
                <div key={post.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors">
                  <RiskBadge level={post.riskScore.level} score={post.riskScore.score} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{post.postTitle}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">u/{post.authorName}</span>
                      <span className="text-xs text-gray-600">·</span>
                      <span className="text-xs text-gray-500">{timeAgo(post.flaggedAt)}</span>
                    </div>
                    {post.riskScore.flags.length > 0 && (
                      <p className="text-xs text-gray-600 mt-1 truncate">{post.riskScore.flags[0]}</p>
                    )}
                  </div>
                  <span className={`text-xs font-medium shrink-0 ${getRiskColor(post.riskScore.level)}`}>
                    {post.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* High-risk tokens */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-red-400" />
            High-Risk Token Trends
          </h2>
          {data.highRiskTokens.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">No high-risk tokens detected</div>
          ) : (
            <div className="space-y-2">
              {data.highRiskTokens.slice(0, 8).map((token, i) => (
                <div key={token} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-4">#{i + 1}</span>
                    <span className="text-xs font-mono text-gray-300">{truncateAddress(token, 8)}</span>
                  </div>
                  <span className="text-xs text-red-400 font-medium">HIGH</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Moderation stats bar chart */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          Moderation Action Breakdown
        </h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={[
            { label: 'Flagged', value: data.totalFlaggedPosts, fill: '#6b7280' },
            { label: 'Actioned', value: data.totalActioned, fill: '#a855f7' },
            { label: 'Dismissed', value: data.totalDismissed, fill: '#4b5563' },
            { label: 'Campaigns', value: data.totalCampaigns, fill: '#ef4444' },
          ]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" stroke="#4b5563" tick={{ fontSize: 12 }} />
            <YAxis stroke="#4b5563" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {[
                { fill: '#6b7280' }, { fill: '#a855f7' }, { fill: '#4b5563' }, { fill: '#ef4444' },
              ].map((entry, i) => (
                <rect key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
