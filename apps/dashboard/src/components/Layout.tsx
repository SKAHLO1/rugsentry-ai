import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Shield,
  LayoutDashboard,
  AlertTriangle,
  Search,
  Bell,
  Settings,
  ChevronDown,
  Menu,
  X,
  Scan,
  FileSearch,
} from 'lucide-react';
import { cn } from '../lib/utils';

const SUBREDDITS = ['cryptomarkets', 'CryptoMoonShots', 'SatoshiStreetBets', 'defi', 'solana'];

export default function Layout() {
  const { subreddit = 'cryptomarkets' } = useParams();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [subredditDropdown, setSubredditDropdown] = useState(false);

  const navItems = [
    { to: `/dashboard/${subreddit}`, icon: LayoutDashboard, label: 'Dashboard' },
    { to: `/flagged/${subreddit}`, icon: AlertTriangle, label: 'Flagged Posts' },
    { to: `/alerts/${subreddit}`, icon: Bell, label: 'Alerts' },
    { to: `/analyzer`, icon: Scan, label: 'Token Analyzer' },
    { to: `/post-analyzer`, icon: FileSearch, label: 'Post Analyzer' },
    { to: `/config/${subreddit}`, icon: Settings, label: 'Config' },
  ];

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
          <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-base leading-none">RugSentry</div>
            <div className="text-purple-400 text-xs font-medium mt-0.5">AI Moderation</div>
          </div>
        </div>

        {/* Subreddit Selector */}
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="relative">
            <button
              onClick={() => setSubredditDropdown(!subredditDropdown)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-750 text-sm text-gray-200 transition-colors"
            >
              <span className="font-medium">r/{subreddit}</span>
              <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', subredditDropdown && 'rotate-180')} />
            </button>
            {subredditDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 overflow-hidden">
                {SUBREDDITS.map((sr) => (
                  <button
                    key={sr}
                    onClick={() => {
                      navigate(`/dashboard/${sr}`);
                      setSubredditDropdown(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors',
                      sr === subreddit ? 'text-purple-400 bg-purple-500/10' : 'text-gray-300'
                    )}
                  >
                    r/{sr}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-800">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-500">Monitoring active</span>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-gray-800 bg-gray-900/50 backdrop-blur flex items-center px-4 gap-4 shrink-0">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1 flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">r/{subreddit}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 hidden sm:block">Powered by</span>
            <span className="text-xs font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Gemini AI + Blockchain Intel
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
