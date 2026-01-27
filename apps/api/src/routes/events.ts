import { Hono } from 'hono';
import { fetchUpcomingEvents, fetchPastEvents, clearEventsCache, type CalendarEvent } from '../services/evento';

export const eventsRoute = new Hono();

// Transform NIP-52 CalendarEvent to Evento.so-compatible Event format
function transformToEventoFormat(calendarEvent: CalendarEvent) {
  const startDate = new Date(calendarEvent.start * 1000);
  const endDate = calendarEvent.end ? new Date(calendarEvent.end * 1000) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // Default 2 hour duration

  return {
    event: {
      id: calendarEvent.id,
      status: 'published',
      basic_info: {
        title: calendarEvent.title,
        description: calendarEvent.description,
        summary: calendarEvent.description.slice(0, 200),
        type: 'meetup',
      },
      datetime: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      location: {
        type: 'physical',
        name: calendarEvent.location || 'TBD',
        address: {
          city: calendarEvent.location || 'Caribbean',
          country: 'Caribbean',
        },
      },
       organizer: {
         name: 'Island Bitcoin',
         nostr: {
           npub: calendarEvent.pubkey,
         },
       },
       ...(calendarEvent.registrationUrl && {
         registration: {
           url: calendarEvent.registrationUrl,
         },
       }),
     },
   };
}

// Root handler - returns all events in Evento.so format for frontend compatibility
eventsRoute.get('/', async (c) => {
  try {
    const [upcoming, past] = await Promise.all([
      fetchUpcomingEvents(),
      fetchPastEvents(),
    ]);
    
    const allEvents = [...upcoming, ...past];
    const transformedEvents = allEvents.map(transformToEventoFormat);
    
    return c.json(transformedEvents);
  } catch (error) {
    console.error('Error fetching events:', error);
    return c.json([]);
  }
});

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

eventsRoute.post('/refresh', async (c) => {
  clearEventsCache();
  return c.json({ success: true, message: 'Events cache cleared' });
});
