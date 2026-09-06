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
  it("shows Cel/Max pack hints, the stock hint, and the suggestion pack detail", () => {
    renderCard(makeItem(), makeLine({ current_stock_qty_base: 40 }));

    expect(screen.getByText(/Cel: 120 szt \(5 zgrzewek\)/)).toBeInTheDocument();
    expect(screen.getByText(/Max: 120 szt \(5 zgrzewek\)/)).toBeInTheDocument();
    expect(screen.getByText("40 szt = 1,7 zgrzewki")).toBeInTheDocument();
    // Suggestion tile: three no-wrap segments ("brakuje 80 szt" / "= 3,3 zgrzewki" / "→ 4 zgrzewki").
    expect(screen.getByText("brakuje 80 szt")).toBeInTheDocument();
    expect(screen.getByText("= 3,3 zgrzewki")).toBeInTheDocument();
    expect(screen.getByText("→ 4 zgrzewki")).toBeInTheDocument();
    // Unit captions sit under the fields (no absolute suffix over the number).
    expect(document.getElementById("current-unit-P1")?.textContent).toBe("szt");
    expect(document.getElementById("final-unit-P1")?.textContent).toBe("zgrzewka");
  });

  it("toggle on + typing '2' sends base units (48) and shows the reverse hint", () => {
    const { onChangeSpy } = renderCard(makeItem(), makeLine());

    fireEvent.click(screen.getByRole("button", { name: /wpisz w zgrzewkach/i }));
    const input = screen.getByLabelText("Obecny stan") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2" } });

    expect(onChangeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ current_stock_qty_base: 48 }),
    );
    expect(screen.getByText("2 zgrzewki = 48 szt")).toBeInTheDocument();
    // While the toggle is on the stock field is captioned with the pack unit.
    expect(document.getElementById("current-unit-P1")?.textContent).toBe("zgrzewka");
  });
});

describe("ProductCard — ×1 SKU renders byte-identically to today", () => {
  it("has no toggle button, the old target-line wording, and no pack '=' hint", () => {
    renderCard(
      makeItem({ purchase_unit: "szt", units_per_purchase_unit: 1 }),
      makeLine({ current_stock_qty_base: 40 }),
    );

    expect(screen.queryByRole("button", { name: /wpisz w/i })).not.toBeInTheDocument();
    expect(
      screen.getByText("target 120 szt · max 120 · 1 szt = 1 szt"),
    ).toBeInTheDocument();
    // No pack-conversion "=" hint under the stock input (only the ×24 SKU gets one).
    expect(screen.queryByText(/40 szt =/)).not.toBeInTheDocument();
    // The suggestion tile keeps the old arrow-only wording, not a pack "=" form.
    expect(screen.getByText("brakuje 80 szt → 80 szt")).toBeInTheDocument();
  });
});
