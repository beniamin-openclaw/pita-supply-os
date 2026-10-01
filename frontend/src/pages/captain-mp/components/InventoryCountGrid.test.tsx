// Information layer of the inventory grid (week2-feedback-quantities Phase 3):
// pack hint for upp > 1 (absent for upp 1), "ostatnio" from the previous-count
// map, and the 3 x max "sprawdź jednostkę" warning that appears/disappears
// with the typed stock. Nothing here blocks submit — the grid has no submit.

import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import type { InventoryProduct } from "../../../types";
import type { InventoryProductGroup } from "../lib/inventoryGrouping";
import type { InventoryLineInput } from "../lib/inventoryLines";
import { InventoryCountGrid, type PreviousCount } from "./InventoryCountGrid";

const KORFU: InventoryProduct = {
  product_id: "P170",
  product_name_pl: "Korfu Pilsner",
  product_category: "Napoje",
  inventory_unit: "szt",
  is_critical: false,
  purchase_unit: "box",
  units_per_purchase_unit: 12,
  order_note: null,
  supplier_id: "SUP_CORFU",
  supplier_name: "Corfu",
  min_stock_qty_base: 12,
  target_stock_qty_base: 36,
  max_stock_qty_base: 36,
};

const TZATZYKI: InventoryProduct = {
  product_id: "P040",
  product_name_pl: "Tzatzyki",
  product_category: "Chłodnia",
  inventory_unit: "kg",
  is_critical: false,
  purchase_unit: "kg",
  units_per_purchase_unit: 1,
  order_note: "karton 6",
  supplier_id: "SUP_BUKAT",
  supplier_name: "Bukat",
  min_stock_qty_base: 6,
  target_stock_qty_base: 36,
  max_stock_qty_base: 36,
};

function renderGrid(
  lines: Record<string, InventoryLineInput>,
  previousByProduct?: Record<string, PreviousCount>,
) {
  const groups: InventoryProductGroup[] = [
    { category: "Napoje", items: [KORFU] },
    { category: "Chłodnia", items: [TZATZYKI] },
  ];
  render(
    <LangProvider>
      <InventoryCountGrid
        groupedProducts={groups}
        lines={lines}
        collapsedCategories={new Set()}
        onToggleCategory={vi.fn()}
        onStockChange={vi.fn()}
        onCommentChange={vi.fn()}
        previousByProduct={previousByProduct}
      />
    </LangProvider>,
  );
}

const line = (stock: number | ""): InventoryLineInput => ({
  current_stock_qty_base: stock,
  count_comment: "",
});

// The prompt follows the Captain's own typing only — re-type and leave the field.
function retype(el: HTMLElement, v: string): void {
  fireEvent.focus(el);
  fireEvent.change(el, { target: { value: "" } });
  fireEvent.change(el, { target: { value: v } });
  fireEvent.blur(el);
}

