// transport-v2: the Transport screen's filter bar — supplier chips and city
// tiles drive the eligible query, the visible lists, the selection and the
// create scope — and the page wiring around the send panel (unsaved-change
// gates, draft-config state, stale responses, busy switching). The API and
// Gmail are mocked; nothing is created or sent for real.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../apiClient", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../apiClient")>();
  return {
    ...real,
    api: {
      ...real.api,
      locations: vi.fn(),
      suppliers: vi.fn(),
      transportDraftConfig: vi.fn(),
      transportEligible: vi.fn(),
      transportBatches: vi.fn(),
      transportBatch: vi.fn(),
      transportCreate: vi.fn(),
      transportBatchPatch: vi.fn(),
      managerOrderable: vi.fn(),
    },
  };
});

vi.mock("./lib/orderEmailDraft", async (importOriginal) => {
  const real = await importOriginal<typeof import("./lib/orderEmailDraft")>();
  return {
    ...real,
    getGoogleClientId: vi.fn(() => "client-id"),
    acquireVerifiedGmailToken: vi.fn(),
  };
});

import { api, ApiError } from "../../apiClient";
import { LangProvider } from "../../i18n";
import type {
  Location,
  ManagerOrderLineDetail,
  TransportBatchDetail,
  TransportBatchSummary,
  TransportEligibleOrder,
} from "../../types";
import * as orderDraft from "./lib/orderEmailDraft";
import { TransportPage } from "./TransportPage";

const LOCATIONS: Location[] = [
  { location_id: "WOLA", location_name: "Pita Bros Wola", city: "Warszawa", active: true, notes: "" },
  { location_id: "KEN", location_name: "Pita Bros KEN", city: "Warszawa", active: true, notes: "" },
  { location_id: "POZ", location_name: "Pita Bros Poznań", city: "Poznań", active: true, notes: "" },
];

function eligibleOrder(
  id: string,
  locationId: string,
  supplierId: string,
  submittedAt: string,
): TransportEligibleOrder {
  const loc = LOCATIONS.find((l) => l.location_id === locationId);
  return {
    order_id: id,
    location_id: locationId,
    location_name: loc?.location_name ?? locationId,
    supplier_id: supplierId,
    supplier_name: supplierId === "SUP_MORY" ? "Magazyn Mory" : "Pago",
    order_date: submittedAt.slice(0, 10),
    status: "captain_submitted",
    captain_submitted_at: submittedAt,
    line_count: 3,
    total_value_estimate_pln: 100,
  };
}

const ELIGIBLE: TransportEligibleOrder[] = [
  eligibleOrder("ORD-WOLA", "WOLA", "SUP_PAGO", "2026-10-04T08:00:00+00:00"),
  eligibleOrder("ORD-POZ", "POZ", "SUP_PAGO", "2026-10-05T08:00:00+00:00"),
  eligibleOrder("ORD-KEN-M", "KEN", "SUP_MORY", "2026-10-03T08:00:00+00:00"),
];

function batchSummary(
  id: string,
  supplierIds: string[],
  locationIds: string[],
  name: string,
): TransportBatchSummary {
  return {
    transport_id: id,
    supplier_id: supplierIds[0],
    supplier_name: supplierIds[0] === "SUP_MORY" ? "Magazyn Mory" : "Pago",
    created: "2026-10-05T09:00:00+00:00",
    order_count: locationIds.length,
    location_ids: locationIds,
    status: "sent",
    name,
    supplier_ids: supplierIds,
  };
}

const BATCHES: TransportBatchSummary[] = [
  batchSummary("TRN-1", ["SUP_PAGO", "SUP_MORY"], ["WOLA", "KEN"], "Run mieszany"),
  batchSummary("TRN-2", ["SUP_MORY"], ["KEN"], "Run Mory"),
  batchSummary("TRN-3", ["SUP_PAGO"], ["POZ"], "Run Poznań"),
];

function renderPage(): void {
  render(
    <MemoryRouter>
      <LangProvider>
        <TransportPage />
      </LangProvider>
    </MemoryRouter>,
  );
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(el);
  });
}

const chip = (name: string): HTMLElement =>
  within(screen.getByRole("group", { name: "Dostawcy" })).getByRole("button", { name });
const cityTile = (name: string): HTMLElement =>
  within(screen.getByRole("group", { name: "Miasta" })).getByRole("button", { name });

