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
