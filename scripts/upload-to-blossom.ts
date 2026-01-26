import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { decode as decodeNsec } from 'nostr-tools/nip19';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

const GITHUB_GALLERY = 'https://api.github.com/repos/islandbitcoin/islandbitcoin-community/contents/gallery';
const BLOSSOM_UPLOAD_URL = 'https://nostr.build/api/v2/upload/files';

interface GalleryFile {
  name: string;
  download_url: string;
}

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
    blurhash?: string;
    dimensions?: { width: number; height: number };
  }>;
}

async function fetchGalleryFiles(): Promise<GalleryFile[]> {
  const response = await fetch(GITHUB_GALLERY, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'island-bitcoin-uploader'
    }
  });
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  
  const files = await response.json();
  
  return files.filter((f: { type: string; name: string; download_url: string }) => 
    f.type === 'file' &&
    !f.name.includes('README') &&
    /\.(jpe?g|png|gif|webp|mp4|mov|avi)$/i.test(f.name)
  );
}

async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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

async function uploadToBlossom(
  fileBuffer: Buffer, 
  filename: string,
  secretKey: Uint8Array
): Promise<{ url: string; sha256: string }> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer]);
  formData.append('file', blob, filename);
  
  const authHeader = createNIP98AuthHeader(BLOSSOM_UPLOAD_URL, 'POST', secretKey);
  
  const response = await fetch(BLOSSOM_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Authorization': authHeader
    },
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
  return {
    url: uploadedFile.url,
    sha256: uploadedFile.sha256 || computeSha256(fileBuffer)
  };
}

function loadExistingMappings(mappingsPath: string): Map<string, BlossomMapping> {
  try {
    const data = require(mappingsPath);
    const map = new Map<string, BlossomMapping>();
    for (const mapping of data) {
      map.set(mapping.filename, mapping);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function main() {
  const nsec = process.env.NOSTR_BUILD_NSEC;
  if (!nsec) {
    throw new Error('NOSTR_BUILD_NSEC environment variable not set');
  }
  
  let secretKey: Uint8Array;
  try {
    const decoded = decodeNsec(nsec);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec format');
    }
    secretKey = decoded.data;
  } catch (error) {
    throw new Error(`Failed to decode nsec: ${error}`);
  }
  
  const pubkey = getPublicKey(secretKey);
  console.log(`Using pubkey: ${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`);
  
  const mappingsPath = path.join(__dirname, 'blossom-urls.json');
  const existingMappings = loadExistingMappings(mappingsPath);
  console.log(`Found ${existingMappings.size} existing mappings`);
  
  console.log('Fetching gallery files from GitHub...');
  const files = await fetchGalleryFiles();
  console.log(`Found ${files.length} files in gallery`);
  
  const mappings: BlossomMapping[] = Array.from(existingMappings.values());
  let uploaded = 0;
  let skipped = 0;
  
  for (const file of files) {
    if (existingMappings.has(file.name)) {
      console.log(`⏭ Skipping (already uploaded): ${file.name}`);
      skipped++;
      continue;
    }
    
    try {
      console.log(`⬇ Downloading: ${file.name}`);
      const fileBuffer = await downloadFile(file.download_url);
      console.log(`  Size: ${(fileBuffer.length / 1024).toFixed(1)} KB`);
      
      console.log(`⬆ Uploading to Blossom: ${file.name}`);
      const { url, sha256 } = await uploadToBlossom(fileBuffer, file.name, secretKey);
      
      mappings.push({
        filename: file.name,
        originalUrl: file.download_url,
        blossomUrl: url,
        sha256
      });
      
      uploaded++;
      console.log(`✓ Uploaded: ${file.name}`);
      console.log(`  URL: ${url}`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`✗ Failed to upload ${file.name}:`, error);
    }
  }
  
  await fs.writeFile(
    mappingsPath,
    JSON.stringify(mappings, null, 2)
  );
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Upload complete!`);
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Failed:   ${files.length - uploaded - skipped}`);
  console.log(`  Total:    ${mappings.length} files in mapping`);
  console.log(`Mappings saved to: ${mappingsPath}`);
}

main().catch(console.error);
