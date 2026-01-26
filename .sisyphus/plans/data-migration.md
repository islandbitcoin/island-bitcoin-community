# Island Bitcoin New Site Data Migration Plan

## Context

### Original Request
Migrate the new Island Bitcoin Community webapp to use real data:
1. Publish NIP-52 calendar events from GitHub event files
2. Upload gallery images to Blossom via nostr.build
3. Configure environment with API tokens
4. Set up new subdomain: beta.community.islandbitcoin.com

### Interview Summary
**Key Decisions:**
- Keep both sites running (Option B)
- New site subdomain: `beta.community.islandbitcoin.com`
- Events: Publish to Nostr as NIP-52 (kind 31923)
- Gallery: Upload to Blossom via nostr.build API
- Use Flash npub's private key for signing

**Research Findings:**
- Old site fetches events from GitHub: `islandbitcoin/islandbitcoin-community/events/*.json`
- Old site fetches gallery from GitHub: `islandbitcoin/islandbitcoin-community/gallery/*`
- 3 event files found (Kingston meetup, Pizza Day, Trezor workshop)
- 15 gallery files found (13 images, 2 videos)

### Available Credentials
From `/Users/dread/Documents/Island-Bitcoin/Island Bitcoin/community-webapp/.env`:
- `NOSTR_BUILD_NSEC`: Flash's private key for NIP-52 signing
- `FLASH_AUTH_TOKEN`: ory_st_wgXYG2FsiBm24ij6sIMdxW5Ci5obgJwm
- `FLASH_API_URL`: https://api.flashapp.me/graphql
- `NOSTR_RELAYS`: wss://relay.flashapp.me,wss://relay.damus.io,wss://nostr.oxtr.dev
- `SENDGRID_API_KEY`: For email notifications
- `GEMINI_API_KEY` / `OPENAI_API_KEY`: For AI features

---

## Work Objectives

### Core Objective
Migrate event and gallery data from GitHub to decentralized protocols (NIP-52 for events, Blossom for images) and configure the new site to use them.

### Concrete Deliverables
1. NIP-52 calendar events published to Nostr relays
2. Gallery images uploaded to Blossom
3. New site configured with all API tokens
4. Subdomain beta.community.islandbitcoin.com routing to new site

### Definition of Done
- [ ] `curl https://beta.community.islandbitcoin.com` returns the new site
- [ ] Events page shows migrated events from NIP-52
- [ ] Gallery page shows images from Blossom
- [ ] Flash API payments configured
- [ ] All 3 GitHub events appear on new site
- [ ] All 13 gallery images appear on new site

### Must Have
- NIP-52 events with correct format (kind 31923)
- Blossom URLs for all gallery images
- Working Flash API integration
- HTTPS on new subdomain

### Must NOT Have (Guardrails)
- Do NOT delete or modify old site
- Do NOT expose private keys in code or logs
- Do NOT hardcode credentials (use environment variables)
- Do NOT skip event validation before publishing

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (API has test framework)
- **User wants tests**: Manual verification for this migration
- **QA approach**: Playwright browser verification + API curl tests

### Manual QA Procedures
Each task includes specific verification commands and expected outputs.

---

## Task Flow

```
1. Server Env Config
       ↓
2. NIP-52 Publishing Script ──→ 3. Blossom Upload Script
       ↓                              ↓
4. Update Event Service ←───── 5. Update Gallery Service
       ↓
6. Subdomain Setup
       ↓
7. Final Verification
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 2, 3 | Independent migration scripts |
| B | 4, 5 | Independent service updates |

| Task | Depends On | Reason |
|------|------------|--------|
| 2 | 1 | Needs NOSTR_BUILD_NSEC from env |
| 3 | 1 | Needs credentials for Blossom |
| 4 | 2 | Needs NIP-52 events published |
| 5 | 3 | Needs Blossom URLs |
| 6 | 4, 5 | Site must be fully functional |
| 7 | 6 | Needs subdomain configured |

---

## TODOs

- [x] 1. Configure Server Environment Variables

  **What to do**:
  - SSH to server and update `/opt/stack/community/.env.api` with all tokens
  - Add: NOSTR_BUILD_NSEC, FLASH_AUTH_TOKEN (as ORY_TOKEN), FLASH_API_URL, NOSTR_RELAYS
  - Add: SENDGRID_API_KEY, GEMINI_API_KEY (if needed for AI features)
  - Restart containers to pick up new env vars

  **Must NOT do**:
  - Do NOT commit credentials to git
  - Do NOT log private keys

  **Parallelizable**: NO (foundation for other tasks)

  **References**:
  - Source: `/Users/dread/Documents/Island-Bitcoin/Island Bitcoin/community-webapp/.env` (line 58-69)
  - Target: `/opt/stack/community/.env.api` on server

  **Acceptance Criteria**:
  - [ ] SSH to server: `ssh -i ~/.ssh/id_ed25519 root@206.189.139.60`
  - [ ] Verify env vars: `docker exec island-bitcoin-api env | grep -E "ORY_TOKEN|NOSTR"` shows values
  - [ ] API health: `curl http://206.189.139.60:3001/health` returns `{"status":"ok"}`

  **Commit**: NO (server-side config only)