describe("InventoryCountGrid information layer", () => {
  it("renders the pack hint for upp 12 and nothing for upp 1", () => {
    renderGrid({});
    expect(screen.getByTestId("pack-P170")).toHaveTextContent("1 box = 12 szt");
    expect(screen.queryByTestId("pack-P040")).not.toBeInTheDocument();
  });

  it("pack row renders two inputs; x1 row keeps one", () => {
    renderGrid({});
    expect(screen.getByLabelText(/box/, { selector: "#stock-P170-packs" })).toBeInTheDocument();
    expect(document.getElementById("stock-P170-loose")).toBeInTheDocument();
    expect(document.getElementById("stock-P170")).toBeNull();
    expect(document.getElementById("stock-P040")).toBeInTheDocument();
    expect(document.getElementById("stock-P040-packs")).toBeNull();
  });

  it("typing 2 packs emits 24 base units", () => {
    const onStockChange = vi.fn();
    render(
      <LangProvider>
        <InventoryCountGrid
          groupedProducts={[{ category: "Napoje", items: [KORFU] }]}
          lines={{}}
          collapsedCategories={new Set()}
          onToggleCategory={vi.fn()}
          onStockChange={onStockChange}
          onCommentChange={vi.fn()}
        />
      </LangProvider>,
    );
    fireEvent.change(document.getElementById("stock-P170-packs")!, { target: { value: "2" } });
    expect(onStockChange).toHaveBeenLastCalledWith("P170", 24);
  });

  it("a 30-unit stock reads as packs + loose", () => {
    renderGrid({ P170: line(30) });
    expect(document.getElementById("stock-P170-reading")).toHaveTextContent(
      "= 2 box + 6 szt (30 szt)",
    );
  });

  it("prompts 'did you mean packs' from the target (no previous)", () => {
    renderGrid({ P170: line(3) });
    retype(document.getElementById("stock-P170-loose")!, "3");
    expect(screen.getByRole("button", { name: /tak/i })).toBeInTheDocument();
  });

  it("prompts from previousByProduct when target is too low", () => {
    const lowTarget: InventoryProduct = { ...KORFU, target_stock_qty_base: 0 };
    const tree = (prev?: Record<string, PreviousCount>) => (
      <LangProvider>
        <InventoryCountGrid
          groupedProducts={[{ category: "Napoje", items: [lowTarget] }]}
          lines={{ P170: line(3) }}
          collapsedCategories={new Set()}
          onToggleCategory={vi.fn()}
          onStockChange={vi.fn()}
          onCommentChange={vi.fn()}
          previousByProduct={prev}
        />
      </LangProvider>
    );
    const { rerender } = render(tree());
    expect(screen.queryByRole("button", { name: /tak/i })).not.toBeInTheDocument();
    rerender(tree({ P170: { qty: 36, date: "13.09.2026" } }));
    const loose = document.getElementById("stock-P170-loose")!;
    retype(loose, "3");
    expect(screen.getByRole("button", { name: /tak/i })).toBeInTheDocument();
  });

  it("shows the master-data order_note", () => {
    renderGrid({});
    expect(screen.getByText("karton 6")).toBeInTheDocument();
  });

  it("renders 'ostatnio' from the previous-count map, only for mapped products", () => {
    renderGrid({}, { P040: { qty: 36, date: "13.09.2026" } });
    expect(screen.getByTestId("prev-P040")).toHaveTextContent("ostatnio 36 kg · 13.09.2026");
    expect(screen.queryByTestId("prev-P170")).not.toBeInTheDocument();
  });

  it("shows the 3 x max unit warning above the threshold and hides it below", () => {
    renderGrid({ P040: line(200) });
    expect(screen.getByTestId("check-unit-P040")).toHaveTextContent("sprawdź jednostkę");
    expect(screen.getByTestId("check-unit-P040")).not.toHaveTextContent("36");
  });

  it("no warning at or below 3 x max, or when max is 0", () => {
    const noMax: InventoryProduct = { ...TZATZYKI, product_id: "P041", max_stock_qty_base: 0 };
    render(
      <LangProvider>
        <InventoryCountGrid
          groupedProducts={[{ category: "Chłodnia", items: [TZATZYKI, noMax] }]}
          lines={{ P040: line(108), P041: line(9999) }}
          collapsedCategories={new Set()}
          onToggleCategory={vi.fn()}
          onStockChange={vi.fn()}
          onCommentChange={vi.fn()}
        />
      </LangProvider>,
    );
    expect(screen.queryByTestId("check-unit-P040")).not.toBeInTheDocument();
    expect(screen.queryByTestId("check-unit-P041")).not.toBeInTheDocument();
  });
});

