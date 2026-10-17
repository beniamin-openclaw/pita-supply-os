// supplier-groups (D4): Pago + Magazyn Mory filter as one option, and Filber's
// "zamówione (bez e-maila)" keeps no e-mail link on the sent order.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const CLAIMED: ManagerQueueItem[] = [
  queueItem("ORD-P", "SUP_PAGO", "Pago"),
  queueItem("ORD-M", "SUP_MORY", "Magazyn Mory"),
  queueItem("ORD-B", "SUP_BUKAT", "Bukat"),
  queueItem("ORD-F", "SUP_FILBER", "Filber"),
];

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  });
  vi.mocked(api.managerQueue).mockImplementation(async (_loc, status) =>
    status === "manager_claimed" ? CLAIMED : [],
  );
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

describe("ManagerPage — Pago + Mory supplier group", () => {
  it("one filter option shows both Pago and Mory orders and hides the rest", async () => {
    renderPage();
    await screen.findByRole("button", { name: /Pita Bros Wola → Bukat/ });
    const select = screen.getByLabelText("Dostawca") as HTMLSelectElement;
    const names = within(select)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(names).toContain("Pago + Magazyn Mory");
    expect(names).not.toContain("Pago");
    expect(names).not.toContain("Magazyn Mory");

    fireEvent.change(select, { target: { value: "GRP_PAGO_MORY" } });
    expect(screen.getByRole("button", { name: /Pita Bros Wola → Pago/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Pita Bros Wola → Magazyn Mory/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pita Bros Wola → Bukat/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pita Bros Wola → Filber/ })).toBeNull();
  });
});

describe("ManagerPage — Filber marked ordered without e-mail", () => {
  it("dispatches as manual and keeps no compose link on the sent order", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let sent = false;
    vi.mocked(api.managerOrder).mockImplementation(async () =>
      filberDetail(sent ? "manager_sent" : "manager_claimed"),
    );
    vi.mocked(api.managerDispatch).mockImplementation(async () => {
      sent = true;
      return {
        order_id: "ORD-F",
        status: "manager_sent",
        // The backend still builds a URL for an e-mail supplier.
        gmail_compose_url: "https://mail.google.com/mail/?view=cm&to=zamowienia",
        supplier_email: "zamowienia@filber.example",
        total_value_estimate_pln: 0,
      };
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Pita Bros Wola → Filber/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Zamówione (bez e-maila)" }));
    await waitFor(() => expect(api.managerDispatch).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.managerDispatch).mock.calls[0][0]).toMatchObject({
      order_id: "ORD-F",
      sent_method: "manual",
      signer_email: null,
      manager_finals: [{ order_line_id: "ORD-F-L1", manager_final_qty_purchase: 3 }],
    });
    expect(await screen.findByText("Oznaczono jako zamówione")).toBeInTheDocument();
    await waitFor(() => expect(api.managerOrder).toHaveBeenCalledTimes(2));
    // Positive anchor: the sent detail is on screen (no editable Release button).
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Odrzuć do poprawy" })).toBeNull(),
    );
    expect(screen.queryByRole("link", { name: "Otwórz email do dostawcy" })).toBeNull();
  });
});
