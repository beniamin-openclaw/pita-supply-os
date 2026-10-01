// Sticky "Powód zbiorczo" (feedback-1001 Phase 2, D10) on the two Captain
// order screens: Apply sets the reason now, the reason follows lines that start
// requiring one later, "Wyłącz" stops it, a hand-picked reason survives, and on
// the create screen the selection round-trips through the localStorage draft.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { LangProvider } from "../../i18n";
import { loadDraft, setToken } from "../../auth";
import type { CaptainOrderDetail, ManagerOrderLineDetail, OrderableItem } from "../../types";
import type { DraftState } from "./types";

const suppliers = vi.fn();
const orderable = vi.fn();
const captainOrder = vi.fn();
vi.mock("../../apiClient", () => ({
  ApiError: class ApiError extends Error {
    status = 0;
    detail = "";
  },
  api: {
    suppliers: () => suppliers(),
    inventoryCounts: () => Promise.resolve([]),
    inventoryCount: () => Promise.reject(new Error("unused")),
    orderable: (id: string) => orderable(id),
    captainDeliveryProposal: () => Promise.reject(new Error("no proposal")),
    captainOrder: (id: string) => captainOrder(id),
  },
}));

import { CaptainMP } from "./CaptainMP";
import { OrderEditPage } from "./OrderEditPage";

// ×1 unit, target 50: stock 0 -> suggestion 50; ordering 90 is +80% -> reason required.
function makeItem(id: string, overrides: Partial<OrderableItem> = {}): OrderableItem {
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
    ...overrides,
  };
}

function typeDeviation(id: string): void {
  fireEvent.change(document.getElementById(`current-${id}`)!, { target: { value: "0" } });
  fireEvent.change(document.getElementById(`final-${id}`)!, { target: { value: "90" } });
}

function reasonOf(id: string): string {
  return (document.getElementById(`reason-${id}`) as HTMLSelectElement).value;
}

