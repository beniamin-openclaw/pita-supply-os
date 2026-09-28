import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { LangProvider } from "../../i18n";
import { MinimumOrderChip } from "./MinimumOrderChip";

function renderChip(props: {
  total: number | null | undefined;
  minimum: number | null | undefined;
  basis?: number | null;
}) {
  return render(
    <LangProvider>
      <MinimumOrderChip {...props} />
    </LangProvider>,
  );
}

describe("MinimumOrderChip", () => {
  it("compares the basis and names it when the backend sends one", () => {
    // Total 620 would clear the 500 minimum; only 380 of it counts.
    renderChip({ total: 620, minimum: 500, basis: 380 });
    expect(
      screen.getByText(
        "Poniżej progu zamówienia (min. 500.00 PLN) — do progu liczy się 380.00 PLN",
      ),
    ).toBeInTheDocument();
  });

  it("renders nothing when the basis meets the minimum", () => {
    const { container } = renderChip({ total: 700, minimum: 500, basis: 500 });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the basis meets the minimum even if the total alone would not", () => {
    // Not a real order shape (basis <= total), but the chip must trust the
    // basis whenever one is given.
    const { container } = renderChip({ total: 300, minimum: 500, basis: 600 });
    expect(container).toBeEmptyDOMElement();
  });

  it("falls back to the total and the original copy without a basis", () => {
    renderChip({ total: 300, minimum: 500, basis: null });
    expect(screen.getByText("Poniżej progu zamówienia (min. 500.00 PLN)")).toBeInTheDocument();
  });

  it("treats an omitted basis like null", () => {
    const { container } = renderChip({ total: 520, minimum: 500 });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no total and no basis", () => {
    const { container } = renderChip({ total: null, minimum: 500 });
    expect(container).toBeEmptyDOMElement();
  });

  it("warns on a zero basis (only excluded products ordered)", () => {
    renderChip({ total: 95, minimum: 500, basis: 0 });
    expect(
      screen.getByText(
        "Poniżej progu zamówienia (min. 500.00 PLN) — do progu liczy się 0.00 PLN",
      ),
    ).toBeInTheDocument();
  });
});
