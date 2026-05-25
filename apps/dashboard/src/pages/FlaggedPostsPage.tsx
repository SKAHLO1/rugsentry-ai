import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Filter, CheckCircle, XCircle, Clock, ExternalLink, ChevronDown, Bot, Users } from 'lucide-react';
import { getFlaggedPosts, updatePostStatus, generateAutoModRule } from '../lib/api';
import RiskBadge from '../components/RiskBadge';
import { timeAgo, truncateAddress, cn } from '../lib/utils';

interface FlaggedPost {
  id: string;
  postId: string;
  postTitle: string;
  postUrl: string;
  authorName: string;
  authorKarma?: number;
  accountAgeDays?: number;
  subreddit: string;
  riskScore: { score: number; level: string; flags: string[]; summary: string };
  tokenAnalysis?: { tokenName?: string; tokenSymbol?: string; isHoneypot?: boolean; contractAddress?: string };
  shillCampaign?: { campaignDetected?: boolean; accountsInvolved?: number; confidenceScore?: number };
  aiExplanation?: string;
  moderationAction?: { type: string; reason: string };
  status: string;
  flaggedAt: string;
  extractedEntities?: { contractAddresses?: string[]; telegramLinks?: string[] };
}

const STATUS_FILTERS = ['all', 'pending', 'actioned', 'reviewed', 'dismissed'];

