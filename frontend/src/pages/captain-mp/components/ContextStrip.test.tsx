import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import { ContextStrip } from "./ContextStrip";
import type { Supplier } from "../types";

const pago: Supplier = {
  supplier_id: "SUP_PAGO",
  supplier_name: "Pago",
  ordering_method: "email",
  delivery_days: "Tue, Sat",
  cutoff_time: "14:00",
  active: true,
  notes: "",
};

describe("ContextStrip — delivery window (dynamic-target-wola)", () => {
  it("shows the literal delivery days when no window is given", () => {
    render(
      <LangProvider>
        <ContextStrip supplier={pago} />
      </LangProvider>,
    );
    expect(screen.getByText(/Pago · dostawa: Tue, Sat/)).toBeInTheDocument();
  });

  it("shows the concrete window when the screen carries a dynamic target", () => {
    render(
      <LangProvider>
        <ContextStrip
          supplier={pago}
          deliveryWindow={{ delivery: "2026-09-08", next: "2026-09-12" }}
        />
      </LangProvider>,
    );
    expect(screen.getByText(/dostawa wt\., 08\.09 · następna sob\., 12\.09/)).toBeInTheDocument();
  });
});
