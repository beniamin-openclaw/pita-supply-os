import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../../i18n";
import type { ManagerQueueItem } from "../../types";
import { ManagerQueue } from "./ManagerQueue";
import { inQueueDays, splitClosedLane } from "./lib/queueAge";

function makeItem(overrides: Partial<ManagerQueueItem> = {}): ManagerQueueItem {
  return {
    order_id: "ORD-1",
    location_id: "WOLA",
    location_name: "Pita Bros Wola",
    supplier_id: "SUP_PAGO",
    supplier_name: "Pago",
    order_date: "2026-09-20",
    status: "captain_submitted",
    captain_submitted_at: new Date().toISOString(),
    line_count: 3,
    total_value_estimate_pln: 120,
    deviation_count: 0,
    reason_count: 0,
    received_count: 0,
    received_discrepancy_count: 0,
    last_received_at: null,
    ...overrides,
  };
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function renderQueue(props: Partial<Parameters<typeof ManagerQueue>[0]> = {}) {
  render(
    <MemoryRouter>
      <LangProvider>
        <ManagerQueue
          submitted={[]}
          claimed={[]}
          sent={[]}
          closed={[]}
          selectedId={null}
          onSelect={() => {}}
          {...props}
        />
      </LangProvider>
    </MemoryRouter>,
  );
}

describe("ManagerQueue — lane default state (Phase 5)", () => {
  it("opens the two working lanes and collapses sent + closed", () => {
    renderQueue();
    const headers = screen.getAllByRole("button", { expanded: true });
    expect(headers).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Do przejęcia/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: /W realizacji/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: /Zamówione/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: /Zakończone/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("still shows the count on a collapsed lane", () => {
    renderQueue({ sent: [makeItem({ order_id: "A" }), makeItem({ order_id: "B" })] });
    expect(screen.getByRole("button", { name: /Zamówione/ })).toHaveTextContent("2");
  });
});

describe("ManagerQueue — 'w kolejce od N dni' chip", () => {
  it("shows the chip on a claimed order waiting 3+ days", () => {
    renderQueue({
      claimed: [makeItem({ status: "manager_claimed", captain_submitted_at: isoDaysAgo(4) })],
    });
    // Exact day count is covered by the pure inQueueDays test with an injected
    // `now`; here only the presence matters (wall-clock vs Warsaw calendar days).
    expect(screen.getByText(/w kolejce od \d+ dni/)).toBeInTheDocument();
  });

  it("hides the chip under the 3-day threshold", () => {
    renderQueue({
      claimed: [makeItem({ status: "manager_claimed", captain_submitted_at: isoDaysAgo(1) })],
    });
    expect(screen.queryByText(/w kolejce od/)).not.toBeInTheDocument();
  });

  it("never shows the chip on the submitted lane, however old", () => {
    renderQueue({ submitted: [makeItem({ captain_submitted_at: isoDaysAgo(10) })] });
    expect(screen.queryByText(/w kolejce od/)).not.toBeInTheDocument();
  });

  it("inQueueDays returns null below the threshold and the day count at/above it", () => {
    const now = new Date("2026-09-20T12:00:00Z");
    expect(inQueueDays(makeItem({ captain_submitted_at: "2026-09-18T12:00:00Z" }), now)).toBeNull();
    expect(inQueueDays(makeItem({ captain_submitted_at: "2026-09-17T12:00:00Z" }), now)).toBe(3);
    expect(inQueueDays(makeItem({ captain_submitted_at: undefined }), now)).toBeNull();
  });
});

describe("ManagerQueue — closed lane archive split", () => {
  it("keeps recent / unreceived rows and counts older ones for the archive link", () => {
    const now = new Date("2026-09-20T12:00:00Z");
    const { recent, archived } = splitClosedLane(
      [
        makeItem({ order_id: "recent", last_received_at: "2026-09-18T10:00:00Z" }),
        makeItem({ order_id: "edge", last_received_at: "2026-09-17T10:00:00Z" }),
        makeItem({ order_id: "old", last_received_at: "2026-09-10T10:00:00Z" }),
        makeItem({ order_id: "none", last_received_at: null }),
      ],
      now,
    );
    expect(recent?.map((q) => q.order_id)).toEqual(["recent", "edge", "none"]);
    expect(archived).toBe(1);
  });

  it("renders the archive link with the hidden count", () => {
    renderQueue({
      closed: [
        makeItem({ order_id: "old-1", status: "closed", last_received_at: isoDaysAgo(20) }),
        makeItem({ order_id: "old-2", status: "closed", last_received_at: isoDaysAgo(9) }),
        makeItem({ order_id: "new", status: "closed", last_received_at: isoDaysAgo(1) }),
      ],
    });
    // The lane is collapsed by default; open it to see the link.
    fireEvent.click(screen.getByRole("button", { name: /Zakończone/ }));
    expect(screen.getByRole("link", { name: "w archiwum: 2" })).toHaveAttribute(
      "href",
      "/manager/archive",
    );
    expect(screen.getByRole("button", { name: /Zakończone/ })).toHaveTextContent("1");
  });
});
