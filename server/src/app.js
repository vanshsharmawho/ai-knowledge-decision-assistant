import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import assistantRoutes from './routes/assistant.js';
import usageRoutes from './routes/usage.js';
import askRoutes, { askHandlers } from './routes/ask.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Public assistant API: callable from any website that embeds the widget.
  app.use('/api/public', cors({ origin: '*', methods: ['GET', 'POST'] }), askRoutes);
  // The endpoint named in the brief: POST /api/ask (same handler as /api/public/ask)
  const publicCors = cors({ origin: '*', methods: ['POST'] });
  app.options('/api/ask', publicCors);
  app.post('/api/ask', publicCors, ...askHandlers);

  // Admin APIs: only the dashboard origin, and only with an admin JWT.
  const adminCors = cors({ origin: config.frontendOrigin });
  app.use('/api/auth', adminCors, authRoutes);
  app.use('/api/documents', adminCors, documentRoutes);
  app.use('/api/assistant', adminCors, assistantRoutes);
  app.use('/api/usage', adminCors, usageRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
