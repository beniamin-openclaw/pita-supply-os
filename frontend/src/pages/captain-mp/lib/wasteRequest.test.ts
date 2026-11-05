import { afterEach, describe, expect, it, vi } from "vitest";
import { getToken, setToken } from "../../../auth";
import { AUTH_INVALID_EVENT, wasteRequest } from "../../../apiClient";

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
describe("waste request scope and result", () => {
  it("does not send when the pinned token changed", async () => {
    setToken("captain", "new");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(wasteRequest("/api/captain/waste/reports", "captain", "old", {})).rejects.toMatchObject({ kind: "scope" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("classifies 422 as rejected and malformed success as unknown", async () => {
    setToken("captain", "token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response('{}', {status: 422})).mockResolvedValueOnce(new Response('bad', {status: 200})));
    await expect(wasteRequest("/api/captain/waste/reports", "captain", "token", {})).rejects.toMatchObject({kind: "rejected"});
    await expect(wasteRequest("/api/captain/waste/reports", "captain", "token", {})).rejects.toMatchObject({kind: "unknown"});
  });
  it("invalidates only the token used by a 401 response", async () => {
    setToken("captain", "old");
    const event = vi.fn(); window.addEventListener(AUTH_INVALID_EVENT, event);
    vi.stubGlobal("fetch", vi.fn(async () => { setToken("captain", "new"); return new Response('{}', {status: 401}); }));
    await expect(wasteRequest("/api/captain/waste/reports", "captain", "old")).rejects.toMatchObject({status: 401});
    expect(getToken("captain")).toBe("new"); expect(event).not.toHaveBeenCalled();
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{}', {status: 401})));
    await expect(wasteRequest("/api/captain/waste/reports", "captain", "new")).rejects.toMatchObject({status: 401});
    expect(getToken("captain")).toBeNull(); expect(event).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_INVALID_EVENT, event);
  });
  it("treats a timeout as an unknown outcome", async () => {
    vi.useFakeTimers();
    setToken("captain", "token");
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))));
    const result = wasteRequest("/api/captain/waste/reports", "captain", "token", {});
    const assertion = expect(result).rejects.toMatchObject({kind: "unknown", code: "network"});
    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
    vi.useRealTimers();
  });
});
