import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import FlaggedPostsPage from './pages/FlaggedPostsPage';
import TokenAnalyzerPage from './pages/TokenAnalyzerPage';
import AlertsPage from './pages/AlertsPage';
import ConfigPage from './pages/ConfigPage';
import PostAnalyzerPage from './pages/PostAnalyzerPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard/cryptomarkets" replace />} />
        <Route path="dashboard/:subreddit" element={<DashboardPage />} />
        <Route path="flagged/:subreddit" element={<FlaggedPostsPage />} />
        <Route path="analyzer" element={<TokenAnalyzerPage />} />
        <Route path="post-analyzer" element={<PostAnalyzerPage />} />
        <Route path="alerts/:subreddit" element={<AlertsPage />} />
        <Route path="config/:subreddit" element={<ConfigPage />} />
      </Route>
    </Routes>
  );
}
