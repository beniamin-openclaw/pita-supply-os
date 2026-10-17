// Manager-zero convention in the Transport matrix (manager-queue-control,
// D10 A): a cell the Manager zeroed while the captain asked for more is amber
// and struck through, read-only and editable, like the order table.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import type { ManagerOrderLineDetail, OrderableItem, TransportBatchOrder } from "../../../types";
import type { TransportDraftMap } from "../lib/transport";
import { TransportMatrix } from "./TransportMatrix";

function line(
  id: string,
  captain: number,
  manager: number,
  overrides: Partial<ManagerOrderLineDetail> = {},
): ManagerOrderLineDetail {
  return {
    order_line_id: id,
    product_id: `P-${id}`,
    product_name_pl: `Produkt ${id}`,
    inventory_unit: "kg",
    is_critical: false,
    supplier_product_id: `SP-${id}`,
    supplier_product_name: `SP ${id}`,
    purchase_unit: "karton",
    units_per_purchase_unit: 1,
    current_stock_qty_base: 0,
    target_stock_qty_base: 0,
    max_stock_qty_base: 0,
    allow_over_max_due_to_packaging: false,
    suggested_qty_base: 0,
    suggested_qty_purchase: 0,
    captain_final_qty_purchase: captain,
    captain_final_qty_base: captain,
    manager_final_qty_purchase: manager,
    manager_final_qty_base: manager,
    captain_comment: "",
    manager_comment: "",
    ...overrides,
  };
}

function order(lines: ManagerOrderLineDetail[]): TransportBatchOrder {
  return {
    order_id: "ORD-W",
    location_id: "WOLA",
    location_name: "Wola",
    status: "manager_claimed",
    lines,
  };
}

function renderMatrix(
  orders: TransportBatchOrder[],
  editable: boolean,
  drafts: TransportDraftMap = {},
): void {
  render(
    <LangProvider>
      <TransportMatrix
        orders={orders}
        editable={editable}
        drafts={drafts}
        onQtyChange={() => {}}
        orderableByOrderId={{}}
        onAddProductAll={() => {}}
        onAddProductOne={() => {}}
        addAllBusy={false}
        onRemoveOrder={() => {}}
        busyOrderId={null}
      />
    </LangProvider>,
  );
}

const LINES = [
  line("A", 4, 0, { manager_final_set: true }), // zeroed by the Manager
  line("B", 3, 3, { manager_final_set: true }), // unchanged
  line("C", 0, 0, { manager_final_set: true }), // added by the Manager at 0
];

describe("TransportMatrix — manager zero", () => {
  it("strikes only the zeroed cell in a read-only matrix", () => {
    renderMatrix([order(LINES)], false);
    const zeroed = document.querySelectorAll("td[data-zeroed]");
    expect(zeroed).toHaveLength(1);
    expect(zeroed[0].querySelector(".line-through")).toHaveTextContent("0");
    expect(zeroed[0]).toHaveClass("bg-amber-50");
  });

  it("strikes the input of a zeroed cell while editing", () => {
    renderMatrix([order(LINES)], true);
    const input = screen.getByLabelText(/Produkt A/);
    expect(input).toHaveClass("line-through");
    expect(screen.getByLabelText(/Produkt B/)).not.toHaveClass("line-through");
    expect(screen.getByLabelText(/Produkt C/)).not.toHaveClass("line-through");
  });

  it("follows the live draft: a cell zeroed before save is struck", () => {
    const drafts: TransportDraftMap = { "ORD-W": { B: { qty: 0, comment: "" } } };
    renderMatrix([order(LINES)], true, drafts);
    expect(screen.getByLabelText(/Produkt B/)).toHaveClass("line-through");
  });

  it("leaves an untouched 0 plain (manager final not set)", () => {
    renderMatrix([order([line("D", 3, 0)])], false);
    expect(document.querySelectorAll("td[data-zeroed]")).toHaveLength(0);
    expect(document.querySelector(".line-through")).toBeNull();
  });
});

// transport-location-columns (D10 A): create has no per-location dedupe, so a
// batch can hold two orders from one location. The matrix shows ONE column
// per location; each order keeps its own lines, inputs and save.
function orderAt(
  orderId: string,
  locationId: string,
  locationName: string,
  lines: ManagerOrderLineDetail[],
): TransportBatchOrder {
  return {
    order_id: orderId,
    location_id: locationId,
    location_name: locationName,
    status: "manager_claimed",
    lines,
  };
}

describe("TransportMatrix — two orders from one location", () => {
  const KEN_1 = orderAt("ORD-K1", "KEN", "Ken", [line("A", 2, 0), line("B", 1, 0)]);
  const KEN_2 = orderAt("ORD-K2", "KEN", "Ken", [line("A2", 3, 0, { product_id: "P-A" })]);
  const WOLA = orderAt("ORD-W", "WOLA", "Wola", [line("W", 4, 0, { product_id: "P-A" })]);

  it("renders one column header per location", () => {
    renderMatrix([KEN_1, KEN_2, WOLA], false);
    expect(screen.getAllByRole("columnheader", { name: /Ken/ })).toHaveLength(1);
    expect(screen.getAllByRole("columnheader", { name: /Wola/ })).toHaveLength(1);
    expect(screen.getAllByRole("columnheader")).toHaveLength(3); // product + 2 locations
  });
});

