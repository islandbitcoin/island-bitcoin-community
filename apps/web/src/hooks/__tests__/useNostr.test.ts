import { describe, it, expect } from "vitest";
import { useNostr } from "../useNostr";

describe("useNostr", () => {
  it("should be exported from the module", () => {
    expect(useNostr).toBeDefined();
    expect(typeof useNostr).toBe("function");
  });

  it("should re-export useNostr from @nostrify/react", async () => {
    const nostrifyReact = await import("@nostrify/react");
    expect(useNostr).toBe(nostrifyReact.useNostr);
  });
});
