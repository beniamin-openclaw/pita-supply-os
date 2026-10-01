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
