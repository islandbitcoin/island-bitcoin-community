import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { galleryRoute } from './gallery';

describe('Gallery API Endpoints', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/gallery', galleryRoute);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/gallery', () => {
    it('should return images from Blossom', async () => {
      const mockBlobs = [
        {
          url: 'https://nostr.build/i/abc123.jpg',
          sha256: 'hash1',
          size: 123456,
          type: 'image/jpeg',
          uploaded: 1234567890,
        },
        {
          url: 'https://nostr.build/i/def456.png',
          sha256: 'hash2',
          size: 234567,
          type: 'image/png',
          uploaded: 1234567891,
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockBlobs,
      });

      const res = await app.request('http://localhost/api/gallery');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(2);
      expect(body[0]).toEqual({
        url: 'https://nostr.build/i/abc123.jpg',
        type: 'image/jpeg',
        uploaded: 1234567890,
      });
      expect(body[1]).toEqual({
        url: 'https://nostr.build/i/def456.png',
        type: 'image/png',
        uploaded: 1234567891,
      });
    });

    it('should handle server unavailable gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const res = await app.request('http://localhost/api/gallery');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual([]);
    });

    it('should filter for image types only', async () => {
      const mockBlobs = [
        {
          url: 'https://nostr.build/i/abc123.jpg',
          sha256: 'hash1',
          size: 123456,
          type: 'image/jpeg',
          uploaded: 1234567890,
        },
        {
          url: 'https://nostr.build/i/video.mp4',
          sha256: 'hash2',
          size: 234567,
          type: 'video/mp4',
          uploaded: 1234567891,
        },
        {
          url: 'https://nostr.build/i/doc.pdf',
          sha256: 'hash3',
          size: 345678,
          type: 'application/pdf',
          uploaded: 1234567892,
        },
        {
          url: 'https://nostr.build/i/image.webp',
          sha256: 'hash4',
          size: 456789,
          type: 'image/webp',
          uploaded: 1234567893,
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockBlobs,
      });

      const res = await app.request('http://localhost/api/gallery');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(2);
      expect(body[0].type).toBe('image/jpeg');
      expect(body[1].type).toBe('image/webp');
    });

    it('should accept pubkey query parameter', async () => {
      const testPubkey = 'test_pubkey_123';
      const mockBlobs = [
        {
          url: 'https://nostr.build/i/test.jpg',
          sha256: 'hash1',
          size: 123456,
          type: 'image/jpeg',
          uploaded: 1234567890,
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockBlobs,
      });

      const res = await app.request(`http://localhost/api/gallery?pubkey=${testPubkey}`);
      expect(res.status).toBe(200);

      expect(global.fetch).toHaveBeenCalledWith(`https://nostr.build/list/${testPubkey}`);
    });

    it('should return empty array on fetch error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const res = await app.request('http://localhost/api/gallery');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual([]);
    });

    it('should return proper image URLs', async () => {
      const mockBlobs = [
        {
          url: 'https://nostr.build/i/abc123.jpg',
          sha256: 'hash1',
          size: 123456,
          type: 'image/jpeg',
          uploaded: 1234567890,
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockBlobs,
      });

      const res = await app.request('http://localhost/api/gallery');
      const body = await res.json();

      expect(body[0].url).toMatch(/^https:\/\/nostr\.build\/i\//);
    });

    it('should not require authentication', async () => {
      const mockBlobs = [
        {
          url: 'https://nostr.build/i/abc123.jpg',
          sha256: 'hash1',
          size: 123456,
          type: 'image/jpeg',
          uploaded: 1234567890,
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockBlobs,
      });

      const res = await app.request('http://localhost/api/gallery', {
        headers: {},
      });

      expect(res.status).toBe(200);
    });
  });
});