// Phase 4 (week2-feedback-quantities): search + toggle chips filter the grid
// and a hit expands its (otherwise collapsed) category.
describe("InventoryCountGrid toolbar", () => {
  function renderCollapsed(lines: Record<string, InventoryLineInput>) {
    const groups: InventoryProductGroup[] = [
      { category: "Napoje", items: [KORFU] },
      { category: "Chłodnia", items: [{ ...TZATZYKI, is_critical: true }] },
    ];
    render(
      <LangProvider>
        <InventoryCountGrid
          groupedProducts={groups}
          lines={lines}
          collapsedCategories={new Set(["Napoje", "Chłodnia"])}
          onToggleCategory={vi.fn()}
          onStockChange={vi.fn()}
          onCommentChange={vi.fn()}
        />
      </LangProvider>,
    );
  }

  it("keeps collapsed categories closed without a filter", () => {
    renderCollapsed({});
    expect(screen.queryByText("Korfu Pilsner")).not.toBeInTheDocument();
    expect(screen.queryByText("Tzatzyki")).not.toBeInTheDocument();
  });

  it("typing a query (after the debounce) shows only the hits, category expanded", async () => {
    vi.useFakeTimers();
    try {
      renderCollapsed({});
      fireEvent.change(screen.getByPlaceholderText("Szukaj produktu…"), {
        target: { value: "kor" },
      });
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByText("Korfu Pilsner")).toBeInTheDocument();
      expect(screen.queryByText("Tzatzyki")).not.toBeInTheDocument();
      expect(screen.queryByText("Chłodnia")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("'tylko nieliczone' hides counted products and expands the rest", () => {
    renderCollapsed({ P170: line(12) });
    fireEvent.click(screen.getByRole("button", { name: "Tylko nieliczone" }));
    expect(screen.queryByText("Korfu Pilsner")).not.toBeInTheDocument();
    expect(screen.getByText("Tzatzyki")).toBeInTheDocument();
  });

  it("'tylko nieliczone' keeps the card the Captain is typing into (frozen set)", () => {
    // Regression (impl-review Phase 4 F1): with the toggle on, entering the
    // first digit must NOT unmount the card — the uncounted membership is
    // frozen when the toggle turns on, not read from the live inputs.
    const groups: InventoryProductGroup[] = [
      { category: "Napoje", items: [KORFU] },
      { category: "Chłodnia", items: [TZATZYKI] },
    ];
    const tree = (lines: Record<string, InventoryLineInput>) => (
      <LangProvider>
        <InventoryCountGrid
          groupedProducts={groups}
          lines={lines}
          collapsedCategories={new Set()}
          onToggleCategory={vi.fn()}
          onStockChange={vi.fn()}
          onCommentChange={vi.fn()}
        />
      </LangProvider>
    );
    const { rerender } = render(tree({ P170: line("") }));
    fireEvent.click(screen.getByRole("button", { name: "Tylko nieliczone" }));
    expect(screen.getByText("Korfu Pilsner")).toBeInTheDocument();
    // The Captain types "1" (of "12") — the parent writes it into `lines`.
    rerender(tree({ P170: line(1) }));
    expect(screen.getByText("Korfu Pilsner")).toBeInTheDocument();
    // Toggling off and on again rebuilds the set: Korfu is now counted.
    fireEvent.click(screen.getByRole("button", { name: "Tylko nieliczone" }));
    fireEvent.click(screen.getByRole("button", { name: "Tylko nieliczone" }));
    expect(screen.queryByText("Korfu Pilsner")).not.toBeInTheDocument();
    expect(screen.getByText("Tzatzyki")).toBeInTheDocument();
  });

  it("'tylko krytyczne' keeps critical products only", () => {
    renderCollapsed({});
    fireEvent.click(screen.getByRole("button", { name: "Tylko krytyczne" }));
    expect(screen.queryByText("Korfu Pilsner")).not.toBeInTheDocument();
    expect(screen.getByText("Tzatzyki")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    vi.useFakeTimers();
    try {
      renderCollapsed({});
      fireEvent.change(screen.getByPlaceholderText("Szukaj produktu…"), {
        target: { value: "zzz" },
      });
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByText("Brak produktów pasujących do filtrów.")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("InventoryCountGrid bulk pack (feedback-1001 D22)", () => {
  const HALLOUMI: InventoryProduct = {
    product_id: "P015",
    product_name_pl: "Halloumi",
    product_category: "Chłodnia",
    inventory_unit: "szt",
    is_critical: true,
    purchase_unit: "szt",
    units_per_purchase_unit: 1,
    order_note: null,
    supplier_id: "SUP_INTERMLECZ",
    supplier_name: "Intermlecz",
    min_stock_qty_base: 12,
    target_stock_qty_base: 24,
    max_stock_qty_base: 36,
    case_unit: "karton",
    units_per_case: 12,
  };

  function renderHalloumi(
    lines: Record<string, InventoryLineInput>,
    onStockChange = vi.fn(),
  ) {
    render(
      <LangProvider>
        <InventoryCountGrid
          groupedProducts={[{ category: "Chłodnia", items: [HALLOUMI] }]}
          lines={lines}
          collapsedCategories={new Set()}
          onToggleCategory={vi.fn()}
          onStockChange={onStockChange}
          onCommentChange={vi.fn()}
        />
      </LangProvider>,
    );
    return onStockChange;
  }

  it("a case takes the count to [kartony] + [szt] even with upp 1", () => {
    renderHalloumi({ P015: line(26) });
    expect(screen.getByTestId("pack-P015")).toHaveTextContent("1 karton = 12 szt");
    expect(document.getElementById("stock-P015-reading")).toHaveTextContent(
      "= 2 kartony + 2 szt (26 szt)",
    );
  });

  it("typing 3 cartons emits 36 base units", () => {
    const onStockChange = renderHalloumi({});
    fireEvent.change(document.getElementById("stock-P015-packs")!, { target: { value: "3" } });
    expect(onStockChange).toHaveBeenLastCalledWith("P015", 36);
  });
});
