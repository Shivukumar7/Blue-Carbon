import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { pool } from './db.js';

import authRoutes from './routes/auth.routes.js';
import communityRoutes from './routes/community.routes.js';
import applicationRoutes from './routes/application.routes.js';
import adminRoutes from './routes/admin.routes.js';
import leaderRoutes from './routes/leader.routes.js';
import memberRoutes from './routes/member.routes.js';
import marketRoutes from './routes/market.routes.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') ?? true }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), { maxAge: '7d' }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'unreachable', detail: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leader', leaderRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/market', marketRoutes);

app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Multer reports upload problems through err.code; treat them as client errors.
  const status = err.status
    || (err.code === 'LIMIT_FILE_SIZE' ? 413 : null)
    || (typeof err.code === 'string' && err.code.startsWith('LIMIT_') ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side' : err.message });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Blue Carbon Registry API listening on http://localhost:${port}`));
