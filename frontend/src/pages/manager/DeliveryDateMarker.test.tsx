import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { LangProvider } from "../../i18n";
import { DeliveryDateMarker } from "./DeliveryDateMarker";

function renderMarker(
  requested: string | null | undefined,
  suggested: string | null | undefined,
  variant: "queue" | "detail" = "detail",
) {
  render(
    <LangProvider>
      <DeliveryDateMarker requested={requested} suggested={suggested} variant={variant} />
    </LangProvider>,
  );
}

describe("DeliveryDateMarker", () => {
  it("renders nothing when the dates are equal", () => {
    renderMarker("2026-09-30", "2026-09-30");
    expect(screen.queryByTestId("delivery-date-marker")).toBeNull();
  });

  it("renders nothing when either date is missing", () => {
    renderMarker("2026-09-30", null);
    expect(screen.queryByTestId("delivery-date-marker")).toBeNull();
    renderMarker(null, "2026-09-30");
    expect(screen.queryByTestId("delivery-date-marker")).toBeNull();
    renderMarker(undefined, undefined);
    expect(screen.queryByTestId("delivery-date-marker")).toBeNull();
  });

  it("renders the detail text with a tooltip when the dates differ", () => {
    renderMarker("2026-10-02", "2026-09-30");
    const marker = screen.getByTestId("delivery-date-marker");
    expect(marker).toHaveTextContent("inna niż proponowana");
    expect(marker).toHaveTextContent("30.09");
    expect(marker.getAttribute("title")).toMatch(/Kapitan wybrał .*02\.10.*proponował .*30\.09/);
  });

  it("renders the queue text with both dates", () => {
    renderMarker("2026-10-02", "2026-09-30", "queue");
    const marker = screen.getByTestId("delivery-date-marker");
    expect(marker).toHaveTextContent(/dostawa .*02\.10.* \(propozycja .*30\.09\)/);
  });
});
