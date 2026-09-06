import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../../../i18n";
import { HistorySegment } from "./HistorySegment";

function renderAt(path: string) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <HistorySegment />
      </MemoryRouter>
    </LangProvider>,
  );
}

describe("HistorySegment", () => {
  it("renders both links with correct hrefs", () => {
    renderAt("/captain-v2/orders");
    const orders = screen.getByText("Zamówienia").closest("a");
    const inventory = screen.getByText("Remanenty").closest("a");
    expect(orders).toHaveAttribute("href", "/captain-v2/orders");
    expect(inventory).toHaveAttribute("href", "/captain-v2/inventory-history");
  });

  it("marks Zamówienia active on the orders route", () => {
    renderAt("/captain-v2/orders");
    expect(screen.getByText("Zamówienia").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Remanenty").closest("a")).not.toHaveAttribute("aria-current");
  });

  it("marks Remanenty active on the inventory-history route", () => {
    renderAt("/captain-v2/inventory-history");
    expect(screen.getByText("Remanenty").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Zamówienia").closest("a")).not.toHaveAttribute("aria-current");
  });

  it("marks Remanenty active on an inventory-history sub-route (detail)", () => {
    renderAt("/captain-v2/inventory-history/INV-123");
    expect(screen.getByText("Remanenty").closest("a")).toHaveAttribute("aria-current", "page");
  });

  it("marks Zamówienia active on an orders sub-route (detail)", () => {
    renderAt("/captain-v2/orders/ORD-123");
    expect(screen.getByText("Zamówienia").closest("a")).toHaveAttribute("aria-current", "page");
  });
});
