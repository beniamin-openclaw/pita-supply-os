import { describe, it, expect } from "vitest";
import { clearStaleAutoReasons, overruleAll } from "./overruleAll";
import type { OrderableItem, OrderLine } from "../types";

// The automatic sticky pass; "overwrite" cases below say so explicitly.
const FILL = "fillMissing" as const;
const OVERWRITE = "overwrite" as const;

// Minimal fixtures — mirrors compute.test.ts's makeItem/makeLine so the two
// suites stay easy to cross-reference.
function makeItem(overrides: Partial<OrderableItem> = {}): OrderableItem {
  return {
    product_id: "P001",
    product_name_pl: "Test",
    inventory_unit: "szt",
    is_critical: false,
    purchase_unit: "karton",
    units_per_purchase_unit: 10,
    rounding_rule: "full_only",
    min_stock_qty_base: 0,
    max_stock_qty_base: 1000,
    target_stock_qty_base: 50,
    allow_over_max_due_to_packaging: false,
    supplier_product_id: "SP001",
    supplier_product_name: "Test SP",
    ...overrides,
  };
}

function makeLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return {
    product_id: "P001",
    supplier_product_id: "SP001",
    current_stock_qty_base: "",
    captain_final_qty_purchase: "",
    reason_code: "",
    captain_comment: "",
    ...overrides,
  };
}

// A deviating line: current=0, target=50 -> suggested purchase = 5 (base 50 /
// units 10). Ordering 9 (base 90) is +80% deviation -> requiresReason=true.
function deviatingLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return makeLine({
    product_id: "P001",
    current_stock_qty_base: 0,
    captain_final_qty_purchase: 9,
    ...overrides,
  });
}

// A line that matches the suggestion exactly (suggested purchase = 5) ->
// requiresReason=false.
function matchingLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return makeLine({
    product_id: "P002",
    current_stock_qty_base: 0,
    captain_final_qty_purchase: 5,
    ...overrides,
  });
}

describe("overruleAll — applies to deviating lines", () => {
  it("sets the reason on a line that requires one and has none yet", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine() };

    const result = overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, FILL);

    expect(result.P001.reason_code).toBe("LOW_STORAGE");
    expect(result).not.toBe(lines); // patched -> new object
  });

  it("patches every deviating line across multiple items in one call", () => {
    const items = [
      makeItem({ product_id: "P001" }),
      makeItem({ product_id: "P003" }),
    ];
    const lines = {
      P001: deviatingLine({ product_id: "P001" }),
      P003: deviatingLine({ product_id: "P003", supplier_product_id: "SP001" }),
    };

    const result = overruleAll(items, lines, { code: "WEEKEND_HIGH_TRAFFIC", comment: "" }, FILL);

    expect(result.P001.reason_code).toBe("WEEKEND_HIGH_TRAFFIC");
    expect(result.P003.reason_code).toBe("WEEKEND_HIGH_TRAFFIC");
  });

  it("stores the comment on the patched line when the reason is OTHER", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine() };

    const result = overruleAll(items, lines, { code: "OTHER", comment: "Explained once for all lines" }, FILL);

    expect(result.P001.reason_code).toBe("OTHER");
    expect(result.P001.captain_comment).toBe("Explained once for all lines");
  });
});

describe("overruleAll fillMissing — never replaces an existing reason", () => {
  it("skips a line that already has a reason set, even a different one", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine({ reason_code: "SUPPLIER_UNDERDELIVERS" }) };

    const result = overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, FILL);

    expect(result.P001.reason_code).toBe("SUPPLIER_UNDERDELIVERS");
    expect(result).toBe(lines); // nothing changed -> same reference
  });

  it("skips a line already set to OTHER even without a comment yet (the Captain still picked it)", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = {
      P001: deviatingLine({ reason_code: "OTHER", captain_comment: "" }),
    };

    const result = overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, FILL);

    expect(result.P001.reason_code).toBe("OTHER");
    expect(result.P001.captain_comment).toBe("");
  });

  it("only patches the untouched line in a mixed batch", () => {
    const items = [
      makeItem({ product_id: "P001" }),
      makeItem({ product_id: "P003" }),
    ];
    const lines = {
      P001: deviatingLine({ product_id: "P001", reason_code: "OTHER", captain_comment: "already explained" }),
      P003: deviatingLine({ product_id: "P003" }),
    };

    const result = overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, FILL);

    expect(result.P001.reason_code).toBe("OTHER");
    expect(result.P001.captain_comment).toBe("already explained");
    expect(result.P003.reason_code).toBe("LOW_STORAGE");
  });
});

