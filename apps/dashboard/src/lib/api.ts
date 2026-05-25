import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[API Error]', err.response?.data || err.message);
    return Promise.reject(err);
  }
);

export const analyzePost = (data: {
  postId: string;
  postTitle: string;
  postContent: string;
  postUrl: string;
  authorName: string;
  subreddit: string;
  authorKarma?: number;
  accountAgeDays?: number;
}) => api.post('/analyze/post', data).then((r) => r.data);

export const analyzeToken = (input: string, chain?: string) =>
  api.post('/analyze/token', { input, chain }).then((r) => r.data);

export const aiClassify = (content: string) =>
  api.post('/analyze/ai-classify', { content }).then((r) => r.data);

export const generateAutoModRule = (postId: string) =>
  api.post('/analyze/automod-rule', { postId }).then((r) => r.data);

export const getDashboardMetrics = (subreddit: string, period = '7d') =>
  api.get(`/dashboard/metrics/${subreddit}?period=${period}`).then((r) => r.data);

export const getFlaggedPosts = (subreddit: string, limit = 50, status?: string) =>
  api.get(`/dashboard/flagged/${subreddit}?limit=${limit}${status ? `&status=${status}` : ''}`).then((r) => r.data);

export const updatePostStatus = (postId: string, status: string, reviewedBy?: string) =>
  api.patch(`/dashboard/flagged/${postId}/status`, { status, reviewedBy }).then((r) => r.data);

export const getModerationLogs = (subreddit: string, limit = 50) =>
  api.get(`/dashboard/logs/${subreddit}?limit=${limit}`).then((r) => r.data);

export const getAlerts = (subreddit: string, limit = 50, unreadOnly = false) =>
  api.get(`/alerts/${subreddit}?limit=${limit}&unreadOnly=${unreadOnly}`).then((r) => r.data);

export const markAlertRead = (alertId: string) =>
  api.patch(`/alerts/${alertId}/read`).then((r) => r.data);

export const markAllAlertsRead = (subreddit: string) =>
  api.post(`/alerts/read-all/${subreddit}`).then((r) => r.data);

export const getSubredditConfig = (subreddit: string) =>
  api.get(`/config/${subreddit}`).then((r) => r.data);

export const saveSubredditConfig = (subreddit: string, config: Record<string, unknown>) =>
  api.put(`/config/${subreddit}`, config).then((r) => r.data);

export default api;
