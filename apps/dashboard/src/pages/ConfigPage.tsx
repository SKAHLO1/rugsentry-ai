import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, Save, RotateCcw, Plus, Trash2, Shield } from 'lucide-react';
import { getSubredditConfig, saveSubredditConfig } from '../lib/api';
import { cn } from '../lib/utils';

interface Config {
  subredditName: string;
  enabled: boolean;
  autoModerate: boolean;
  riskThresholds: {
    autoRemove: number;
    sendToQueue: number;
    addFlair: number;
    alertMods: number;
  };
  actions: {
    onHighRisk: string[];
    onCriticalRisk: string[];
    onShillDetected: string[];
  };
  whitelistedTokens: string[];
  trustedDomains: string[];
}

const ALL_ACTIONS = [
  { value: 'remove_post', label: 'Remove Post' },
  { value: 'lock_comments', label: 'Lock Comments' },
  { value: 'add_flair', label: 'Add Warning Flair' },
  { value: 'send_modmail', label: 'Send ModMail Alert' },
  { value: 'mute_user', label: 'Mute User' },
  { value: 'ban_recommendation', label: 'Recommend Ban' },
  { value: 'queue_escalation', label: 'Escalate to Queue' },
];

const DEFAULT_CONFIG: Config = {
  subredditName: '',
  enabled: true,
  autoModerate: false,
  riskThresholds: { autoRemove: 85, sendToQueue: 65, addFlair: 45, alertMods: 70 },
  actions: {
    onHighRisk: ['add_flair', 'queue_escalation', 'send_modmail'],
    onCriticalRisk: ['remove_post', 'send_modmail', 'ban_recommendation'],
    onShillDetected: ['queue_escalation', 'send_modmail'],
  },
  whitelistedTokens: [],
  trustedDomains: ['reddit.com', 'twitter.com', 'coingecko.com'],
};

