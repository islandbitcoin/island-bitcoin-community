import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { decode as decodeNsec } from 'nostr-tools/nip19';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

const BLOSSOM_UPLOAD_URL = 'https://nostr.build/api/v2/upload/files';

interface BlossomMapping {
  filename: string;
  originalUrl: string;
  blossomUrl: string;
  sha256: string;
}

interface BlossomResponse {
  status: string;
  data: Array<{
    url: string;
    sha256?: string;
  }>;
}

function computeSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function createNIP98AuthHeader(url: string, method: string, secretKey: Uint8Array): string {
  const authEvent = {
    kind: 27235,
    content: '',
    tags: [
      ['u', url],
      ['method', method]
    ],
    created_at: Math.floor(Date.now() / 1000)
  };
  const signedEvent = finalizeEvent(authEvent, secretKey);
  return `Nostr ${Buffer.from(JSON.stringify(signedEvent)).toString('base64')}`;
}

async function uploadToBlossom(fileBuffer: Buffer, filename: string, secretKey: Uint8Array): Promise<{ url: string; sha256: string }> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer]);
  formData.append('file', blob, filename);
  const authHeader = createNIP98AuthHeader(BLOSSOM_UPLOAD_URL, 'POST', secretKey);
  const response = await fetch(BLOSSOM_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Authorization': authHeader },
    body: formData
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  const result = await response.json() as BlossomResponse;
  if (result.status !== 'success' || !result.data || result.data.length === 0) {
    throw new Error(`Upload response invalid: ${JSON.stringify(result)}`);
  }
  const uploadedFile = result.data[0];
  return { url: uploadedFile.url, sha256: uploadedFile.sha256 || computeSha256(fileBuffer) };
}

async function main() {
  const nsec = process.env.NOSTR_BUILD_NSEC;
  if (!nsec) throw new Error('NOSTR_BUILD_NSEC environment variable not set');
  let secretKey: Uint8Array;
  try {
    const decoded = decodeNsec(nsec);
    if (decoded.type !== 'nsec') throw new Error('Invalid nsec format');
    secretKey = decoded.data;
  } catch (error) {
    throw new Error(`Failed to decode nsec: ${error}`);
  }
  const pubkey = getPublicKey(secretKey);
  console.log(`Using pubkey: ${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`);

  const mappingsPath = path.join(__dirname, 'blossom-urls.json');
  let existingMappings: BlossomMapping[];
  try {
    const data = await fs.readFile(mappingsPath, 'utf-8');
    existingMappings = JSON.parse(data);
  } catch { existingMappings = []; }
  const existingNames = new Set(existingMappings.map(m => m.filename));
  console.log(`Found ${existingMappings.length} existing mappings`);

  const galleryDir = path.join(__dirname, '..', 'gallery');
  const allFiles = await fs.readdir(galleryDir);
  const meetupFiles = allFiles.filter(f => f.startsWith('Meetup Jan 2026') && f.endsWith('.jpeg')).sort();
  console.log(`Found ${meetupFiles.length} meetup files to upload`);

  const mappings: BlossomMapping[] = [...existingMappings];
  let uploaded = 0, skipped = 0;

  for (const filename of meetupFiles) {
    if (existingNames.has(filename)) {
      console.log(`Skip: ${filename}`);
      skipped++;
      continue;
    }
    try {
      const filePath = path.join(galleryDir, filename);
      const fileBuffer = await fs.readFile(filePath);
      console.log(`Uploading: ${filename} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
      const { url, sha256 } = await uploadToBlossom(fileBuffer, filename, secretKey);
      mappings.push({
        filename,
        originalUrl: `https://raw.githubusercontent.com/islandbitcoin/islandbitcoin-community/main/gallery/${encodeURIComponent(filename)}`,
        blossomUrl: url,
        sha256
      });
      uploaded++;
      console.log(`Done: ${filename} -> ${url}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed: ${filename}:`, error);
    }
  }

  await fs.writeFile(mappingsPath, JSON.stringify(mappings, null, 2));
  console.log(`\nComplete! Uploaded: ${uploaded}, Skipped: ${skipped}, Total: ${mappings.length}`);
}

main().catch(console.error);
