import { describe, expect, it } from "vitest";

import { resolveSigner } from "./useOrderEmailSigner";

const MAREK = { name: "Marek Złotopolski", phone: "+48 662 184 258", email: "marek@pitabros.pl" };
const SLAWEK = { name: "Sławomir Glanowski", phone: "+48 692 840 194", email: "slawek@pitabros.pl" };

describe("resolveSigner (twin of gmail_url.resolve_signer)", () => {
  it("matches by e-mail, case-insensitive", () => {
    expect(resolveSigner([MAREK, SLAWEK], "SLAWEK@pitabros.pl")).toBe(SLAWEK);
  });
  it("falls back to the first signer for an unknown or empty choice", () => {
    expect(resolveSigner([MAREK, SLAWEK], "x@y.pl")).toBe(MAREK);
    expect(resolveSigner([MAREK, SLAWEK], null)).toBe(MAREK);
  });
  it("returns null when nothing is configured", () => {
    expect(resolveSigner([], "marek@pitabros.pl")).toBeNull();
    expect(resolveSigner(undefined, null)).toBeNull();
  });
});
