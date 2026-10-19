// captain-backup-dropdown on the Captain order screen: backup-supplier cards
// sit in a collapsed "Pozycje zapasowe" section below the regular cards; a
// quantity typed on a backup card survives collapsing and is still submitted.
// The API is mocked: nothing is sent anywhere.

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

const KUCHNIE: CaptainSupplier = {
  supplier_id: "SUP_KUCHNIE",
  supplier_name: "Kuchnie Świata",
  ordering_method: "email",
  active: true,
  notes: "",
};

function makeItem(id: string, name: string, isBackup: boolean): OrderableItem {
  return {
    product_id: id,
    product_name_pl: name,
    inventory_unit: "kg",
    is_critical: false,
    purchase_unit: "kg",
    units_per_purchase_unit: 1,
    rounding_rule: "full_only",
    min_stock_qty_base: 0,
    max_stock_qty_base: 100,
    target_stock_qty_base: 10,
    allow_over_max_due_to_packaging: false,
    supplier_product_id: `SP-${id}`,
    supplier_product_name: name,
    is_backup: isBackup,
    primary_supplier_names: isBackup ? ["Pago + Magazyn"] : [],
  };
}

async function renderScreen(waitFor: string): Promise<void> {
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
  await screen.findByText(waitFor);
}

function type(id: string, value: string): void {
  fireEvent.change(document.getElementById(id)!, { target: { value } });
}

function toggle(): HTMLElement {
  return screen.getByRole("button", { name: /Pozycje zapasowe/ });
}

beforeEach(() => {
  captainSuppliers.mockReset();
  orderable.mockReset();
  captainSubmit.mockReset();
  captainSuppliers.mockResolvedValue([KUCHNIE]);
  captainSubmit.mockResolvedValue({
    order_id: "ORD-T",
    status: "captain_submitted",
    line_count: 2,
    total_value_estimate_pln: 0,
    warnings: [],
  });
});

describe("CaptainMP — backup items section", () => {
  it("collapses backups by default; a typed backup qty stays visible and is submitted", async () => {
    orderable.mockResolvedValue([
      makeItem("P001", "Ryż", false),
      makeItem("P014", "Feta", true),
      makeItem("P020", "Oliwki", true),
    ]);
    await renderScreen("Ryż");

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveTextContent("Pozycje zapasowe (2)");
    expect(document.getElementById("final-P014")).toBeNull();

    fireEvent.click(toggle());
    type("final-P014", "3");
    fireEvent.click(toggle());
    expect((document.getElementById("final-P014") as HTMLInputElement).value).toBe("3");
    expect(document.getElementById("final-P020")).toBeNull();

    type("current-P001", "5");
    type("final-P001", "5");
    type("order-ordered-by", "Ola");
    fireEvent.click(screen.getByRole("button", { name: "Wyślij" }));
    fireEvent.click(screen.getByRole("button", { name: "Tak, wyślij" }));
    await waitFor(() => expect(captainSubmit).toHaveBeenCalledTimes(1));
    const req = captainSubmit.mock.calls[0][0] as {
      lines: { product_id: string; captain_final_qty_purchase: number }[];
    };
    const feta = req.lines.find((l) => l.product_id === "P014");
    expect(feta?.captain_final_qty_purchase).toBe(3);
  });

  it("a tab with only backup items shows them without a section", async () => {
    orderable.mockResolvedValue([makeItem("P014", "Feta", true)]);
    await renderScreen("Feta");
    expect(screen.queryByTestId("backup-items-section")).toBeNull();
    expect(document.getElementById("final-P014")).not.toBeNull();
  });
});
