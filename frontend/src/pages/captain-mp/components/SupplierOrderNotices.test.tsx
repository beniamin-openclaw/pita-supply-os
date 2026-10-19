// SupplierOrderNotices — accessibility of the supplier-level notices
// (captain-sent-today): the live region is mounted before a notice appears, so
// a notice shown on a tab switch is announced, and each "Zobacz zamówienie"
// button is described by its own notice.

import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import type { CaptainSupplierOrderRef } from "../types";
import { SupplierOrderNotices } from "./SupplierOrderNotices";

function ref(
  orderId: string,
  status: CaptainSupplierOrderRef["status"],
  submittedOn: string,
  submittedAt: string | null,
): CaptainSupplierOrderRef {
  return {
    order_id: orderId,
    status,
    order_date: submittedOn,
    submitted_on: submittedOn,
    captain_submitted_at: submittedAt,
  };
}

const SENT = ref("ORD-S", "captain_submitted", "2026-10-17", "2026-10-17T08:15:00Z");
const OPEN = ref("ORD-O", "manager_claimed", "2026-10-15", "2026-10-15T07:00:00Z");

function notices(
  sentToday: CaptainSupplierOrderRef | null,
  openOrder: CaptainSupplierOrderRef | null,
  onShowOrder: (orderId: string) => void = () => {},
): ReactElement {
  return (
    <LangProvider>
      <SupplierOrderNotices
        supplierName="Bukat"
        sentToday={sentToday}
        openOrder={openOrder}
        onShowOrder={onShowOrder}
      />
    </LangProvider>
  );
}

describe("SupplierOrderNotices — accessibility", () => {
  it("keeps an empty live region mounted, then fills it", () => {
    const { rerender } = render(notices(null, null));
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();

    // A tab switch to a supplier with an order today: same node, now filled.
    rerender(notices(SENT, null));
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("Dziś już wysłano zamówienie do Bukat");
  });

  it("describes each 'Zobacz zamówienie' button by its own notice", () => {
    const onShowOrder = vi.fn();
    render(notices(SENT, OPEN, onShowOrder));
    const [sentButton, openButton] = screen.getAllByRole("button", { name: "Zobacz zamówienie" });

    expect(sentButton).toHaveAccessibleDescription(/Dziś już wysłano zamówienie do Bukat/);
    expect(openButton).toHaveAccessibleDescription(
      "Masz już otwarte zamówienie u tego dostawcy (z 15.10, status: W realizacji).",
    );

    fireEvent.click(openButton);
    expect(onShowOrder).toHaveBeenCalledWith("ORD-O");
  });
});
