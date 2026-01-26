import blossomUrls from '../../../../scripts/blossom-urls.json';

export interface BlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
}

interface BlossomUrlEntry {
  filename: string;
  originalUrl: string;
  blossomUrl: string;
  sha256: string;
}

export async function listBlobs(): Promise<BlobDescriptor[]> {
  try {
    // Transform the hardcoded mapping to BlobDescriptor format
    const blobs: BlobDescriptor[] = (blossomUrls as BlossomUrlEntry[]).map((entry) => ({
      url: entry.blossomUrl,
      sha256: entry.sha256,
      size: 0, // Not available from mapping
      type: entry.filename.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg',
      uploaded: Date.now() / 1000, // Current timestamp
    }));

    // Filter for image types only (exclude videos)
    return blobs.filter((b: BlobDescriptor) => b.type?.startsWith('image/'));
  } catch (error) {
    console.error('Blossom mapping error:', error);
    return [];
  }
}
