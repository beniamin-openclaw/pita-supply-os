// order-email-v2 impl-review W1: while a Gmail draft is being created the page
// is locked — switching orders or releasing/cancelling must not drop the
// dispatch that follows the verified draft, nor build it from another order.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../i18n";
import type { ManagerOrderDetail, ManagerQueueItem } from "../types";

vi.mock("../apiClient", async (importOriginal) => {
  const real = await importOriginal<typeof import("../apiClient")>();
  return {
    ...real,
    api: {
      managerQueue: vi.fn(),
      managerOrder: vi.fn(),
      managerOrderable: vi.fn(async () => []),
      managerDispatch: vi.fn(),
      managerRelease: vi.fn(),
    },
  };
});

vi.mock("./manager/lib/orderEmailDraft", async (importOriginal) => {
  const real = await importOriginal<typeof import("./manager/lib/orderEmailDraft")>();
  return {
    ...real,
    getGoogleClientId: vi.fn(() => "client-id"),
    createVerifiedOrderDraft: vi.fn(),
  };
});

import { api } from "../apiClient";
import * as orderDraft from "./manager/lib/orderEmailDraft";
import { ManagerPage } from "./ManagerPage";

function queueItem(orderId: string, locationName: string): ManagerQueueItem {
  return {
    order_id: orderId,
    location_id: locationName.toUpperCase(),
    location_name: locationName,
    supplier_id: "SUP_BUKAT",
    supplier_name: "Bukat",
    order_date: "2026-09-28",
    status: "manager_claimed",
    line_count: 1,
    deviation_count: 0,
    reason_count: 0,
    total_value_estimate_pln: 100,
    received_count: 0,
    received_discrepancy_count: 0,
  } as ManagerQueueItem;
}

function detail(orderId: string, locationName: string): ManagerOrderDetail {
  return {
    order_id: orderId,
    location_id: locationName.toUpperCase(),
    location_name: locationName,
    supplier_id: "SUP_BUKAT",
    supplier_name: "Bukat",
    supplier_email: "biuro@bukat.com",
    cc_email: "biuro@pitabros.pl",
    location_email: null,
    sender_email: "bracka@pitabros.pl",
    order_mailbox: "biuro@pitabros.pl",
    email_signers: [],
    ordering_method: "email",
    supplier_notes: "",
    order_date: "2026-09-28",
    status: "manager_claimed",
    notes: "",
    lines: [
      {
        order_line_id: `${orderId}-L1`,
        product_id: "P1",
        product_name_pl: "Pomidor",
        inventory_unit: "kg",
        is_critical: false,
        supplier_product_id: "SP1",
        supplier_product_name: "Pomidor",
        purchase_unit: "kg",
        units_per_purchase_unit: 1,
        current_stock_qty_base: 0,
        target_stock_qty_base: 0,
        max_stock_qty_base: 0,
        allow_over_max_due_to_packaging: false,
        suggested_qty_base: 0,
        suggested_qty_purchase: 0,
        captain_final_qty_purchase: 5,
        captain_final_qty_base: 5,
        manager_final_qty_purchase: 0,
        manager_final_qty_base: 0,
        captain_comment: "",
        manager_comment: "",
      },
    ],
    receipts: [],
  } as ManagerOrderDetail;
}

const DETAILS: Record<string, ManagerOrderDetail> = {
  "ORD-1": detail("ORD-1", "Pita Bros Bracka"),
  "ORD-2": detail("ORD-2", "Pita Bros Wola"),
};

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  });
  vi.mocked(api.managerQueue).mockImplementation(async (_loc, status) =>
    status === "manager_claimed"
      ? [queueItem("ORD-1", "Pita Bros Bracka"), queueItem("ORD-2", "Pita Bros Wola")]
      : [],
  );
  vi.mocked(api.managerOrder).mockImplementation(async (id: string) => DETAILS[id]);
  vi.mocked(api.managerDispatch).mockResolvedValue({
    order_id: "ORD-1",
    status: "manager_sent",
    gmail_compose_url: null,
    supplier_email: "biuro@bukat.com",
    total_value_estimate_pln: 0,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderPage() {
  render(
    <MemoryRouter>
      <LangProvider>
        <ManagerPage />
      </LangProvider>
    </MemoryRouter>,
  );
}

describe("ManagerPage — page lock during a Gmail draft", () => {
  it("refuses other actions mid-draft, then dispatches the clicked order", async () => {
    let finish: (v: { draftId: string }) => void = () => {};
    vi.mocked(orderDraft.createVerifiedOrderDraft).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Pita Bros Bracka → Bukat/ }));
    const draftButton = await screen.findByRole("button", { name: "Zrób draft w Gmailu" });
    act(() => {
      fireEvent.click(draftButton);
    });

    // Another order cannot be opened while the draft is pending.
    fireEvent.click(screen.getByRole("button", { name: /Pita Bros Wola → Bukat/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Trwa tworzenie szkicu");
    expect(api.managerOrder).not.toHaveBeenCalledWith("ORD-2");
    expect(screen.getByRole("button", { name: "Odrzuć do poprawy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anuluj zamówienie" })).toBeDisabled();

    await act(async () => finish({ draftId: "r-1" }));
    await waitFor(() => expect(api.managerDispatch).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.managerDispatch).mock.calls[0][0]).toMatchObject({
      order_id: "ORD-1",
      manager_finals: [{ order_line_id: "ORD-1-L1", manager_final_qty_purchase: 5 }],
    });

    // Lock released: the other order opens normally.
    fireEvent.click(screen.getByRole("button", { name: /Pita Bros Wola → Bukat/ }));
    await waitFor(() => expect(api.managerOrder).toHaveBeenCalledWith("ORD-2"));
  });

  it("a failed draft releases the lock without dispatching", async () => {
    vi.mocked(orderDraft.createVerifiedOrderDraft).mockRejectedValue(
      new orderDraft.WrongMailboxError("beniamin@pitabros.pl"),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Pita Bros Bracka → Bukat/ }));
    const draftButton = await screen.findByRole("button", { name: "Zrób draft w Gmailu" });
    await act(async () => {
      fireEvent.click(draftButton);
    });
    expect(api.managerDispatch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Odrzuć do poprawy" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Pita Bros Wola → Bukat/ }));
    await waitFor(() => expect(api.managerOrder).toHaveBeenCalledWith("ORD-2"));
  });
});
