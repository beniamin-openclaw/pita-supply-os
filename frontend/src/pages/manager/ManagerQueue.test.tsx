import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../../i18n";
import type { ManagerQueueItem } from "../../types";
import { ManagerQueue } from "./ManagerQueue";
import { orderEventTypeLabel } from "./lib/orderEvents";
import {
  archiveAgeDays,
  inQueueDays,
  isClaimedOverdue,
  isClosedWithoutReceipt,
  isSentUnreceived,
  QUEUE_LANE_LIMIT,
  splitClosedLane,
} from "./lib/queueAge";

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

describe("ManagerQueue — delivery calendar marker", () => {
  it("shows the marker and coverage when the chosen date differs", () => {
    renderQueue({
      submitted: [
        makeItem({
          requested_delivery_date: "2026-10-02",
          suggested_delivery_date: "2026-09-30",
          coverage_days: 3,
        }),
      ],
    });
    const marker = screen.getByTestId("delivery-date-marker");
    expect(marker).toHaveTextContent("02.10");
    expect(marker).toHaveTextContent("propozycja");
    expect(marker).toHaveTextContent("30.09");
    expect(screen.getByTestId("coverage-days")).toHaveTextContent("na 3 dni");
  });

  it("shows nothing extra for a legacy item", () => {
    renderQueue({ submitted: [makeItem({ requested_delivery_date: "2026-10-02" })] });
    expect(screen.queryByTestId("delivery-date-marker")).toBeNull();
    expect(screen.queryByTestId("coverage-days")).toBeNull();
  });
});

describe("queueAge — stalled-order helpers (manager-queue-control, D16)", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  const hoursAgo = (h: number): string => new Date(now.getTime() - h * 3_600_000).toISOString();

  it("flags a claimed order more than 24 h after the captain's send", () => {
    expect(
      isClaimedOverdue(
        makeItem({ status: "manager_claimed", captain_submitted_at: hoursAgo(25) }),
        now,
      ),
    ).toBe(true);
    expect(
      isClaimedOverdue(
        makeItem({ status: "manager_claimed", captain_submitted_at: hoursAgo(23) }),
        now,
      ),
    ).toBe(false);
  });

  it("does not flag other lanes or a missing timestamp", () => {
    expect(
      isClaimedOverdue(
        makeItem({ status: "captain_submitted", captain_submitted_at: hoursAgo(48) }),
        now,
      ),
    ).toBe(false);
    expect(
      isClaimedOverdue(makeItem({ status: "manager_claimed", captain_submitted_at: undefined }), now),
    ).toBe(false);
  });

  it("flags a sent order with no receipt more than 3 days after it was sent", () => {
    expect(
      isSentUnreceived(makeItem({ status: "manager_sent", manager_sent_at: hoursAgo(73) }), now),
    ).toBe(true);
    expect(
      isSentUnreceived(makeItem({ status: "manager_sent", manager_sent_at: hoursAgo(71) }), now),
    ).toBe(false);
  });

  it("does not flag a received sent order, a legacy row without a stamp, or another lane", () => {
    expect(
      isSentUnreceived(
        makeItem({ status: "manager_sent", manager_sent_at: hoursAgo(200), received_count: 1 }),
        now,
      ),
    ).toBe(false);
    expect(isSentUnreceived(makeItem({ status: "manager_sent", manager_sent_at: null }), now)).toBe(
      false,
    );
    expect(isSentUnreceived(makeItem({ status: "closed", manager_sent_at: hoursAgo(200) }), now)).toBe(
      false,
    );
  });
});