export default function ConfigPage() {
  const { subreddit = 'cryptomarkets' } = useParams();
  const [config, setConfig] = useState<Config>({ ...DEFAULT_CONFIG, subredditName: subreddit });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [newDomain, setNewDomain] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const res = await getSubredditConfig(subreddit);
        if (res.success && res.data) setConfig(res.data);
        else setConfig({ ...DEFAULT_CONFIG, subredditName: subreddit });
      } catch {
        setConfig({ ...DEFAULT_CONFIG, subredditName: subreddit });
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [subreddit]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSubredditConfig(subreddit, config as Record<string, unknown>);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const toggleAction = (category: keyof Config['actions'], action: string) => {
    setConfig(prev => {
      const list = prev.actions[category];
      const updated = list.includes(action) ? list.filter(a => a !== action) : [...list, action];
      return { ...prev, actions: { ...prev.actions, [category]: updated } };
    });
  };

  const updateThreshold = (key: keyof Config['riskThresholds'], value: number) => {
    setConfig(prev => ({ ...prev, riskThresholds: { ...prev.riskThresholds, [key]: value } }));
  };

  const addToken = () => {
    if (newToken.trim()) {
      setConfig(prev => ({ ...prev, whitelistedTokens: [...prev.whitelistedTokens, newToken.trim()] }));
      setNewToken('');
    }
  };

  const removeToken = (token: string) => {
    setConfig(prev => ({ ...prev, whitelistedTokens: prev.whitelistedTokens.filter(t => t !== token) }));
  };

  const addDomain = () => {
    if (newDomain.trim()) {
      setConfig(prev => ({ ...prev, trustedDomains: [...prev.trustedDomains, newDomain.trim()] }));
      setNewDomain('');
    }
  };

  const removeDomain = (domain: string) => {
    setConfig(prev => ({ ...prev, trustedDomains: prev.trustedDomains.filter(d => d !== domain) }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-400" />
            Configuration
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">r/{subreddit}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setConfig({ ...DEFAULT_CONFIG, subredditName: subreddit })}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button onClick={handleSave} disabled={saving}
            className={cn('flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors', saved ? 'bg-green-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50')}>
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Config'}
          </button>
        </div>
      </div>

      {/* General Settings */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-400" /> General Settings
        </h2>
        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-300 font-medium">Enable RugSentry</span>
              <p className="text-xs text-gray-500 mt-0.5">Activate AI-powered scanning for this subreddit</p>
            </div>
            <button onClick={() => setConfig(p => ({ ...p, enabled: !p.enabled }))}
              className={cn('relative w-11 h-6 rounded-full transition-colors', config.enabled ? 'bg-purple-600' : 'bg-gray-700')}>
              <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', config.enabled && 'translate-x-5')} />
            </button>
          </label>
          <div className="border-t border-gray-800" />
          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-300 font-medium">Auto-Moderate</span>
              <p className="text-xs text-gray-500 mt-0.5">Automatically take actions based on risk thresholds</p>
            </div>
            <button onClick={() => setConfig(p => ({ ...p, autoModerate: !p.autoModerate }))}
              className={cn('relative w-11 h-6 rounded-full transition-colors', config.autoModerate ? 'bg-purple-600' : 'bg-gray-700')}>
              <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', config.autoModerate && 'translate-x-5')} />
            </button>
          </label>
        </div>
      </div>

      {/* Risk Thresholds */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Risk Score Thresholds</h2>
        <div className="space-y-4">
          {[
            { key: 'autoRemove' as const, label: 'Auto Remove', desc: 'Automatically remove posts above this score', color: 'text-red-400' },
            { key: 'alertMods' as const, label: 'Alert Moderators', desc: 'Send modmail alerts above this score', color: 'text-orange-400' },
            { key: 'sendToQueue' as const, label: 'Send to Queue', desc: 'Escalate to mod queue above this score', color: 'text-yellow-400' },
            { key: 'addFlair' as const, label: 'Add Warning Flair', desc: 'Add warning flair above this score', color: 'text-blue-400' },
          ].map(({ key, label, desc, color }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-sm font-medium text-gray-300">{label}</span>
                  <p className="text-xs text-gray-600">{desc}</p>
                </div>
                <span className={cn('text-sm font-bold tabular-nums', color)}>{config.riskThresholds[key]}</span>
              </div>
              <input type="range" min={0} max={100} value={config.riskThresholds[key]}
                onChange={e => updateThreshold(key, parseInt(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-gray-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer" />
            </div>
          ))}
        </div>
      </div>

      {/* Moderation Actions */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Moderation Actions</h2>
        {[
          { key: 'onCriticalRisk' as const, label: 'On Critical Risk (81-100)', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
          { key: 'onHighRisk' as const, label: 'On High Risk (61-80)', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
          { key: 'onShillDetected' as const, label: 'On Shill Detected', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
        ].map(({ key, label, color }) => (
          <div key={key}>
            <p className={cn('text-xs font-semibold uppercase px-2 py-1 rounded border inline-block mb-2', color)}>{label}</p>
            <div className="flex flex-wrap gap-2">
              {ALL_ACTIONS.map(({ value, label: actionLabel }) => (
                <button key={value} onClick={() => toggleAction(key, value)}
                  className={cn('px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors', config.actions[key].includes(value) ? 'bg-purple-600/20 border-purple-500/50 text-purple-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200')}>
                  {actionLabel}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Whitelisted Tokens */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Whitelisted Tokens</h2>
        <p className="text-xs text-gray-500">Posts mentioning these tokens will not trigger automated actions.</p>
        <div className="flex gap-2">
          <input type="text" value={newToken} onChange={e => setNewToken(e.target.value)} onKeyDown={e => e.key === 'Enter' && addToken()}
            placeholder="0xabc123... or BTC"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
          <button onClick={addToken} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.whitelistedTokens.map(token => (
            <span key={token} className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400">
              {token}
              <button onClick={() => removeToken(token)} className="hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
            </span>
          ))}
          {config.whitelistedTokens.length === 0 && <span className="text-xs text-gray-600">No whitelisted tokens</span>}
        </div>
      </div>

      {/* Trusted Domains */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Trusted Domains</h2>
        <p className="text-xs text-gray-500">Links from these domains will have reduced risk scores.</p>
        <div className="flex gap-2">
          <input type="text" value={newDomain} onChange={e => setNewDomain(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDomain()}
            placeholder="coingecko.com"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
          <button onClick={addDomain} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.trustedDomains.map(domain => (
            <span key={domain} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
              {domain}
              <button onClick={() => removeDomain(domain)} className="hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
