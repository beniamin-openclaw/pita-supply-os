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
  lock: { busyId?: string | null; draftingId?: string | null } = {},
  onCloseWithoutReceipt: (orderId: string) => void = () => {},
): void {
  render(
    <MemoryRouter>
      <LangProvider>
        <OrderDetailPane
          selectedId={detail.order_id}
          detail={detail}
          loading={false}
          busyId={lock.busyId ?? null}
          draftingId={lock.draftingId ?? null}
          drafts={drafts}
          availableToAdd={[]}
          onAddLine={() => {}}
          onClaim={() => {}}
          onRelease={() => {}}
          onCancel={() => {}}
          onCloseWithoutReceipt={onCloseWithoutReceipt}
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

  it("is disabled while an action or a Gmail draft runs on the order", () => {
    renderPane(makeDetail(), () => {}, {}, { busyId: "ORD-1" });
    expect(screen.getByRole("button", BUTTON)).toBeDisabled();
  });

  it("is disabled while a Gmail draft is being created", () => {
    renderPane(makeDetail(), () => {}, {}, { draftingId: "ORD-1" });
    expect(screen.getByRole("button", BUTTON)).toBeDisabled();
  });

  it("is not offered on a sent Filber order", () => {
    renderPane(makeDetail({ status: "manager_sent", editable_after_send: true }));
    expect(screen.queryByRole("button", BUTTON)).toBeNull();
  });

  it("is not offered when Filber is not an e-mail supplier", () => {
    renderPane(makeDetail({ ordering_method: "manual" }));
    // The dispatch panel's own mark-as-ordered covers that case.
    expect(screen.getByRole("button", { name: "Oznacz jako zamówione ✓" })).toBeInTheDocument();
    expect(screen.queryByRole("button", BUTTON)).toBeNull();
  });

  it("is not offered before the order is claimed", () => {
    renderPane(makeDetail({ status: "captain_submitted" }));
    expect(screen.queryByRole("button", BUTTON)).toBeNull();
  });
});

const CLOSE = { name: "Zamknij bez przyjęcia" };

describe("OrderDetailPane — close without receipt (D5)", () => {
  const RECEIPT = {
    receipt_id: "RCP-1",
    order_id: "ORD-1",
    location_id: "WOLA",
    supplier_id: "SUP_FILBER",
    receipt_date: "2026-10-16",
    line_count: 1,
    discrepancy_count: 0,
    lines: [],
  } as unknown as ManagerOrderDetail["receipts"][number];

  it("offers the close on a sent order with no receipt and calls the handler", () => {
    const onClose = vi.fn();
    renderPane(
      makeDetail({ status: "manager_sent", editable_after_send: true }),
      () => {},
      {},
      {},
      onClose,
    );
    fireEvent.click(screen.getByRole("button", CLOSE));
    expect(onClose).toHaveBeenCalledWith("ORD-1");
  });

  it("offers it on a sent Transport member too (read-only branch)", () => {
    renderPane(
      makeDetail({ status: "manager_sent", supplier_order_reference: "TRN-20261005-PAGO-1" }),
    );
    expect(screen.getByRole("button", CLOSE)).toBeEnabled();
  });

  it("is disabled while an action runs on the order", () => {
    renderPane(makeDetail({ status: "manager_sent" }), () => {}, {}, { busyId: "ORD-1" });
    expect(screen.getByRole("button", CLOSE)).toBeDisabled();
  });

  it("is not offered once a receipt exists", () => {
    renderPane(makeDetail({ status: "manager_sent", receipts: [RECEIPT] }));
    expect(screen.queryByRole("button", CLOSE)).toBeNull();
  });

  it("is not offered on a claimed order", () => {
    renderPane(makeDetail({ status: "manager_claimed" }));
    expect(screen.queryByRole("button", CLOSE)).toBeNull();
  });

  it("a closed order without a receipt says so, with the reason", () => {
    renderPane(
      makeDetail({
        status: "closed",
        events: [
          {
            event_id: "OEV-1",
            order_id: "ORD-1",
            event_type: "closed_without_receipt",
            actor: "manager-default",
            at: "2026-10-17T09:00:00Z",
            details: "Towar przyszedł poza aplikacją",
          },
        ],
      }),
    );
    expect(screen.queryByRole("button", CLOSE)).toBeNull();
    expect(screen.getByTestId("closed-without-receipt")).toHaveTextContent(
      "Zamknięte bez przyjęcia",
    );
    expect(screen.getByText("Powód: Towar przyszedł poza aplikacją")).toBeInTheDocument();
    expect(screen.queryByText("Zablokowane po odbiorze")).toBeNull();
    // The status pill must not claim a delivery ("Zrealizowane") that never came.
    expect(screen.queryByText("Zrealizowane")).toBeNull();
  });

  it("a closed order with a receipt keeps the received lock", () => {
    renderPane(makeDetail({ status: "closed", receipts: [RECEIPT] }));
    expect(screen.getByText("Zablokowane po odbiorze")).toBeInTheDocument();
    expect(screen.getAllByText("Zrealizowane").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("closed-without-receipt")).toBeNull();
  });
});

