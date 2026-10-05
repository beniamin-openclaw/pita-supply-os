// LogisticsPanel's unsaved-changes flag (transport-v2): the send panel waits
// for a logistics save, so a form whose values were saved — "12,5" stored as
// 12.5, " Jan " stored as "Jan", "650.125" stored as 650.13 — must read as
// clean again, or sending would stay blocked.

import type { ReactElement } from "react";
import { describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import type { TransportBatchDetail, TransportBatchPatchRequest } from "../../../types";
import { LogisticsPanel } from "./LogisticsPanel";

function makeDetail(overrides: Partial<TransportBatchDetail> = {}): TransportBatchDetail {
  return {
    transport_id: "TRN-20261006-PAGO-abc123",
    supplier_id: "SUP_PAGO",
    supplier_name: "Pago",
    created: "2026-10-05T09:00:00+00:00",
    order_count: 0,
    location_ids: [],
    status: "draft",
    pickup_date: null,
    pickup_time: null,
    driver: null,
    vehicle: null,
    limit_kg: null,
    notes: "",
    total_weight_kg: 0,
    unknown_weight_count: 0,
    events: [],
    suppliers: [],
    orders: [],
    lines: [],
    ...overrides,
  };
}

interface Harness {
  onSave: Mock<(patch: TransportBatchPatchRequest) => void>;
  onDirtyChange: Mock<(dirty: boolean) => void>;
  rerender: (detail: TransportBatchDetail) => void;
  unmount: () => void;
}

function renderPanel(detail: TransportBatchDetail): Harness {
  const onSave = vi.fn<(patch: TransportBatchPatchRequest) => void>();
  const onDirtyChange = vi.fn<(dirty: boolean) => void>();
  const ui = (d: TransportBatchDetail): ReactElement => (
    <LangProvider>
      <LogisticsPanel
        detail={d}
        driverSuggestions={[]}
        vehicleSuggestions={[]}
        driverOptions={[]}
        vehicleOptions={[]}
        busy={false}
        onSave={onSave}
        onDirtyChange={onDirtyChange}
      />
    </LangProvider>
  );
  const view = render(ui(detail));
  return {
    onSave,
    onDirtyChange,
    rerender: (d) => view.rerender(ui(d)),
    unmount: () => view.unmount(),
  };
}

function lastDirty(h: Harness): boolean | undefined {
  const calls = h.onDirtyChange.mock.calls;
  return calls.length ? calls[calls.length - 1][0] : undefined;
}

function type(id: string, value: string): void {
  fireEvent.change(document.getElementById(id) as HTMLElement, { target: { value } });
}

const SAVE = /Zapisz logistykę/;

describe("LogisticsPanel — unsaved-changes flag", () => {
  it("is clean on mount and dirty after an edit, with the save button shown", () => {
    const h = renderPanel(makeDetail());
    expect(lastDirty(h)).toBe(false);
    expect(screen.queryByRole("button", { name: SAVE })).not.toBeInTheDocument();

    type("trn-driver", "Jan");
    expect(lastDirty(h)).toBe(true);
    expect(screen.getByRole("button", { name: SAVE })).toBeInTheDocument();
  });

  it("reads as clean once the saved values come back (decimal comma, padding, 3 decimals)", () => {
    const h = renderPanel(makeDetail());
    type("trn-driver", " Jan ");
    type("trn-vehicle", "Ducato ");
    type("trn-pickup-time", " 07:30");
    type("trn-limit-kg", "650,125");
    expect(lastDirty(h)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: SAVE }));
    expect(h.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        driver: "Jan",
        vehicle: "Ducato",
        pickup_time: "07:30",
        limit_kg: 650.13,
      }),
    );

    // The page re-renders the same panel with the saved batch.
    h.rerender(
      makeDetail({ driver: "Jan", vehicle: "Ducato", pickup_time: "07:30", limit_kg: 650.13 }),
    );
    expect(lastDirty(h)).toBe(false);
    expect(screen.queryByRole("button", { name: SAVE })).not.toBeInTheDocument();
  });

  it("a blank name is not a change (the backend keeps the old one)", () => {
    const h = renderPanel(makeDetail({ name: "Wtorek Wola + Bracka" }));
    type("trn-name", "   ");
    expect(lastDirty(h)).toBe(false);
  });

  it("stays dirty while the batch still holds the old values", () => {
    const h = renderPanel(makeDetail());
    type("trn-driver", "Jan");
    h.rerender(makeDetail({ notes: "" }));
    expect(lastDirty(h)).toBe(true);
  });

  it("reports clean on unmount, so a closed panel cannot keep blocking sends", () => {
    const h = renderPanel(makeDetail());
    type("trn-driver", "Jan");
    expect(lastDirty(h)).toBe(true);
    h.unmount();
    expect(lastDirty(h)).toBe(false);
  });
});
