// Which manager signs the supplier order e-mail (order-email-v2). The signer
// list is operator config (`_meta.order_email_signers`, served on the order
// detail); the choice is a per-browser preference remembered in localStorage —
// not an identity (the Manager token is shared).

import { useCallback, useState } from "react";

import type { OrderEmailSigner } from "../../../types";

export const SIGNER_STORAGE_KEY = "supply_os_order_email_signer";

function readStored(): string | null {
  try {
    return localStorage.getItem(SIGNER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(email: string): void {
  try {
    localStorage.setItem(SIGNER_STORAGE_KEY, email);
  } catch {
    // private mode / blocked storage — the choice just isn't remembered
  }
}

/**
 * The signer whose e-mail matches `email` (case-insensitive); the first one
 * when `email` is empty or no longer configured; null when none is configured.
 * Twin of the backend `gmail_url.resolve_signer`.
 */
export function resolveSigner(
  signers: OrderEmailSigner[] | undefined,
  email: string | null | undefined,
): OrderEmailSigner | null {
  if (!signers || signers.length === 0) return null;
  const wanted = (email ?? "").trim().toLowerCase();
  if (wanted) {
    const hit = signers.find((s) => (s.email ?? "").trim().toLowerCase() === wanted);
    if (hit) return hit;
  }
  return signers[0];
}

export function useOrderEmailSigner(signers: OrderEmailSigner[] | undefined): {
  signer: OrderEmailSigner | null;
  setSignerEmail: (email: string) => OrderEmailSigner | null;
} {
  const [stored, setStored] = useState<string | null>(() => readStored());
  const signer = resolveSigner(signers, stored);
  const setSignerEmail = useCallback(
    (email: string): OrderEmailSigner | null => {
      writeStored(email);
      setStored(email);
      return resolveSigner(signers, email);
    },
    [signers],
  );
  return { signer, setSignerEmail };
}
