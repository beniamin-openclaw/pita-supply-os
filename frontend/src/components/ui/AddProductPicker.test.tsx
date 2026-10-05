import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LangProvider } from "../../i18n";
import type { OrderableItem } from "../../types";
import { AddProductPicker } from "./AddProductPicker";

function item(overrides: Partial<OrderableItem> = {}): OrderableItem {
  return {
    product_id: "P026",
    product_name_pl: "Gyros Wieprz",
    inventory_unit: "kg",
    is_critical: false,
    purchase_unit: "karton",
    units_per_purchase_unit: 5,
    rounding_rule: "full_only",
    min_stock_qty_base: 0,
    max_stock_qty_base: 0,
    target_stock_qty_base: 0,
    allow_over_max_due_to_packaging: false,
    supplier_product_id: "SP_PAGO_P026",
    supplier_product_name: "Gyros karton",
    ...overrides,
  } as OrderableItem;
}

const OUTSIDE = item({
  product_id: "P024",
  product_name_pl: "Gyros 15 KG",
  supplier_product_id: "SP_PAGO_P024",
  supplier_product_name: "Gyros 15 KG",
  configured_for_location: false,
});

function renderPicker(items: OrderableItem[], onSelect = vi.fn()) {
  render(
    <LangProvider>
      <AddProductPicker items={items} onSelect={onSelect} />
    </LangProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Dodaj produkt/ }));
  return onSelect;
}

describe("AddProductPicker — one-off override (manager-add-any-product)", () => {
  it("hides products outside the location's list until the checkbox is ticked", () => {
    const onSelect = renderPicker([item(), OUTSIDE]);
    expect(screen.getByText("Gyros Wieprz")).toBeInTheDocument();
    expect(screen.queryByText("Gyros 15 KG")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Wyjątkowo: pokaż wszystkie produkty dostawcy"));
    expect(screen.getByText("Gyros 15 KG")).toBeInTheDocument();
    expect(screen.getByText("poza listą lokalu")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Gyros 15 KG"));
    expect(onSelect).toHaveBeenCalledWith(OUTSIDE);
  });

  it("drops the one-off checkbox when the dropdown closes", () => {
    renderPicker([item(), OUTSIDE]);
    fireEvent.click(screen.getByLabelText("Wyjątkowo: pokaż wszystkie produkty dostawcy"));
    expect(screen.getByText("Gyros 15 KG")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: /Dodaj produkt/ }));
    expect(screen.queryByText("Gyros 15 KG")).not.toBeInTheDocument();
  });

  it("shows no checkbox when every item is on the location's list", () => {
    renderPicker([item()]);
    expect(
      screen.queryByLabelText("Wyjątkowo: pokaż wszystkie produkty dostawcy"),
    ).not.toBeInTheDocument();
  });
});
