import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import { ProductCard } from "./ProductCard";
import type { OrderableItem, OrderLine } from "../types";
import { innermostText } from "../../../test/innermostText";

function makeItem(overrides: Partial<OrderableItem> = {}): OrderableItem {
  return {
    product_id: "P1",
    product_name_pl: "Coca-Cola Zero",
    inventory_unit: "szt",
    is_critical: false,
    purchase_unit: "zgrzewka",
    units_per_purchase_unit: 24,
    rounding_rule: "full_only",
    min_stock_qty_base: 0,
    max_stock_qty_base: 120,
    target_stock_qty_base: 120,
    allow_over_max_due_to_packaging: false,
    supplier_product_id: "SP1",
    supplier_product_name: "Coca-Cola Zero zgrzewka x24",
    ...overrides,
  };
}

function makeLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return {
    product_id: "P1",
    supplier_product_id: "SP1",
    current_stock_qty_base: "",
    captain_final_qty_purchase: "",
    ...overrides,
  };
}

/** Controlled wrapper — ProductCard is a pure controlled component, so a test
 * that types into the stock input needs the parent to actually apply the
 * `onChange` update for the derived hint text to re-render. */
function Wrapper({
  item,
  initialLine,
  onChangeSpy,
}: {
  item: OrderableItem;
  initialLine: OrderLine;
  onChangeSpy: (line: OrderLine) => void;
}) {
  const [line, setLine] = useState<OrderLine>(initialLine);
  return (
    <ProductCard
      item={item}
      line={line}
      onChange={(next) => {
        onChangeSpy(next);
        setLine(next);
      }}
    />
  );
}

function renderCard(item: OrderableItem, initialLine: OrderLine) {
  const onChangeSpy = vi.fn();
  render(
    <LangProvider>
      <Wrapper item={item} initialLine={initialLine} onChangeSpy={onChangeSpy} />
    </LangProvider>,
  );
  return { onChangeSpy };
}

function retype(el: HTMLElement, v: string): void {
  fireEvent.focus(el);
  fireEvent.change(el, { target: { value: "" } });
  fireEvent.change(el, { target: { value: v } });
  fireEvent.blur(el);
}

describe("ProductCard — pack-unit display (×24 SKU)", () => {
  it("shows packs-first Cel/Max, the two-field stock reading, and the suggestion pack detail", () => {
    renderCard(makeItem(), makeLine({ current_stock_qty_base: 40 }));

    expect(screen.getByText(innermostText(/Cel: 5 zgrzewek \(120 szt\)/))).toBeInTheDocument();
    expect(screen.getByText(innermostText(/Max: 5 zgrzewek \(120 szt\)/))).toBeInTheDocument();
    // 40 szt seeds as 1 zgrzewka + 16 szt.
    expect((screen.getByLabelText("Obecny stan, zgrzewka") as HTMLInputElement).value).toBe("1");
    expect((screen.getByLabelText("Obecny stan, szt") as HTMLInputElement).value).toBe("16");
    expect(screen.getByText(innermostText("= 1 zgrzewka + 16 szt (40 szt)"))).toBeInTheDocument();
    expect(screen.getByText(innermostText("brakuje 80 szt"))).toBeInTheDocument();
    expect(screen.getByText(innermostText("= 3,3 zgrzewki"))).toBeInTheDocument();
    expect(screen.getByText(innermostText("→ 4 zgrzewki"))).toBeInTheDocument();
    expect(document.getElementById("final-unit-P1")).toHaveTextContent("zgrzewka");
  });

  it("typing 2 packs stores 48 base units; there is no 'wpisz w' toggle", () => {
    const { onChangeSpy } = renderCard(makeItem(), makeLine());

    expect(screen.queryByRole("button", { name: /wpisz w/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Obecny stan, zgrzewka"), { target: { value: "2" } });

    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ current_stock_qty_base: 48 }),
    );
    expect(screen.getByText(innermostText("= 2 zgrzewki (48 szt)"))).toBeInTheDocument();
  });

  it("below-min uses the pack wording", () => {
    renderCard(makeItem({ min_stock_qty_base: 48 }), makeLine({ current_stock_qty_base: 10 }));
    expect(screen.getByText(innermostText("Poniżej minimum: 2 zgrzewki (48 szt)"))).toBeInTheDocument();
  });

  it("prompts 'did you mean' when previousStock is large and the loose value is small", () => {
    const onChangeSpy = vi.fn();
    render(
      <LangProvider>
        <ProductCard
          item={makeItem()}
          line={makeLine({ current_stock_qty_base: 5 })}
          onChange={onChangeSpy}
          previousStock={200}
        />
      </LangProvider>,
    );
    retype(document.getElementById("current-P1-loose")!, "5");
    expect(screen.getByText(innermostText(/Czy chodziło o 5 zgrzewek \(120 szt\)\?/))).toBeInTheDocument();
  });
});