beforeEach(() => {
  // jsdom has no scrollIntoView; opening a batch scrolls its panel into view.
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(orderDraft.getGoogleClientId).mockReturnValue("client-id");
  vi.mocked(api.managerOrderable).mockReset();
  vi.mocked(api.managerOrderable).mockResolvedValue([]);
  vi.mocked(api.transportBatchPatch).mockReset();
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  });
  vi.mocked(api.locations).mockResolvedValue(LOCATIONS);
  vi.mocked(api.suppliers).mockResolvedValue([
    { supplier_id: "SUP_PAGO", supplier_name: "Pago Sp. z o.o.", email: "zamowienia@pago.pl", ordering_method: "email", active: true, notes: "" },
    { supplier_id: "SUP_MORY", supplier_name: "Magazyn Mory", ordering_method: "email", active: true, notes: "" },
  ]);
  vi.mocked(api.transportDraftConfig).mockReset();
  vi.mocked(api.transportDraftConfig).mockResolvedValue({
    driver_recipients: "",
    drivers: "",
    vehicles: "",
    order_mailbox: "biuro@pitabros.pl",
  });
  vi.mocked(api.transportEligible).mockReset();
  vi.mocked(api.transportEligible).mockResolvedValue(ELIGIBLE);
  vi.mocked(api.transportBatches).mockReset();
  vi.mocked(api.transportBatches).mockResolvedValue(BATCHES);
  vi.mocked(api.transportCreate).mockReset();
  vi.mocked(api.transportCreate).mockResolvedValue({
    transport_id: "TRN-NEW",
    combined: ["ORD-WOLA"],
    skipped: [],
  });
  vi.mocked(api.transportBatch).mockReset();
  vi.mocked(api.transportBatch).mockResolvedValue({
    transport_id: "TRN-NEW",
    supplier_id: "SUP_PAGO",
    supplier_name: "Pago",
    order_count: 0,
    location_ids: [],
    orders: [],
    lines: [],
    status: "draft",
    notes: "",
    total_weight_kg: 0,
    unknown_weight_count: 0,
    events: [],
  } as TransportBatchDetail);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TransportPage — filter bar (transport-v2)", () => {
  it("starts with both chips on: Pago run with companions, one history fetch for all suppliers", async () => {
    renderPage();
    await settle();

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(chip("Pago")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Magazyn Mory")).toHaveAttribute("aria-pressed", "true");
    expect(api.transportEligible).toHaveBeenCalledWith("SUP_PAGO", true);
    expect(api.transportBatches).toHaveBeenCalledWith(undefined, 100, false);

    // Eligible newest first; the Mory order carries its supplier badge.
    const rows = screen.getAllByRole("checkbox").map((c) => c.closest("label")?.textContent ?? "");
    expect(rows[0]).toContain("Pita Bros Poznań");
    expect(rows[1]).toContain("Pita Bros Wola");
    expect(rows[2]).toContain("Pita Bros KEN");
    expect(rows[2]).toContain("Magazyn Mory");

    // History rows carry supplier badges (chip names).
    expect(screen.getByText("Run mieszany").closest("button")).toHaveTextContent("PagoMagazyn Mory");
  });

  it("one chip on -> that supplier alone; the last chip on is disabled with a reason", async () => {
    renderPage();
    await settle();
    await click(chip("Pago"));
    await settle();

    expect(api.transportEligible).toHaveBeenLastCalledWith("SUP_MORY", false);
    expect(chip("Pago")).toHaveAttribute("aria-pressed", "false");
    const mory = chip("Magazyn Mory");
    expect(mory).toBeDisabled();
    expect(mory).toHaveAttribute("title", "Co najmniej jeden dostawca musi zostać włączony.");

    // History: a Pago-only run is hidden, Mory runs stay.
    expect(screen.queryByText("Run Poznań")).not.toBeInTheDocument();
    expect(screen.getByText("Run Mory")).toBeInTheDocument();
    expect(screen.getByText("Run mieszany")).toBeInTheDocument();
  });

  it("create sends the chip scope (Mory alone, no companions)", async () => {
    vi.mocked(api.transportEligible).mockImplementation(async (supplierId: string) =>
      supplierId === "SUP_MORY" ? [ELIGIBLE[2]] : ELIGIBLE,
    );
    renderPage();
    await settle();
    await click(chip("Pago"));
    await settle();

    await click(screen.getByRole("checkbox"));
    await click(screen.getByRole("button", { name: "Utwórz transport" }));
    await settle();

    expect(api.transportCreate).toHaveBeenCalledWith({
      supplier_id: "SUP_MORY",
      order_ids: ["ORD-KEN-M"],
      allow_companions: false,
    });
  });

  it("a city tile filters both lists and a hidden order is dropped from the selection", async () => {
    renderPage();
    await settle();

    // Select the Poznań and Wola orders, then switch Poznań off.
    const checkboxes = screen.getAllByRole("checkbox");
    await click(checkboxes[0]); // Poznań (newest)
    await click(checkboxes[1]); // Wola
    expect(screen.getByText(/^2 zaznaczonych/)).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Wszystkie" })).not.toBeInTheDocument();
    await click(cityTile("Poznań"));
    expect(cityTile("Poznań")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Pita Bros Poznań")).not.toBeInTheDocument();
    expect(screen.queryByText("Run Poznań")).not.toBeInTheDocument();
    expect(screen.getByText(/^1 zaznaczonych/)).toBeInTheDocument();

    // Switching it back on does not bring the forgotten tick back.
    await click(screen.getByRole("button", { name: "Wszystkie" }));
    expect(cityTile("Poznań")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Run Poznań")).toBeInTheDocument();
    expect(screen.getByText(/^1 zaznaczonych/)).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "Utwórz transport" }));
    await settle();
    expect(api.transportCreate).toHaveBeenCalledWith({
      supplier_id: "SUP_PAGO",
      order_ids: ["ORD-WOLA"],
      allow_companions: true,
    });
  });

  it("'Pokaż anulowane' refetches the history with cancelled batches", async () => {
    renderPage();
    await settle();
    await click(screen.getByRole("button", { name: /anulowane/i }));
    await settle();
    expect(api.transportBatches).toHaveBeenLastCalledWith(undefined, 100, true);
  });
});

