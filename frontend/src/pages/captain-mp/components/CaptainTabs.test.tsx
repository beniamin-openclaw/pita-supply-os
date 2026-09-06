import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../../../i18n";
import { CaptainTabs } from "./CaptainTabs";

function renderAt(path: string) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <CaptainTabs />
      </MemoryRouter>
    </LangProvider>,
  );
}

describe("CaptainTabs", () => {
  it("renders both destination tabs", () => {
    renderAt("/captain-v2");
    expect(screen.getByText("Zamówienia")).toBeInTheDocument();
    expect(screen.getByText("Remanent")).toBeInTheDocument();
  });

  it("marks the orders tab active on the order screen", () => {
    renderAt("/captain-v2");
    expect(screen.getByText("Zamówienia").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Remanent").closest("a")).not.toHaveAttribute("aria-current");
  });

  it("marks the inventory tab active across the whole inventory subtree", () => {
    // The history sub-page is now part of the Historia tab, NOT Remanent —
    // it is reachable from there via the Zamówienia/Remanenty segment.
    renderAt("/captain-v2/inventory-history");
    expect(screen.getByText("Historia").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Remanent").closest("a")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Zamówienia").closest("a")).not.toHaveAttribute("aria-current");
  });

  it("marks the Remanent tab active on the count-entry screen", () => {
    renderAt("/captain-v2/inventory-count");
    expect(screen.getByText("Remanent").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Historia").closest("a")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Zamówienia").closest("a")).not.toHaveAttribute("aria-current");
  });
});
