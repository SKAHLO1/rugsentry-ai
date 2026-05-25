import { useState } from 'react';
import { FileSearch, AlertTriangle, Bot, Send } from 'lucide-react';
import { analyzePost } from '../lib/api';
import RiskBadge from '../components/RiskBadge';
import RiskGauge from '../components/RiskGauge';
import { cn } from '../lib/utils';

export default function PostAnalyzerPage() {
  const [form, setForm] = useState({
    postId: `demo-${Date.now()}`,
    postTitle: '',
    postContent: '',
    postUrl: 'https://reddit.com/r/cryptomarkets/test',
    authorName: '',
    subreddit: 'cryptomarkets',
    authorKarma: '',
    accountAgeDays: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!form.postTitle.trim() || !form.authorName.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await analyzePost({
        ...form,
        postId: `demo-${Date.now()}`,
        authorKarma: form.authorKarma ? parseInt(form.authorKarma) : undefined,
        accountAgeDays: form.accountAgeDays ? parseInt(form.accountAgeDays) : undefined,
      });
      if (res.success) setResult(res.data);
      else setError(res.error || 'Analysis failed');
    } catch {
      setError('Failed to connect to backend. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const riskScore = result?.riskScore as { score: number; level: string; flags: string[]; summary: string } | undefined;
  const tokenAnalysis = result?.tokenAnalysis as { tokenName?: string; isHoneypot?: boolean } | undefined;
  const shillCampaign = result?.shillCampaign as { campaignDetected?: boolean; accountsInvolved?: number; confidenceScore?: number } | undefined;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileSearch className="w-6 h-6 text-purple-400" />
          Post Analyzer
        </h1>
        <p className="text-gray-400 text-sm mt-1">Simulate a full RugSentry analysis on any Reddit post</p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Post Title *</label>
            <input type="text" value={form.postTitle} onChange={e => setForm(f => ({ ...f, postTitle: e.target.value }))}
              placeholder="🚀 $TOKEN launching now — 100x potential!"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Author Username *</label>
            <input type="text" value={form.authorName} onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))}
              placeholder="cryptouser123"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Subreddit</label>
            <input type="text" value={form.subreddit} onChange={e => setForm(f => ({ ...f, subreddit: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Post URL</label>
            <input type="text" value={form.postUrl} onChange={e => setForm(f => ({ ...f, postUrl: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Author Karma</label>
            <input type="number" value={form.authorKarma} onChange={e => setForm(f => ({ ...f, authorKarma: e.target.value }))}
              placeholder="e.g. 45"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Account Age (days)</label>
            <input type="number" value={form.accountAgeDays} onChange={e => setForm(f => ({ ...f, accountAgeDays: e.target.value }))}
              placeholder="e.g. 3"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Post Content</label>
          <textarea value={form.postContent} onChange={e => setForm(f => ({ ...f, postContent: e.target.value }))}
            rows={5}
            placeholder="Paste the full post content here. Include contract addresses, pump.fun links, telegram links etc..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none" />
        </div>
        <button onClick={handleAnalyze} disabled={loading || !form.postTitle.trim() || !form.authorName.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors">
          {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analyzing...</> : <><Send className="w-4 h-4" />Analyze Post</>}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {result && riskScore && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h2 className="text-lg font-bold text-white">Analysis Result</h2>
                  <RiskBadge level={riskScore.level} size="md" />
                </div>
                <p className="text-sm text-gray-300">{riskScore.summary}</p>
                {riskScore.flags.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {riskScore.flags.map((flag: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />{flag}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <RiskGauge score={riskScore.score} size={110} />
            </div>
          </div>

          {tokenAnalysis && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Token Analysis</h3>
              <p className="text-sm text-gray-400">{tokenAnalysis.tokenName || 'Unknown token'} — Honeypot: <span className={tokenAnalysis.isHoneypot ? 'text-red-400' : 'text-green-400'}>{tokenAnalysis.isHoneypot ? 'YES ⚠️' : 'No'}</span></p>
            </div>
          )}

          {shillCampaign?.campaignDetected && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-orange-400 mb-1">Coordinated Shill Detected</h3>
              <p className="text-sm text-gray-300">{shillCampaign.accountsInvolved} accounts involved — {shillCampaign.confidenceScore}% confidence</p>
            </div>
          )}

          {result.aiExplanation && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-purple-400 mb-1.5 flex items-center gap-1.5">
                <Bot className="w-4 h-4" /> AI Moderation Insight
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">{result.aiExplanation as string}</p>
            </div>
          )}

          {result.moderationAction && (
            <div className={cn('rounded-xl border p-4', {
              'bg-red-500/10 border-red-500/20': riskScore.level === 'CRITICAL',
              'bg-orange-500/10 border-orange-500/20': riskScore.level === 'HIGH',
              'bg-yellow-500/10 border-yellow-500/20': riskScore.level === 'MEDIUM',
            })}>
              <h3 className="text-sm font-semibold text-gray-300 mb-1">Moderation Action Taken</h3>
              <p className="text-sm text-gray-400">
                <span className="font-medium text-gray-200">{(result.moderationAction as { type: string }).type.replace(/_/g, ' ').toUpperCase()}</span>
                {' — '}{(result.moderationAction as { reason: string }).reason}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