// ---- the send panel inside the page -----------------------------------------

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const SOUVLAKI_LINE = {
  order_line_id: "L1",
  product_id: "P027",
  product_name_pl: "Souvlaki",
  inventory_unit: "kg",
  is_critical: false,
  supplier_product_id: "SP_PAGO_P027",
  supplier_product_name: "Souvlaki karton",
  purchase_unit: "karton",
  units_per_purchase_unit: 1,
  current_stock_qty_base: 0,
  target_stock_qty_base: 0,
  max_stock_qty_base: 0,
  allow_over_max_due_to_packaging: false,
  suggested_qty_base: 3,
  suggested_qty_purchase: 3,
  captain_final_qty_purchase: 3,
  captain_final_qty_base: 3,
  manager_final_qty_purchase: 0,
  manager_final_qty_base: 0,
  captain_comment: "",
  manager_comment: "",
} as ManagerOrderLineDetail;

function batchDetail(
  id: string,
  name: string,
  overrides: Partial<TransportBatchDetail> = {},
): TransportBatchDetail {
  return {
    transport_id: id,
    supplier_id: "SUP_PAGO",
    supplier_name: "Pago",
    created: "2026-10-05T09:00:00+00:00",
    name,
    order_count: 1,
    location_ids: ["WOLA"],
    status: "draft",
    driver: "",
    vehicle: "",
    pickup_date: "2026-10-06",
    pickup_time: "07:30",
    notes: "",
    total_weight_kg: 0,
    unknown_weight_count: 0,
    events: [],
    orders: [
      {
        order_id: "ORD-W",
        location_id: "WOLA",
        location_name: "Pita Bros Wola",
        status: "manager_claimed",
        supplier_id: "SUP_PAGO",
        lines: [SOUVLAKI_LINE],
      },
    ],
    lines: [],
    ...overrides,
  } as TransportBatchDetail;
}

const DRAFT_RUN = "Run roboczy";
const DRAFT_DETAIL = batchDetail("TRN-D", DRAFT_RUN);
const SEND_BATCHES: TransportBatchSummary[] = [
  { ...batchSummary("TRN-D", ["SUP_PAGO"], ["WOLA"], DRAFT_RUN), status: "draft" },
  ...BATCHES,
];

const orderSend = (): HTMLElement => screen.getByRole("button", { name: "Wyślij zamówienie" });
const driverSend = (): HTMLElement => screen.getByRole("button", { name: "Wyślij listę kierowcy" });

/** The history row of a batch (its name also heads the open detail). */
function historyRow(name: string): HTMLElement {
  const row = screen
    .getAllByText(name)
    .map((el) => el.closest("button"))
    .find((b): b is HTMLButtonElement => b !== null);
  if (!row) throw new Error(`no history row for ${name}`);
  return row;
}

async function openBatch(name: string): Promise<void> {
  await click(historyRow(name));
  await settle();
  await settle();
}

const LOGISTICS_REASON = "Najpierw zapisz logistykę („Zapisz logistykę” w sekcji Logistyka).";

