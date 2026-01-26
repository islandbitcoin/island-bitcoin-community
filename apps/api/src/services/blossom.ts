export interface BlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
}

export async function listBlobs(pubkey: string): Promise<BlobDescriptor[]> {
  try {
    const response = await fetch(`https://nostr.build/list/${pubkey}`);
    if (!response.ok) {
      return [];
    }
    const blobs = await response.json();
    // Filter for image types only
    return blobs.filter((b: BlobDescriptor) => b.type?.startsWith('image/'));
  } catch (error) {
    console.error('Blossom fetch error:', error);
    return [];
  }
}
