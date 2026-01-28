import "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock window.nostr for NIP-07 extension tests
Object.defineProperty(window, "nostr", {
  value: undefined,
  writable: true,
  configurable: true,
});
