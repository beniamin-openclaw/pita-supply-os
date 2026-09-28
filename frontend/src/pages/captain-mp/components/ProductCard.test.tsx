import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import { ProductCard } from "./ProductCard";
import type { OrderableItem, OrderLine } from "../types";

function makeItem(overrides: Partial<OrderableItem> = {}): OrderableItem {
  return {
    product_id: "P1",
    product_name_pl: "Coca-Cola Zero",
    inventory_unit: "szt",
    is_critical: false,
    purchase_unit: "zgrzewka",
    units_per_purchase_unit: 24,
    rounding_rule: "full_only",
    min_stock_qty_base: 0,
    max_stock_qty_base: 120,
    target_stock_qty_base: 120,
    allow_over_max_due_to_packaging: false,
    supplier_product_id: "SP1",
    supplier_product_name: "Coca-Cola Zero zgrzewka x24",
    ...overrides,
  };
}

function makeLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return {
    product_id: "P1",
    supplier_product_id: "SP1",
    current_stock_qty_base: "",
    captain_final_qty_purchase: "",
    ...overrides,
  };
}

/** Controlled wrapper — ProductCard is a pure controlled component, so a test
 * that types into the stock input needs the parent to actually apply the
 * `onChange` update for the derived hint text to re-render. */
function Wrapper({
  item,
  initialLine,
  onChangeSpy,
}: {
  item: OrderableItem;
  initialLine: OrderLine;
  onChangeSpy: (line: OrderLine) => void;
}) {
  const [line, setLine] = useState<OrderLine>(initialLine);
  return (
    <ProductCard
      item={item}
      line={line}
      onChange={(next) => {
        onChangeSpy(next);
        setLine(next);
      }}
    />
  );
}

function renderCard(item: OrderableItem, initialLine: OrderLine) {
  const onChangeSpy = vi.fn();
  render(
    <LangProvider>
      <Wrapper item={item} initialLine={initialLine} onChangeSpy={onChangeSpy} />
    </LangProvider>,
  );
  return { onChangeSpy };
}

describe("ProductCard — pack-unit display (×24 SKU)", () => {
  it("shows packs-first Cel/Max, the two-field stock reading, and the suggestion pack detail", () => {
    renderCard(makeItem(), makeLine({ current_stock_qty_base: 40 }));

    expect(screen.getByText(/Cel: 5 zgrzewek \(120 szt\)/)).toBeInTheDocument();
    expect(screen.getByText(/Max: 5 zgrzewek \(120 szt\)/)).toBeInTheDocument();
    // 40 szt seeds as 1 zgrzewka + 16 szt.
    expect((screen.getByLabelText("Obecny stan, zgrzewka") as HTMLInputElement).value).toBe("1");
    expect((screen.getByLabelText("Obecny stan, szt") as HTMLInputElement).value).toBe("16");
    expect(screen.getByText("= 1 zgrzewka + 16 szt (40 szt)")).toBeInTheDocument();
    expect(screen.getByText("brakuje 80 szt")).toBeInTheDocument();
    expect(screen.getByText("= 3,3 zgrzewki")).toBeInTheDocument();
    expect(screen.getByText("→ 4 zgrzewki")).toBeInTheDocument();
    expect(document.getElementById("final-unit-P1")?.textContent).toBe("zgrzewka");
  });

  it("typing 2 packs stores 48 base units; there is no 'wpisz w' toggle", () => {
    const { onChangeSpy } = renderCard(makeItem(), makeLine());

    expect(screen.queryByRole("button", { name: /wpisz w/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Obecny stan, zgrzewka"), { target: { value: "2" } });

    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ current_stock_qty_base: 48 }),
    );
    expect(screen.getByText("= 2 zgrzewki (48 szt)")).toBeInTheDocument();
  });

  it("below-min uses the pack wording", () => {
    renderCard(makeItem({ min_stock_qty_base: 48 }), makeLine({ current_stock_qty_base: 10 }));
    expect(screen.getByText("Poniżej minimum: 2 zgrzewki (48 szt)")).toBeInTheDocument();
  });

  it("prompts 'did you mean' when previousStock is large and the loose value is small", () => {
    const onChangeSpy = vi.fn();
    render(
      <LangProvider>
        <ProductCard
          item={makeItem()}
          line={makeLine({ current_stock_qty_base: 5 })}
          onChange={onChangeSpy}
          previousStock={200}
        />
      </LangProvider>,
    );
    expect(screen.getByText(/Czy chodziło o 5 zgrzewek \(120 szt\)\?/)).toBeInTheDocument();
  });
});

describe("ProductCard — ×1 SKU renders byte-identically to today", () => {
  it("has one stock field, the old target-line wording, and no pack '=' hint", () => {
    renderCard(
      makeItem({ purchase_unit: "szt", units_per_purchase_unit: 1 }),
      makeLine({ current_stock_qty_base: 40 }),
    );

    expect((screen.getByLabelText("Obecny stan") as HTMLInputElement).value).toBe("40");
    expect(document.getElementById("current-unit-P1")?.textContent).toBe("szt");
    expect(
      screen.getByText("target 120 szt · max 120 · 1 szt = 1 szt"),
    ).toBeInTheDocument();
    // No pack-conversion "=" hint under the stock input (only the ×24 SKU gets one).
    expect(screen.queryByText(/40 szt =/)).not.toBeInTheDocument();
    // The suggestion tile keeps the old arrow-only wording, not a pack "=" form.
    expect(screen.getByText("brakuje 80 szt → 80 szt")).toBeInTheDocument();
  });
});

describe("ProductCard — suggestion 0 is information (week2-feedback-quantities)", () => {
  it("stock ≥ target with a positive order mounts NO ReasonPicker and shows the info pill", () => {
    // target 120, stock 130 → suggestion 0; ordering 2 zgrzewki anyway.
    renderCard(makeItem(), makeLine({ current_stock_qty_base: 130, captain_final_qty_purchase: 2 }));

    expect(screen.queryByText("Wybierz powód odchylenia")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Stan 130 ≥ cel 120 szt — powód niewymagany",
    );
  });

  it("stock below target with a >25% deviation still mounts the ReasonPicker", () => {
    // target 120, stock 40 → suggestion 4; ordering 8 is +100% → reason required.
    renderCard(makeItem(), makeLine({ current_stock_qty_base: 40, captain_final_qty_purchase: 8 }));

    expect(screen.getByText("Wybierz powód odchylenia")).toBeInTheDocument();
  });

  it("supplier with alerts off: suggestion shown, no reason, no below-minimum warning", () => {
    // Same +100% line as above, plus stock 40 < min 60 — both would alert.
    renderCard(
      makeItem({ suggestion_alerts_enabled: false, min_stock_qty_base: 60 }),
      makeLine({ current_stock_qty_base: 40, captain_final_qty_purchase: 8 }),
    );

    expect(screen.queryByText("Wybierz powód odchylenia")).not.toBeInTheDocument();
    expect(screen.queryByText(/Poniżej minimum/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Ilość wpisana");
    expect(document.getElementById("suggest-P1")).toHaveTextContent("4");
  });
});
