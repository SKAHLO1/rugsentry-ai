import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { ENV } from './config/env';
import { initFirebase } from './config/firebase';
import analyzeRoutes from './api/routes/analyze';
import dashboardRoutes from './api/routes/dashboard';
import alertRoutes from './api/routes/alerts';
import configRoutes from './api/routes/config';
import webhookRoutes from './api/routes/webhook';

const app = express();

initFirebase();

app.use(helmet());
app.use(cors({
  origin: ENV.CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

app.use('/api/analyze', analyzeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/config', configRoutes);
app.use('/api/webhook', webhookRoutes);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'RugSentry AI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('*', (_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Error Handler]', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(ENV.PORT, () => {
  console.log(`🛡️  RugSentry AI Backend running on port ${ENV.PORT}`);
  console.log(`📊 Environment: ${ENV.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${ENV.PORT}/health`);
});

export default app;
