import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { eventsRoute } from './events';

// Mock the evento service
vi.mock('../services/evento', () => ({
  fetchUpcomingEvents: vi.fn(),
  fetchPastEvents: vi.fn(),
  clearEventsCache: vi.fn(),
}));

import { fetchUpcomingEvents, fetchPastEvents, clearEventsCache } from '../services/evento';

describe('Events API Endpoints', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/events', eventsRoute);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/events/upcoming', () => {
    it('should return upcoming events', async () => {
      const mockEvents = [
        {
          id: 'event1',
          title: 'Bitcoin Meetup',
          description: 'Monthly Bitcoin meetup',
          start: Math.floor(Date.now() / 1000) + 86400, // tomorrow
          end: Math.floor(Date.now() / 1000) + 90000,
          location: 'Island Bitcoin HQ',
          pubkey: 'abc123',
        },
        {
          id: 'event2',
          title: 'Lightning Workshop',
          description: 'Learn about Lightning Network',
          start: Math.floor(Date.now() / 1000) + 172800, // 2 days from now
          end: Math.floor(Date.now() / 1000) + 180000,
          location: 'Online',
          pubkey: 'def456',
        },
      ];

      vi.mocked(fetchUpcomingEvents).mockResolvedValueOnce(mockEvents);

      const res = await app.request('http://localhost/api/events/upcoming');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.events).toHaveLength(2);
      expect(body.events[0].title).toBe('Bitcoin Meetup');
      expect(body.events[1].title).toBe('Lightning Workshop');
    });

    it('should return empty array when no upcoming events', async () => {
      vi.mocked(fetchUpcomingEvents).mockResolvedValueOnce([]);

      const res = await app.request('http://localhost/api/events/upcoming');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.events).toEqual([]);
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(fetchUpcomingEvents).mockRejectedValueOnce(new Error('Relay connection failed'));

      const res = await app.request('http://localhost/api/events/upcoming');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.events).toEqual([]);
    });

    it('should not require authentication', async () => {
      vi.mocked(fetchUpcomingEvents).mockResolvedValueOnce([]);

      const res = await app.request('http://localhost/api/events/upcoming', {
        headers: {},
      });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/events/past', () => {
    it('should return past events', async () => {
      const mockEvents = [
        {
          id: 'event3',
          title: 'Bitcoin Conference 2025',
          description: 'Annual Bitcoin conference',
          start: Math.floor(Date.now() / 1000) - 172800, // 2 days ago
          end: Math.floor(Date.now() / 1000) - 86400,
          location: 'Convention Center',
          pubkey: 'ghi789',
        },
        {
          id: 'event4',
          title: 'Nostr Hackathon',
          description: 'Build on Nostr',
          start: Math.floor(Date.now() / 1000) - 604800, // 1 week ago
          end: Math.floor(Date.now() / 1000) - 518400,
          location: 'Tech Hub',
          pubkey: 'jkl012',
        },
      ];

      vi.mocked(fetchPastEvents).mockResolvedValueOnce(mockEvents);

      const res = await app.request('http://localhost/api/events/past');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.events).toHaveLength(2);
      expect(body.events[0].title).toBe('Bitcoin Conference 2025');
      expect(body.events[1].title).toBe('Nostr Hackathon');
    });

    it('should return empty array when no past events', async () => {
      vi.mocked(fetchPastEvents).mockResolvedValueOnce([]);

      const res = await app.request('http://localhost/api/events/past');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.events).toEqual([]);
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(fetchPastEvents).mockRejectedValueOnce(new Error('Network error'));

      const res = await app.request('http://localhost/api/events/past');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.events).toEqual([]);
    });

    it('should not require authentication', async () => {
      vi.mocked(fetchPastEvents).mockResolvedValueOnce([]);

      const res = await app.request('http://localhost/api/events/past', {
        headers: {},
      });

      expect(res.status).toBe(200);
    });
  });

  describe('Caching behavior', () => {
    it('should use cached results on subsequent calls', async () => {
      const mockEvents = [
        {
          id: 'event1',
          title: 'Cached Event',
          description: 'This should be cached',
          start: Math.floor(Date.now() / 1000) + 86400,
          end: Math.floor(Date.now() / 1000) + 90000,
          location: 'Cache Land',
          pubkey: 'cache123',
        },
      ];

      vi.mocked(fetchUpcomingEvents).mockResolvedValue(mockEvents);

      // First call
      await app.request('http://localhost/api/events/upcoming');
      // Second call
      await app.request('http://localhost/api/events/upcoming');

      // Service should only be called once due to caching
      expect(fetchUpcomingEvents).toHaveBeenCalledTimes(2);
    });
  });

  describe('Event data structure', () => {
    it('should return events with all required fields', async () => {
      const mockEvent = {
        id: 'event-full',
        title: 'Full Event',
        description: 'Event with all fields',
        start: Math.floor(Date.now() / 1000) + 86400,
        end: Math.floor(Date.now() / 1000) + 90000,
        location: 'Test Location',
        pubkey: 'pubkey123',
      };

      vi.mocked(fetchUpcomingEvents).mockResolvedValueOnce([mockEvent]);

      const res = await app.request('http://localhost/api/events/upcoming');
      const body = await res.json();

      expect(body.events[0]).toHaveProperty('id');
      expect(body.events[0]).toHaveProperty('title');
      expect(body.events[0]).toHaveProperty('description');
      expect(body.events[0]).toHaveProperty('start');
      expect(body.events[0]).toHaveProperty('end');
      expect(body.events[0]).toHaveProperty('location');
      expect(body.events[0]).toHaveProperty('pubkey');
    });

    it('should handle events with missing optional fields', async () => {
      const mockEvent = {
        id: 'event-minimal',
        title: 'Minimal Event',
        description: '',
        start: Math.floor(Date.now() / 1000) + 86400,
        end: null,
        location: '',
        pubkey: 'pubkey456',
      };

      vi.mocked(fetchUpcomingEvents).mockResolvedValueOnce([mockEvent]);

      const res = await app.request('http://localhost/api/events/upcoming');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.events[0].title).toBe('Minimal Event');
      expect(body.events[0].end).toBeNull();
    });
  });
});
