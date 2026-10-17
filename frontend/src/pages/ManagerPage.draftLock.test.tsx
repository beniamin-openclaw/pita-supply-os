// order-email-v2 impl-review W1: while a Gmail draft is being created the page
// is locked — switching orders or releasing/cancelling must not drop the
// dispatch that follows the verified draft, nor build it from another order.
// supplier-email-v21 WP3: "Wyślij" opens THAT draft after the dispatch; a
// blocked tab leaves an amber "not sent yet — Otwórz szkic" line.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../i18n";
import type { ManagerOrderDetail, ManagerQueueItem } from "../types";

vi.mock("../apiClient", async (importOriginal) => {
  const real = await importOriginal<typeof import("../apiClient")>();
  return {
    ...real,
    api: {
      managerQueue: vi.fn(),
      managerOrder: vi.fn(),
      managerOrderable: vi.fn(async () => []),
      managerDispatch: vi.fn(),
      managerRelease: vi.fn(),
      suppliers: vi.fn(async () => []),
    },
  };
});

vi.mock("./manager/lib/orderEmailDraft", async (importOriginal) => {
  const real = await importOriginal<typeof import("./manager/lib/orderEmailDraft")>();
  return {
    ...real,
    getGoogleClientId: vi.fn(() => "client-id"),
    createVerifiedOrderDraft: vi.fn(),
  };
});

import { ApiError, api } from "../apiClient";
import * as orderDraft from "./manager/lib/orderEmailDraft";
import { ManagerPage } from "./ManagerPage";

function queueItem(orderId: string, locationName: string): ManagerQueueItem {
  return {
    order_id: orderId,
    location_id: locationName.toUpperCase(),
    location_name: locationName,
    supplier_id: "SUP_BUKAT",
    supplier_name: "Bukat",
    order_date: "2026-09-28",
    status: "manager_claimed",
    line_count: 1,
    deviation_count: 0,
    reason_count: 0,
    total_value_estimate_pln: 100,
    received_count: 0,
    received_discrepancy_count: 0,
  } as ManagerQueueItem;
}

function detail(orderId: string, locationName: string): ManagerOrderDetail {
  return {
    order_id: orderId,
    location_id: locationName.toUpperCase(),
    location_name: locationName,
    supplier_id: "SUP_BUKAT",
    supplier_name: "Bukat",
    supplier_email: "biuro@bukat.com",
    cc_email: "biuro@pitabros.pl",
    location_email: null,
    sender_email: "bracka@pitabros.pl",
    order_mailbox: "biuro@pitabros.pl",
    email_signers: [],
    ordering_method: "email",
    supplier_notes: "",
    order_date: "2026-09-28",
    status: "manager_claimed",
    notes: "",
    lines: [
      {
        order_line_id: `${orderId}-L1`,
        product_id: "P1",
        product_name_pl: "Pomidor",
        inventory_unit: "kg",
        is_critical: false,
        supplier_product_id: "SP1",
        supplier_product_name: "Pomidor",
        purchase_unit: "kg",
        units_per_purchase_unit: 1,
        current_stock_qty_base: 0,
        target_stock_qty_base: 0,
        max_stock_qty_base: 0,
        allow_over_max_due_to_packaging: false,
        suggested_qty_base: 0,
        suggested_qty_purchase: 0,
        captain_final_qty_purchase: 5,
        captain_final_qty_base: 5,
        manager_final_qty_purchase: 0,
        manager_final_qty_base: 0,
        captain_comment: "",
        manager_comment: "",
      },
    ],
    receipts: [],
  } as ManagerOrderDetail;
}

const DETAILS: Record<string, ManagerOrderDetail> = {
  "ORD-1": detail("ORD-1", "Pita Bros Bracka"),
  "ORD-2": detail("ORD-2", "Pita Bros Wola"),
};