describe("ProductCard — ×1 SKU renders byte-identically to today", () => {
  it("has one stock field, the old target-line wording, and no pack '=' hint", () => {
    renderCard(
      makeItem({ purchase_unit: "szt", units_per_purchase_unit: 1 }),
      makeLine({ current_stock_qty_base: 40 }),
    );

    expect((screen.getByLabelText("Obecny stan") as HTMLInputElement).value).toBe("40");
    expect(document.getElementById("current-unit-P1")?.textContent).toBe("szt");
    expect(
      screen.getByText(innermostText("target 120 szt · max 120 · 1 szt = 1 szt")),
    ).toBeInTheDocument();
    // No pack-conversion "=" hint under the stock input (only the ×24 SKU gets one).
    expect(screen.queryByText(/40 szt =/)).not.toBeInTheDocument();
    // The suggestion tile keeps the old arrow-only wording, not a pack "=" form.
    expect(screen.getByText(innermostText("brakuje 80 szt → 80 szt"))).toBeInTheDocument();
  });
});

describe("ProductCard — suggestion 0 is information (week2-feedback-quantities)", () => {
  it("stock ≥ target with a positive order mounts NO ReasonPicker and shows the info pill", () => {
    // target 120, stock 130 → suggestion 0; ordering 2 zgrzewki anyway.
    renderCard(makeItem(), makeLine({ current_stock_qty_base: 130, captain_final_qty_purchase: 2 }));

    expect(screen.queryByText("Wybierz powód odchylenia")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Stan 130 ≥ cel 120 szt — powód niewymagany",
    );
  });

  it("stock below target with a >25% deviation still mounts the ReasonPicker", () => {
    // target 120, stock 40 → suggestion 4; ordering 8 is +100% → reason required.
    renderCard(makeItem(), makeLine({ current_stock_qty_base: 40, captain_final_qty_purchase: 8 }));

    expect(screen.getByText("Wybierz powód odchylenia")).toBeInTheDocument();
  });

  it("supplier with alerts off: suggestion shown, no reason, no below-minimum warning", () => {
    // Same +100% line as above, plus stock 40 < min 60 — both would alert.
    renderCard(
      makeItem({ suggestion_alerts_enabled: false, min_stock_qty_base: 60 }),
      makeLine({ current_stock_qty_base: 40, captain_final_qty_purchase: 8 }),
    );

    expect(screen.queryByText("Wybierz powód odchylenia")).not.toBeInTheDocument();
    expect(screen.queryByText(/Poniżej minimum/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Ilość wpisana");
    expect(document.getElementById("suggest-P1")).toHaveTextContent("4");
  });
});

describe("ProductCard — bulk pack (feedback-1001 D22/D33)", () => {
  // SP_BUKAT_P006 shape: kg, tenth_kg, critical, skrzynka of 6 kg.
  const pomidor = (): OrderableItem =>
    makeItem({
      product_name_pl: "Pomidor",
      inventory_unit: "kg",
      purchase_unit: "kg",
      units_per_purchase_unit: 1,
      rounding_rule: "tenth_kg",
      is_critical: true,
      target_stock_qty_base: 42,
      max_stock_qty_base: 42,
      case_unit: "skrzynka",
      units_per_case: 6,
    });

  it("reads thresholds in crates and splits stock as [skrzynki] + [kg]", () => {
    renderCard(pomidor(), makeLine({ current_stock_qty_base: 14 }));

    expect(screen.getByText(innermostText(/Cel: 7 skrzynek \(42 kg\)/))).toBeInTheDocument();
    expect(screen.getByText(innermostText("1 skrzynka = 6 kg"))).toBeInTheDocument();
    expect((screen.getByLabelText("Obecny stan, skrzynka") as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText("Obecny stan, kg") as HTMLInputElement).value).toBe("2");
    // Need 28 kg -> 4,67 crates -> 5 crates (30 kg); the need is shown too (F5).
    expect(screen.getByText(innermostText("brakuje 28 kg"))).toBeInTheDocument();
    expect(screen.getByText(innermostText("→ 28 kg ≈ 5 skrzynek (30 kg)"))).toBeInTheDocument();
  });

  it("the order is [skrzynki] + [kg] and emits one combined purchase quantity", () => {
    const { onChangeSpy } = renderCard(pomidor(), makeLine({ current_stock_qty_base: 14 }));

    fireEvent.change(screen.getByLabelText("Zamawiasz, skrzynka"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Zamawiasz, kg"), { target: { value: "4" } });
    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ captain_final_qty_purchase: 28 }),
    );
    expect(document.getElementById("final-P1-reading")).toHaveTextContent(
      "= 4 skrzynki + 4 kg (28 kg)",
    );
    // Ordering the raw need (28 kg) is a green match — no reason picker.
    expect(screen.getByRole("status")).toHaveTextContent("Zgodnie z sugestią");
  });

  it("tapping the suggestion fills whole crates into both fields", () => {
    renderCard(pomidor(), makeLine({ current_stock_qty_base: 14 }));
    fireEvent.click(screen.getByRole("button", { name: /Zaakceptuj sugestię: 30 kg/ }));
    expect((screen.getByLabelText("Zamawiasz, skrzynka") as HTMLInputElement).value).toBe("5");
    expect((screen.getByLabelText("Zamawiasz, kg") as HTMLInputElement).value).toBe("0");
  });

  it("a need under half a crate suggests 0 crates; a big order still asks for a reason", () => {
    renderCard(
      pomidor(),
      makeLine({ current_stock_qty_base: 40, captain_final_qty_purchase: 18 }),
    );
    expect(screen.getByText(innermostText("→ 2 kg ≈ 0 skrzynek"))).toBeInTheDocument();
    expect(screen.getByLabelText("Zamawiasz, skrzynka")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("status")).toHaveTextContent("+800% odchylenia — wymagany powód");
  });
});

describe("ProductCard — bulk pack shows the per-rule need (impl-review F5)", () => {
  const pomidor = (): OrderableItem =>
    makeItem({
      product_name_pl: "Pomidor",
      inventory_unit: "kg",
      purchase_unit: "kg",
      units_per_purchase_unit: 1,
      rounding_rule: "tenth_kg",
      is_critical: true,
      target_stock_qty_base: 10,
      max_stock_qty_base: 12,
      case_unit: "skrzynka",
      units_per_case: 6,
    });

  it("stock 7,05: 'brakuje 2,95 kg → 3 kg ≈ 1 skrzynka (6 kg)'", () => {
    renderCard(pomidor(), makeLine({ current_stock_qty_base: 7.05 }));
    expect(screen.getByText(innermostText("brakuje 2,95 kg"))).toBeInTheDocument();
    expect(screen.getByText(innermostText("→ 3 kg ≈ 1 skrzynka (6 kg)"))).toBeInTheDocument();
  });

  it("need equal to the case suggestion keeps the short form", () => {
    renderCard(pomidor(), makeLine({ current_stock_qty_base: 4 }));
    expect(screen.getByText(innermostText("→ 1 skrzynka (6 kg)"))).toBeInTheDocument();
  });

  it("English copy", () => {
    localStorage.setItem("supply_os_lang", "en");
    try {
      renderCard(pomidor(), makeLine({ current_stock_qty_base: 7.05 }));
      expect(screen.getByText(innermostText("need 2.95 kg"))).toBeInTheDocument();
      expect(screen.getByText(innermostText("→ 3 kg ≈ 1 crate (6 kg)"))).toBeInTheDocument();
    } finally {
      localStorage.removeItem("supply_os_lang");
    }
  });
});

describe("ProductCard — non-case suggestion detail number formatting", () => {
  it("stock 7,05 / target 10: 'brakuje 2,95 kg' without a float artefact", () => {
    const item: OrderableItem = makeItem({
      product_name_pl: "Pomidor",
      inventory_unit: "kg",
      purchase_unit: "kg",
      units_per_purchase_unit: 1,
      rounding_rule: "tenth_kg",
      target_stock_qty_base: 10,
      max_stock_qty_base: 12,
    });
    renderCard(item, makeLine({ current_stock_qty_base: 7.05 }));
    expect(screen.getByText(innermostText(/^brakuje 2,95 kg/))).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/2\.9500/);
  });
});

