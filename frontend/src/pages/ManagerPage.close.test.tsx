// close-without-receipt (D5): the Manager closes a sent order with no receipt —
// confirm, then a required reason, sent trimmed with the manager token route.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../i18n";
import type { ManagerOrderDetail, ManagerQueueItem, OrderStatus } from "../types";

vi.mock("../apiClient", async (importOriginal) => {
  const real = await importOriginal<typeof import("../apiClient")>();
  return {
    ...real,
    api: {
      managerQueue: vi.fn(),
      managerOrder: vi.fn(),
      managerOrderable: vi.fn(async () => []),
      managerDispatch: vi.fn(),
      managerClose: vi.fn(),
      suppliers: vi.fn(async () => []),
    },
  };
});

import { api } from "../apiClient";
import { ManagerPage } from "./ManagerPage";

function queueItem(orderId: string, supplierId: string, supplierName: string): ManagerQueueItem {
  return {
    order_id: orderId,
    location_id: "WOLA",
    location_name: "Pita Bros Wola",
    supplier_id: supplierId,
    supplier_name: supplierName,
    order_date: "2026-10-17",
    status: "manager_claimed",
    line_count: 1,
    deviation_count: 0,
    reason_count: 0,
    total_value_estimate_pln: 100,
    received_count: 0,
    received_discrepancy_count: 0,
  } as ManagerQueueItem;
}

function filberDetail(status: OrderStatus): ManagerOrderDetail {
  return {
    order_id: "ORD-F",
    location_id: "WOLA",
    location_name: "Pita Bros Wola",
    supplier_id: "SUP_FILBER",
    supplier_name: "Filber",
    supplier_email: "zamowienia@filber.example",
    cc_email: "biuro@pitabros.pl",
    location_email: null,
    sender_email: "wola@pitabros.pl",
    order_mailbox: "biuro@pitabros.pl",
    email_signers: [],
    ordering_method: "email",
    supplier_notes: "",
    order_date: "2026-10-17",
    status,
    notes: "",
    lines: [
      {
        order_line_id: "ORD-F-L1",
        product_id: "P1",
        product_name_pl: "Cola",
        inventory_unit: "szt",
        is_critical: false,
        supplier_product_id: "SP1",
        supplier_product_name: "Cola",
        purchase_unit: "zgrzewka",
        units_per_purchase_unit: 12,
        current_stock_qty_base: 0,
        target_stock_qty_base: 0,
        max_stock_qty_base: 0,
        allow_over_max_due_to_packaging: false,
        suggested_qty_base: 0,
        suggested_qty_purchase: 0,
        captain_final_qty_purchase: 3,
        captain_final_qty_base: 36,
        manager_final_qty_purchase: null,
        manager_final_qty_base: null,
        captain_comment: "",
        manager_comment: "",
      },
    ],
    receipts: [],
  } as ManagerOrderDetail;
}

const SENT: ManagerQueueItem[] = [
  { ...queueItem("ORD-F", "SUP_FILBER", "Filber"), status: "manager_sent" } as ManagerQueueItem,
];

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  });
  vi.mocked(api.managerQueue).mockImplementation(async (_loc, status) =>
    status === "manager_sent" ? SENT : [],
  );
  vi.mocked(api.managerOrder).mockImplementation(async () => ({
    ...filberDetail("manager_sent"),
    editable_after_send: true,
  }));
  vi.mocked(api.managerClose).mockResolvedValue({ order_id: "ORD-F", status: "closed" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function renderPage(): void {
  render(
    <MemoryRouter>
      <LangProvider>
        <ManagerPage />
      </LangProvider>
    </MemoryRouter>,
  );
}

async function openSentOrder(): Promise<HTMLElement> {
  renderPage();
  // The sent lane starts collapsed.
  const lanes = await screen.findAllByRole("button", { name: /^Zamówione/ });
  const header = lanes.find((b) => b.hasAttribute("aria-expanded"));
  if (!header) throw new Error("sent lane header not found");
  fireEvent.click(header);
  fireEvent.click(await screen.findByRole("button", { name: /Pita Bros Wola → Filber/ }));
  return screen.findByRole("button", { name: "Zamknij bez przyjęcia" });
}

describe("ManagerPage — close without receipt", () => {
  it("confirms, asks for a reason and closes with the trimmed reason", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "prompt").mockReturnValue("  Towar poza aplikacją  ");
    fireEvent.click(await openSentOrder());
    await waitFor(() =>
      expect(api.managerClose).toHaveBeenCalledWith("ORD-F", "Towar poza aplikacją"),
    );
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Zamknięto bez przyjęcia")).toBeInTheDocument();
    await waitFor(() => expect(api.managerOrder).toHaveBeenCalledTimes(2));
  });

  it("sends nothing when the reason is left empty", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "prompt").mockReturnValue("   ");
    fireEvent.click(await openSentOrder());
    expect(api.managerClose).not.toHaveBeenCalled();
  });

  it("sends nothing when the confirm is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const prompt = vi.spyOn(window, "prompt");
    fireEvent.click(await openSentOrder());
    expect(prompt).not.toHaveBeenCalled();
    expect(api.managerClose).not.toHaveBeenCalled();
  });
});