---

- [x] 2. Create and Run NIP-52 Event Publishing Script

  **What to do**:
  - Create script `scripts/publish-nip52-events.ts` in the monorepo
  - Fetch event JSON files from GitHub API
  - Transform Evento.so format to NIP-52 format (kind 31923)
  - Sign events with NOSTR_BUILD_NSEC
  - Publish to configured relays
  - Run script to publish all 3 events

  **Must NOT do**:
  - Do NOT publish duplicate events (check if already exists)
  - Do NOT publish draft/cancelled events
  - Do NOT include private key in script (read from env)

  **Parallelizable**: YES (with task 3)

  **References**:
  - Event format: `https://raw.githubusercontent.com/islandbitcoin/islandbitcoin-community/main/events/kingston-bitcoin-meetup.json`
  - NIP-52 spec: https://github.com/nostr-protocol/nips/blob/master/52.md
  - Existing NIP-52 parser: `apps/api/src/services/evento.ts:50-80` (parseNip52Event function)
  - Nostr client: `packages/nostr/src/client.ts`

  **NIP-52 Event Structure**:
  ```json
  {
    "kind": 31923,
    "content": "<event description>",
    "tags": [
      ["d", "<unique-id>"],
      ["title", "<event title>"],
      ["start", "<unix-timestamp>"],
      ["end", "<unix-timestamp>"],
      ["location", "<location string>"],
      ["g", "<geohash or lat,lon>"]
    ]
  }
  ```

  **Acceptance Criteria**:
  - [ ] Script exists: `ls scripts/publish-nip52-events.ts`
  - [ ] Run script: `npx tsx scripts/publish-nip52-events.ts`
  - [ ] Verify on relay: Query relay for kind 31923 events from Flash pubkey
  - [ ] New site shows events: Navigate to http://206.189.139.60:8081/events

  **Commit**: YES
  - Message: `feat(scripts): add NIP-52 event publishing migration script`
  - Files: `scripts/publish-nip52-events.ts`

---

- [x] 3. Create and Run Blossom Gallery Upload Script

  **What to do**:
  - Create script `scripts/upload-to-blossom.ts` in the monorepo
  - Fetch list of gallery files from GitHub API
  - Download each image/video file
  - Upload to nostr.build Blossom server using NIP-98 auth
  - Record mapping of original filename → Blossom URL
  - Save mapping to `scripts/blossom-urls.json`

  **Must NOT do**:
  - Do NOT re-upload files that already exist on Blossom
  - Do NOT upload README.md or non-media files
  - Do NOT include private key in script

  **Parallelizable**: YES (with task 2)

  **References**:
  - Gallery files: `https://api.github.com/repos/islandbitcoin/islandbitcoin-community/contents/gallery`
  - nostr.build API: https://nostr.build/api/
  - Blossom spec: https://github.com/hzrd149/blossom
  - NIP-98 auth: https://github.com/nostr-protocol/nips/blob/master/98.md

  **nostr.build Upload Process**:
  1. Create NIP-98 auth header (signed event)
  2. POST to `https://nostr.build/api/v2/upload/files`
  3. Response contains Blossom URL

  **Acceptance Criteria**:
  - [ ] Script exists: `ls scripts/upload-to-blossom.ts`
  - [ ] Run script: `npx tsx scripts/upload-to-blossom.ts`
  - [ ] Mapping saved: `cat scripts/blossom-urls.json` shows 13+ entries
  - [ ] URLs work: `curl -I <blossom-url>` returns 200 for each image

  **Commit**: YES
  - Message: `feat(scripts): add Blossom gallery upload migration script`
  - Files: `scripts/upload-to-blossom.ts`, `scripts/blossom-urls.json`

---

- [x] 4. Update Events Service to Prioritize NIP-52

  **What to do**:
  - The events service already fetches from NIP-52 relays
  - Verify it's using the correct relays (from NOSTR_RELAYS env)
  - Update relay list if needed to include relay.flashapp.me
  - Test that published events appear

  **Must NOT do**:
  - Do NOT remove fallback to empty array on error
  - Do NOT hardcode relay URLs

  **Parallelizable**: YES (with task 5)

  **References**:
  - Events service: `apps/api/src/services/evento.ts`
  - Events route: `apps/api/src/routes/events.ts`
  - Default relays: `apps/api/src/services/evento.ts:13-17`

  **Acceptance Criteria**:
  - [ ] Check relay config: grep for DEFAULT_RELAYS in evento.ts
  - [ ] Rebuild if changed: `pnpm build`
  - [ ] Test API: `curl http://206.189.139.60:3001/api/events` returns events array
  - [ ] Events have data: Response includes Kingston meetup event

  **Commit**: YES (if changes needed)
  - Message: `fix(api): update NIP-52 relay list to include flashapp relay`
  - Files: `apps/api/src/services/evento.ts`

