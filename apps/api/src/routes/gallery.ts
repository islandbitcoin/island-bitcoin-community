import { Hono } from 'hono';
import { listBlobs } from '../services/blossom';

export const galleryRoute = new Hono();

galleryRoute.get('/', async (c) => {
  const blobs = await listBlobs();

  const images = blobs.map(b => ({
    url: b.url,
    type: b.type,
    uploaded: b.uploaded,
  }));

  return c.json(images);
});
