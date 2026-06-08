import { describe, it, expect } from "vitest";

import { sanitizeTokenInput } from "./auth";

describe("sanitizeTokenInput", () => {
  it("strips an env-key prefix", () => {
    expect(sanitizeTokenInput("SUPPLY_OS_MANAGER_TOKEN=abc123")).toBe("abc123");
  });

  it("strips an env-key prefix AND a LOCATION: prefix", () => {
    expect(sanitizeTokenInput("SUPPLY_OS_CAPTAIN_TOKENS=WOLA:abc")).toBe("abc");
  });

  it("strips a bare LOCATION: prefix", () => {
    expect(sanitizeTokenInput("WOLA:abc123")).toBe("abc123");
  });

  it("trims surrounding whitespace and newlines", () => {
    expect(sanitizeTokenInput("  WOLA:abc123  \n")).toBe("abc123");
  });

  it("strips surrounding quotes", () => {
    expect(sanitizeTokenInput('"WOLA:abc123"')).toBe("abc123");
  });

  it("passes a clean token through unchanged", () => {
    expect(sanitizeTokenInput("abc123")).toBe("abc123");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(sanitizeTokenInput("   ")).toBe("");
  });

  it("does not mistake a colon-less hex token for a LOCATION prefix", () => {
    expect(sanitizeTokenInput("deadbeef00")).toBe("deadbeef00");
  });
});