---

- [x] 5. Update Gallery Service for Blossom

  **What to do**:
  - Check current gallery service implementation
  - Update to fetch from Blossom URLs instead of GitHub
  - Option A: Hardcode Blossom URLs from migration
  - Option B: Query Blossom server for files by pubkey
  - Rebuild and deploy

  **Must NOT do**:
  - Do NOT break existing gallery endpoint
  - Do NOT remove error handling

  **Parallelizable**: YES (with task 4)

  **References**:
  - Gallery route: `apps/api/src/routes/gallery.ts`
  - Blossom service: `apps/api/src/services/blossom.ts`
  - Blossom URLs mapping: `scripts/blossom-urls.json` (from task 3)

  **Acceptance Criteria**:
  - [ ] Check implementation: `cat apps/api/src/services/blossom.ts`
  - [ ] Update service to use Blossom URLs
  - [ ] Rebuild: `pnpm build`
  - [ ] Test API: `curl http://206.189.139.60:3001/api/gallery` returns images
  - [ ] Images load: Open gallery page, images display

  **Commit**: YES
  - Message: `feat(api): update gallery service to fetch from Blossom`
  - Files: `apps/api/src/services/blossom.ts`, `apps/api/src/routes/gallery.ts`

---

- [ ] 6. Configure Subdomain and Reverse Proxy

  **What to do**:
  - User configures DNS: `beta.community.islandbitcoin.com` → 206.189.139.60
  - Update Caddy config to route subdomain to port 8081
  - Enable HTTPS via Caddy's automatic TLS
  - Test subdomain works

  **Must NOT do**:
  - Do NOT break existing community.islandbitcoin.com routing
  - Do NOT disable HTTPS

  **Parallelizable**: NO (requires tasks 4, 5 complete)

  **References**:
  - Caddy container: `caddy` on server
  - Caddy config location: `/opt/stack/caddy/Caddyfile` (verify path)
  - Current routing: community.islandbitcoin.com → old site

  **Caddyfile Addition**:
  ```
  beta.community.islandbitcoin.com {
      reverse_proxy localhost:8081
  }
  ```

  **Acceptance Criteria**:
  - [ ] DNS configured (user action): `dig beta.community.islandbitcoin.com` shows 206.189.139.60
  - [ ] Caddy updated: Config includes beta.community routing
  - [ ] Caddy reloaded: `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`
  - [ ] HTTPS works: `curl -I https://beta.community.islandbitcoin.com` returns 200
  - [ ] Site loads: Open in browser, see new site

  **Commit**: NO (server-side config)

---

- [ ] 7. Final Verification with Playwright

  **What to do**:
  - Run comprehensive Playwright test on https://beta.community.islandbitcoin.com
  - Verify all pages load
  - Verify events appear with real data
  - Verify gallery shows Blossom images
  - Take screenshots for documentation

  **Must NOT do**:
  - Do NOT skip any page
  - Do NOT ignore console errors

  **Parallelizable**: NO (final verification)

  **References**:
  - Playwright skill: Use browser automation tools
  - Previous test results: Task output from earlier session

  **Acceptance Criteria**:
  - [ ] Homepage loads with events and gallery sections populated
  - [ ] Events page shows Kingston Bitcoin Meetup and other events
  - [ ] Gallery page shows all 13 migrated images
  - [ ] No console errors (except expected Nostr relay warnings)
  - [ ] All routes return 200 OK
  - [ ] Screenshots captured for documentation

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 2 | `feat(scripts): add NIP-52 event publishing migration script` | scripts/publish-nip52-events.ts | Events appear on relay |
| 3 | `feat(scripts): add Blossom gallery upload migration script` | scripts/*.ts, scripts/blossom-urls.json | URLs accessible |
| 4 | `fix(api): update NIP-52 relay list` | apps/api/src/services/evento.ts | API returns events |
| 5 | `feat(api): update gallery service for Blossom` | apps/api/src/services/blossom.ts | API returns images |

---

## Success Criteria

### Verification Commands
```bash
# Events API
curl https://beta.community.islandbitcoin.com/api/events
# Expected: JSON array with Kingston meetup event

# Gallery API  
curl https://beta.community.islandbitcoin.com/api/gallery
# Expected: JSON array with Blossom image URLs

# Health check
curl https://beta.community.islandbitcoin.com/api/health
# Expected: {"status":"ok"}

# Homepage
curl -I https://beta.community.islandbitcoin.com
# Expected: HTTP/2 200
```

### Final Checklist
- [ ] All 3 GitHub events published as NIP-52
- [ ] All 13 gallery images uploaded to Blossom
- [ ] Events page shows real events
- [ ] Gallery page shows real images
- [ ] Flash API configured (ORY_TOKEN set)
- [ ] HTTPS working on beta.community.islandbitcoin.com
- [ ] No critical console errors
- [ ] Old site at community.islandbitcoin.com unchanged
