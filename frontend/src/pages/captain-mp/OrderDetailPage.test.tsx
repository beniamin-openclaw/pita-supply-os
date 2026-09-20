// Phase 7 (week2-feedback-quantities): the order-level "Menedżer zmienił
// ilości" banner on the Captain order detail. It must appear ONLY on a
// dispatched/closed order whose lines the manager changed — including a line
// the manager zeroed (manager_final 0 while the captain ordered > 0).

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { LangProvider } from "../../i18n";
import type { CaptainOrderDetail, ManagerOrderLineDetail, OrderStatus } from "../../types";

const captainOrder = vi.fn();
vi.mock("../../apiClient", () => ({
  ApiError: class ApiError extends Error {
    status = 0;
    detail = "";
  },
  api: {
    captainOrder: (id: string) => captainOrder(id),
    captainReceipts: () => Promise.resolve([]),
    receipt: () => Promise.reject(new Error("unused")),
    receiptPhotoUrls: () => Promise.resolve([]),
  },
}));

import { OrderDetailPage } from "./OrderDetailPage";

function makeLine(
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
    units_per_purchase_unit: 5,
    current_stock_qty_base: 2,
    target_stock_qty_base: 20,
    max_stock_qty_base: 30,
    allow_over_max_due_to_packaging: false,
    suggested_qty_base: 18,
    suggested_qty_purchase: 4,
    captain_final_qty_purchase: captain,
    captain_final_qty_base: captain * 5,
    manager_final_qty_purchase: manager,
    manager_final_qty_base: manager * 5,
    captain_comment: "",
    manager_comment: "",
    ...overrides,
  };
}

function makeOrder(status: OrderStatus, lines: ManagerOrderLineDetail[]): CaptainOrderDetail {
  return {
    order_id: "ORD-20260914-WOL-PAGO-abc123",
    location_id: "WOLA",
    location_name: "Pita Bros Wola",
    supplier_id: "SUP_PAGO",
    supplier_name: "Pago",
    order_date: "2026-09-14",
    status,
    notes: "",
    editable: status === "captain_submitted",
    lines,
  };
}

function renderPage(order: CaptainOrderDetail) {
  captainOrder.mockResolvedValue(order);
  render(
    <MemoryRouter initialEntries={[`/captain-v2/orders/${order.order_id}`]}>
      <LangProvider>
        <Routes>
          <Route path="/captain-v2/orders/:order_id" element={<OrderDetailPage />} />
        </Routes>
      </LangProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  captainOrder.mockReset();
});

describe("OrderDetailPage — manager-changed banner", () => {
  it("shows the banner counting changed lines on a sent order", async () => {
    renderPage(
      makeOrder("manager_sent", [
        makeLine("OL-1", 4, 4), // unchanged
        makeLine("OL-2", 4, 6), // manager raised
        makeLine("OL-3", 3, 1), // manager lowered
      ]),
    );
    const banner = await screen.findByTestId("manager-changed-banner");
    expect(banner).toHaveTextContent("Menedżer zmienił ilości w 2 pozycjach");
    // The per-line hint still renders for each changed line (and only those).
    expect(screen.getAllByText(/zmienione przez menedżera/)).toHaveLength(2);
  });

  it("counts a line the manager zeroed (manager_final 0, captain > 0)", async () => {
    renderPage(
      makeOrder("closed", [
        makeLine("OL-1", 4, 4),
        makeLine("OL-2", 2, 0), // the Pago 14.09 case
      ]),
    );
    const banner = await screen.findByTestId("manager-changed-banner");
    expect(banner).toHaveTextContent("Menedżer zmienił ilość w 1 pozycji");
    expect(screen.getByText("zmienione przez menedżera (było 2)")).toBeInTheDocument();
  });

  it("does not read manager_final 0 as a zeroing on a Transport (Pago) order", async () => {
    // Transport finalize never writes manager_final; every line ships at the
    // captain quantity, so nothing was changed (impl-review Phase 7 F1).
    renderPage({
      ...makeOrder("manager_sent", [makeLine("OL-1", 4, 0), makeLine("OL-2", 2, 0)]),
      sent_method: "transport",
    });
    await waitFor(() => expect(screen.getByText("Pozycje zamówienia")).toBeInTheDocument());
    expect(screen.queryByTestId("manager-changed-banner")).not.toBeInTheDocument();
    expect(screen.queryByText(/zmienione przez menedżera/)).not.toBeInTheDocument();
  });

  it("does not show the banner when no quantity differs", async () => {
    renderPage(
      makeOrder("manager_sent", [makeLine("OL-1", 4, 4), makeLine("OL-2", 2, 2)]),
    );
    await waitFor(() => expect(screen.getByText("Pozycje zamówienia")).toBeInTheDocument());
    expect(screen.queryByTestId("manager-changed-banner")).not.toBeInTheDocument();
    expect(screen.queryByText(/zmienione przez menedżera/)).not.toBeInTheDocument();
  });

  it("does not show the banner before dispatch, even with manager_final 0", async () => {
    // captain_submitted: manager_final 0 is the untouched default, not a zeroing.
    renderPage(
      makeOrder("captain_submitted", [makeLine("OL-1", 4, 0), makeLine("OL-2", 2, 0)]),
    );
    await waitFor(() => expect(screen.getByText("Pozycje zamówienia")).toBeInTheDocument());
    expect(screen.queryByTestId("manager-changed-banner")).not.toBeInTheDocument();
    expect(screen.queryByText(/zmienione przez menedżera/)).not.toBeInTheDocument();
  });
});