function applyBulk(code: string): void {
  fireEvent.click(screen.getByRole("button", { name: /Powód zbiorczo/ }));
  fireEvent.change(document.getElementById("overrule-all-reason")!, { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Zastosuj" }));
}

beforeEach(() => {
  suppliers.mockReset();
  orderable.mockReset();
  captainOrder.mockReset();
  setToken("captain", "tok");
});

describe("CaptainMP — sticky bulk reason", () => {
  function renderCreate() {
    suppliers.mockResolvedValue([
      {
        supplier_id: "SUP_BUKAT",
        supplier_name: "Bukat",
        ordering_method: "email",
        active: true,
        notes: "",
      },
    ]);
    orderable.mockResolvedValue([makeItem("P1"), makeItem("P2")]);
    return render(
      <MemoryRouter>
        <LangProvider>
          <CaptainMP />
        </LangProvider>
      </MemoryRouter>,
    );
  }

  it("fills lines that start requiring a reason after Apply, keeps hand picks, stops on Wyłącz", async () => {
    renderCreate();
    await screen.findByText("Produkt P1");
    typeDeviation("P1");
    expect(reasonOf("P1")).toBe("");

    applyBulk("LOW_STORAGE");
    expect(reasonOf("P1")).toBe("LOW_STORAGE");
    expect(screen.getByText(/Aktywny powód zbiorczy/)).toBeInTheDocument();

    // A line that becomes deviating AFTER Apply gets the reason automatically.
    typeDeviation("P2");
    expect(reasonOf("P2")).toBe("LOW_STORAGE");

    // A hand-picked reason on a line is not overwritten by the sticky pass.
    fireEvent.change(document.getElementById("reason-P2")!, {
      target: { value: "WEEKEND_HIGH_TRAFFIC" },
    });
    fireEvent.change(document.getElementById("final-P2")!, { target: { value: "95" } });
    expect(reasonOf("P2")).toBe("WEEKEND_HIGH_TRAFFIC");

    fireEvent.click(screen.getByRole("button", { name: "Wyłącz" }));
    expect(screen.queryByText(/Aktywny powód zbiorczy/)).not.toBeInTheDocument();
  });

  it("persists bulkReason in the draft and restores it after a reload", async () => {
    const first = renderCreate();
    await screen.findByText("Produkt P1");
    typeDeviation("P1");
    applyBulk("LOW_STORAGE");
    first.unmount(); // the flush-on-unmount path writes the draft synchronously

    const draft = loadDraft<DraftState>("SUP_BUKAT");
    expect(draft?.state.bulkReason).toEqual({ code: "LOW_STORAGE", comment: "" });

    renderCreate();
    await screen.findByText("Produkt P1");
    await waitFor(() =>
      expect(screen.getByText(/Aktywny powód zbiorczy/)).toBeInTheDocument(),
    );
    expect(reasonOf("P1")).toBe("LOW_STORAGE");
  });

  it("hides the control for a supplier with suggestion alerts off", async () => {
    suppliers.mockResolvedValue([
      { supplier_id: "SUP_BUKAT", supplier_name: "Bukat", ordering_method: "email", active: true, notes: "" },
    ]);
    orderable.mockResolvedValue([makeItem("P1", { suggestion_alerts_enabled: false })]);
    render(
      <MemoryRouter>
        <LangProvider>
          <CaptainMP />
        </LangProvider>
      </MemoryRouter>,
    );
    await screen.findByText("Produkt P1");
    expect(screen.queryByRole("button", { name: /Powód zbiorczo/ })).not.toBeInTheDocument();
  });
});

describe("OrderEditPage — sticky bulk reason", () => {
  function detailLine(id: string): ManagerOrderLineDetail {
    return {
      order_line_id: `OL-${id}`,
      product_id: id,
      product_name_pl: `Produkt ${id}`,
      inventory_unit: "szt",
      is_critical: false,
      supplier_product_id: `SP-${id}`,
      supplier_product_name: `SP ${id}`,
      purchase_unit: "szt",
      units_per_purchase_unit: 1,
      current_stock_qty_base: 0,
      target_stock_qty_base: 50,
      max_stock_qty_base: 1000,
      allow_over_max_due_to_packaging: false,
      suggested_qty_base: 50,
      suggested_qty_purchase: 50,
      captain_final_qty_purchase: 90,
      captain_final_qty_base: 90,
      manager_final_qty_purchase: 0,
      manager_final_qty_base: 0,
      reason_code: null,
      captain_comment: "",
      manager_comment: "",
    };
  }

  it("applies, follows later lines and stops on Wyłącz", async () => {
    const order: CaptainOrderDetail = {
      order_id: "ORD-1",
      location_id: "WOLA",
      location_name: "Wola",
      supplier_id: "SUP_BUKAT",
      supplier_name: "Bukat",
      order_date: "2026-10-01",
      status: "captain_submitted",
      notes: "",
      editable: true,
      lines: [detailLine("P1")],
    };
    captainOrder.mockResolvedValue(order);
    orderable.mockResolvedValue([makeItem("P1"), makeItem("P2")]);
    render(
      <MemoryRouter initialEntries={["/captain-v2/orders/ORD-1/edit"]}>
        <LangProvider>
          <Routes>
            <Route path="/captain-v2/orders/:order_id/edit" element={<OrderEditPage />} />
          </Routes>
        </LangProvider>
      </MemoryRouter>,
    );
    await screen.findByText("Produkt P2");

    applyBulk("LOW_STORAGE");
    expect(reasonOf("P1")).toBe("LOW_STORAGE");

    typeDeviation("P2");
    expect(reasonOf("P2")).toBe("LOW_STORAGE");

    fireEvent.click(screen.getByRole("button", { name: "Wyłącz" }));
    expect(screen.queryByText(/Aktywny powód zbiorczy/)).not.toBeInTheDocument();
  });
});
