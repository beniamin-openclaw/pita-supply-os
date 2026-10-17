// N19: the inventory draft is scoped per location (Captain token), so a draft
// saved at one location is never offered at another on a shared device.

import { describe, expect, it, beforeEach, vi } from "vitest";

import { clearDraft, loadDraft, saveDraft } from "../../../auth";
import {
  captainScope,
  inventoryDraftKey,
  LEGACY_INVENTORY_DRAFT_KEY,
  migrateLegacyInventoryDraft,
} from "./inventoryDraft";

let store: Map<string, string>;

beforeEach(() => {
  store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

const STATE = { lines: { P1: { current_stock_qty_base: 3 } }, timestamp: 1 };

describe("inventoryDraftKey", () => {
  it("differs per token and is stable for the same token", () => {
    expect(inventoryDraftKey("tok-wola")).toBe(inventoryDraftKey("tok-wola"));
    expect(inventoryDraftKey("tok-wola")).not.toBe(inventoryDraftKey("tok-bracka"));
  });

  it("never contains the raw token and has a fixed scope without auth", () => {
    expect(inventoryDraftKey("tok-wola")).not.toContain("tok-wola");
    expect(captainScope("")).toBe("noauth");
    expect(captainScope(null)).toBe("noauth");
  });
});

describe("per-location draft isolation", () => {
  it("round-trips at the same location", () => {
    const key = inventoryDraftKey("tok-wola");
    saveDraft(key, STATE);
    expect(loadDraft<typeof STATE>(inventoryDraftKey("tok-wola"))?.state).toEqual(STATE);
  });

  it("a draft saved at location A is not loaded at location B", () => {
    saveDraft(inventoryDraftKey("tok-wola"), STATE);
    expect(loadDraft(inventoryDraftKey("tok-bracka"))).toBeNull();
  });

  it("clearing one location leaves the other untouched", () => {
    saveDraft(inventoryDraftKey("tok-wola"), STATE);
    saveDraft(inventoryDraftKey("tok-bracka"), STATE);
    clearDraft(inventoryDraftKey("tok-wola"));
    expect(loadDraft(inventoryDraftKey("tok-wola"))).toBeNull();
    expect(loadDraft(inventoryDraftKey("tok-bracka"))).not.toBeNull();
  });
});

describe("migrateLegacyInventoryDraft", () => {
  it("drops an unattributed legacy draft without loading it anywhere", () => {
    saveDraft(LEGACY_INVENTORY_DRAFT_KEY, STATE);
    migrateLegacyInventoryDraft("tok-wola");
    expect(loadDraft(LEGACY_INVENTORY_DRAFT_KEY)).toBeNull();
    expect(loadDraft(inventoryDraftKey("tok-wola"))).toBeNull();
  });

  it("moves a legacy draft that records a matching location to the new key once", () => {
    saveDraft(LEGACY_INVENTORY_DRAFT_KEY, { ...STATE, scope: captainScope("tok-wola") });
    migrateLegacyInventoryDraft("tok-wola");
    expect(loadDraft(LEGACY_INVENTORY_DRAFT_KEY)).toBeNull();
    expect(loadDraft<typeof STATE>(inventoryDraftKey("tok-wola"))?.state.lines).toEqual(
      STATE.lines,
    );
  });

  it("drops a legacy draft recorded for a different location", () => {
    saveDraft(LEGACY_INVENTORY_DRAFT_KEY, { ...STATE, scope: captainScope("tok-bracka") });
    migrateLegacyInventoryDraft("tok-wola");
    expect(loadDraft(LEGACY_INVENTORY_DRAFT_KEY)).toBeNull();
    expect(loadDraft(inventoryDraftKey("tok-wola"))).toBeNull();
  });

  it("does not overwrite an existing new-key draft", () => {
    const key = inventoryDraftKey("tok-wola");
    saveDraft(key, { ...STATE, timestamp: 99 });
    saveDraft(LEGACY_INVENTORY_DRAFT_KEY, { ...STATE, scope: captainScope("tok-wola") });
    migrateLegacyInventoryDraft("tok-wola");
    expect(loadDraft<typeof STATE>(key)?.state.timestamp).toBe(99);
  });

  it("is a no-op when there is no legacy draft", () => {
    migrateLegacyInventoryDraft("tok-wola");
    expect(store.size).toBe(0);
  });
});
