// Bulk packs (feedback-1001-names-units D33/D34) — the frontend half of the
// shared engine + gate fixture docs/pita-supply-os-v1/fixtures/
// case_suggestion_cases.json. The backend twin
// (supply-os-v1/tests/test_case_suggestion_fixture.py) reads the SAME file
// through compute_suggestion / _evaluate_submit_line, so the two engines cannot
// drift without both suites failing (plan-review F9).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { OrderableItem, OrderLine } from "../types";
import {
  caseRoundedMax,
  caseSuggestion,
  computeDeviation,
  computeRowState,
  computeSuggestion,
  deviationReference,
  roundHalfUp,
} from "./compute";

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../docs/pita-supply-os-v1/fixtures/case_suggestion_cases.json",
);

interface FixtureItem {
  inventory_unit: string;
  purchase_unit: string;
  units_per_purchase_unit: number;
  rounding_rule: OrderableItem["rounding_rule"];
  is_critical: boolean;
  target_stock_qty_base: number;
  max_stock_qty_base: number;
  allow_over_max_due_to_packaging: boolean;
  case_unit: string | null;
  units_per_case: number | null;
  suggestion_alerts_enabled: boolean;
}

interface RowBase {
  name: string;
  item: string;
  item_overrides?: Partial<FixtureItem>;
}

interface SuggestionRow extends RowBase {
  current: number;
  need: number;
  suggested: number;
}

interface GateRow extends RowBase {
  current: number | null;
  ordered: number;
  reason_required: boolean;
  kind: "none" | "critical" | "deviation" | "over_max";
  delta: number | null;
}

interface Fixture {
  items: Record<string, FixtureItem>;
  suggestion: SuggestionRow[];
  gates: GateRow[];
}

const DATA = JSON.parse(readFileSync(FIXTURE, "utf-8")) as Fixture;

function itemFor(row: RowBase): OrderableItem {
  const f: FixtureItem = { ...DATA.items[row.item], ...(row.item_overrides ?? {}) };
  return {
    product_id: "P_X",
    product_name_pl: "X",
    inventory_unit: f.inventory_unit,
    is_critical: f.is_critical,
    purchase_unit: f.purchase_unit,
    units_per_purchase_unit: f.units_per_purchase_unit,
    rounding_rule: f.rounding_rule,
    min_stock_qty_base: 0,
    max_stock_qty_base: f.max_stock_qty_base,
    target_stock_qty_base: f.target_stock_qty_base,
    allow_over_max_due_to_packaging: f.allow_over_max_due_to_packaging,
    supplier_product_id: "SP_X",
    supplier_product_name: "X",
    suggestion_alerts_enabled: f.suggestion_alerts_enabled,
    case_unit: f.case_unit,
    units_per_case: f.units_per_case,
  };
}

function lineFor(row: GateRow): OrderLine {
  return {
    product_id: "P_X",
    supplier_product_id: "SP_X",
    current_stock_qty_base: row.current === null ? "" : row.current,
    captain_final_qty_purchase: row.ordered,
    reason_code: "",
    captain_comment: "",
  };
}

describe("shared case fixture — engine (D33)", () => {
  it.each(DATA.suggestion.map((r) => [r.name, r] as const))("%s", (_name, row) => {
    const s = computeSuggestion(itemFor(row), row.current);
    expect(s.need).toBeCloseTo(row.need, 9);
    expect(s.purchase).toBeCloseTo(row.suggested, 9);
  });
});

describe("shared case fixture — reason gates (D34)", () => {
  it.each(DATA.gates.map((r) => [r.name, r] as const))("%s", (_name, row) => {
    const rs = computeRowState(itemFor(row), lineFor(row));
    expect(rs.requiresReason).toBe(row.reason_required);
    if (row.reason_required) expect(rs.state).toBe("red");
    // The backend stores |deviation| as a fraction; the card shows it signed in %.
    if (row.delta !== null && rs.deviationPct !== null) {
      expect(Math.abs(rs.deviationPct) / 100).toBeCloseTo(row.delta, 9);
    }
    // F9: the step floor means a reference of 0 never renders "+∞%".
    expect(rs.messageVars?.pct).not.toBe("+∞%");
  });
});

describe("rounding + case helpers (twins of app/suggestion.py)", () => {
  it.each([
    [0.5, 1],
    [1.5, 2],
    [2.5, 3],
    [0.49, 0],
    [2.4999999999999996, 3],
  ])("roundHalfUp(%s) = %s (plan-review F4)", (x, expected) => {
    expect(roundHalfUp(x)).toBe(expected);
  });

  it("caseSuggestion rounds the need to the nearest whole case", () => {
    expect([0, 2, 3, 4, 9, 10].map((n) => caseSuggestion(n, 6))).toEqual([0, 0, 6, 6, 12, 12]);
    expect(caseSuggestion(4, null)).toBe(4);
  });

  it("deviationReference: zero inside [need, case], else the nearer end (D34)", () => {
    expect(deviationReference(5, 4, 6)).toBe(5);
    expect(deviationReference(0.5, 2, 0)).toBe(0.5);
    expect(deviationReference(18, 2, 0)).toBe(2);
    expect(deviationReference(1, 4, 6)).toBe(4);
    expect(deviationReference(13, 10, 12)).toBe(12);
    expect(deviationReference(5, 3, 3)).toBe(3);
  });

  it("caseRoundedMax rounds max up to a whole case", () => {
    expect(caseRoundedMax(20, 1, 6)).toBe(24);
    expect(caseRoundedMax(24, 1, 6)).toBe(24);
    expect(caseRoundedMax(1, 1, 5)).toBe(5);
    expect(caseRoundedMax(20, 1, null)).toBe(20);
  });

  it("computeDeviation floors the denominator at the step (no +∞%)", () => {
    expect(computeDeviation(0, 0.5, 0.1)).toBeCloseTo(500, 9);
    expect(computeDeviation(4, 5, 1)).toBeCloseTo(25, 9);
    // Legacy 2-argument form is unchanged.
    expect(computeDeviation(0, 1)).toBe(Infinity);
    expect(computeDeviation(0, 0)).toBe(0);
  });

  it("a case item ordered at the need is a green match", () => {
    const row: GateRow = {
      name: "need 4 ordered 4",
      item: "pomidor",
      current: 6,
      ordered: 4,
      reason_required: false,
      kind: "none",
      delta: 0,
    };
    const rs = computeRowState(itemFor(row), lineFor(row));
    expect(rs.state).toBe("green");
    expect(rs.messageKey).toBe("state.match");
  });
});

describe("alerts-off pill with a case (impl-review F4a)", () => {
  it("an order inside [need, case] is a green match, outside it a neutral grey", () => {
    const base: GateRow = {
      name: "alerts off",
      item: "pomidor",
      item_overrides: { suggestion_alerts_enabled: false },
      current: 6, // need 4, case 6
      ordered: 5,
      reason_required: false,
      kind: "none",
      delta: 0,
    };
    expect(computeRowState(itemFor(base), lineFor(base)).state).toBe("green");
    const outside: GateRow = { ...base, ordered: 7 };
    const rs = computeRowState(itemFor(outside), lineFor(outside));
    expect(rs.state).toBe("grey");
    expect(rs.requiresReason).toBe(false);
  });
});