describe("ManagerQueue — stalled-order chips and header counts (D16)", () => {
  it("marks a claimed order unsent 24 h after the captain's send and counts it", () => {
    renderQueue({
      claimed: [
        makeItem({ order_id: "OLD", status: "manager_claimed", captain_submitted_at: isoDaysAgo(2) }),
        makeItem({ order_id: "NEW", status: "manager_claimed" }),
      ],
    });
    expect(screen.getAllByText("przejęte > 24 h")).toHaveLength(1);
    expect(screen.getByTestId("stalled-count-claimed")).toHaveTextContent("1 > 24 h");
  });

  it("counts sent orders without a receipt after 3 days on the collapsed lane", () => {
    renderQueue({
      sent: [
        makeItem({ order_id: "S1", status: "manager_sent", manager_sent_at: isoDaysAgo(4) }),
        makeItem({
          order_id: "S2",
          status: "manager_sent",
          manager_sent_at: isoDaysAgo(4),
          received_count: 1,
        }),
        makeItem({ order_id: "S3", status: "manager_sent", manager_sent_at: isoDaysAgo(1) }),
      ],
    });
    expect(screen.getByTestId("stalled-count-sent")).toHaveTextContent("1 > 3 dni");
    fireEvent.click(screen.getByRole("button", { name: /Zamówione/ }));
    expect(screen.getAllByText("wysłane > 3 dni bez przyjęcia")).toHaveLength(1);
  });

  it("shows no count when nothing has stalled", () => {
    renderQueue({ claimed: [makeItem({ status: "manager_claimed" })] });
    expect(screen.queryByTestId("stalled-count-claimed")).toBeNull();
    expect(screen.queryByText("przejęte > 24 h")).toBeNull();
  });

  it("gives screen readers a full sentence instead of the short badge", () => {
    renderQueue({
      claimed: [
        makeItem({ status: "manager_claimed", captain_submitted_at: isoDaysAgo(2) }),
      ],
    });
    expect(screen.getByText("1 przejętych ponad 24 h temu")).toHaveClass("sr-only");
    expect(screen.getByText("1 > 24 h")).toHaveAttribute("aria-hidden", "true");
  });

  it("marks a lane at its load cap with a plus", () => {
    const sent = Array.from({ length: QUEUE_LANE_LIMIT }, (_, i) =>
      makeItem({ order_id: `S${i}`, status: "manager_sent" }),
    );
    renderQueue({ sent });
    expect(screen.getByTestId("lane-count-sent")).toHaveTextContent(`${QUEUE_LANE_LIMIT}+`);
    expect(screen.getByTestId("lane-count-claimed")).toHaveTextContent("0");
  });
});

describe("close-without-receipt (D5) — queue helpers and chip", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  const closedNoReceipt = (overrides: Partial<ManagerQueueItem> = {}): ManagerQueueItem =>
    makeItem({
      status: "closed",
      received_count: 0,
      last_received_at: null,
      manager_sent_at: "2026-06-20T10:00:00Z",
      ...overrides,
    });

  it("tells a closed order without a receipt from a received one", () => {
    expect(isClosedWithoutReceipt(closedNoReceipt())).toBe(true);
    expect(
      isClosedWithoutReceipt(
        closedNoReceipt({ received_count: 1, last_received_at: "2026-10-16T10:00:00Z" }),
      ),
    ).toBe(false);
    expect(isClosedWithoutReceipt(makeItem({ status: "manager_sent" }))).toBe(false);
  });

  it("drops the D16 marker once the order is closed", () => {
    expect(isSentUnreceived(closedNoReceipt(), now)).toBe(false);
    expect(
      isSentUnreceived(
        makeItem({ status: "manager_sent", manager_sent_at: "2026-06-20T10:00:00Z" }),
        now,
      ),
    ).toBe(true);
  });

  it("the closed lane ages a no-receipt row by manager_sent_at", () => {
    const { recent, archived } = splitClosedLane(
      [
        closedNoReceipt({ order_id: "stale" }),
        closedNoReceipt({ order_id: "fresh", manager_sent_at: "2026-10-16T10:00:00Z" }),
        closedNoReceipt({ order_id: "no-stamp", manager_sent_at: null }),
      ],
      now,
    );
    expect(recent?.map((q) => q.order_id)).toEqual(["fresh", "no-stamp"]);
    expect(archived).toBe(1);
  });

  it("the archive always shows a no-receipt row, whatever its age", () => {
    expect(archiveAgeDays(closedNoReceipt(), now)).toBeNull();
    expect(
      archiveAgeDays(
        closedNoReceipt({ received_count: 1, last_received_at: "2026-10-07T12:00:00Z" }),
        now,
      ),
    ).toBe(10);
  });

  it("labels the close event", () => {
    const t = (key: string): string => key;
    expect(orderEventTypeLabel(t, "closed_without_receipt")).toBe(
      "manager.events.type.closedWithoutReceipt",
    );
  });

  it("the card shows 'Zamknięte bez przyjęcia' only without a receipt", () => {
    renderQueue({
      closed: [
        closedNoReceipt({ order_id: "c1", manager_sent_at: isoDaysAgo(1) }),
        makeItem({
          order_id: "c2",
          status: "closed",
          received_count: 1,
          last_received_at: isoDaysAgo(1),
        }),
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /Zakończone/ }));
    expect(screen.getAllByTestId("closed-without-receipt")).toHaveLength(1);
    expect(screen.getByText("Zamknięte bez przyjęcia")).toBeInTheDocument();
    expect(screen.getByText(/Dostarczono/)).toBeInTheDocument();
  });
});

