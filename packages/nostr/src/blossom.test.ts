import { describe, it, expect, beforeEach, vi } from "vitest";
import { nip24242Auth } from "./blossom";

describe("blossom", () => {
  describe("nip24242Auth", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    });

    it("creates upload auth event", () => {
      const event = nip24242Auth({
        pubkey: "test-pubkey",
        method: "upload",
        sha256: "test-sha256",
      });

      expect(event.kind).toBe(24242);
      expect(event.pubkey).toBe("test-pubkey");
      expect(event.tags).toContainEqual(["t", "upload"]);
      expect(event.tags).toContainEqual(["x", "test-sha256"]);
      expect(event.tags.some((tag) => tag[0] === "expiration")).toBe(true);
    });

    it("creates list auth event without sha256", () => {
      const event = nip24242Auth({
        pubkey: "test-pubkey",
        method: "list",
      });

      expect(event.kind).toBe(24242);
      expect(event.tags).toContainEqual(["t", "list"]);
      expect(event.tags.some((tag) => tag[0] === "x")).toBe(false);
    });

    it("creates delete auth event", () => {
      const event = nip24242Auth({
        pubkey: "test-pubkey",
        method: "delete",
        sha256: "test-sha256",
      });

      expect(event.kind).toBe(24242);
      expect(event.tags).toContainEqual(["t", "delete"]);
      expect(event.tags).toContainEqual(["x", "test-sha256"]);
    });

    it("uses custom expiration seconds", () => {
      const now = Math.floor(Date.now() / 1000);
      const event = nip24242Auth({
        pubkey: "test-pubkey",
        method: "upload",
        expirationSeconds: 3600,
      });

      const expirationTag = event.tags.find((tag) => tag[0] === "expiration");
      expect(expirationTag).toBeDefined();
      expect(Number(expirationTag![1])).toBe(now + 3600);
    });

    it("uses custom content", () => {
      const event = nip24242Auth({
        pubkey: "test-pubkey",
        method: "upload",
        content: "Custom upload message",
      });

      expect(event.content).toBe("Custom upload message");
    });

    it("generates default content based on method", () => {
      const uploadEvent = nip24242Auth({
        pubkey: "test-pubkey",
        method: "upload",
      });

      expect(uploadEvent.content).toBe("Upload request");

      const listEvent = nip24242Auth({
        pubkey: "test-pubkey",
        method: "list",
      });

      expect(listEvent.content).toBe("List request");
    });
  });
});
