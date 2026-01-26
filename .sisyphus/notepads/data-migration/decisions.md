# Data Migration Decisions

## [2026-01-26] Architecture Decisions

### Dual Site Strategy
- **Decision**: Keep both old and new sites running separately
- **Rationale**: Allows gradual migration and testing without disrupting existing users
- **Implementation**: New site on subdomain `beta.community.islandbitcoin.com`

### Data Storage
- **Events**: NIP-52 (kind 31923) on Nostr relays
- **Gallery**: Blossom server via nostr.build
- **Rationale**: Decentralized, censorship-resistant, aligns with Bitcoin/Nostr ethos

### Relay Selection
- Primary: relay.flashapp.me (Flash's relay)
- Fallback: relay.damus.io, nostr.oxtr.dev
- **Rationale**: Flash's relay for community events, public relays for redundancy
