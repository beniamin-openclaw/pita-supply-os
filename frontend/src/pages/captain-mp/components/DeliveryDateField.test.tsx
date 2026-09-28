import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import type { DeliveryProposal } from "../../../types";
import { DeliveryDateField } from "./DeliveryDateField";

const proposal: DeliveryProposal = {
  supplier_id: "SUP_PAGO",
  location_id: "WOLA",
  proposed_delivery_date: "2026-10-07",
  following_delivery_date: "2026-10-14",
  order_deadline: "2026-10-05T15:00:00Z",
  source: "location",
  coverage_prompt: false,
};

function renderField(value: string, p: DeliveryProposal | null) {
  const onChange = vi.fn();
  const onRestore = vi.fn();
  render(
    <LangProvider>
      <DeliveryDateField value={value} proposal={p} onChange={onChange} onRestore={onRestore} />
    </LangProvider>,
  );
  return { onChange, onRestore };
}

describe("DeliveryDateField", () => {
  it("shows the proposal hint when the value equals the proposal", () => {
    renderField("2026-10-07", proposal);
    expect(screen.getByLabelText("Data dostawy")).toHaveValue("2026-10-07");
    expect(screen.getByTestId("delivery-date-hint")).toHaveTextContent(
      "Proponowana wg kalendarza dostaw",
    );
    expect(screen.queryByRole("button", { name: "Przywróć" })).toBeNull();
  });

  it("shows 'Zmieniono' and a restore button when the value differs", () => {
    const { onRestore } = renderField("2026-10-09", proposal);
    expect(screen.getByTestId("delivery-date-hint")).toHaveTextContent("Zmieniono");
    fireEvent.click(screen.getByRole("button", { name: "Przywróć" }));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("reports a picked date", () => {
    const { onChange } = renderField("2026-10-07", proposal);
    fireEvent.change(screen.getByLabelText("Data dostawy"), { target: { value: "2026-10-08" } });
    expect(onChange).toHaveBeenCalledWith("2026-10-08");
  });

  it("shows the no-calendar note for a fallback or missing proposal", () => {
    renderField("2026-09-29", { ...proposal, source: "fallback" });
    expect(screen.getByTestId("delivery-date-hint")).toHaveTextContent(
      "Brak kalendarza dostaw",
    );
    expect(screen.queryByRole("button", { name: "Przywróć" })).toBeNull();
  });

  it("shows the no-calendar note without any proposal", () => {
    renderField("2026-09-29", null);
    expect(screen.getByTestId("delivery-date-hint")).toHaveTextContent(
      "Brak kalendarza dostaw",
    );
  });
});
