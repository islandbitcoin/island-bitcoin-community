import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "../useTheme";

describe("useTheme", () => {
  const originalLocalStorage = window.localStorage;
  let mockStorage: Record<string, string> = {};

  const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" ? false : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  beforeEach(() => {
    mockStorage = {};
    
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: vi.fn(() => {
          mockStorage = {};
        }),
      },
      writable: true,
    });

    Object.defineProperty(window, "matchMedia", {
      value: mockMatchMedia,
      writable: true,
    });

    document.documentElement.classList.remove("dark", "light");
  });

  afterEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: originalLocalStorage,
      writable: true,
    });
  });

  it("should return default theme as system", () => {
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.theme).toBe("system");
  });

  it("should persist theme to localStorage", () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme("dark");
    });

    expect(localStorage.setItem).toHaveBeenCalledWith("theme", "dark");
  });

  it("should load theme from localStorage", () => {
    mockStorage["theme"] = "dark";
    
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.theme).toBe("dark");
  });

  it("should toggle between light and dark", () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme("light");
    });
    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.setTheme("dark");
    });
    expect(result.current.theme).toBe("dark");
  });

  it("should apply dark class to document when dark theme", () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme("dark");
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("should remove dark class when light theme", () => {
    document.documentElement.classList.add("dark");
    
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme("light");
    });

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