describe("overruleAll — skips lines that don't require a reason", () => {
  it("leaves a line matching its suggestion untouched", () => {
    const items = [makeItem({ product_id: "P002" })];
    const lines = { P002: matchingLine() };

    const result = overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, FILL);

    expect(result.P002.reason_code).toBe("");
    expect(result).toBe(lines);
  });

  it("leaves a suggestion-0 line (stock ≥ target, ordered anyway) without a reason", () => {
    // week2-feedback-quantities Phase 1: current=60 ≥ target=50 → suggestion 0
    // is information, requiresReason=false, so "overrule all" must skip it.
    const items = [makeItem({ product_id: "P005" })];
    const lines = {
      P005: makeLine({
        product_id: "P005",
        current_stock_qty_base: 60,
        captain_final_qty_purchase: 3,
      }),
    };

    const result = overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, FILL);

    expect(result.P005.reason_code).toBe("");
    expect(result).toBe(lines);
  });

  it("leaves a blank (not-yet-ordered) line untouched", () => {
    const items = [makeItem({ product_id: "P004" })];
    const lines = { P004: makeLine({ product_id: "P004" }) };

    const result = overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, FILL);

    expect(result.P004.reason_code).toBe("");
    expect(result).toBe(lines);
  });
});

describe("overruleAll — OTHER without a comment is a no-op", () => {
  it("patches nothing when OTHER is chosen with a blank comment", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine() };

    const result = overruleAll(items, lines, { code: "OTHER", comment: "" }, FILL);

    expect(result).toBe(lines);
    expect(result.P001.reason_code).toBe("");
  });

  it("patches nothing when OTHER's comment is whitespace-only", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine() };

    const result = overruleAll(items, lines, { code: "OTHER", comment: "   " }, FILL);

    expect(result).toBe(lines);
  });

  it("is a no-op across a whole batch, not just the OTHER-affected line", () => {
    const items = [
      makeItem({ product_id: "P001" }),
      makeItem({ product_id: "P003" }),
    ];
    const lines = {
      P001: deviatingLine({ product_id: "P001" }),
      P003: deviatingLine({ product_id: "P003" }),
    };

    const result = overruleAll(items, lines, { code: "OTHER", comment: "" }, FILL);

    expect(result).toBe(lines);
    expect(result.P001.reason_code).toBe("");
    expect(result.P003.reason_code).toBe("");
  });
});

describe("overruleAll — defensive edge cases", () => {
  it("ignores an item with no corresponding line entry", () => {
    const items = [makeItem({ product_id: "P999" })];
    const lines: Record<string, OrderLine> = {};

    const result = overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, FILL);

    expect(result).toBe(lines);
  });

  it("returns the same reference when items is empty", () => {
    const lines = { P001: deviatingLine() };

    const result = overruleAll([], lines, { code: "LOW_STORAGE", comment: "" }, FILL);

    expect(result).toBe(lines);
  });
});

describe("overruleAll overwrite — explicit Apply replaces earlier picks", () => {
  it("replaces a different existing reason", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine({ reason_code: "SUPPLIER_UNDERDELIVERS" }) };

    const result = overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, OVERWRITE);

    expect(result.P001.reason_code).toBe("LOW_STORAGE");
    expect(result).not.toBe(lines);
  });

  it("replaces an OTHER pick and drops its stale comment when switching away", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = {
      P001: deviatingLine({ reason_code: "OTHER", captain_comment: "old explanation" }),
    };

    const result = overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, OVERWRITE);

    expect(result.P001.reason_code).toBe("LOW_STORAGE");
    expect(result.P001.captain_comment).toBe("");
  });

  it("writes a trimmed comment when the new reason is OTHER, replacing an older one", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = {
      P001: deviatingLine({ reason_code: "OTHER", captain_comment: "old" }),
    };

    const result = overruleAll(items, lines, { code: "OTHER", comment: "  new  " }, OVERWRITE);

    expect(result.P001.captain_comment).toBe("new");
  });

  it("still skips lines that do not require a reason", () => {
    const items = [makeItem({ product_id: "P002" })];
    const lines = { P002: matchingLine({ reason_code: "LOW_STORAGE" }) };

    const result = overruleAll(items, lines, { code: "OTHER", comment: "x" }, OVERWRITE);

    expect(result).toBe(lines);
  });

  it("returns the same reference when every line already carries exactly this reason", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine({ reason_code: "LOW_STORAGE" }) };

    expect(overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, OVERWRITE)).toBe(lines);
  });

  it("OTHER with a blank comment is a no-op in overwrite mode too", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine({ reason_code: "LOW_STORAGE" }) };

    expect(overruleAll(items, lines, { code: "OTHER", comment: " " }, OVERWRITE)).toBe(lines);
  });
});