describe("TransportMatrix — merged location column, editing", () => {
  const KEN_1 = orderAt("ORD-K1", "KEN", "Ken", [line("A", 2, 0), line("B", 1, 0)]);
  const KEN_2 = orderAt("ORD-K2", "KEN", "Ken", [line("A2", 3, 0, { product_id: "P-A" })]);
  const WOLA = orderAt("ORD-W", "WOLA", "Wola", [line("W", 4, 0, { product_id: "P-A" })]);

  function renderEditable(
    onQtyChange: (orderId: string, lineId: string, qty: number) => void = () => {},
    onRemoveOrder: (order: TransportBatchOrder) => void = () => {},
  ): void {
    render(
      <LangProvider>
        <TransportMatrix
          orders={[KEN_1, KEN_2, WOLA]}
          editable
          drafts={{}}
          onQtyChange={onQtyChange}
          orderableByOrderId={{}}
          onAddProductAll={() => {}}
          onAddProductOne={() => {}}
          addAllBusy={false}
          onRemoveOrder={onRemoveOrder}
          busyOrderId={null}
        />
      </LangProvider>,
    );
  }

  it("stacks one input per order and each writes its own line", () => {
    const onQtyChange = vi.fn();
    renderEditable(onQtyChange);
    const first = screen.getByLabelText("Produkt A — Ken, zamówienie 1");
    const second = screen.getByLabelText("Produkt A — Ken, zamówienie 2");
    fireEvent.change(second, { target: { value: "7" } });
    expect(onQtyChange).toHaveBeenLastCalledWith("ORD-K2", "A2", 7);
    fireEvent.change(first, { target: { value: "1" } });
    expect(onQtyChange).toHaveBeenLastCalledWith("ORD-K1", "A", 1);
    // Single-order location keeps the plain label.
    expect(screen.getByLabelText("Produkt A — Wola")).toBeInTheDocument();
  });

  it("shows the per-location total under stacked cells only", () => {
    renderEditable();
    expect(screen.getByTestId("cell-total-KEN-P-A")).toHaveTextContent("razem 5");
    expect(screen.queryByTestId("cell-total-KEN-P-B")).toBeNull();
    expect(screen.queryByTestId("cell-total-WOLA-P-A")).toBeNull();
  });

  it("names the orders in the header and removes each one separately", () => {
    const onRemoveOrder = vi.fn();
    renderEditable(() => {}, onRemoveOrder);
    expect(screen.getByTestId("orders-at-KEN")).toHaveTextContent("2 zamówienia");
    fireEvent.click(screen.getByLabelText("Usuń zamówienie 2 lokalu Ken z transportu"));
    expect(onRemoveOrder).toHaveBeenCalledWith(KEN_2, "Ken, zam. 2");
    expect(screen.getByLabelText("Usuń Wola z transportu")).toBeInTheDocument();
  });

  it("Enter hops through the stacked inputs, then down the column", () => {
    renderEditable();
    const a1 = screen.getByLabelText("Produkt A — Ken, zamówienie 1");
    const a2 = screen.getByLabelText("Produkt A — Ken, zamówienie 2");
    const b1 = screen.getByLabelText("Produkt B — Ken, zamówienie 1");
    a1.focus();
    fireEvent.keyDown(a1, { key: "Enter" });
    expect(document.activeElement).toBe(a2);
    fireEvent.keyDown(a2, { key: "Enter" });
    expect(document.activeElement).toBe(b1);
  });
});

function orderable(productId: string, name: string): OrderableItem {
  return {
    product_id: productId,
    product_name_pl: name,
    supplier_product_id: `SP-${productId}`,
    supplier_product_name: name,
    configured_for_location: true,
  } as OrderableItem;
}

