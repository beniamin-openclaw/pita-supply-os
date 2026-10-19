// captain-sent-today (WP6 + D10 A) on the Captain order screen: the ✓ on a
// supplier tab comes from the server (`sent_today`), so it survives a reload;
// a second order the same day is warned about but never blocked; an open order
// from the days before shows an information notice. Nothing here depends on
// localStorage.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { LangProvider } from "../../i18n";
import { warsawTodayIso } from "../../lib/dates";
import type { CaptainSupplier, CaptainSupplierOrderRef, OrderableItem } from "../../types";

const captainSuppliers = vi.fn();
const suppliers = vi.fn();
const orderable = vi.fn();
const captainSubmit = vi.fn();
vi.mock("../../apiClient", () => ({
  ApiError: class ApiError extends Error {
    status = 0;
    detail = "";
  },
  api: {
    captainSuppliers: () => captainSuppliers(),
    suppliers: () => suppliers(),
    inventoryCounts: () => Promise.resolve([]),
    inventoryCount: () => Promise.reject(new Error("unused")),
    orderable: (id: string) => orderable(id),
    captainDeliveryProposal: () => Promise.reject(new Error("no proposal")),
    captainSubmit: (req: unknown) => captainSubmit(req),
  },
}));

import { CaptainMP } from "./CaptainMP";

const TODAY = warsawTodayIso();
const SUBMITTED_AT = `${TODAY}T08:15:00Z`;
const WARSAW_TIME = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(SUBMITTED_AT));

function orderRef(
  orderId: string,
  status: CaptainSupplierOrderRef["status"],
  submittedOn: string,
  submittedAt: string | null,
): CaptainSupplierOrderRef {
  return {
    order_id: orderId,
    status,
    order_date: submittedOn,
    submitted_on: submittedOn,
    captain_submitted_at: submittedAt,
  };
}

function supplierRow(
  id: string,
  name: string,
  extra: Partial<CaptainSupplier> = {},
): CaptainSupplier {
  return {
    supplier_id: id,
    supplier_name: name,
    ordering_method: "email",
    active: true,
    notes: "",
    ...extra,
  };
}

// ×1 unit, target 50: stock 0 → suggestion 50; ordering 50 is green (no reason).
function makeItem(id: string): OrderableItem {
  return {
    product_id: id,
    product_name_pl: `Produkt ${id}`,
    inventory_unit: "szt",
    is_critical: false,
    purchase_unit: "szt",
    units_per_purchase_unit: 1,
    rounding_rule: "full_only",
    min_stock_qty_base: 0,
    max_stock_qty_base: 1000,
    target_stock_qty_base: 50,
    allow_over_max_due_to_packaging: false,
    supplier_product_id: `SP-${id}`,
    supplier_product_name: `SP ${id}`,
  };
}

function renderScreen(): void {
  render(
    <MemoryRouter initialEntries={["/captain-v2"]}>
      <LangProvider>
        <Routes>
          <Route path="/captain-v2" element={<CaptainMP />} />
          <Route
            path="/captain-v2/orders/:order_id"
            element={<div data-testid="order-detail-route">detail</div>}
          />
        </Routes>
      </LangProvider>
    </MemoryRouter>,
  );
}

function fillOrder(id: string): void {
  fireEvent.change(document.getElementById("order-ordered-by")!, { target: { value: "Ola" } });
  fireEvent.change(document.getElementById(`current-${id}`)!, { target: { value: "0" } });
  fireEvent.change(document.getElementById(`final-${id}`)!, { target: { value: "50" } });
}

function tab(name: string): HTMLElement {
  return screen.getByRole("tab", { name: new RegExp(name) });
}

beforeEach(() => {
  captainSuppliers.mockReset();
  suppliers.mockReset();
  orderable.mockReset();
  captainSubmit.mockReset();
  suppliers.mockRejectedValue(new Error("global list unused"));
  orderable.mockImplementation((id: string) => Promise.resolve([makeItem(`${id}-1`)]));
});

