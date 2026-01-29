import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { leaderboardRoute } from './routes/leaderboard';
import { configRoute } from './routes/config';
import { walletRoute } from './routes/wallet';
import { triviaRoute } from './routes/trivia';
import { achievementsRoute } from './routes/achievements';
import { galleryRoute } from './routes/gallery';
import { eventsRoute } from './routes/events';
import { payoutsRoute } from './routes/admin/payouts';
import { questionsAdminRoute } from './routes/admin/questions';
import { initAchievements } from './services/achievements';

const app = new Hono();

// Initialize achievement engine
initAchievements();

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.route('/api/leaderboard', leaderboardRoute);
app.route('/api/config', configRoute);
app.route('/api/wallet', walletRoute);
app.route('/api/trivia', triviaRoute);
app.route('/api/achievements', achievementsRoute);
app.route('/api/gallery', galleryRoute);
app.route('/api/events', eventsRoute);
app.route('/api/admin/payouts', payoutsRoute);
app.route('/api/admin/questions', questionsAdminRoute);

const port = 3001;

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`🚀 API server running on http://localhost:${info.port}`);
});