describe("TransportMatrix — adding to a merged location column", () => {
  const K1 = orderAt("ORD-K1", "KEN", "Ken", [line("A", 2, 0)]);
  const K2 = orderAt("ORD-K2", "KEN", "Ken", [line("D", 1, 0)]);
  const W = orderAt("ORD-W", "WOLA", "Wola", [line("C", 4, 0)]);
  const ORDERABLE: Record<string, OrderableItem[]> = {
    // K1 lacks C (a "+" cell) and D (already on K2 — not offered for Ken).
    "ORD-K1": [orderable("P-C", "Produkt C"), orderable("P-D", "Produkt D"), orderable("P-E", "Produkt E")],
    "ORD-K2": [orderable("P-C", "Produkt C")],
  };

  function renderAdd(
    onAddProductOne: (order: TransportBatchOrder, item: OrderableItem, label: string) => void,
  ): void {
    render(
      <LangProvider>
        <TransportMatrix
          orders={[K1, K2, W]}
          editable
          drafts={{}}
          onQtyChange={() => {}}
          orderableByOrderId={ORDERABLE}
          onAddProductAll={() => {}}
          onAddProductOne={onAddProductOne}
          addAllBusy={false}
          onRemoveOrder={() => {}}
          busyOrderId={null}
        />
      </LangProvider>,
    );
  }

  it("'+' adds to the first order that can take the product, naming it", () => {
    const onAdd = vi.fn();
    renderAdd(onAdd);
    fireEvent.click(screen.getByLabelText("Dodaj Produkt C dla Ken, zam. 1"));
    expect(onAdd).toHaveBeenCalledWith(K1, ORDERABLE["ORD-K1"][0], "Ken, zam. 1");
  });

  it("add-one lists each location once and skips products another Ken order has", () => {
    const onAdd = vi.fn();
    renderAdd(onAdd);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["KEN", "WOLA"]);
    const pickers = screen.getAllByRole("button", { name: /Dodaj produkt/i });
    fireEvent.click(pickers[pickers.length - 1]);
    expect(screen.queryByRole("option", { name: /Produkt D/ })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: /Produkt E/ }));
    expect(onAdd).toHaveBeenCalledWith(K1, ORDERABLE["ORD-K1"][2], "Ken, zam. 1");
  });
});

describe("TransportMatrix — merged column details", () => {
  it("strikes only the zeroed stacked input", () => {
    const K1 = orderAt("ORD-K1", "KEN", "Ken", [line("A", 2, 0, { manager_final_set: true })]);
    const K2 = orderAt("ORD-K2", "KEN", "Ken", [line("A2", 3, 3, { product_id: "P-A" })]);
    renderMatrix([K1, K2], true);
    expect(screen.getByLabelText("Produkt A — Ken, zamówienie 1")).toHaveClass("line-through");
    expect(screen.getByLabelText("Produkt A — Ken, zamówienie 2")).not.toHaveClass("line-through");
  });

  it("handles three orders from one location (KEN ×3)", () => {
    const ks = [1, 2, 3].map((n) =>
      orderAt(`ORD-K${n}`, "KEN", "Ken", [line(`A${n}`, n, 0, { product_id: "P-A" })]),
    );
    renderMatrix(ks, false);
    expect(screen.getAllByRole("columnheader", { name: /Ken/ })).toHaveLength(1);
    expect(screen.getByTestId("orders-at-KEN")).toHaveTextContent("3 zamówienia");
    expect(screen.getByTestId("cell-total-KEN-P-A")).toHaveTextContent("razem 6");
  });
});

describe("TransportMatrix — merged column, review follow-ups", () => {
  it("Enter in a one-order column skips a row without an input", () => {
    const W = orderAt("ORD-W", "WOLA", "Wola", [line("A", 1, 0), line("C", 1, 0)]);
    const K = orderAt("ORD-K", "KEN", "Ken", [line("B", 1, 0)]);
    renderMatrix([W, K], true);
    const a = screen.getByLabelText("Produkt A — Wola");
    const c = screen.getByLabelText("Produkt C — Wola");
    a.focus();
    fireEvent.keyDown(a, { key: "Enter" });
    expect(document.activeElement).toBe(c);
  });

  it("'+' falls through to zam. 2 when zam. 1 cannot take the product", () => {
    const K1 = orderAt("ORD-K1", "KEN", "Ken", [line("A", 1, 0)]);
    const K2 = orderAt("ORD-K2", "KEN", "Ken", [line("A2", 1, 0, { product_id: "P-A" })]);
    const W = orderAt("ORD-W", "WOLA", "Wola", [line("C", 1, 0)]);
    const item = orderable("P-C", "Produkt C");
    const onAdd = vi.fn();
    render(
      <LangProvider>
        <TransportMatrix
          orders={[K1, K2, W]}
          editable
          drafts={{}}
          onQtyChange={() => {}}
          orderableByOrderId={{ "ORD-K2": [item] }}
          onAddProductAll={() => {}}
          onAddProductOne={onAdd}
          addAllBusy={false}
          onRemoveOrder={() => {}}
          busyOrderId={null}
        />
      </LangProvider>,
    );
    fireEvent.click(screen.getByLabelText("Dodaj Produkt C dla Ken, zam. 2"));
    expect(onAdd).toHaveBeenCalledWith(K2, item, "Ken, zam. 2");
  });

  it("tints only the zeroed order's row when the other order is not zeroed", () => {
    const K1 = orderAt("ORD-K1", "KEN", "Ken", [line("A", 2, 0, { manager_final_set: true })]);
    const K2 = orderAt("ORD-K2", "KEN", "Ken", [line("A2", 3, 3, { product_id: "P-A" })]);
    renderMatrix([K1, K2], false);
    expect(document.querySelectorAll("td[data-zeroed]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-zeroed-order]")).toHaveLength(1);
  });
});
