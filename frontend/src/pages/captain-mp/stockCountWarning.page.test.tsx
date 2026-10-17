// captain-stock-count-warning (D6) on the Captain order screen: with the
// location flag on, the confirm dialog warns when no stock was counted or every
// count is 0, and the Captain can still send; with the flag off (NORBLIN,
// ELEKTROWNIA) nothing changes. The API is mocked: nothing is sent anywhere.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { LangProvider } from "../../i18n";
import type { CaptainSupplier, OrderableItem } from "../../types";

const captainSuppliers = vi.fn();
const orderable = vi.fn();
const captainSubmit = vi.fn();
vi.mock("../../apiClient", () => ({
  ApiError: class ApiError extends Error {
    status = 0;
    detail = "";
  },
  api: {
    captainSuppliers: () => captainSuppliers(),
    suppliers: () => Promise.reject(new Error("global list unused")),
    inventoryCounts: () => Promise.resolve([]),
    inventoryCount: () => Promise.reject(new Error("unused")),
    orderable: (id: string) => orderable(id),
    captainDeliveryProposal: () => Promise.reject(new Error("no proposal")),
    captainSubmit: (req: unknown) => captainSubmit(req),
  },
}));

import { CaptainMP } from "./CaptainMP";

const BUKAT: CaptainSupplier = {
  supplier_id: "SUP_BUKAT",
  supplier_name: "Bukat",
  ordering_method: "email",
  active: true,
  notes: "",
};

// ×1 unit, target 50, max 1000: stock 10 → suggestion 40 (green at 40).
function makeItem(id: string, requireStockCount: boolean | undefined): OrderableItem {
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
    require_stock_count: requireStockCount,
  };
}

function setLocationFlag(requireStockCount: boolean | undefined): void {
  orderable.mockImplementation(() =>
    Promise.resolve([makeItem("P1", requireStockCount), makeItem("P2", requireStockCount)]),
  );
}

async function renderScreen(): Promise<void> {
  render(
    <MemoryRouter initialEntries={["/captain-v2"]}>
      <LangProvider>
        <Routes>
          <Route path="/captain-v2" element={<CaptainMP />} />
          <Route path="/captain-v2/orders/:order_id" element={<div>detail</div>} />
        </Routes>
      </LangProvider>
    </MemoryRouter>,
  );
  await screen.findByText("Produkt P1");
}

function type(id: string, value: string): void {
  fireEvent.change(document.getElementById(id)!, { target: { value } });
}

function openConfirm(): void {
  type("order-ordered-by", "Ola");
  fireEvent.click(screen.getByRole("button", { name: "Wyślij" }));
}

beforeEach(() => {
  captainSuppliers.mockReset();
  orderable.mockReset();
  captainSubmit.mockReset();
  captainSuppliers.mockResolvedValue([BUKAT]);
  captainSubmit.mockResolvedValue({
    order_id: "ORD-T",
    status: "captain_submitted",
    line_count: 1,
    total_value_estimate_pln: 0,
    warnings: [],
  });
});

describe("CaptainMP — stock-count warning (D6)", () => {
  it("flag on, no stock typed: warns, and 'Wyślij mimo to' still submits", async () => {
    setLocationFlag(true);
    await renderScreen();
    type("final-P1", "40"); // an order quantity, but no stock on any card
    openConfirm();

    expect(screen.getByTestId("confirm-stock-warning")).toHaveTextContent("Nie wpisano stanów");
    fireEvent.click(screen.getByRole("button", { name: "Wyślij mimo to" }));
    await waitFor(() => expect(captainSubmit).toHaveBeenCalledTimes(1));
  });

  it("flag on, every typed stock is 0: warns with the all-zero copy", async () => {
    setLocationFlag(true);
    await renderScreen();
    type("current-P1", "0");
    type("final-P1", "50");
    openConfirm();

    expect(screen.getByTestId("confirm-stock-warning")).toHaveTextContent(
      "Wszystkie wpisane stany to 0",
    );
    // Going back keeps the order unsent.
    const back = screen.getAllByRole("button", { name: "Wróć i popraw" });
    fireEvent.click(back[back.length - 1]);
    expect(screen.queryByTestId("confirm-stock-warning")).not.toBeInTheDocument();
    expect(captainSubmit).not.toHaveBeenCalled();
  });

  it("flag absent (older backend) behaves as on", async () => {
    setLocationFlag(undefined);
    await renderScreen();
    type("final-P1", "40");
    openConfirm();
    expect(screen.getByTestId("confirm-stock-warning")).toBeInTheDocument();
  });

  it("flag on, a real count: no warning, plain confirm", async () => {
    setLocationFlag(true);
    await renderScreen();
    type("current-P1", "10");
    type("final-P1", "40");
    openConfirm();

    expect(screen.queryByTestId("confirm-stock-warning")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tak, wyślij" }));
    await waitFor(() => expect(captainSubmit).toHaveBeenCalledTimes(1));
  });

  it("flag off (Norblin): no warning even with no stock typed", async () => {
    setLocationFlag(false);
    await renderScreen();
    type("final-P1", "40");
    openConfirm();

    expect(screen.queryByTestId("confirm-stock-warning")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tak, wyślij" }));
    await waitFor(() => expect(captainSubmit).toHaveBeenCalledTimes(1));
  });
});
