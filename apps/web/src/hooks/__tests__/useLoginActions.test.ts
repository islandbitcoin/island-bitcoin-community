import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockAddLogin = vi.fn();
const mockRemoveLogin = vi.fn();

vi.mock("@nostrify/react", () => ({
  useNostr: vi.fn(() => ({
    nostr: {},
  })),
}));

vi.mock("@nostrify/react/login", () => ({
  useNostrLogin: vi.fn(() => ({
    logins: [],
    addLogin: mockAddLogin,
    removeLogin: mockRemoveLogin,
  })),
  NLogin: {
    fromNsec: vi.fn((nsec: string) => ({ type: "nsec", id: "test-nsec-id", nsec })),
    fromBunker: vi.fn().mockResolvedValue({ type: "bunker", id: "test-bunker-id" }),
    fromExtension: vi.fn().mockResolvedValue({ type: "extension", id: "test-ext-id" }),
  },
}));

import { useLoginActions } from "../useLoginActions";

describe("useLoginActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be exported from the module", () => {
    expect(useLoginActions).toBeDefined();
    expect(typeof useLoginActions).toBe("function");
  });

  it("should return login action methods", () => {
    const { result } = renderHook(() => useLoginActions());

    expect(result.current).toHaveProperty("nsec");
    expect(result.current).toHaveProperty("bunker");
    expect(result.current).toHaveProperty("extension");
    expect(result.current).toHaveProperty("logout");
  });

  it("should have nsec method that accepts a string", () => {
    const { result } = renderHook(() => useLoginActions());

    expect(typeof result.current.nsec).toBe("function");
  });

  it("should have bunker method that returns a promise", () => {
    const { result } = renderHook(() => useLoginActions());

    expect(typeof result.current.bunker).toBe("function");
  });

  it("should have extension method that returns a promise", () => {
    const { result } = renderHook(() => useLoginActions());

    expect(typeof result.current.extension).toBe("function");
  });

  it("should have logout method that returns a promise", () => {
    const { result } = renderHook(() => useLoginActions());

    expect(typeof result.current.logout).toBe("function");
  });

  it("nsec should call addLogin with login object", () => {
    const { result } = renderHook(() => useLoginActions());

    act(() => {
      result.current.nsec("nsec1test");
    });

    expect(mockAddLogin).toHaveBeenCalledWith(
      expect.objectContaining({ type: "nsec" })
    );
  });

  it("extension should call addLogin after resolving", async () => {
    const { result } = renderHook(() => useLoginActions());

    await act(async () => {
      await result.current.extension();
    });

    expect(mockAddLogin).toHaveBeenCalledWith(
      expect.objectContaining({ type: "extension" })
    );
  });

  it("bunker should call addLogin after resolving", async () => {
    const { result } = renderHook(() => useLoginActions());

    await act(async () => {
      await result.current.bunker("bunker://pubkey?relay=wss://relay.example.com");
    });

    expect(mockAddLogin).toHaveBeenCalledWith(
      expect.objectContaining({ type: "bunker" })
    );
  });
});
