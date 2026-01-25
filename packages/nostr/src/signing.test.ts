import { describe, it, expect } from "vitest";
import { signEvent, verifyEvent } from "./signing";
import type { Event } from "nostr-tools";

describe("signing", () => {
  describe("verifyEvent", () => {
    it("returns false for invalid event", () => {
      const invalidEvent: Event = {
        id: "invalid",
        pubkey: "invalid",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "test",
        sig: "invalid",
      };

      expect(verifyEvent(invalidEvent)).toBe(false);
    });

    it("returns false for event with missing signature", () => {
      const eventWithoutSig: Event = {
        id: "test",
        pubkey: "test",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "test",
        sig: "",
      };

      expect(verifyEvent(eventWithoutSig)).toBe(false);
    });
  });

  describe("signEvent", () => {
    it("calls signer.sign with event", async () => {
      const event: Event = {
        id: "test",
        pubkey: "test",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "test",
        sig: "",
      };

      const mockSigner = {
        sign: async () => "test-signature",
      };

      const result = await signEvent(event, mockSigner);
      expect(result).toBe("test-signature");
    });
  });
});
