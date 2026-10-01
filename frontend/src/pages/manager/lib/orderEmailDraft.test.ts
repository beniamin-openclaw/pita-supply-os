import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRINGS, interpolateTemplate } from "../../../i18n";
import type { StringKey } from "../../../i18n/strings";

vi.mock("./gmailDraft", async (importOriginal) => {
  const real = await importOriginal<typeof import("./gmailDraft")>();
  return {
    ...real,
    requestGmailAccessToken: vi.fn(async () => "tok"),
    getGmailProfileEmail: vi.fn(async () => "biuro@pitabros.pl"),
    createGmailDraft: vi.fn(async () => ({ id: "r-1" })),
    getGmailDraftFrom: vi.fn(async () => '"Pita Bros Bracka" <bracka@pitabros.pl>'),
    deleteGmailDraft: vi.fn(async () => undefined),
    clearGmailTokenCache: vi.fn(),
    rememberGmailToken: vi.fn(),
  };
});

import * as gmail from "./gmailDraft";
import {
  addressFromHeader,
  createVerifiedOrderDraft,
  describeDraftError,
  SenderRewrittenError,
  WrongMailboxError,
} from "./orderEmailDraft";

const t = (key: StringKey, vars?: Record<string, string | number>): string =>
  interpolateTemplate(STRINGS[key].pl, vars);

const args = {
  clientId: "client",
  mailbox: "biuro@pitabros.pl",
  from: { name: "Pita Bros Bracka", email: "bracka@pitabros.pl" },
  to: "biuro@bukat.com",
  cc: "pitabrosbracka@gmail.com",
  subject: "Zamówienie Pita Bros Bracka",
  body: "Dzień dobry,",
};

function decodeRaw(raw: string): string {
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

describe("createVerifiedOrderDraft", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path: pre-selects the mailbox, sends From/To/Cc, returns the draft id", async () => {
    await expect(createVerifiedOrderDraft(args)).resolves.toEqual({ draftId: "r-1" });
    expect(gmail.requestGmailAccessToken).toHaveBeenCalledWith("client", {
      loginHint: "biuro@pitabros.pl",
      reuse: true,
    });
    const raw = vi.mocked(gmail.createGmailDraft).mock.calls[0][1];
    const mime = decodeRaw(raw);
    expect(mime).toContain('From: "Pita Bros Bracka" <bracka@pitabros.pl>');
    expect(mime).toContain("To: biuro@bukat.com");
    expect(mime).toContain("Cc: pitabrosbracka@gmail.com");
    expect(gmail.deleteGmailDraft).not.toHaveBeenCalled();
    // Remembered for reuse only after the profile check passed.
    expect(gmail.rememberGmailToken).toHaveBeenCalledWith("biuro@pitabros.pl", "tok");
  });

  it("wrong mailbox: no draft is created, the token is forgotten", async () => {
    vi.mocked(gmail.getGmailProfileEmail).mockResolvedValueOnce("beniamin@pitabros.pl");
    const err = await createVerifiedOrderDraft(args).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WrongMailboxError);
    expect((err as WrongMailboxError).actual).toBe("beniamin@pitabros.pl");
    expect(gmail.createGmailDraft).not.toHaveBeenCalled();
    expect(gmail.clearGmailTokenCache).toHaveBeenCalledWith("biuro@pitabros.pl");
    expect(gmail.rememberGmailToken).not.toHaveBeenCalled();
  });

  it("mailbox comparison is case-insensitive", async () => {
    vi.mocked(gmail.getGmailProfileEmail).mockResolvedValueOnce("Biuro@PitaBros.pl");
    await expect(createVerifiedOrderDraft(args)).resolves.toEqual({ draftId: "r-1" });
  });

  it("rewritten From: the draft is deleted and the error names the address", async () => {
    vi.mocked(gmail.getGmailDraftFrom).mockResolvedValueOnce("Biuro <biuro@pitabros.pl>");
    const err = await createVerifiedOrderDraft(args).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SenderRewrittenError);
    expect((err as SenderRewrittenError).actual).toBe("biuro@pitabros.pl");
    expect(gmail.deleteGmailDraft).toHaveBeenCalledWith("tok", "r-1");
  });

  it("an expired session surfaces as GmailAuthExpiredError", async () => {
    vi.mocked(gmail.getGmailProfileEmail).mockRejectedValueOnce(new gmail.GmailAuthExpiredError());
    await expect(createVerifiedOrderDraft(args)).rejects.toBeInstanceOf(gmail.GmailAuthExpiredError);
    expect(gmail.createGmailDraft).not.toHaveBeenCalled();
  });
});

describe("describeDraftError / addressFromHeader", () => {
  const ctx = { mailbox: "biuro@pitabros.pl", sender: "bracka@pitabros.pl" };

  it("names the wrong account and the required one", () => {
    const msg = describeDraftError(new WrongMailboxError("beniamin@pitabros.pl"), t, ctx);
    expect(msg).toContain("beniamin@pitabros.pl");
    expect(msg).toContain("biuro@pitabros.pl");
  });

  it("maps session expiry, popup block and generic errors", () => {
    expect(describeDraftError(new gmail.GmailAuthExpiredError(), t, ctx)).toBe(
      "Sesja Google wygasła — kliknij ponownie.",
    );
    expect(describeDraftError(new Error("popup_blocked"), t, ctx)).toContain("zablokowała");
    expect(describeDraftError(new Error("Google sign-in timed out"), t, ctx)).toContain(
      "90 sekund",
    );
    expect(describeDraftError(new Error("No access token returned"), t, ctx)).toContain(
      "nie dał dostępu",
    );
    expect(describeDraftError(new Error("access_denied"), t, ctx)).toContain("nie dał dostępu");
    expect(describeDraftError(new Error("Gmail API error 500: x"), t, ctx)).toContain(
      "Gmail API error 500",
    );
    expect(describeDraftError(new SenderRewrittenError("biuro@pitabros.pl"), t, ctx)).toContain(
      "bracka@pitabros.pl",
    );
  });

  it("extracts a bare address", () => {
    expect(addressFromHeader('"Pita Bros Bracka" <bracka@pitabros.pl>')).toBe("bracka@pitabros.pl");
    expect(addressFromHeader(" biuro@pitabros.pl ")).toBe("biuro@pitabros.pl");
  });
});
