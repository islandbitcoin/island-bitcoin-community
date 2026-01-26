import { Hono } from 'hono';
import { listBlobs } from '../services/blossom';

export const galleryRoute = new Hono();

const DEFAULT_PUBKEY = '1d7e6e78c2e7d8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e';

galleryRoute.get('/', async (c) => {
  const pubkey = c.req.query('pubkey') || DEFAULT_PUBKEY;
  const blobs = await listBlobs(pubkey);
  
  const images = blobs.map(b => ({
    url: b.url,
    type: b.type,
    uploaded: b.uploaded,
  }));
  
  return c.json(images);
});
