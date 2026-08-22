import { describe, it, expect, vi, afterEach } from "vitest";

import { api, formatErrorDetail } from "./apiClient";

describe("formatErrorDetail", () => {
  it("maps a single 422 validation entry to 'field: msg'", () => {
    const payload = {
      detail: [{ loc: ["body", "lines"], msg: "field required", type: "missing" }],
    };
    expect(formatErrorDetail(payload, "fallback")).toBe("lines: field required");
  });

  it("joins multiple 422 entries with '; '", () => {
    const payload = {
      detail: [
        { loc: ["body", "a"], msg: "err a", type: "missing" },
        { loc: ["body", "b"], msg: "err b", type: "value_error" },
      ],
    };
    expect(formatErrorDetail(payload, "fb")).toBe("a: err a; b: err b");
  });

  it("uses a nested loc path minus the leading body segment", () => {
    const payload = {
      detail: [{ loc: ["body", "lines", 0, "qty"], msg: "must be >= 0" }],
    };
    expect(formatErrorDetail(payload, "fb")).toBe("lines.0.qty: must be >= 0");
  });

  it("passes a string detail through unchanged", () => {
    expect(formatErrorDetail({ detail: "Order not found" }, "fb")).toBe(
      "Order not found",
    );
  });

  it("falls back when detail is missing or empty", () => {
    expect(formatErrorDetail({}, "Bad Request")).toBe("Bad Request");
    expect(formatErrorDetail(null, "Bad Request")).toBe("Bad Request");
    expect(formatErrorDetail({ detail: "" }, "Bad Request")).toBe("Bad Request");
  });

  it("falls back (not '[]') for an empty detail array", () => {
    expect(formatErrorDetail({ detail: [] }, "Bad Request")).toBe("Bad Request");
  });

  it("never returns '[object Object]' for an object detail", () => {
    const out = formatErrorDetail({ detail: { weird: 1 } }, "fb");
    expect(out).not.toContain("[object Object]");
  });

  it("never returns '[object Object]' for an array of opaque objects", () => {
    const out = formatErrorDetail({ detail: [{ foo: "bar" }] }, "fb");
    expect(out).not.toContain("[object Object]");
  });
});

describe("api.suppliers — role/token selection (regression)", () => {
  // /api/suppliers accepts EITHER token server-side (require_any_auth), so the
  // bug this guards is client-side: a Manager-only screen holds no captain
  // token, so calling api.suppliers() with the default captain role sends no
  // Authorization header at all and 401s. That shipped once and left
  // /manager/transport with an empty picker and both sections stuck loading.
  //
  // localStorage is stubbed rather than used directly: this jsdom build exposes
  // it without working methods (see src/test/setup.ts's own guard).
  function stubStorage(entries: Record<string, string>): void {
    const store = new Map(Object.entries(entries));
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  }

  function stubFetchOk(): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function authHeaderOf(fetchMock: ReturnType<typeof vi.fn>): string | undefined {
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    return (init.headers as Record<string, string>)["Authorization"];
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the MANAGER token when called with 'manager'", async () => {
    stubStorage({ supply_os_manager_token: "mgr-token" });
    const fetchMock = stubFetchOk();

    await api.suppliers("manager");

    expect(authHeaderOf(fetchMock)).toBe("Bearer mgr-token");
  });

  it("still authenticates on a manager-only screen (no captain token stored)", async () => {
    stubStorage({ supply_os_manager_token: "mgr-token" });
    const fetchMock = stubFetchOk();

    await api.suppliers("manager");

    // The regression sent NO Authorization header here, producing a silent 401.
    expect(authHeaderOf(fetchMock)).toBeDefined();
  });

  it("defaults to the captain token (unchanged for captain screens)", async () => {
    stubStorage({ supply_os_captain_token: "cap-token" });
    const fetchMock = stubFetchOk();

    await api.suppliers();

    expect(authHeaderOf(fetchMock)).toBe("Bearer cap-token");
  });
});
