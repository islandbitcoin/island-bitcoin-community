import "@testing-library/react";

// Mock window.nostr for NIP-07 extension tests
Object.defineProperty(window, "nostr", {
  value: undefined,
  writable: true,
  configurable: true,
});
