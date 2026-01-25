import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { leaderboardRoute } from './routes/leaderboard';
import { configRoute } from './routes/config';

const app = new Hono();

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.route('/api/leaderboard', leaderboardRoute);
app.route('/api/config', configRoute);

const port = 3001;

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`🚀 API server running on http://localhost:${info.port}`);
});
