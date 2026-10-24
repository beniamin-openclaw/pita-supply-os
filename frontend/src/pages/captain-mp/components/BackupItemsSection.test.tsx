import { useState, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import { BackupItemsSection } from "./BackupItemsSection";
import { ProductCard } from "./ProductCard";
import type { OrderableItem, OrderLine } from "../types";

function backupItem(id: string, name: string): OrderableItem {
  return {
    product_id: id,
    product_name_pl: name,
    inventory_unit: "kg",
    is_critical: false,
    purchase_unit: "kg",
    units_per_purchase_unit: 1,
    rounding_rule: "full_only",
    min_stock_qty_base: 0,
    max_stock_qty_base: 10,
    target_stock_qty_base: 10,
    allow_over_max_due_to_packaging: false,
    supplier_product_id: `SP-${id}`,
    supplier_product_name: name,
    is_backup: true,
    primary_supplier_names: ["Pago"],
    suggestion_alerts_enabled: false,
  };
}

const ITEMS: OrderableItem[] = [backupItem("P014", "Feta"), backupItem("P020", "Oliwki")];

function blankLine(item: OrderableItem): OrderLine {
  return {
    product_id: item.product_id,
    supplier_product_id: item.supplier_product_id,
    current_stock_qty_base: "",
    captain_final_qty_purchase: "",
  };
}

/** Holds `lines` like CaptainMP does, so typed quantities survive a toggle. */
function Harness({
  items,
  initial = {},
}: {
  items: OrderableItem[];
  initial?: Record<string, OrderLine>;
}): ReactNode {
  const [lines, setLines] = useState<Record<string, OrderLine>>(initial);
  return (
    <LangProvider>
      <BackupItemsSection
        items={items}
        lines={lines}
        renderCard={(item: OrderableItem) => (
          <ProductCard
            key={item.product_id}
            item={item}
            line={lines[item.product_id] || blankLine(item)}
            onChange={(next: OrderLine) =>
              setLines((prev: Record<string, OrderLine>) => ({ ...prev, [next.product_id]: next }))
            }
          />
        )}
      />
    </LangProvider>
  );
}

function toggle(): HTMLElement {
  return screen.getByRole("button", { name: /Pozycje zapasowe/ });
}

function finalInput(id: string): HTMLInputElement | null {
  return document.getElementById(`final-${id}`) as HTMLInputElement | null;
}

describe("BackupItemsSection", () => {
  it("is collapsed by default and hides every blank backup card", () => {
    render(<Harness items={ITEMS} />);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveTextContent("Pozycje zapasowe (2)");
    expect(toggle()).toHaveTextContent("rozwiń, gdy chcesz zamówić tutaj");
    expect(screen.queryByText("Feta")).toBeNull();
    expect(screen.queryByText("Oliwki")).toBeNull();
  });

  it("expands to show all backup cards", () => {
    render(<Harness items={ITEMS} />);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(finalInput("P014")).not.toBeNull();
    expect(finalInput("P020")).not.toBeNull();
  });

  it("keeps a typed quantity visible after collapsing", () => {
    render(<Harness items={ITEMS} />);
    fireEvent.click(toggle());
    fireEvent.change(finalInput("P014") as HTMLInputElement, { target: { value: "3" } });
    fireEvent.click(toggle());

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(finalInput("P014")?.value).toBe("3");
    expect(finalInput("P020")).toBeNull();
    expect(toggle()).toHaveTextContent("Z ilością do zamówienia: 1");

    // Re-expanding shows the same value — nothing was lost.
    fireEvent.click(toggle());
    expect(finalInput("P014")?.value).toBe("3");
  });

  it("shows a backup with a restored draft quantity while collapsed, including 0", () => {
    render(
      <Harness
        items={ITEMS}
        initial={{
          P020: { ...blankLine(ITEMS[1]), captain_final_qty_purchase: 0 },
        }}
      />,
    );
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(finalInput("P020")?.value).toBe("0");
    expect(finalInput("P014")).toBeNull();
    // A typed 0 keeps the card on screen but is not counted as an order.
    expect(toggle()).toHaveTextContent("rozwiń, gdy chcesz zamówić tutaj");
  });

  it("keeps a collapsed card on screen while its quantity is cleared and retyped", () => {
    render(<Harness items={ITEMS} />);
    fireEvent.click(toggle());
    fireEvent.change(finalInput("P014") as HTMLInputElement, { target: { value: "3" } });
    fireEvent.click(toggle());

    const input = finalInput("P014") as HTMLInputElement;
    input.focus();
    // Captain backspaces "3" to type "5" — the card must not unmount mid-edit.
    fireEvent.change(input, { target: { value: "" } });
    expect(finalInput("P014")).toBe(input);
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "5" } });
    expect(finalInput("P014")?.value).toBe("5");
    expect(toggle()).toHaveTextContent("Z ilością do zamówienia: 1");
  });

  it("drops a cleared card from the collapsed view after the next collapse", () => {
    render(<Harness items={ITEMS} />);
    fireEvent.click(toggle());
    fireEvent.change(finalInput("P014") as HTMLInputElement, { target: { value: "3" } });
    fireEvent.click(toggle());
    fireEvent.change(finalInput("P014") as HTMLInputElement, { target: { value: "" } });
    expect(finalInput("P014")).not.toBeNull();

    fireEvent.click(toggle()); // expand
    fireEvent.click(toggle()); // collapse again — the blank card goes
    expect(finalInput("P014")).toBeNull();
  });

  it("renders nothing without backup items", () => {
    render(<Harness items={[]} />);
    expect(screen.queryByTestId("backup-items-section")).toBeNull();
  });
});
