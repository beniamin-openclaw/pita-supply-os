import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../../i18n";
import type { ManagerOrderDetail, ManagerOrderLineDetail } from "../../types";
import { DispatchPanel } from "./DispatchPanel";

function makeLine(overrides: Partial<ManagerOrderLineDetail> = {}): ManagerOrderLineDetail {
  return {
    order_line_id: "OL-ORD-1-001",
    product_id: "P001",
    product_name_pl: "Pita",
    inventory_unit: "szt",
    is_critical: false,
    supplier_product_id: "SP001",
    supplier_product_name: "Pita 15cm",
    purchase_unit: "karton",
    units_per_purchase_unit: 60,
    current_stock_qty_base: 10,
    target_stock_qty_base: 100,
    max_stock_qty_base: 120,
    allow_over_max_due_to_packaging: false,
    suggested_qty_base: 90,
    suggested_qty_purchase: 2,
    captain_final_qty_purchase: 2,
    captain_final_qty_base: 120,
    manager_final_qty_purchase: 0,
    manager_final_qty_base: 0,
    captain_comment: "",
    manager_comment: "",
    ...overrides,
  };
}

function makeDetail(overrides: Partial<ManagerOrderDetail> = {}): ManagerOrderDetail {
  return {
    order_id: "ORD-1",
    location_id: "WOLA",
    location_name: "Pita Bros Wola",
    supplier_id: "SUP_PAGO",
    supplier_name: "Pago",
    supplier_email: "orders@example.test",
    ordering_method: "email",
    supplier_notes: "",
    order_date: "2026-09-20",
    status: "manager_claimed",
    notes: "",
    lines: [makeLine()],
    receipts: [],
    ...overrides,
  };
}

function renderPanel(detail: ManagerOrderDetail): void {
  render(
    <MemoryRouter>
      <LangProvider>
        <DispatchPanel
          detail={detail}
          drafts={{}}
          busy={false}
          onDispatch={() => {}}
          onToast={() => {}}
        />
      </LangProvider>
    </MemoryRouter>,
  );
}

describe("DispatchPanel — transport-only supplier", () => {
  it("renders the notice and the Transport link", () => {
    renderPanel(makeDetail({ ordering_method: "transport" }));
    expect(screen.getByText(/Wysyłka: przez Transport/)).toBeInTheDocument();
    expect(
      screen.getByText(/Pago zamawia się wyłącznie w ramach transportu zbiorczego/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Przejdź do ekranu Transport" })).toHaveAttribute(
      "href",
      "/manager/transport",
    );
  });

  it("renders no dispatch affordance at all", () => {
    renderPanel(makeDetail({ ordering_method: "transport" }));
    // Positive anchor first: without it every assertion below would also pass
    // on a branch that silently rendered nothing at all.
    expect(screen.getByRole("link", { name: "Przejdź do ekranu Transport" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Otwórz w Gmail" })).toBeNull();
    expect(screen.queryByText("Otwórz w Gmail")).toBeNull();
    expect(screen.queryByRole("button", { name: /Oznacz jako zamówione/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Kopiuj treść" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Kopiuj listę" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("DispatchPanel — other channels untouched", () => {
  it("email channel with a valid supplier_email still renders the Gmail link", () => {
    renderPanel(makeDetail({ ordering_method: "email" }));
    const gmail = screen.getByRole("link", { name: "Otwórz w Gmail" });
    expect(gmail).toHaveAttribute("href", expect.stringContaining("mail.google.com"));
    expect(screen.queryByText("Przejdź do ekranu Transport")).toBeNull();
  });
});
