# Data Migration Issues

## [2026-01-26] Known Issues

### React Version Incompatibility (RESOLVED)
- **Issue**: TypeError: Cannot read properties of null (reading 'useReducer')
- **Cause**: React 19 incompatibility with @nostrify/react
- **Solution**: Downgraded to React 18.3.1
- **Status**: RESOLVED

### Relay Configuration
- **Current**: DEFAULT_RELAYS in evento.ts does NOT include relay.flashapp.me
- **Impact**: Published NIP-52 events may not be fetched
- **Next Step**: Update DEFAULT_RELAYS to include relay.flashapp.me

## [2026-01-26 17:00] CRITICAL DISCOVERY: Wrong Codebase Deployed

### Issue
The production server at https://beta.community.islandbitcoin.com is running a **completely different codebase** than the monorepo we've been working on.

**Deployed Code:**
- Location: `/opt/stack/community/`
- Structure: Old unified server (single-app architecture)
- Server file: `server/unified-server.js` (JavaScript, not TypeScript)
- No monorepo structure (no `apps/`, `packages/` directories)
- Docker image: `stack-community` (built from `/opt/stack/community/Dockerfile`)

**Our Development Code:**
- Location: Local `island-bitcoin-community/` monorepo
- Structure: Modern monorepo with `apps/api`, `apps/web`, `packages/nostr`, `packages/shared`
- Server files: TypeScript in `apps/api/src/`
- Docker image: `island-bitcoin-api:latest` (built locally, not used by server)

### Impact
- **ALL changes to `apps/api/src/services/evento.ts` are NOT deployed**
- The logging we added is NOT running on the server
- The expanded relay list (11 relays) is NOT active
- The WebSocket polyfill is NOT in use
- NIP-52 event fetching code we modified is NOT executing

### Root Cause
The server's `docker-compose.yml` builds from `/opt/stack/community/` which contains the old codebase:
```yaml
community:
  build:
    context: ./community
    dockerfile: Dockerfile
```

### Next Steps
1. **Determine which codebase is the source of truth:**
   - Is `/opt/stack/community/` the production code we should be modifying?
   - Or should we deploy the monorepo to replace it?

2. **If monorepo is correct:**
   - Deploy monorepo to `/opt/stack/community/`
   - Update docker-compose.yml to use new structure
   - Rebuild and restart containers

3. **If old code is correct:**
   - Abandon monorepo changes
   - Make modifications directly to `/opt/stack/community/server/unified-server.js`
   - Investigate where NIP-52 fetching happens in that codebase

### Files to Investigate
- `/opt/stack/community/server/unified-server.js` - Main server file
- `/opt/stack/community/Dockerfile` - Build configuration
- `/opt/stack/community/package.json` - Dependencies and scripts

## [2026-01-26 18:20] NPool Timeout Root Cause IDENTIFIED

### Diagnostic Logging Results

Successfully deployed logging-enabled API container and captured diagnostic output:

```
[fetchNip52Events] Starting - relays: 11 filter: { kinds: [ 31923 ], limit: 100 }
[fetchNip52Events] Entering message loop...
[fetchNip52Events] Loop exited. Events collected: 0
[fetchNip52Events] Error: DOMException The signal has been aborted
[fetchNip52Events] Events before error: 0
[fetchNip52Events] Completed in 30007 ms. Total events: 0
```

### Root Cause

**NPool async iterator never receives messages from relays.**

Evidence:
- ✅ Function starts correctly
- ✅ Enters the `for await` loop
- ❌ **ZERO "Message received" logs** (should log every msg[0])
- ❌ Loop times out after 30 seconds
- ❌ No EOSE, no EVENT, no messages at all

### Comparison with Working Code

**Working (direct WebSocket):**
```javascript
socket.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  if (msg[0] === "EVENT") {
    console.log("Title:", msg[2].tags.find(t => t[0] === "title")?.[1]);
  }
});
```
Result: 5 events in 2 seconds

**Broken (NPool):**
```typescript
for await (const msg of client.req([filter], { signal: controller.signal })) {
  console.log('[fetchNip52Events] Message received:', msg[0]); // NEVER EXECUTES
}
```
Result: 0 messages, timeout after 30 seconds

### Conclusion

The issue is in the `@nostrify/nostrify` NPool implementation or how we're using it. The `client.req()` async iterator is not yielding any messages, even though:
1. Relays are reachable (manual WebSocket works)
2. Events exist on relays (confirmed via manual query)
3. Filter is correct (kind 31923, limit 100)

### Next Steps

**Option A: Replace NPool with direct WebSocket**
- Proven to work (2 seconds, 5 events)
- More control over connection lifecycle
- Simpler debugging

**Option B: Debug NPool configuration**
- Check if reqRouter is returning correct relay map
- Verify NRelay1 is connecting properly
- Add logging inside NPool library

**Option C: Try alternative Nostr library**
- nostr-tools
- NDK
- Other battle-tested options

**Recommendation: Option A** - Replace with direct WebSocket implementation since we've already proven it works.
