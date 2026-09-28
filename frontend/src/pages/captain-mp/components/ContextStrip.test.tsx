import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import type { DeliveryProposal, Supplier } from "../../../types";
import { ContextStrip } from "./ContextStrip";

const supplier: Supplier = {
  supplier_id: "SUP_PAGO",
  supplier_name: "Pago",
  ordering_method: "email",
  delivery_days: "Tue",
  cutoff_time: "14:00",
  active: true,
  notes: "",
};

function proposal(deadline: string, source: DeliveryProposal["source"] = "location") {
  return {
    supplier_id: "SUP_PAGO",
    location_id: "WOLA",
    proposed_delivery_date: "2026-09-30",
    order_deadline: deadline,
    source,
  } satisfies DeliveryProposal;
}

function renderStrip(p: DeliveryProposal | null) {
  render(
    <LangProvider>
      <ContextStrip supplier={supplier} proposal={p} />
    </LangProvider>,
  );
}

describe("ContextStrip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mon 2026-09-28 10:00 CEST.
    vi.setSystemTime(new Date("2026-09-28T08:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows 'Zamów do dziś 17:00' for a deadline today", () => {
    renderStrip(proposal("2026-09-28T15:00:00Z"));
    expect(screen.getByText(/Zamów do dziś 17:00/)).toBeInTheDocument();
    expect(screen.getByText(/dostawa/)).toHaveTextContent("30.09");
  });

  it("names the weekday for a later deadline", () => {
    renderStrip(proposal("2026-10-05T15:00:00Z"));
    expect(screen.getByText(/Zamów do pon.* 17:00/)).toBeInTheDocument();
  });

  it("keeps the legacy delivery text for a fallback proposal", () => {
    renderStrip(proposal("2026-09-28T15:00:00Z", "fallback"));
    expect(screen.getByText(/dostawa: Tue/)).toBeInTheDocument();
    expect(screen.getByText(/Zamów do dziś 17:00/)).toBeInTheDocument();
  });

  it("keeps the supplier cutoff without a proposal", () => {
    renderStrip(null);
    expect(screen.getByText("Wyślij do dziś 14:00")).toBeInTheDocument();
  });
});
