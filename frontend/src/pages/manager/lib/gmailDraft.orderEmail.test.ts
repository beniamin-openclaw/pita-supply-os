// order-email-v2 additions to gmailDraft.ts: From/Cc headers, login_hint, the
// in-memory token cache, and 401 handling. The Transport cases in
// gmailDraft.test.ts are untouched and must stay green.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildGmailAuthUrl,
  buildMimeMessage,
  clearGmailTokenCache,
  getGmailDraftFrom,
  getGmailProfileEmail,
  GmailAuthExpiredError,
  hasCachedGmailToken,
  OAUTH_BROADCAST_CHANNEL,
  rememberGmailToken,
  requestGmailAccessToken,
  TOKEN_CACHE_MS,
} from "./gmailDraft";

const base = { to: "biuro@bukat.com", subject: "S", bodyText: "B", attachments: [] };

describe("buildMimeMessage — From / Cc (order-email-v2)", () => {
  it("omits From and Cc when not given (Transport output unchanged)", () => {
    const mime = buildMimeMessage(base);
    expect(mime).not.toContain("From:");
    expect(mime).not.toContain("Cc:");
    expect(mime.startsWith("To: biuro@bukat.com\r\n")).toBe(true);
  });

  it("quotes an ASCII display name", () => {
    const mime = buildMimeMessage({
      ...base,
      from: { name: "Pita Bros Bracka", email: "bracka@pitabros.pl" },
      cc: "pitabrosbracka@gmail.com",
    });
    expect(mime.startsWith('From: "Pita Bros Bracka" <bracka@pitabros.pl>\r\n')).toBe(true);
    expect(mime).toContain("\r\nCc: pitabrosbracka@gmail.com\r\n");
  });

  it("RFC 2047-encodes a non-ASCII display name", () => {
    const mime = buildMimeMessage({
      ...base,
      from: { name: "Pita Bros Słony", email: "slony@pitabros.pl" },
    });
    const from = mime.split("\r\n")[0];
    expect(from).toMatch(/^From: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <slony@pitabros\.pl>$/);
    const b64 = from.match(/B\?(.+)\?=/)![1];
    expect(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))).toBe(
      "Pita Bros Słony",
    );
  });
});

describe("buildGmailAuthUrl — login_hint", () => {
  it("adds login_hint only when given", () => {
    const opts = { clientId: "c", redirectUri: "https://x/cb", state: "s" };
    expect(new URL(buildGmailAuthUrl(opts)).searchParams.has("login_hint")).toBe(false);
    expect(
      new URL(buildGmailAuthUrl({ ...opts, loginHint: "biuro@pitabros.pl" })).searchParams.get(
        "login_hint",
      ),
    ).toBe("biuro@pitabros.pl");
  });
});

describe("requestGmailAccessToken — token cache", () => {
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearGmailTokenCache();
    openSpy = vi.fn(() => ({}) as Window);
    vi.stubGlobal("open", openSpy);
  });
  afterEach(() => {
    clearGmailTokenCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function signIn(token: string, opts: { loginHint?: string; reuse?: boolean }) {
    const pending = requestGmailAccessToken("client", opts);
    const url = openSpy.mock.calls.at(-1)?.[0] as string;
    const state = new URL(url).searchParams.get("state");
    const ch = new BroadcastChannel(OAUTH_BROADCAST_CHANNEL);
    ch.postMessage({ type: "supplyos-gmail-token", accessToken: token, state });
    ch.close();
    return pending;
  }

  it("reuses a remembered token for the same account without a popup", async () => {
    expect(await signIn("tok-1", { loginHint: "biuro@pitabros.pl", reuse: true })).toBe("tok-1");
    expect(openSpy).toHaveBeenCalledTimes(1);
    // The request alone never caches: the caller remembers a VERIFIED token.
    expect(hasCachedGmailToken("biuro@pitabros.pl")).toBe(false);
    rememberGmailToken("biuro@pitabros.pl", "tok-1");
    expect(new URL(openSpy.mock.calls[0][0] as string).searchParams.get("login_hint")).toBe(
      "biuro@pitabros.pl",
    );
    await expect(
      requestGmailAccessToken("client", { loginHint: "BIURO@pitabros.pl", reuse: true }),
    ).resolves.toBe("tok-1");
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it("does not cache without reuse (Transport keeps per-click popups)", async () => {
    await signIn("tok-2", {});
    expect(hasCachedGmailToken()).toBe(false);
  });

  it("expires after TOKEN_CACHE_MS and can be cleared", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    rememberGmailToken("biuro@pitabros.pl", "tok-3");
    expect(hasCachedGmailToken("biuro@pitabros.pl")).toBe(true);
    clock.mockReturnValue(now + TOKEN_CACHE_MS + 1);
    expect(hasCachedGmailToken("biuro@pitabros.pl")).toBe(false);

    clock.mockReturnValue(now);
    rememberGmailToken("biuro@pitabros.pl", "tok-4");
    clearGmailTokenCache("biuro@pitabros.pl");
    expect(hasCachedGmailToken("biuro@pitabros.pl")).toBe(false);
  });

  it("a 401 from the Gmail API clears the cache", async () => {
    rememberGmailToken("biuro@pitabros.pl", "tok-5");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    await expect(getGmailProfileEmail("tok-5")).rejects.toBeInstanceOf(GmailAuthExpiredError);
    expect(hasCachedGmailToken("biuro@pitabros.pl")).toBe(false);
  });
});

describe("Gmail API reads", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the profile address and the stored From header", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/profile")
        ? new Response(JSON.stringify({ emailAddress: "biuro@pitabros.pl" }))
        : new Response(
            JSON.stringify({
              message: { payload: { headers: [{ name: "From", value: "X <bracka@pitabros.pl>" }] } },
            }),
          ),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await getGmailProfileEmail("t")).toBe("biuro@pitabros.pl");
    expect(await getGmailDraftFrom("t", "r-1")).toBe("X <bracka@pitabros.pl>");
    expect(fetchMock.mock.calls[1][0]).toMatch(/drafts\/r-1\?format=metadata$/);
  });
});
