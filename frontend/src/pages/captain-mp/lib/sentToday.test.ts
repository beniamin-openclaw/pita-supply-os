// captain-sent-today: the pure helpers behind the ✓ on the supplier tabs and
// the "already sent today" notices.

import { describe, expect, it } from "vitest";

import type { CaptainSupplier, CaptainSupplierOrderRef } from "../types";
import {
  localSentRef,
  mergeSupplierOrders,
  newerOrderRef,
  sentTodayBySupplier,
} from "./sentToday";

const TODAY = "2026-10-17";
const YESTERDAY = "2026-10-16";

function ref(
  orderId: string,
  submittedOn: string,
  submittedAt: string | null = null,
): CaptainSupplierOrderRef {
  return {
    order_id: orderId,
    status: "captain_submitted",
    order_date: submittedOn,
    submitted_on: submittedOn,
    captain_submitted_at: submittedAt,
  };
}

function supplier(
  id: string,
  extra: Partial<CaptainSupplier> = {},
): CaptainSupplier {
  return {
    supplier_id: id,
    supplier_name: id,
    ordering_method: "email",
    active: true,
    notes: "",
    ...extra,
  };
}

describe("newerOrderRef", () => {
  it("prefers the later day, then the later timestamp, then the larger id", () => {
    const a = ref("ORD-A", YESTERDAY, "2026-10-16T20:00:00Z");
    const b = ref("ORD-B", TODAY, "2026-10-17T06:00:00Z");
    expect(newerOrderRef(a, b)).toBe(b);
    expect(newerOrderRef(b, a)).toBe(b);

    const early = ref("ORD-Z", TODAY, "2026-10-17T06:00:00Z");
    const late = ref("ORD-A", TODAY, "2026-10-17T09:00:00Z");
    expect(newerOrderRef(early, late)).toBe(late);

    const noTs1 = ref("ORD-1", TODAY);
    const noTs2 = ref("ORD-2", TODAY);
    expect(newerOrderRef(noTs1, noTs2)).toBe(noTs2);
  });

  it("returns the other ref when one side is missing", () => {
    const a = ref("ORD-A", TODAY);
    expect(newerOrderRef(a, null)).toBe(a);
    expect(newerOrderRef(undefined, a)).toBe(a);
    expect(newerOrderRef(null, undefined)).toBeNull();
  });
});

describe("sentTodayBySupplier", () => {
  it("takes the server's sent_today — the ✓ survives a reload", () => {
    const server = ref("ORD-S", TODAY, "2026-10-17T08:15:00Z");
    const out = sentTodayBySupplier(
      [supplier("SUP_A", { sent_today: server }), supplier("SUP_B")],
      {},
      TODAY,
    );
    expect(out).toEqual({ SUP_A: server });
  });

  it("adds this session's submits and keeps the newer of the two", () => {
    const server = ref("ORD-S", TODAY, "2026-10-17T08:15:00Z");
    const local = ref("ORD-L", TODAY, "2026-10-17T10:00:00Z");
    const out = sentTodayBySupplier(
      [supplier("SUP_A", { sent_today: server }), supplier("SUP_B")],
      { SUP_A: local, SUP_B: ref("ORD-B", TODAY, "2026-10-17T07:00:00Z") },
      TODAY,
    );
    expect(out.SUP_A).toBe(local);
    expect(out.SUP_B.order_id).toBe("ORD-B");
  });

  it("drops refs from another day (screen left open past midnight)", () => {
    const out = sentTodayBySupplier(
      [supplier("SUP_A", { sent_today: ref("ORD-S", YESTERDAY) })],
      { SUP_B: ref("ORD-L", YESTERDAY) },
      TODAY,
    );
    expect(out).toEqual({});
  });

  it("ignores rows without order state (fallback /api/suppliers rows)", () => {
    expect(sentTodayBySupplier([supplier("SUP_A")], {}, TODAY)).toEqual({});
  });
});

describe("localSentRef", () => {
  it("uses the Europe/Warsaw day of the submit moment", () => {
    // 22:30 UTC on 16.10 is already 17.10 in Warsaw (CEST, UTC+2).
    const r = localSentRef("ORD-1", "captain_submitted", new Date("2026-10-16T22:30:00Z"));
    expect(r).toEqual({
      order_id: "ORD-1",
      status: "captain_submitted",
      order_date: TODAY,
      submitted_on: TODAY,
      captain_submitted_at: "2026-10-16T22:30:00.000Z",
    });
  });
});

describe("mergeSupplierOrders", () => {
  it("refreshes the order fields by id without adding, removing or reordering tabs", () => {
    const fresh = ref("ORD-F", TODAY);
    const open = ref("ORD-O", YESTERDAY);
    const current = [
      supplier("SUP_A", { sent_today: ref("ORD-OLD", TODAY) }),
      supplier("SUP_B"),
      supplier("SUP_C", { open_order: open }),
    ];
    const merged = mergeSupplierOrders(current, [
      supplier("SUP_B", { sent_today: fresh }),
      supplier("SUP_A"),
      supplier("SUP_NEW", { sent_today: ref("ORD-X", TODAY) }),
    ]);
    expect(merged.map((s) => s.supplier_id)).toEqual(["SUP_A", "SUP_B", "SUP_C"]);
    expect(merged[0].sent_today).toBeNull(); // the server no longer reports it
    expect(merged[1].sent_today).toBe(fresh);
    expect(merged[2].open_order).toBe(open); // not in the fresh read: unchanged
  });
});
