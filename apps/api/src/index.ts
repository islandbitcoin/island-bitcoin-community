import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { leaderboardRoute } from './routes/leaderboard';
import { configRoute } from './routes/config';
import { walletRoute } from './routes/wallet';
import { triviaRoute } from './routes/trivia';
import { stackerRoute } from './routes/stacker';
import { achievementsRoute } from './routes/achievements';
import { galleryRoute } from './routes/gallery';

const app = new Hono();

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.route('/api/leaderboard', leaderboardRoute);
app.route('/api/config', configRoute);
app.route('/api/wallet', walletRoute);
app.route('/api/trivia', triviaRoute);
app.route('/api/stacker', stackerRoute);
app.route('/api/achievements', achievementsRoute);
app.route('/api/gallery', galleryRoute);

const port = 3001;

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`🚀 API server running on http://localhost:${info.port}`);
});