// In-memory sessionStorage, fresh per test, so the drafted-orders mirror
// (impl-review S3) can be read back across a remount like after a reload.
let session: Map<string, string>;

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  });
  session = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => session.get(k) ?? null,
    setItem: (k: string, v: string) => void session.set(k, v),
    removeItem: (k: string) => void session.delete(k),
    clear: () => session.clear(),
  });
  vi.mocked(api.managerQueue).mockImplementation(async (_loc, status) =>
    status === "manager_claimed"
      ? [queueItem("ORD-1", "Pita Bros Bracka"), queueItem("ORD-2", "Pita Bros Wola")]
      : [],
  );
  vi.mocked(api.managerOrder).mockImplementation(async (id: string) => DETAILS[id]);
  vi.mocked(api.managerDispatch).mockResolvedValue({
    order_id: "ORD-1",
    status: "manager_sent",
    gmail_compose_url: null,
    supplier_email: "biuro@bukat.com",
    total_value_estimate_pln: 0,
  });
});
let openSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  // Default: the browser allows the draft tab. jsdom has no real window.open.
  openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);
});
afterEach(() => {
  openSpy.mockRestore();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const DRAFT_URL = "https://mail.google.com/mail/?authuser=biuro%40pitabros.pl#drafts?compose=m-1";

/** After the dispatch the refetched ORD-1 is sent, as on the server. */
function sentAfterDispatch(): void {
  vi.mocked(api.managerOrder).mockImplementation(async (id: string) =>
    id === "ORD-1" && vi.mocked(api.managerDispatch).mock.calls.length > 0
      ? { ...DETAILS[id], status: "manager_sent" }
      : DETAILS[id],
  );
}

function renderPage() {
  render(
    <MemoryRouter>
      <LangProvider>
        <ManagerPage />
      </LangProvider>
    </MemoryRouter>,
  );
}

// Whole-page renders: the first one pays the module warm-up (~4 s locally),
// so the 5 s default flakes under a loaded full run.
describe("ManagerPage — page lock during a Gmail draft", { timeout: 15_000 }, () => {
  it("refuses other actions mid-draft, then dispatches the clicked order", async () => {
    let finish: (v: { draftId: string; messageId: string }) => void = () => {};
    vi.mocked(orderDraft.createVerifiedOrderDraft).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const open = openSpy;
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Pita Bros Bracka → Bukat/ }));
    const draftButton = await screen.findByRole("button", { name: "Wyślij" });
    act(() => {
      fireEvent.click(draftButton);
    });

    // Another order cannot be opened while the draft is pending.
    fireEvent.click(screen.getByRole("button", { name: /Pita Bros Wola → Bukat/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Trwa tworzenie szkicu");
    expect(api.managerOrder).not.toHaveBeenCalledWith("ORD-2");
    expect(screen.getByRole("button", { name: "Odrzuć do poprawy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anuluj zamówienie" })).toBeDisabled();

    await act(async () => finish({ draftId: "r-1", messageId: "m-1" }));
    await waitFor(() => expect(api.managerDispatch).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.managerDispatch).mock.calls[0][0]).toMatchObject({
      order_id: "ORD-1",
      manager_finals: [{ order_line_id: "ORD-1-L1", manager_final_qty_purchase: 5 }],
    });
    // The draft itself opens only after the dispatch, never before it.
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(DRAFT_URL, "_blank");

    // Lock released: the other order opens normally.
    fireEvent.click(screen.getByRole("button", { name: /Pita Bros Wola → Bukat/ }));
    await waitFor(() => expect(api.managerOrder).toHaveBeenCalledWith("ORD-2"));
  });

  it("a failed draft releases the lock without dispatching", async () => {
    vi.mocked(orderDraft.createVerifiedOrderDraft).mockRejectedValue(
      new orderDraft.WrongMailboxError("beniamin@pitabros.pl"),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Pita Bros Bracka → Bukat/ }));
    const draftButton = await screen.findByRole("button", { name: "Wyślij" });
    await act(async () => {
      fireEvent.click(draftButton);
    });
    expect(api.managerDispatch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Odrzuć do poprawy" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Pita Bros Wola → Bukat/ }));
    await waitFor(() => expect(api.managerOrder).toHaveBeenCalledWith("ORD-2"));
  });

  it("the draft tab waits for the dispatch: pending opens nothing yet", async () => {
    vi.mocked(orderDraft.createVerifiedOrderDraft).mockResolvedValue({
      draftId: "r-1",
      messageId: "m-1",
    });
    let settle: (v: Awaited<ReturnType<typeof api.managerDispatch>>) => void = () => {};
    vi.mocked(api.managerDispatch).mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Pita Bros Bracka → Bukat/ }));
    const sendButton = await screen.findByRole("button", { name: "Wyślij" });
    await act(async () => {
      fireEvent.click(sendButton);
    });
    await waitFor(() => expect(api.managerDispatch).toHaveBeenCalledTimes(1));
    // Draft verified, dispatch still in flight: no tab for an unrecorded order.
    expect(openSpy).not.toHaveBeenCalled();

    await act(async () =>
      settle({
        order_id: "ORD-1",
        status: "manager_sent",
        gmail_compose_url: null,
        supplier_email: "biuro@bukat.com",
        total_value_estimate_pln: 0,
      }),
    );
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(DRAFT_URL, "_blank");
  });

  it("a rejected dispatch opens no tab and shows no draft line", async () => {
    vi.mocked(orderDraft.createVerifiedOrderDraft).mockResolvedValue({
      draftId: "r-1",
      messageId: "m-1",
    });
    vi.mocked(api.managerDispatch).mockRejectedValue(
      new ApiError(409, "Zamówienie już wysłane"),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Pita Bros Bracka → Bukat/ }));
    const sendButton = await screen.findByRole("button", { name: "Wyślij" });
    await act(async () => {
      fireEvent.click(sendButton);
    });
    await waitFor(() => expect(api.managerDispatch).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/Szkic jest w biuro@pitabros\.pl \(niewysłany\), ale nie udało się/),
    ).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(/NIE jest jeszcze wysłany/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Otwórz szkic" })).toBeNull();
  });

  it("a blocked tab leaves an amber 'not sent yet' line linking the draft", async () => {
    vi.mocked(orderDraft.createVerifiedOrderDraft).mockResolvedValue({
      draftId: "r-1",
      messageId: "m-1",
    });
    const open = openSpy.mockReturnValue(null);
    sentAfterDispatch();
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Pita Bros Bracka → Bukat/ }));
    const sendButton = await screen.findByRole("button", { name: "Wyślij" });
    await act(async () => {
      fireEvent.click(sendButton);
    });
    await waitFor(() => expect(api.managerDispatch).toHaveBeenCalledTimes(1));
    expect(open).toHaveBeenCalledWith(DRAFT_URL, "_blank");

    const line = await screen.findByText(/NIE jest jeszcze wysłany/);
    expect(line).toHaveTextContent("biuro@pitabros.pl");
    expect(screen.getByRole("link", { name: "Otwórz szkic" })).toHaveAttribute("href", DRAFT_URL);
    expect(screen.getByRole("link", { name: "Otwórz szkice" })).toHaveAttribute(
      "href",
      "https://mail.google.com/mail/?authuser=biuro%40pitabros.pl#drafts",
    );
  });

  it("an opened tab shows the green line with the same draft link", async () => {
    vi.mocked(orderDraft.createVerifiedOrderDraft).mockResolvedValue({
      draftId: "r-1",
      messageId: "m-1",
    });
    sentAfterDispatch();
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Pita Bros Bracka → Bukat/ }));
    const sendButton = await screen.findByRole("button", { name: "Wyślij" });
    await act(async () => {
      fireEvent.click(sendButton);
    });
    expect(await screen.findByRole("link", { name: "Otwórz szkic" })).toHaveAttribute(
      "href",
      DRAFT_URL,
    );
    expect(screen.queryByText(/NIE jest jeszcze wysłany/)).toBeNull();
  });

  it("a blocked draft keeps its warning on the queue and across a reload until opened", async () => {
    vi.mocked(orderDraft.createVerifiedOrderDraft).mockResolvedValue({
      draftId: "r-1",
      messageId: "m-1",
    });
    openSpy.mockReturnValue(null);
    sentAfterDispatch();
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Pita Bros Bracka → Bukat/ }));
    const sendButton = await screen.findByRole("button", { name: "Wyślij" });
    await act(async () => {
      fireEvent.click(sendButton);
    });
    await screen.findByText(/NIE jest jeszcze wysłany/);
    const bracka = screen.getByRole("button", { name: /Pita Bros Bracka → Bukat/ });
    expect(bracka).toHaveTextContent("Szkic niewysłany");
    expect(screen.getByRole("button", { name: /Pita Bros Wola → Bukat/ })).not.toHaveTextContent(
      "Szkic niewysłany",
    );

    // Reload: a fresh page in the same tab still shows the warning.
    cleanup();
    renderPage();
    expect(
      await screen.findByRole("button", { name: /Pita Bros Bracka → Bukat.*Szkic niewysłany/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pita Bros Bracka → Bukat/ }));
    await screen.findByText(/NIE jest jeszcze wysłany/);

    // Opening the draft from the line clears the warning (line + chip).
    fireEvent.click(screen.getByRole("link", { name: "Otwórz szkic" }));
    expect(screen.queryByText(/NIE jest jeszcze wysłany/)).toBeNull();
    expect(screen.getByRole("link", { name: "Otwórz szkic" })).toHaveAttribute("href", DRAFT_URL);
    expect(screen.getByRole("button", { name: /Pita Bros Bracka → Bukat/ })).not.toHaveTextContent(
      "Szkic niewysłany",
    );
  });
});

// manager-queue-control: the filter reads suppliers with the manager token
// (lessons.md, role-pinned calls), and the stalled lanes load at the clamp.
describe("ManagerPage — queue data wiring", () => {
  it("loads suppliers as manager and the claimed/sent lanes at 200", async () => {
    renderPage();
    await screen.findByRole("button", { name: /Pita Bros Bracka → Bukat/ });
    expect(api.suppliers).toHaveBeenCalledWith("manager");
    expect(api.managerQueue).toHaveBeenCalledWith(undefined, "manager_claimed", 200);
    expect(api.managerQueue).toHaveBeenCalledWith(undefined, "manager_sent", 200);
  });
});