describe("TransportPage — send panel wiring", () => {
  beforeEach(() => {
    vi.mocked(api.transportBatches).mockResolvedValue(SEND_BATCHES);
    vi.mocked(api.transportBatch).mockResolvedValue(DRAFT_DETAIL);
    vi.mocked(api.transportDraftConfig).mockResolvedValue({
      driver_recipients: "kierowca@pitabros.pl",
      drivers: "",
      vehicles: "",
      order_mailbox: "biuro@pitabros.pl",
    });
  });

  it("unsaved matrix quantities disable both sends", async () => {
    renderPage();
    await settle();
    await openBatch(DRAFT_RUN);
    expect(orderSend()).toBeEnabled();
    expect(driverSend()).toBeEnabled();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Souvlaki — Pita Bros Wola"), {
        target: { value: "5" },
      });
    });
    expect(orderSend()).toBeDisabled();
    expect(driverSend()).toBeDisabled();
    expect(screen.getByText("Najpierw zapisz zmiany.")).toBeInTheDocument();
  });

  it("unsaved logistics disable both sends with their own reason until saved", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    await settle();
    await openBatch(DRAFT_RUN);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Kierowca"), { target: { value: "Adam Nowak" } });
    });
    expect(orderSend()).toBeDisabled();
    expect(driverSend()).toBeDisabled();
    expect(orderSend()).toHaveAttribute("title", LOGISTICS_REASON);
    expect(screen.getByText(LOGISTICS_REASON)).toBeInTheDocument();

    // Switching batches asks first, like unsaved quantities.
    vi.mocked(api.transportBatch).mockClear();
    await click(historyRow("Run Mory"));
    expect(confirmSpy).toHaveBeenCalledWith(
      "Masz niezapisane zmiany (ilości albo logistyka) — porzucić je?",
    );
    expect(api.transportBatch).not.toHaveBeenCalled();

    vi.mocked(api.transportBatchPatch).mockResolvedValue(
      batchDetail("TRN-D", DRAFT_RUN, { driver: "Adam Nowak" }) as never,
    );
    vi.mocked(api.transportBatch).mockResolvedValue(
      batchDetail("TRN-D", DRAFT_RUN, { driver: "Adam Nowak" }),
    );
    await click(screen.getByRole("button", { name: "Zapisz logistykę" }));
    await settle();
    await settle();

    expect(api.transportBatchPatch).toHaveBeenCalledWith(
      "TRN-D",
      expect.objectContaining({ driver: "Adam Nowak" }),
    );
    expect(orderSend()).toBeEnabled();
    expect(driverSend()).toBeEnabled();
    expect(screen.queryByText(LOGISTICS_REASON)).not.toBeInTheDocument();
  });

  it("the configured order mailbox reaches the confirmation card", async () => {
    renderPage();
    await settle();
    await openBatch(DRAFT_RUN);
    await click(orderSend());
    const card = screen.getByRole("group", { name: "Szkic zamówienia (zlecenie odbioru) w Gmailu" });
    expect(within(card).getByText("biuro@pitabros.pl")).toBeInTheDocument();
  });

  it("an empty order mailbox disables the sends with the no-mailbox reason", async () => {
    vi.mocked(api.transportDraftConfig).mockResolvedValue({
      driver_recipients: "kierowca@pitabros.pl",
      drivers: "",
      vehicles: "",
      order_mailbox: "",
    });
    renderPage();
    await settle();
    await openBatch(DRAFT_RUN);
    expect(orderSend()).toBeDisabled();
    expect(driverSend()).toBeDisabled();
    expect(
      screen.getByText("Brak skrzynki zamówień w konfiguracji — nie ma gdzie utworzyć szkicu."),
    ).toBeInTheDocument();
  });

  describe("draft-config failures", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("is retried once; a second failure shows the reload reason, not 'no mailbox'", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      vi.mocked(api.transportDraftConfig).mockRejectedValue(new ApiError(500, "boom"));
      renderPage();
      await settle();
      await openBatch(DRAFT_RUN);
      expect(api.transportDraftConfig).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Wczytywanie konfiguracji wysyłki…")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(api.transportDraftConfig).toHaveBeenCalledTimes(2);
      expect(orderSend()).toBeDisabled();
      expect(driverSend()).toBeDisabled();
      expect(
        screen.getByText("Nie udało się wczytać konfiguracji wysyłki — odśwież stronę."),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Brak skrzynki zamówień/)).not.toBeInTheDocument();

      // No third attempt.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(api.transportDraftConfig).toHaveBeenCalledTimes(2);
    });

    it("a successful retry enables the sends", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      vi.mocked(api.transportDraftConfig)
        .mockRejectedValueOnce(new ApiError(0, "network"))
        .mockResolvedValueOnce({
          driver_recipients: "kierowca@pitabros.pl",
          drivers: "",
          vehicles: "",
          order_mailbox: "biuro@pitabros.pl",
        });
      renderPage();
      await settle();
      await openBatch(DRAFT_RUN);
      expect(orderSend()).toBeDisabled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(orderSend()).toBeEnabled();
      expect(driverSend()).toBeEnabled();
    });
  });

  it("a late answer for a batch opened earlier does not replace the one opened since", async () => {
    const first = deferred<TransportBatchDetail>();
    vi.mocked(api.transportBatch).mockImplementation((id: string) =>
      id === "TRN-1"
        ? first.promise
        : Promise.resolve(batchDetail(id, "Run Mory", { status: "sent" })),
    );
    renderPage();
    await settle();

    await click(historyRow("Run mieszany"));
    await openBatch("Run Mory");
    expect(screen.getByLabelText("Nazwa (opcjonalna)")).toHaveValue("Run Mory");

    await act(async () => {
      first.resolve(batchDetail("TRN-1", "Run mieszany", { status: "sent" }));
    });
    await settle();
    expect(screen.getByLabelText("Nazwa (opcjonalna)")).toHaveValue("Run Mory");
    expect(screen.queryByText("Ładowanie…")).not.toBeInTheDocument();
  });

  it("a send that leaves the status unchanged keeps quantities typed meanwhile", async () => {
    const token = deferred<string>();
    vi.mocked(orderDraft.acquireVerifiedGmailToken).mockReturnValue(token.promise);
    renderPage();
    await settle();
    await openBatch(DRAFT_RUN);

    await click(driverSend());
    await click(screen.getByRole("button", { name: "Utwórz szkic" }));
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Souvlaki — Pita Bros Wola"), {
        target: { value: "5" },
      });
    });

    vi.mocked(api.transportBatch).mockClear();
    await act(async () => {
      token.reject(new Error("popup closed"));
    });
    await settle();

    // The panel refreshed the batch (still a draft) without re-seeding.
    expect(api.transportBatch).toHaveBeenCalledWith("TRN-D");
    expect(screen.getByLabelText("Souvlaki — Pita Bros Wola")).toHaveValue("5");
    expect(driverSend()).toHaveAttribute("title", "Najpierw zapisz zmiany.");
  });

  it("while a send runs, other batches cannot be opened from the history", async () => {
    const token = deferred<string>();
    vi.mocked(orderDraft.acquireVerifiedGmailToken).mockReturnValue(token.promise);
    renderPage();
    await settle();
    await openBatch(DRAFT_RUN);

    await click(orderSend());
    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));

    const other = historyRow("Run Mory");
    expect(other).toBeDisabled();
    expect(other).toHaveAttribute("title", "Poczekaj, aż skończy się wysyłka otwartego transportu.");
    expect(historyRow(DRAFT_RUN)).toBeEnabled();
    expect(screen.getByRole("button", { name: "Anuluj szkic" })).toBeDisabled();
    // Re-clicking the open batch would remount its panel mid-send: a no-op.
    vi.mocked(api.transportBatch).mockClear();
    await click(historyRow(DRAFT_RUN));
    expect(api.transportBatch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Wyślij zamówienie" })).toBeInTheDocument();

    await act(async () => {
      token.reject(new Error("popup closed"));
    });
    await settle();
    expect(historyRow("Run Mory")).toBeEnabled();
    expect(historyRow("Run Mory")).not.toHaveAttribute("title");
  });
});

describe("TransportPage — eligible list, latest request wins", () => {
  it("a slow answer for an older chip state never overwrites the newer one", async () => {
    const moryOnly = deferred<TransportEligibleOrder[]>();
    const both = deferred<TransportEligibleOrder[]>();
    vi.mocked(api.transportEligible)
      .mockResolvedValueOnce(ELIGIBLE)
      .mockReturnValueOnce(moryOnly.promise)
      .mockReturnValueOnce(both.promise);
    renderPage();
    await settle();

    await click(chip("Pago")); // off -> Mory alone (slow)
    await click(chip("Pago")); // on again -> both
    expect(api.transportEligible).toHaveBeenNthCalledWith(2, "SUP_MORY", false);
    expect(api.transportEligible).toHaveBeenNthCalledWith(3, "SUP_PAGO", true);

    await act(async () => {
      both.resolve(ELIGIBLE);
    });
    await act(async () => {
      moryOnly.resolve([ELIGIBLE[2]]);
    });
    await settle();

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByText("Pita Bros Poznań")).toBeInTheDocument();
  });
});