export default function FlaggedPostsPage() {
  const { subreddit = 'cryptomarkets' } = useParams();
  const [posts, setPosts] = useState<FlaggedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoModRule, setAutoModRule] = useState<string>('');
  const [generatingRule, setGeneratingRule] = useState<string | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await getFlaggedPosts(subreddit, 100, statusFilter === 'all' ? undefined : statusFilter);
      if (res.success) setPosts(res.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, [subreddit, statusFilter]);

  const handleStatusUpdate = async (postId: string, status: string) => {
    try {
      await updatePostStatus(postId, status, 'moderator');
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, status } : p));
    } catch { /* ignore */ }
  };

  const handleGenerateRule = async (post: FlaggedPost) => {
    setGeneratingRule(post.id);
    try {
      const res = await generateAutoModRule(post.id);
      if (res.success) setAutoModRule(res.data.rule);
    } catch { /* ignore */ }
    finally { setGeneratingRule(null); }
  };

  const MOCK_POSTS: FlaggedPost[] = [
    {
      id: '1', postId: 'abc123', postTitle: '🚀 $MOONRUG just launched on pump.fun — 100x potential!',
      postUrl: 'https://reddit.com/r/cryptomarkets/abc123', authorName: 'cryptobot2024',
      authorKarma: 45, accountAgeDays: 3, subreddit,
      riskScore: { score: 91, level: 'CRITICAL', flags: ['Honeypot detected', 'Deployer linked to prior rugs', 'Top wallet concentration 78%', 'Pump.fun link'], summary: 'Critical risk.' },
      tokenAnalysis: { tokenName: 'MoonRug', tokenSymbol: 'MOONRUG', isHoneypot: true, contractAddress: '0xabc123def456' },
      shillCampaign: { campaignDetected: true, accountsInvolved: 14, confidenceScore: 91 },
      aiExplanation: 'This post promotes a high-risk token with confirmed honeypot behavior. The deployer wallet has been linked to 3 previous rug pulls. 14 coordinated accounts are promoting this token.',
      status: 'pending', flaggedAt: new Date(Date.now() - 300000).toISOString(),
      extractedEntities: { contractAddresses: ['0xabc123def456'], telegramLinks: ['https://t.me/moonrugofficial'] },
    },
    {
      id: '2', postId: 'def456', postTitle: 'Early gem alert: $SAFEAI presale going live now',
      postUrl: 'https://reddit.com/r/cryptomarkets/def456', authorName: 'defi_hunter99',
      authorKarma: 210, accountAgeDays: 18, subreddit,
      riskScore: { score: 67, level: 'HIGH', flags: ['Low liquidity ($2,400)', 'New account (18 days)', 'Contains 4 shill keywords'], summary: 'High risk.' },
      status: 'actioned', flaggedAt: new Date(Date.now() - 1800000).toISOString(),
      extractedEntities: { contractAddresses: [], telegramLinks: [] },
    },
  ];

  const displayPosts = posts.length > 0 ? posts : MOCK_POSTS;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-400" />
            Flagged Posts
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">r/{subreddit} — {displayPosts.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <div className="flex rounded-lg border border-gray-800 overflow-hidden">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 text-xs font-medium capitalize transition-colors', statusFilter === s ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200')}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {displayPosts.map((post) => (
            <div key={post.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              {/* Post row */}
              <div
                className="p-4 flex items-start gap-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
                onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
              >
                <RiskBadge level={post.riskScore.level} score={post.riskScore.score} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-200">{post.postTitle}</p>
                    {post.tokenAnalysis?.isHoneypot && (
                      <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">HONEYPOT</span>
                    )}
                    {post.shillCampaign?.campaignDetected && (
                      <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded">SHILL</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-gray-500">u/{post.authorName}</span>
                    {post.accountAgeDays !== undefined && (
                      <span className="text-xs text-gray-600">{post.accountAgeDays}d old account</span>
                    )}
                    {post.authorKarma !== undefined && (
                      <span className="text-xs text-gray-600">{post.authorKarma} karma</span>
                    )}
                    <span className="text-xs text-gray-600">{timeAgo(post.flaggedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('text-xs font-medium capitalize px-2 py-0.5 rounded-full border', {
                    'bg-yellow-500/10 text-yellow-400 border-yellow-500/30': post.status === 'pending',
                    'bg-purple-500/10 text-purple-400 border-purple-500/30': post.status === 'actioned',
                    'bg-green-500/10 text-green-400 border-green-500/30': post.status === 'reviewed',
                    'bg-gray-500/10 text-gray-400 border-gray-500/30': post.status === 'dismissed',
                  })}>
                    {post.status}
                  </span>
                  <ChevronDown className={cn('w-4 h-4 text-gray-500 transition-transform', expandedId === post.id && 'rotate-180')} />
                </div>
              </div>

              {/* Expanded view */}
              {expandedId === post.id && (
                <div className="border-t border-gray-800 p-4 space-y-4">
                  {/* Flags */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Risk Flags</h4>
                    <ul className="space-y-1">
                      {post.riskScore.flags.map((flag, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />{flag}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Token info */}
                  {post.tokenAnalysis && (
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Token Analysis</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div><span className="text-gray-500">Name:</span> <span className="text-gray-200">{post.tokenAnalysis.tokenName || 'N/A'}</span></div>
                        <div><span className="text-gray-500">Symbol:</span> <span className="text-gray-200">${post.tokenAnalysis.tokenSymbol || 'N/A'}</span></div>
                        <div><span className="text-gray-500">Honeypot:</span> <span className={post.tokenAnalysis.isHoneypot ? 'text-red-400' : 'text-green-400'}>{post.tokenAnalysis.isHoneypot ? 'YES ⚠️' : 'No'}</span></div>
                        {post.tokenAnalysis.contractAddress && (
                          <div className="col-span-2"><span className="text-gray-500">Contract:</span> <span className="font-mono text-gray-300">{truncateAddress(post.tokenAnalysis.contractAddress, 8)}</span></div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Shill campaign */}
                  {post.shillCampaign?.campaignDetected && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-orange-400 uppercase mb-2 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> Coordinated Campaign Detected
                      </h4>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><span className="text-gray-500">Accounts:</span> <span className="text-orange-300">{post.shillCampaign.accountsInvolved}</span></div>
                        <div><span className="text-gray-500">Confidence:</span> <span className="text-orange-300">{post.shillCampaign.confidenceScore}%</span></div>
                      </div>
                    </div>
                  )}

                  {/* AI explanation */}
                  {post.aiExplanation && (
                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-purple-400 uppercase mb-1.5 flex items-center gap-1">
                        <Bot className="w-3.5 h-3.5" /> AI Moderation Insight
                      </h4>
                      <p className="text-xs text-gray-300 leading-relaxed">{post.aiExplanation}</p>
                    </div>
                  )}

                  {/* AutoMod rule */}
                  {autoModRule && expandedId === post.id && (
                    <div className="bg-gray-800 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Generated AutoMod Rule</h4>
                      <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto">{autoModRule}</pre>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
                    <a href={post.postUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> View Post
                    </a>
                    {post.status !== 'reviewed' && (
                      <button onClick={() => handleStatusUpdate(post.id, 'reviewed')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors border border-green-500/30">
                        <CheckCircle className="w-3.5 h-3.5" /> Mark Reviewed
                      </button>
                    )}
                    {post.status !== 'dismissed' && (
                      <button onClick={() => handleStatusUpdate(post.id, 'dismissed')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors">
                        <XCircle className="w-3.5 h-3.5" /> Dismiss
                      </button>
                    )}
                    {post.status !== 'actioned' && (
                      <button onClick={() => handleStatusUpdate(post.id, 'actioned')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors border border-red-500/30">
                        <AlertTriangle className="w-3.5 h-3.5" /> Action Post
                      </button>
                    )}
                    <button
                      onClick={() => handleGenerateRule(post)}
                      disabled={generatingRule === post.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors border border-purple-500/30 disabled:opacity-50">
                      {generatingRule === post.id ? (
                        <><span className="w-3 h-3 border border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />Generating...</>
                      ) : (
                        <><Clock className="w-3.5 h-3.5" />Generate AutoMod Rule</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {displayPosts.length === 0 && !loading && (
            <div className="text-center py-16 text-gray-600">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No flagged posts found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