describe("ProductCard — backup + cross-supplier info (krakow-katowice-rollout)", () => {
  const ref = {
    order_id: "O1",
    supplier_id: "SUP_X",
    supplier_name: "Hurtownia X",
    status: "captain_submitted",
    qty_purchase: 3,
    purchase_unit: "zgrzewka",
    qty_base: 72,
    inventory_unit: "szt",
    order_date: "2026-10-07",
    requested_delivery_date: "2026-10-09",
    captain_submitted_at: null,
  };

  it("backup: dashed frame, tile shows the primary supplier, one info line", () => {
    const { onChangeSpy } = renderCard(
      makeItem({
        is_backup: true,
        suggestion_alerts_enabled: false,
        primary_supplier_names: ["Bukat", "Pago"],
      }),
      makeLine({ current_stock_qty_base: 5 }),
    );
    expect(screen.getByText("zapasowy")).toBeInTheDocument();
    expect(screen.getByTestId("backup-info").textContent).toBe("Zapasowy · główny: Bukat, Pago");
    // The old separate line is gone.
    expect(screen.queryByText("Sugestia u: Bukat, Pago")).toBeNull();
    const tile = screen.getByRole("button", { name: "Sugestia u dostawcy głównego: Bukat, Pago" });
    expect(tile).toBeDisabled();
    expect(tile.textContent).toContain("u Bukat, Pago");
    expect(tile.textContent).not.toContain("—");
    expect(tile.getAttribute("aria-label")).not.toMatch(/najpierw wpisz/);
    expect(document.querySelector(".rounded-xl")?.className).toContain("border-dashed");
    fireEvent.click(tile);
    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it("backup: info line carries the newest open-order date, no duplicate block", () => {
    renderCard(
      makeItem({
        is_backup: true,
        primary_supplier_names: ["Bukat"],
        open_orders_elsewhere: [
          ref,
          { ...ref, order_id: "O2", order_date: "2026-10-12" },
          { ...ref, order_id: "O3", order_date: "2026-10-03" },
        ],
      }),
      makeLine(),
    );
    expect(screen.getByTestId("backup-info").textContent).toBe(
      "Zapasowy · główny: Bukat · zamówione 12.10",
    );
    expect(screen.queryByTestId("open-orders-elsewhere")).toBeNull();
  });

  it("backup: 'zamówione' is the Warsaw day of the submit, not the UTC order_date", () => {
    renderCard(
      makeItem({
        is_backup: true,
        primary_supplier_names: ["Bukat"],
        open_orders_elsewhere: [
          { ...ref, order_date: "2026-10-12", captain_submitted_at: "2026-10-12T22:30:00Z" },
        ],
      }),
      makeLine(),
    );
    expect(screen.getByTestId("backup-info").textContent).toBe(
      "Zapasowy · główny: Bukat · zamówione 13.10",
    );
  });

  it("backup without primary names still has an honest tile label", () => {
    renderCard(makeItem({ is_backup: true }), makeLine({ current_stock_qty_base: 1 }));
    expect(screen.getByTestId("backup-info").textContent).toBe("Zapasowy");
    expect(
      screen.getByRole("button", { name: /Dostawca zapasowy/ }).getAttribute("aria-label"),
    ).not.toMatch(/najpierw wpisz/);
  });

  it("non-backup card keeps a solid frame and the open-order block", () => {
    renderCard(makeItem({ open_orders_elsewhere: [ref] }), makeLine());
    expect(document.querySelector(".rounded-xl")?.className).not.toContain("border-dashed");
    expect(screen.queryByTestId("backup-info")).toBeNull();
    expect(screen.getByTestId("open-orders-elsewhere")).toBeInTheDocument();
  });

  it("captain view hides the /N pack suffix in the card title", () => {
    renderCard(makeItem({ product_name_pl: "MELVIT KASZA PĘCZAK 900g/10" }), makeLine());
    expect(screen.getByText("MELVIT KASZA PĘCZAK 900g")).toBeInTheDocument();
  });

  it("open order elsewhere with a delivery date", () => {
    renderCard(makeItem({ open_orders_elsewhere: [ref] }), makeLine());
    expect(
      screen.getByText("Już zamówione u Hurtownia X: 3 zgrzewki · U menedżera · dostawa 09.10"),
    ).toBeInTheDocument();
  });

  it("open order elsewhere without a delivery date", () => {
    renderCard(
      makeItem({ open_orders_elsewhere: [{ ...ref, requested_delivery_date: null }] }),
      makeLine(),
    );
    expect(
      screen.getByText(
        "Już zamówione u Hurtownia X: 3 zgrzewki · U menedżera · zamówienie z 07.10",
      ),
    ).toBeInTheDocument();
  });

  it("'Też u' for a multi-supplier non-backup item", () => {
    renderCard(
      makeItem({
        other_suppliers: [
          { supplier_id: "S1", supplier_name: "Alfa" },
          { supplier_id: "S2", supplier_name: "Beta" },
        ],
      }),
      makeLine(),
    );
    expect(screen.getByText("Też u: Alfa, Beta")).toBeInTheDocument();
  });

  it("plain item shows none of it", () => {
    renderCard(makeItem(), makeLine());
    expect(screen.queryByText("zapasowy")).toBeNull();
    expect(screen.queryByText(/Też u/)).toBeNull();
    expect(screen.queryByTestId("open-orders-elsewhere")).toBeNull();
  });
});

// captain-kg-reading: read-only kg next to the order card's stock field.
describe("ProductCard — kg reading for a piece count", () => {
  const halloumi = (overrides: Partial<OrderableItem> = {}): OrderableItem =>
    makeItem({
      product_id: "P015",
      product_name_pl: "Halloumi",
      supplier_product_name: "Halloumi Reha 200gr",
      purchase_unit: "szt",
      units_per_purchase_unit: 1,
      max_stock_qty_base: 48,
      target_stock_qty_base: 48,
      ...overrides,
    });

  it("x1: typing 12 shows (2,4 kg) under the unit caption, read from the supplier name", () => {
    const { onChangeSpy } = renderCard(halloumi(), makeLine({ product_id: "P015" }));
    const kg = screen.getByTestId("current-kg-P015");
    expect(kg).toBeEmptyDOMElement();
    fireEvent.change(screen.getByLabelText("Obecny stan"), { target: { value: "12" } });
    expect(kg).toHaveTextContent("(2,4 kg)");
    expect(document.getElementById("current-unit-P015")).toHaveTextContent("szt(2,4 kg)");
    // Display only: the line still carries pieces.
    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ current_stock_qty_base: 12 }),
    );
  });

  it("x1: a multipack product_name_pl decides over a clean supplier name", () => {
    renderCard(
      halloumi({ product_name_pl: "Halloumi 200g/12" }),
      makeLine({ product_id: "P015", current_stock_qty_base: 12 }),
    );
    expect(screen.queryByTestId("current-kg-P015")).not.toBeInTheDocument();
  });

  it("x1 kg product: no kg line", () => {
    renderCard(
      halloumi({ product_name_pl: "Gyros 15 KG", inventory_unit: "kg", purchase_unit: "kg" }),
      makeLine({ product_id: "P015", current_stock_qty_base: 30 }),
    );
    expect(screen.queryByTestId("current-kg-P015")).not.toBeInTheDocument();
  });

  it("pack row reads product_name_pl only: a weight only in the supplier name shows nothing", () => {
    renderCard(
      halloumi({ case_unit: "karton", units_per_case: 12, supplier_product_name: "Halloumi 200g" }),
      makeLine({ product_id: "P015", current_stock_qty_base: 12 }),
    );
    expect(document.getElementById("current-P015-reading")).toHaveTextContent(
      /^= 1 karton \(12 szt\)$/,
    );
  });

  it("pack row with the weight in product_name_pl adds the kg", () => {
    renderCard(
      halloumi({
        product_name_pl: "Halloumi Reha 200gr",
        case_unit: "karton",
        units_per_case: 12,
      }),
      makeLine({ product_id: "P015", current_stock_qty_base: 12 }),
    );
    expect(document.getElementById("current-P015-reading")).toHaveTextContent(
      "= 1 karton (12 szt · 2,4 kg)",
    );
  });
});
