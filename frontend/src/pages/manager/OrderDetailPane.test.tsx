import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../../i18n";
import type { ManagerOrderDetail, ManagerOrderLineDetail } from "../../types";
import type { DraftMap } from "./lib/draftState";
import { OrderDetailPane } from "./OrderDetailPane";

function makeLine(overrides: Partial<ManagerOrderLineDetail> = {}): ManagerOrderLineDetail {
  return {
    order_line_id: "OL-ORD-1-001",
    product_id: "P001",
    product_name_pl: "Cola",
    inventory_unit: "szt",
    is_critical: false,
    supplier_product_id: "SP001",
    supplier_product_name: "Cola 0,5",
    purchase_unit: "zgrzewka",
    units_per_purchase_unit: 12,
    current_stock_qty_base: 10,
    target_stock_qty_base: 100,
    max_stock_qty_base: 120,
    allow_over_max_due_to_packaging: false,
    suggested_qty_base: 90,
    suggested_qty_purchase: 2,
    captain_final_qty_purchase: 2,
    captain_final_qty_base: 24,
    manager_final_qty_purchase: null,
    manager_final_qty_base: null,
    captain_comment: "",
    manager_comment: "",
    ...overrides,
  } as ManagerOrderLineDetail;
}

function makeDetail(overrides: Partial<ManagerOrderDetail> = {}): ManagerOrderDetail {
  return {
    order_id: "ORD-1",
    location_id: "WOLA",
    location_name: "Pita Bros Wola",
    supplier_id: "SUP_FILBER",
    supplier_name: "Filber",
    supplier_email: "orders@example.test",
    ordering_method: "email",
    supplier_notes: "",
    order_date: "2026-10-17",
    status: "manager_claimed",
    notes: "",
    lines: [makeLine()],
    receipts: [],
    ...overrides,
  };
}

function renderPane(
  detail: ManagerOrderDetail,
  onDispatch: (orderId: string, sentMethod: string) => void = () => {},
  drafts: DraftMap = {},
): void {
  render(
    <MemoryRouter>
      <LangProvider>
        <OrderDetailPane
          selectedId={detail.order_id}
          detail={detail}
          loading={false}
          busyId={null}
          drafts={drafts}
          availableToAdd={[]}
          onAddLine={() => {}}
          onClaim={() => {}}
          onRelease={() => {}}
          onCancel={() => {}}
          onSave={() => {}}
          onDispatch={onDispatch}
          onQtyChange={() => {}}
          onCommentChange={() => {}}
          onToast={() => {}}
        />
      </LangProvider>
    </MemoryRouter>,
  );
}

const BUTTON = { name: "Zamówione (bez e-maila)" };

describe("OrderDetailPane — Filber mark-ordered without e-mail (D4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches a claimed Filber e-mail order as manual after the confirm", () => {
    const onDispatch = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPane(makeDetail(), onDispatch);
    fireEvent.click(screen.getByRole("button", BUTTON));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onDispatch).toHaveBeenCalledWith("ORD-1", "manual");
    // The e-mail path stays available next to it.
    expect(screen.getByRole("link", { name: "Otwórz w Gmail" })).toBeInTheDocument();
  });

  it("does nothing when the confirm is declined", () => {
    const onDispatch = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPane(makeDetail(), onDispatch);
    fireEvent.click(screen.getByRole("button", BUTTON));
    expect(onDispatch).not.toHaveBeenCalled();
  });

  it("is disabled when every line is zero", () => {
    renderPane(makeDetail(), () => {}, {
      "OL-ORD-1-001": { qty: 0, comment: "" },
    } as DraftMap);
    expect(screen.getByRole("button", BUTTON)).toBeDisabled();
  });

  it("is not offered for another e-mail supplier", () => {
    renderPane(makeDetail({ supplier_id: "SUP_BUKAT", supplier_name: "Bukat" }));
    expect(screen.getByRole("link", { name: "Otwórz w Gmail" })).toBeInTheDocument();
    expect(screen.queryByRole("button", BUTTON)).toBeNull();
  });

  it("is not offered before the order is claimed", () => {
    renderPane(makeDetail({ status: "captain_submitted" }));
    expect(screen.queryByRole("button", BUTTON)).toBeNull();
  });
});