describe("CaptainMP — sent today from the database", () => {
  it("shows the ✓ and the notice from server data on a fresh load", async () => {
    captainSuppliers.mockResolvedValue([
      supplierRow("SUP_BUKAT", "Bukat", {
        sent_today: orderRef("ORD-A", "manager_sent", TODAY, SUBMITTED_AT),
      }),
      supplierRow("SUP_INTERMLECZ", "Intermlecz"),
    ]);
    renderScreen();
    await screen.findByText("Produkt SUP_BUKAT-1");

    expect(within(tab("Bukat")).getByText("wysłano dziś")).toBeInTheDocument();
    expect(within(tab("Intermlecz")).queryByText("wysłano dziś")).not.toBeInTheDocument();
    expect(screen.getByTestId("sent-today-notice")).toHaveTextContent(
      `Dziś już wysłano zamówienie do Bukat (${WARSAW_TIME}).`,
    );
    expect(screen.queryByTestId("open-order-notice")).not.toBeInTheDocument();

    // The notice links to that order.
    fireEvent.click(
      within(screen.getByTestId("sent-today-notice")).getByRole("button", {
        name: "Zobacz zamówienie",
      }),
    );
    expect(await screen.findByTestId("order-detail-route")).toBeInTheDocument();
  });

  it("warns in the confirm dialog but still submits a second order", async () => {
    captainSuppliers.mockResolvedValue([
      supplierRow("SUP_BUKAT", "Bukat", {
        sent_today: orderRef("ORD-A", "captain_submitted", TODAY, SUBMITTED_AT),
      }),
    ]);
    captainSubmit.mockResolvedValue({
      order_id: "ORD-B",
      status: "captain_submitted",
      line_count: 1,
      total_value_estimate_pln: 0,
      warnings: [],
    });
    renderScreen();
    await screen.findByText("Produkt SUP_BUKAT-1");
    fillOrder("SUP_BUKAT-1");

    fireEvent.click(screen.getByRole("button", { name: "Wyślij" }));
    expect(screen.getByTestId("confirm-sent-today")).toHaveTextContent(
      `Dziś już wysłano zamówienie do Bukat (${WARSAW_TIME}). Wysłać kolejne?`,
    );
    fireEvent.click(screen.getByRole("button", { name: "Wyślij mimo to" }));

    await waitFor(() => expect(captainSubmit).toHaveBeenCalledTimes(1));
    expect(captainSubmit.mock.calls[0][0]).toMatchObject({ supplier_id: "SUP_BUKAT" });
  });

  it("shows the open-order hint with date and status, not as a warning", async () => {
    captainSuppliers.mockResolvedValue([
      supplierRow("SUP_BUKAT", "Bukat"),
      supplierRow("SUP_INTERMLECZ", "Intermlecz", {
        open_order: orderRef("ORD-O", "manager_claimed", "2026-10-15", "2026-10-15T07:00:00Z"),
      }),
    ]);
    renderScreen();
    await screen.findByText("Produkt SUP_BUKAT-1");
    expect(screen.queryByTestId("open-order-notice")).not.toBeInTheDocument();

    fireEvent.click(tab("Intermlecz"));
    expect(await screen.findByTestId("open-order-notice")).toHaveTextContent(
      "Masz już otwarte zamówienie u tego dostawcy (z 15.10, status: W realizacji).",
    );
    expect(screen.queryByTestId("sent-today-notice")).not.toBeInTheDocument();
    // An open order is not "sent today": no ✓ on the tab.
    expect(within(tab("Intermlecz")).queryByText("wysłano dziś")).not.toBeInTheDocument();
  });

  it("marks the tab ✓ right after a submit and re-reads the server's view", async () => {
    captainSuppliers
      .mockResolvedValueOnce([
        supplierRow("SUP_BUKAT", "Bukat"),
        supplierRow("SUP_INTERMLECZ", "Intermlecz"),
      ])
      .mockResolvedValue([
        supplierRow("SUP_BUKAT", "Bukat", {
          sent_today: orderRef("ORD-NEW", "captain_submitted", TODAY, SUBMITTED_AT),
        }),
        supplierRow("SUP_INTERMLECZ", "Intermlecz"),
      ]);
    captainSubmit.mockResolvedValue({
      order_id: "ORD-NEW",
      status: "captain_submitted",
      line_count: 1,
      total_value_estimate_pln: 0,
      warnings: [],
    });
    renderScreen();
    await screen.findByText("Produkt SUP_BUKAT-1");
    expect(screen.queryByTestId("sent-today-notice")).not.toBeInTheDocument();
    fillOrder("SUP_BUKAT-1");

    fireEvent.click(screen.getByRole("button", { name: "Wyślij" }));
    // No earlier order today: the plain confirm.
    expect(screen.queryByTestId("confirm-sent-today")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tak, wyślij" }));

    // The screen moves on to the next supplier; Bukat keeps its ✓.
    await screen.findByText("Produkt SUP_INTERMLECZ-1");
    expect(within(tab("Bukat")).getByText("wysłano dziś")).toBeInTheDocument();
    await waitFor(() => expect(captainSuppliers).toHaveBeenCalledTimes(2));

    // Back on Bukat the notice names the order just sent.
    fireEvent.click(tab("Bukat"));
    expect(await screen.findByTestId("sent-today-notice")).toHaveTextContent(
      /Dziś już wysłano zamówienie do Bukat \(\d{2}:\d{2}\)\./,
    );
  });

  it("shows no ✓ and no notices on the global fallback list", async () => {
    captainSuppliers.mockRejectedValue(Object.assign(new Error("404"), { status: 404 }));
    suppliers.mockResolvedValue([supplierRow("SUP_BUKAT", "Bukat")]);
    renderScreen();
    await screen.findByText("Produkt SUP_BUKAT-1");
    expect(within(tab("Bukat")).queryByText("wysłano dziś")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sent-today-notice")).not.toBeInTheDocument();
    expect(screen.queryByTestId("open-order-notice")).not.toBeInTheDocument();
  });
});
