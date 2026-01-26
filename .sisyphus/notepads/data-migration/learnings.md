# Data Migration Learnings

## [2026-01-26] Initial Setup

### Completed Tasks
- Task 1: Server environment variables configured successfully
- Task 2: NIP-52 event publishing script created and executed (3 events published)
- Task 3: Blossom gallery upload script created and executed (14 files uploaded)

### Key Findings
- React version incompatibility fixed: Downgraded from v19 to v18.3.1 for @nostrify/react compatibility
- All environment variables successfully configured on server at `/opt/stack/community/.env.api`
- NIP-52 events published to relays: relay.flashapp.me, relay.damus.io, nostr.oxtr.dev
- Blossom URLs mapping saved to `scripts/blossom-urls.json` with 14 entries

### Conventions
- Use `npx tsx` for running TypeScript scripts
- Always verify environment variables before running migration scripts
- Store Blossom URL mappings in JSON format for easy reference

## Task: Update Events Service to Prioritize NIP-52 (2026-01-26)

**Status**: ✅ COMPLETED

**Changes Made**:
- Updated `apps/api/src/services/evento.ts` DEFAULT_RELAYS array
- Added `wss://relay.flashapp.me` as the FIRST relay (priority)
- Maintained existing relays as fallbacks: relay.damus.io, relay.nostr.band, nos.lol

**Verification**:
- ✅ File modified successfully
- ✅ pnpm build passed (exit code 0)
- ✅ LSP diagnostics: zero errors
- ✅ All existing functionality preserved (caching, error handling, parsing)

**Impact**:
- NIP-52 events published to relay.flashapp.me will now be fetched correctly
- Events from Task 2 (3 NIP-52 events) are now discoverable
- Relay priority: flashapp.me → damus.io → nostr.band → nos.lol

**Technical Notes**:
- No breaking changes
- Cache TTL and error handling remain unchanged
- parseNip52Event function untouched
- Backward compatible with existing relay fallback logic
