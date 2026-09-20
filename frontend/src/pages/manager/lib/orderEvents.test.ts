import { describe, it, expect } from "vitest";

import type { OrderEvent } from "../../../types";
import { orderEventTypeLabel, sortOrderEvents } from "./orderEvents";

const ev = (id: string, at: string | null, type = "quantities_changed"): OrderEvent => ({
  event_id: id,
  order_id: "ORD-1",
  event_type: type,
  at,
  details: "",
});

describe("orderEvents helpers (week2-feedback-quantities Phase 6)", () => {
  it("sorts newest first and tolerates a null `at`", () => {
    const sorted = sortOrderEvents([
      ev("old", "2026-09-20T09:00:00Z"),
      ev("none", null),
      ev("new", "2026-09-20T10:00:00Z"),
    ]);
    expect(sorted.map((e) => e.event_id)).toEqual(["new", "old", "none"]);
  });

  it("maps known event types to labels and echoes unknown ones", () => {
    const t = (key: string) => `L:${key}`;
    expect(orderEventTypeLabel(t as never, "line_added")).toBe("L:manager.events.type.lineAdded");
    expect(orderEventTypeLabel(t as never, "weird")).toBe("weird");
  });
});
