// Per-location key for the inventory-count localStorage draft (N19).
//
// The draft used to live under the fixed key "__inventory__", so on a device
// shared by several locations (demo / training / manager phone) a draft from
// one location was offered at another. The SPA does not know the location id:
// it is carried only by the Captain token (one token per location, see
// `auth.ts`), so the key is scoped by a short fingerprint of that token. The
// raw token is never written into a key.

import { clearDraft } from "../../../auth";

/** Fixed key used before N19 (shared by every location on the device). */
export const LEGACY_INVENTORY_DRAFT_KEY = "__inventory__";

/** Short non-reversible fingerprint (djb2) of the Captain token. */
export function captainScope(token: string | null | undefined): string {
  const raw = token ?? "";
  if (raw === "") return "noauth";
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

/** Draft key for the location behind this Captain token. */
export function inventoryDraftKey(token: string | null | undefined): string {
  return `${LEGACY_INVENTORY_DRAFT_KEY}:${captainScope(token)}`;
}

/**
 * One-shot removal of the pre-N19 shared draft. The old format never recorded a
 * location, so it cannot be attributed to one; it is dropped (once, on first
 * load after deploy) rather than offered at the wrong location.
 */
export function removeLegacyInventoryDraft(): void {
  clearDraft(LEGACY_INVENTORY_DRAFT_KEY);
}