describe("overruleAll fillMissing — sticky pass", () => {
  it("fills a line that starts requiring a reason later, keeps hand-picked ones", () => {
    const items = [
      makeItem({ product_id: "P001" }),
      makeItem({ product_id: "P003" }),
    ];
    const lines = {
      P001: deviatingLine({ product_id: "P001", reason_code: "SUPPLIER_UNDERDELIVERS" }),
      P003: deviatingLine({ product_id: "P003" }),
    };

    const result = overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, FILL);

    expect(result.P001.reason_code).toBe("SUPPLIER_UNDERDELIVERS");
    expect(result.P003.reason_code).toBe("LOW_STORAGE");
  });

  it("is idempotent: a second pass returns the same reference (no effect loop)", () => {
    const items = [makeItem({ product_id: "P001" })];
    const once = overruleAll(
      items,
      { P001: deviatingLine() },
      { code: "OTHER", comment: "why" },
      FILL,
    );

    expect(overruleAll(items, once, { code: "OTHER", comment: "why" }, FILL)).toBe(once);
  });

  it("writes the OTHER comment on the filled line", () => {
    const items = [makeItem({ product_id: "P001" })];
    const result = overruleAll(
      items,
      { P001: deviatingLine() },
      { code: "OTHER", comment: "why" },
      FILL,
    );

    expect(result.P001.captain_comment).toBe("why");
  });

  it("skips a line the Captain cleared by hand (handEdited), fills the rest", () => {
    const items = [makeItem({ product_id: "P001" }), makeItem({ product_id: "P003" })];
    const lines = {
      P001: deviatingLine({ product_id: "P001", reason_code: "" }),
      P003: deviatingLine({ product_id: "P003" }),
    };
    const bulk = { code: "LOW_STORAGE" as const, comment: "" };

    const result = overruleAll(items, lines, bulk, FILL, new Set(["P001"]));

    expect(result.P001.reason_code).toBe("");
    expect(result.P003.reason_code).toBe("LOW_STORAGE");
  });

  it("overwrite (an explicit Apply) ignores handEdited", () => {
    const items = [makeItem({ product_id: "P001" })];
    const result = overruleAll(
      items,
      { P001: deviatingLine({ reason_code: "" }) },
      { code: "LOW_STORAGE", comment: "" },
      OVERWRITE,
      new Set(["P001"]),
    );

    expect(result.P001.reason_code).toBe("LOW_STORAGE");
  });
});

describe("overruleAll — supplier with alerts off", () => {
  it("never applies a reason (no line requires one)", () => {
    const items = [makeItem({ product_id: "P001", suggestion_alerts_enabled: false })];
    const lines = { P001: deviatingLine() };

    expect(overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, OVERWRITE)).toBe(lines);
    expect(overruleAll(items, lines, { code: "LOW_STORAGE", comment: "" }, FILL)).toBe(lines);
  });
});

describe("overruleAll — auto-filled reasons (impl-review F1)", () => {
  const bulk = { code: "WEEKEND_HIGH_TRAFFIC" as const, comment: "" };

  it("marks every reason it fills as reason_auto, in both modes", () => {
    const items = [makeItem({ product_id: "P001" })];
    for (const mode of [FILL, OVERWRITE]) {
      const result = overruleAll(items, { P001: deviatingLine() }, bulk, mode);
      expect(result.P001.reason_auto).toBe(true);
    }
  });

  it("typing '1' then '12' leaves no reason on the matching line", () => {
    // Target 120 szt, 10 per karton, stock 0 -> suggestion 12 kartons.
    const items = [makeItem({ product_id: "P001", target_stock_qty_base: 120 })];
    const afterOne = overruleAll(
      items,
      { P001: deviatingLine({ captain_final_qty_purchase: 1 }) },
      bulk,
      FILL,
    );
    expect(afterOne.P001.reason_code).toBe("WEEKEND_HIGH_TRAFFIC");

    const typed = { P001: { ...afterOne.P001, captain_final_qty_purchase: 12 } };
    const afterTwelve = overruleAll(items, typed, bulk, FILL);
    expect(afterTwelve.P001.reason_code).toBe("");
    expect(afterTwelve.P001.reason_auto).toBe(false);
    // Stable: another pass changes nothing.
    expect(overruleAll(items, afterTwelve, bulk, FILL)).toBe(afterTwelve);
  });

  it("keeps a hand-picked reason on a line that no longer needs one", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: matchingLine({ reason_code: "LOW_STORAGE" }) };
    expect(clearStaleAutoReasons(items, lines)).toBe(lines);
    expect(overruleAll(items, lines, bulk, FILL)).toBe(lines);
  });

  it("an auto OTHER loses its comment with the reason", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = {
      P001: matchingLine({ reason_code: "OTHER", captain_comment: "bulk why", reason_auto: true }),
    };
    const result = clearStaleAutoReasons(items, lines);
    expect(result.P001.reason_code).toBe("");
    expect(result.P001.captain_comment).toBe("");
  });

  it("keeps an auto reason while the line still requires one", () => {
    const items = [makeItem({ product_id: "P001" })];
    const lines = { P001: deviatingLine({ reason_code: "LOW_STORAGE", reason_auto: true }) };
    expect(clearStaleAutoReasons(items, lines)).toBe(lines);
  });
});
