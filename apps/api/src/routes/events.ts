import { Hono } from 'hono';
import { fetchUpcomingEvents, fetchPastEvents } from '../services/evento';

export const eventsRoute = new Hono();

eventsRoute.get('/upcoming', async (c) => {
  try {
    const events = await fetchUpcomingEvents();
    return c.json({ events });
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    return c.json({ events: [] });
  }
});

eventsRoute.get('/past', async (c) => {
  try {
    const events = await fetchPastEvents();
    return c.json({ events });
  } catch (error) {
    console.error('Error fetching past events:', error);
    return c.json({ events: [] });
  }
});
