// transport-v2: the "Dokumenty i wysyłka" panel — the only place a Transport
// batch is sent (verified Gmail draft) or marked. Gmail, the PDF runtime and
// the API are mocked: no network, no real draft, no real order.

import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("../../../apiClient", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../../apiClient")>();
  return {
    ...real,
    api: {
      ...real.api,
      transportFinalize: vi.fn(),
      transportReopen: vi.fn(),
      transportDraftCreated: vi.fn(),
    },
  };
});

vi.mock("../lib/orderEmailDraft", async (importOriginal) => {
  const real = await importOriginal<typeof import("../lib/orderEmailDraft")>();
  return {
    ...real,
    getGoogleClientId: vi.fn(() => "client-id"),
    acquireVerifiedGmailToken: vi.fn(),
    createVerifiedDraftWithToken: vi.fn(),
  };
});

vi.mock("../lib/transportPdf", async (importOriginal) => {
  const real = await importOriginal<typeof import("../lib/transportPdf")>();
  return {
    ...real,
    downloadTransportPdf: vi.fn(async () => undefined),
    generateTransportPdfBase64: vi.fn(),
  };
});

vi.mock("../lib/gmailDraft", async (importOriginal) => {
  const real = await importOriginal<typeof import("../lib/gmailDraft")>();
  return { ...real, deleteGmailDraft: vi.fn() };
});

import { api, ApiError } from "../../../apiClient";
import { LangProvider } from "../../../i18n";
import type {
  TransportBatchDetail,
  TransportEvent,
  TransportFinalizeResponse,
} from "../../../types";
import * as gmailDraft from "../lib/gmailDraft";
import * as orderDraft from "../lib/orderEmailDraft";
import * as transportPdf from "../lib/transportPdf";
import { TransportSendPanel } from "./TransportSendPanel";

const MAILBOX = "biuro@pitabros.pl";
const SUPPLIER_EMAIL = "zamowienia@pago.pl; hurt@pago.pl";
const DRIVER_RECIPIENTS = "kierowca@pitabros.pl";
const TRN = "TRN-20261006-PAGO-abc123";

function makeDetail(overrides: Partial<TransportBatchDetail> = {}): TransportBatchDetail {
  return {
    transport_id: TRN,
    supplier_id: "SUP_PAGO",
    supplier_name: "Pago",
    created: "2026-10-05T09:00:00+00:00",
    order_count: 2,
    location_ids: ["KEN", "WOLA"],
    status: "draft",
    pickup_date: "2026-10-06",
    pickup_time: "07:30",
    driver: "Jan Kowalski",
    vehicle: "Ducato WX 12345",
    notes: "",
    total_weight_kg: 0,
    unknown_weight_count: 0,
    events: [],
    suppliers: [
      { supplier_id: "SUP_PAGO", supplier_name: "Pago" },
      { supplier_id: "SUP_MORY", supplier_name: "Magazyn Mory" },
    ],
    orders: [
      {
        order_id: "ORD-P",
        location_id: "WOLA",
        location_name: "Pita Bros Wola",
        status: "manager_claimed",
        lines: [],
        supplier_id: "SUP_PAGO",
        extra_items: "Tacki - 2 opak\nFeta grecka - 5 kg",
      },
      {
        order_id: "ORD-M",
        location_id: "KEN",
        location_name: "Pita Bros KEN",
        status: "manager_claimed",
        lines: [],
        supplier_id: "SUP_MORY",
        extra_items: "Serwetki - 1 karton",
      },
    ],
    lines: [
      {
        product_id: "P027",
        product_name_pl: "Souvlaki",
        supplier_product_id: "SP_PAGO_P027",
        supplier_product_name: "Souvlaki karton",
        purchase_unit: "karton",
        total_qty_purchase: 3,
        supplier_id: "SUP_PAGO",
        supplier_name: "Pago",
        per_location: [
          { location_id: "WOLA", location_name: "Pita Bros Wola", order_id: "ORD-P", qty_purchase: 3 },
        ],
      },
    ],
    ...overrides,
  } as TransportBatchDetail;
}

function draftEvent(
  kind: "order" | "driver",
  draftId: string,
  mailbox: string,
  at = "2026-10-05T10:00:00+00:00",
): TransportEvent {
  return {
    event_id: `EV-${draftId}`,
    transport_id: TRN,
    event_type: `${kind}_draft_created`,
    at,
    details: `draft_id=${draftId}; mailbox=${mailbox}`,
  };
}

function sentDetail(overrides: Partial<TransportBatchDetail> = {}): TransportBatchDetail {
  return makeDetail({
    status: "sent",
    orders: makeDetail().orders.map((o) => ({ ...o, status: "manager_sent" })),
    events: [
      {
        event_id: "EV-sent",
        transport_id: TRN,
        event_type: "batch_sent",
        at: "2026-10-05T09:30:00+00:00",
        details: "",
      },
    ],
    ...overrides,
  });
}

const FINALIZE_OK: TransportFinalizeResponse = {
  transport_id: TRN,
  sent: ["ORD-P", "ORD-M"],
  skipped: [],
};

interface Harness {
  onChanged: ReturnType<typeof vi.fn>;
  onFinalized: ReturnType<typeof vi.fn>;
  fetchDetail: ReturnType<typeof vi.fn>;
  /** Re-render the same panel instance with a new detail (a page refresh). */
  rerender: (detail: TransportBatchDetail) => void;
}

function renderPanel(
  detail: TransportBatchDetail,
  opts: {
    dirty?: boolean;
    logisticsDirty?: boolean;
    configStatus?: "loading" | "ready" | "failed";
    onBusyChange?: (busy: boolean) => void;
    orderMailbox?: string;
    supplierEmail?: string | null;
    driverRecipients?: string | null;
    fetched?: TransportBatchDetail;
  } = {},
): Harness {
  const onChanged = vi.fn(async () => undefined);
  const onFinalized = vi.fn();
  const fetchDetail = vi.fn(async () => opts.fetched ?? sentDetail());
  const ui = (d: TransportBatchDetail): ReactElement => (
    <LangProvider>
      <TransportSendPanel
        detail={d}
        displayLabel="Transport Wtorek · Warszawa · 06.10.26"
        pagoDisplayLabel="Transport Wtorek · Warszawa · 06.10.26"
        supplierEmail={opts.supplierEmail === undefined ? SUPPLIER_EMAIL : opts.supplierEmail}
        driverRecipients={opts.driverRecipients === undefined ? DRIVER_RECIPIENTS : opts.driverRecipients}
        orderMailbox={opts.orderMailbox ?? MAILBOX}
        dirty={opts.dirty ?? false}
        logisticsDirty={opts.logisticsDirty}
        configStatus={opts.configStatus}
        onBusyChange={opts.onBusyChange}
        onChanged={onChanged as unknown as () => Promise<void>}
        onFinalized={onFinalized as unknown as (res: TransportFinalizeResponse) => void}
        fetchDetail={fetchDetail as unknown as (id: string) => Promise<TransportBatchDetail>}
      />
    </LangProvider>
  );
  const r = render(ui(detail));
  return {
    onChanged,
    onFinalized,
    fetchDetail,
    rerender: (d: TransportBatchDetail): void => r.rerender(ui(d)),
  };
}

/** Click a button and let every promise in its handler settle. */
async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(el);
  });
}

const orderButton = (): HTMLElement => screen.getByRole("button", { name: "Wyślij zamówienie" });
const driverButton = (): HTMLElement => screen.getByRole("button", { name: "Wyślij listę kierowcy" });

let callLog: string[];

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  });
  vi.spyOn(window, "open").mockReturnValue(null);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  callLog = [];

  vi.mocked(orderDraft.getGoogleClientId).mockReturnValue("client-id");
  vi.mocked(orderDraft.acquireVerifiedGmailToken).mockReset();
  vi.mocked(orderDraft.acquireVerifiedGmailToken).mockImplementation(async () => {
    callLog.push("token");
    return "tok";
  });
  vi.mocked(orderDraft.createVerifiedDraftWithToken).mockReset();
  vi.mocked(orderDraft.createVerifiedDraftWithToken).mockImplementation(async () => {
    callLog.push("draft");
    return { id: "d-new" };
  });
  vi.mocked(transportPdf.generateTransportPdfBase64).mockReset();
  vi.mocked(transportPdf.generateTransportPdfBase64).mockImplementation(async () => {
    callLog.push("pdf");
    return "BASE64";
  });
  vi.mocked(gmailDraft.deleteGmailDraft).mockReset();
  vi.mocked(gmailDraft.deleteGmailDraft).mockImplementation(async () => {
    callLog.push("delete");
  });
  vi.mocked(api.transportFinalize).mockReset();
  vi.mocked(api.transportFinalize).mockImplementation(async () => {
    callLog.push("finalize");
    return FINALIZE_OK;
  });
  vi.mocked(api.transportReopen).mockReset();
  vi.mocked(api.transportDraftCreated).mockReset();
  vi.mocked(api.transportDraftCreated).mockImplementation(async () => {
    callLog.push("record");
    return {
      event_id: "EV-x",
      transport_id: TRN,
      event_type: "order_draft_created",
      details: "",
    } as TransportEvent;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("TransportSendPanel — confirmation card", () => {
  it("'Wyślij zamówienie' only opens the card — no token, no API call", async () => {
    renderPanel(makeDetail());
    await click(orderButton());

    const card = screen.getByRole("group", { name: "Szkic zamówienia (zlecenie odbioru) w Gmailu" });
    expect(within(card).getByText("zamowienia@pago.pl, hurt@pago.pl")).toBeInTheDocument();
    expect(within(card).getByText(MAILBOX)).toBeInTheDocument();
    expect(card).toHaveTextContent("Transport zostanie oznaczony jako wysłany");
    expect(orderDraft.acquireVerifiedGmailToken).not.toHaveBeenCalled();
    expect(api.transportFinalize).not.toHaveBeenCalled();
    expect(orderDraft.createVerifiedDraftWithToken).not.toHaveBeenCalled();

    await click(within(card).getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("missing logistics is a soft warning — the confirm button stays enabled", async () => {
    renderPanel(makeDetail({ driver: "", vehicle: null }));
    await click(orderButton());
    const card = screen.getByRole("group");
    expect(card).toHaveTextContent(
      "Brakuje: Kierowca, Samochód. Możesz kontynuować albo uzupełnić w sekcji Logistyka.",
    );
    expect(
      within(card).getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }),
    ).toBeEnabled();
  });

  it("lists only the lead supplier's off-catalogue lines, all unticked", async () => {
    renderPanel(makeDetail());
    await click(orderButton());
    const tacki = screen.getByLabelText("Pita Bros Wola: Tacki - 2 opak");
    const feta = screen.getByLabelText("Pita Bros Wola: Feta grecka - 5 kg");
    expect(tacki).not.toBeChecked();
    expect(feta).not.toBeChecked();
    // A Magazyn Mory extra never reaches Pago.
    expect(screen.queryByText(/Serwetki/)).not.toBeInTheDocument();
    expect(screen.queryByText(/osobna sekcja/)).not.toBeInTheDocument();
    await click(feta);
    expect(screen.getByText(/osobna sekcja — nigdy do treści e-maila/)).toBeInTheDocument();
  });

  it("the send buttons are disabled with a visible reason while there are unsaved changes", () => {
    renderPanel(makeDetail(), { dirty: true });
    expect(orderButton()).toBeDisabled();
    expect(driverButton()).toBeDisabled();
    expect(screen.getByText("Najpierw zapisz zmiany.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oznacz jako wysłane bez maila" })).toBeDisabled();
  });

  it("without a supplier e-mail the order send is disabled and points at mark-only", () => {
    renderPanel(makeDetail(), { supplierEmail: "" });
    expect(orderButton()).toBeDisabled();
    expect(driverButton()).toBeEnabled();
    expect(screen.getByText(/użyj „Oznacz jako wysłane bez maila”/)).toBeInTheDocument();
  });

  it("without an order mailbox both sends are disabled", () => {
    renderPanel(makeDetail(), { orderMailbox: "" });
    expect(orderButton()).toBeDisabled();
    expect(driverButton()).toBeDisabled();
  });

  it("without a Google client id there are no send buttons, only the downloads", () => {
    vi.mocked(orderDraft.getGoogleClientId).mockReturnValue("");
    renderPanel(makeDetail());
    expect(screen.queryByRole("button", { name: "Wyślij zamówienie" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zlecenie odbioru (PDF)" })).toBeInTheDocument();
    // One short line says why; mark-only keeps working.
    expect(
      screen.getByText("Tworzenie szkiców w Gmailu jest niedostępne — brakuje konfiguracji Google."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oznacz jako wysłane bez maila" })).toBeEnabled();
  });

  it("without a Google client id, unsaved changes still explain the disabled mark-only", () => {
    vi.mocked(orderDraft.getGoogleClientId).mockReturnValue("");
    renderPanel(makeDetail(), { logisticsDirty: true });
    const markOnly = screen.getByRole("button", { name: "Oznacz jako wysłane bez maila" });
    expect(markOnly).toBeDisabled();
    expect(
      screen.getByText("Najpierw zapisz logistykę („Zapisz logistykę” w sekcji Logistyka)."),
    ).toBeInTheDocument();
  });

  it("unsaved logistics disable both sends and mark-only with their own reason", () => {
    renderPanel(makeDetail(), { logisticsDirty: true });
    const reason = "Najpierw zapisz logistykę („Zapisz logistykę” w sekcji Logistyka).";
    expect(orderButton()).toBeDisabled();
    expect(driverButton()).toBeDisabled();
    expect(orderButton()).toHaveAttribute("title", reason);
    expect(screen.getByText(reason)).toBeInTheDocument();
    expect(screen.queryByText("Najpierw zapisz zmiany.")).not.toBeInTheDocument();
    const markOnly = screen.getByRole("button", { name: "Oznacz jako wysłane bez maila" });
    expect(markOnly).toBeDisabled();
    expect(markOnly).toHaveAttribute("title", reason);
  });

  it("unsaved quantities and logistics show both reasons", () => {
    renderPanel(makeDetail(), { dirty: true, logisticsDirty: true });
    expect(screen.getByText("Najpierw zapisz zmiany.")).toBeInTheDocument();
    expect(
      screen.getByText("Najpierw zapisz logistykę („Zapisz logistykę” w sekcji Logistyka)."),
    ).toBeInTheDocument();
  });

  it("a failed draft-config says to reload, not that there is no mailbox", () => {
    renderPanel(makeDetail(), { configStatus: "failed", orderMailbox: "", driverRecipients: null });
    expect(orderButton()).toBeDisabled();
    expect(driverButton()).toBeDisabled();
    expect(
      screen.getByText("Nie udało się wczytać konfiguracji wysyłki — odśwież stronę."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Brak skrzynki zamówień/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Brak skonfigurowanych odbiorców/)).not.toBeInTheDocument();
    // Mark-only does not need the config.
    expect(screen.getByRole("button", { name: "Oznacz jako wysłane bez maila" })).toBeEnabled();
  });

  it("while the draft-config loads the sends wait with a loading reason", () => {
    renderPanel(makeDetail(), { configStatus: "loading", orderMailbox: "" });
    expect(orderButton()).toBeDisabled();
    expect(driverButton()).toBeDisabled();
    expect(screen.getByText("Wczytywanie konfiguracji wysyłki…")).toBeInTheDocument();
    expect(screen.queryByText(/Brak skrzynki zamówień/)).not.toBeInTheDocument();
  });

  it("a cancelled batch offers only the downloads", () => {
    renderPanel(makeDetail({ status: "cancelled" }));
    expect(screen.getByRole("button", { name: "Lista dla kierowcy (PDF)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Wyślij zamówienie" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Oznacz jako wysłane bez maila" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cofnij wysłanie" })).not.toBeInTheDocument();
  });
});

describe("TransportSendPanel — order on a draft batch", () => {
  it("runs token -> finalize -> fetchDetail -> draft -> record, in that order", async () => {
    const h = renderPanel(makeDetail());
    h.fetchDetail.mockImplementation(async () => {
      callLog.push("fetch");
      return sentDetail();
    });
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));

    expect(callLog).toEqual(["token", "finalize", "fetch", "pdf", "draft", "record"]);
    expect(orderDraft.acquireVerifiedGmailToken).toHaveBeenCalledWith({
      clientId: "client-id",
      mailbox: MAILBOX,
    });
    expect(api.transportFinalize).toHaveBeenCalledWith(TRN);
    expect(h.onFinalized).toHaveBeenCalledWith(FINALIZE_OK);
    expect(h.fetchDetail).toHaveBeenCalledWith(TRN);

    const draftArgs = vi.mocked(orderDraft.createVerifiedDraftWithToken).mock.calls[0];
    expect(draftArgs[0]).toBe("tok");
    expect(draftArgs[1].from).toEqual({ name: "Pita Bros", email: MAILBOX });
    expect(draftArgs[1].to).toBe("zamowienia@pago.pl,hurt@pago.pl");
    expect(draftArgs[1].subject.startsWith("KOREKTA")).toBe(false);
    expect(draftArgs[1].attachments).toEqual([
      expect.objectContaining({ base64: "BASE64", mimeType: "application/pdf" }),
    ]);
    expect(draftArgs[1].attachments?.[0].filename).toContain("zamowienie");

    expect(api.transportDraftCreated).toHaveBeenCalledWith({
      transport_id: TRN,
      kind: "order",
      gmail_draft_id: "d-new",
      mailbox: MAILBOX,
      approved_extras: [],
      replaced_draft_id: "",
    });
    expect(gmailDraft.deleteGmailDraft).not.toHaveBeenCalled();
    expect(h.onChanged).toHaveBeenCalled();

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      `Szkic utworzony w ${MAILBOX} — sprawdź treść i załącznik, potem wyślij z Gmaila.`,
    );
    expect(within(status).getByRole("link", { name: "Otwórz Szkice w Gmailu" })).toHaveAttribute(
      "href",
      orderDraft.gmailDraftsUrl(MAILBOX),
    );
    // The card closes on success.
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("unticked extras reach neither the PDF nor the e-mail", async () => {
    renderPanel(makeDetail());
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));

    const pdfDef = JSON.stringify(vi.mocked(transportPdf.generateTransportPdfBase64).mock.calls[0][0]);
    expect(pdfDef).not.toContain("Tacki");
    expect(pdfDef).not.toContain("Feta grecka");
    const body = vi.mocked(orderDraft.createVerifiedDraftWithToken).mock.calls[0][1].body;
    expect(body).not.toContain("Tacki");
    expect(body).not.toContain("Feta grecka");
  });

  it("a ticked extra goes to the PDF and the record, never into the e-mail body", async () => {
    renderPanel(makeDetail());
    await click(orderButton());
    await click(screen.getByLabelText("Pita Bros Wola: Feta grecka - 5 kg"));
    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));

    const pdfDef = JSON.stringify(vi.mocked(transportPdf.generateTransportPdfBase64).mock.calls[0][0]);
    expect(pdfDef).toContain("Feta grecka - 5 kg");
    expect(pdfDef).not.toContain("Tacki");
    const body = vi.mocked(orderDraft.createVerifiedDraftWithToken).mock.calls[0][1].body;
    expect(body).not.toContain("Feta grecka");
    expect(vi.mocked(api.transportDraftCreated).mock.calls[0][0].approved_extras).toEqual([
      "Feta grecka - 5 kg",
    ]);
  });

  it("a finalize failure creates no draft", async () => {
    vi.mocked(api.transportFinalize).mockRejectedValue(
      new ApiError(409, `Transport batch ${TRN} is not draft (status=sent)`),
    );
    const h = renderPanel(makeDetail());
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));

    expect(orderDraft.createVerifiedDraftWithToken).not.toHaveBeenCalled();
    expect(api.transportDraftCreated).not.toHaveBeenCalled();
    expect(h.onFinalized).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("szkic NIE został utworzony");
    expect(screen.getByRole("alert")).toHaveTextContent("is not draft");
    expect(h.onChanged).toHaveBeenCalled();
  });

  it("an empty 'sent' list stops before the draft and shows the skipped reasons", async () => {
    vi.mocked(api.transportFinalize).mockResolvedValue({
      transport_id: TRN,
      sent: [],
      skipped: [{ order_id: "ORD-P", reason: "remove conflict" }],
    });
    const h = renderPanel(makeDetail());
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));

    expect(h.onFinalized).toHaveBeenCalled();
    expect(h.fetchDetail).not.toHaveBeenCalled();
    expect(orderDraft.createVerifiedDraftWithToken).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("ORD-P: remove conflict");
  });

  it("a token failure stops before finalize", async () => {
    vi.mocked(orderDraft.acquireVerifiedGmailToken).mockRejectedValue(
      new orderDraft.WrongMailboxError("beniamin@pitabros.pl"),
    );
    renderPanel(makeDetail());
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));

    expect(api.transportFinalize).not.toHaveBeenCalled();
    expect(orderDraft.createVerifiedDraftWithToken).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("beniamin@pitabros.pl");
  });

  it("a draft failure after finalize says the transport is already marked sent", async () => {
    vi.mocked(orderDraft.createVerifiedDraftWithToken).mockRejectedValue(new Error("boom"));
    renderPanel(makeDetail());
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));

    expect(api.transportFinalize).toHaveBeenCalled();
    expect(api.transportDraftCreated).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Transport jest już oznaczony jako wysłany");
    expect(alert).toHaveTextContent("Kliknij „Wyślij zamówienie” jeszcze raz.");
    expect(alert).toHaveTextContent("boom");
    // The card stays open for the retry.
    expect(screen.getByRole("group")).toBeInTheDocument();
  });

  it("a 409 on draft-created means 'record not saved' — the draft exists, check Gmail", async () => {
    vi.mocked(api.transportDraftCreated).mockRejectedValue(
      new ApiError(409, "order draft can only be recorded on a sent batch"),
    );
    renderPanel(makeDetail());
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      `Szkic powstał w ${MAILBOX}, ale nie udało się go zapisać w historii transportu`,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Sprawdź Szkice w Gmailu.");
    expect(screen.getByRole("status")).toHaveTextContent("Szkic utworzony");
  });
});

describe("TransportSendPanel — order on a sent batch (re-send)", () => {
  it("does not finalize and replaces the previous same-mailbox draft after creating the new one", async () => {
    renderPanel(sentDetail({ events: [draftEvent("order", "d-old", MAILBOX)] }));
    await click(orderButton());
    const card = screen.getByRole("group");
    expect(card).toHaveTextContent("Powstanie nowy szkic; status transportu się nie zmieni.");
    expect(card).toHaveTextContent("zostanie usunięty z Gmaila, jeśli nie został wysłany");
    await click(within(card).getByRole("button", { name: "Utwórz szkic" }));

    expect(api.transportFinalize).not.toHaveBeenCalled();
    expect(callLog).toEqual(["token", "pdf", "draft", "record", "delete"]);
    expect(gmailDraft.deleteGmailDraft).toHaveBeenCalledWith("tok", "d-old");
    expect(vi.mocked(api.transportDraftCreated).mock.calls[0][0].replaced_draft_id).toBe("d-old");
  });

  it("a 404 while deleting the previous draft is silent", async () => {
    vi.mocked(gmailDraft.deleteGmailDraft).mockRejectedValue(
      new Error("Gmail API error 404: Requested entity was not found."),
    );
    renderPanel(sentDetail({ events: [draftEvent("order", "d-old", MAILBOX)] }));
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic" }));

    expect(gmailDraft.deleteGmailDraft).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Szkic utworzony");
  });

  it("any other delete failure is a non-blocking warning", async () => {
    vi.mocked(gmailDraft.deleteGmailDraft).mockRejectedValue(new Error("Gmail API error 500: oops"));
    renderPanel(sentDetail({ events: [draftEvent("order", "d-old", MAILBOX)] }));
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic" }));

    expect(screen.getByRole("alert")).toHaveTextContent("może nadal być w Gmailu. Nie wysyłaj go.");
    expect(screen.getByRole("status")).toHaveTextContent("Szkic utworzony");
  });

  it("a previous draft in another mailbox is not deleted (only flagged on the card)", async () => {
    renderPanel(sentDetail({ events: [draftEvent("order", "d-old", "beniamin@pitabros.pl")] }));
    await click(orderButton());
    expect(screen.getByRole("group")).toHaveTextContent(
      "jest w innej skrzynce (beniamin@pitabros.pl) — usuń go tam ręcznie i nie wysyłaj.",
    );
    await click(screen.getByRole("button", { name: "Utwórz szkic" }));
    expect(gmailDraft.deleteGmailDraft).not.toHaveBeenCalled();
    expect(vi.mocked(api.transportDraftCreated).mock.calls[0][0].replaced_draft_id).toBe("d-old");
  });

  it("the KOREKTA checkbox is unticked by default and marks subject and body when ticked", async () => {
    renderPanel(sentDetail({ events: [draftEvent("order", "d-old", MAILBOX)] }));
    await click(orderButton());
    const correction = screen.getByLabelText(/To korekta zlecenia, które już poszło do PAGO/);
    expect(correction).not.toBeChecked();
    await click(correction);
    await click(screen.getByRole("button", { name: "Utwórz szkic" }));

    const args = vi.mocked(orderDraft.createVerifiedDraftWithToken).mock.calls[0][1];
    expect(args.subject.startsWith("KOREKTA - ")).toBe(true);
    expect(args.body).toContain("KOREKTA: to zlecenie koryguje i zastępuje");
  });

  it("an unticked KOREKTA checkbox leaves subject and body unchanged", async () => {
    renderPanel(sentDetail({ events: [draftEvent("order", "d-old", MAILBOX)] }));
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic" }));
    const args = vi.mocked(orderDraft.createVerifiedDraftWithToken).mock.calls[0][1];
    expect(args.subject.startsWith("KOREKTA")).toBe(false);
    expect(args.body).not.toContain("KOREKTA");
  });

  it("no previous order draft -> no KOREKTA checkbox", async () => {
    renderPanel(sentDetail());
    await click(orderButton());
    expect(screen.queryByLabelText(/To korekta zlecenia/)).not.toBeInTheDocument();
  });
});

describe("TransportSendPanel — driver list", () => {
  it("never finalizes and records a driver draft without extras", async () => {
    const h = renderPanel(makeDetail());
    await click(driverButton());
    const card = screen.getByRole("group", { name: "Szkic listy kierowcy w Gmailu" });
    expect(card).toHaveTextContent("Status transportu się nie zmieni.");
    expect(screen.queryByLabelText(/Feta grecka/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/To korekta zlecenia/)).not.toBeInTheDocument();
    await click(within(card).getByRole("button", { name: "Utwórz szkic" }));

    expect(api.transportFinalize).not.toHaveBeenCalled();
    expect(h.fetchDetail).not.toHaveBeenCalled();
    expect(h.onFinalized).not.toHaveBeenCalled();
    const args = vi.mocked(orderDraft.createVerifiedDraftWithToken).mock.calls[0][1];
    expect(args.to).toBe(DRIVER_RECIPIENTS);
    expect(args.attachments?.[0].filename).toContain("lista-kierowcy");
    expect(api.transportDraftCreated).toHaveBeenCalledWith({
      transport_id: TRN,
      kind: "driver",
      gmail_draft_id: "d-new",
      mailbox: MAILBOX,
      approved_extras: [],
      replaced_draft_id: "",
    });
  });
});

describe("TransportSendPanel — mark-only and undo", () => {
  it("'Oznacz jako wysłane bez maila' confirms, finalizes and refreshes — no Gmail", async () => {
    const h = renderPanel(makeDetail());
    await click(screen.getByRole("button", { name: "Oznacz jako wysłane bez maila" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(api.transportFinalize).toHaveBeenCalledWith(TRN);
    expect(h.onFinalized).toHaveBeenCalledWith(FINALIZE_OK);
    expect(h.onChanged).toHaveBeenCalled();
    expect(orderDraft.acquireVerifiedGmailToken).not.toHaveBeenCalled();
    expect(orderDraft.createVerifiedDraftWithToken).not.toHaveBeenCalled();
  });

  it("mark-only does nothing when the confirm is declined", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    renderPanel(makeDetail());
    await click(screen.getByRole("button", { name: "Oznacz jako wysłane bez maila" }));
    expect(api.transportFinalize).not.toHaveBeenCalled();
  });

  it("'Cofnij wysłanie' explains the consequences, calls reopen and refreshes", async () => {
    vi.mocked(api.transportReopen).mockResolvedValue({
      transport_id: TRN,
      reopened: ["ORD-P", "ORD-M"],
      skipped: [],
    });
    const h = renderPanel(sentDetail());
    expect(screen.queryByRole("button", { name: "Oznacz jako wysłane bez maila" })).not.toBeInTheDocument();
    await click(screen.getByRole("button", { name: "Cofnij wysłanie" }));

    const text = vi.mocked(window.confirm).mock.calls[0][0] as string;
    expect(text).toContain("Zamówienia wrócą do edycji");
    expect(text).toContain("nie wysyłaj go");
    expect(text).toContain("oznacz poprawione jako KOREKTA");
    expect(api.transportReopen).toHaveBeenCalledWith(TRN);
    expect(h.onChanged).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("zamówienia z powrotem w edycji: 2");
  });

  it("a 409 with recorded deliveries names the locations", async () => {
    vi.mocked(api.transportReopen).mockRejectedValue(
      new ApiError(
        409,
        `Transport batch ${TRN} cannot be reopened — delivery already recorded for: Pita Bros Wola`,
      ),
    );
    renderPanel(sentDetail());
    await click(screen.getByRole("button", { name: "Cofnij wysłanie" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nie można cofnąć — dostawa jest już przyjęta w: Pita Bros Wola.",
    );
  });

  it("a 404 says a legacy batch cannot be reopened", async () => {
    vi.mocked(api.transportReopen).mockRejectedValue(new ApiError(404, "not found"));
    renderPanel(sentDetail());
    await click(screen.getByRole("button", { name: "Cofnij wysłanie" }));
    expect(screen.getByRole("alert")).toHaveTextContent("stary transport bez nagłówka");
  });
});

describe("TransportSendPanel — downloads and status", () => {
  it("the ZOW download uses the currently ticked extras", async () => {
    renderPanel(makeDetail());
    await click(orderButton());
    await click(screen.getByLabelText("Pita Bros Wola: Tacki - 2 opak"));
    await click(screen.getByRole("button", { name: "Zlecenie odbioru (PDF)" }));

    const [def, filename] = vi.mocked(transportPdf.downloadTransportPdf).mock.calls[0];
    expect(JSON.stringify(def)).toContain("Tacki - 2 opak");
    expect(JSON.stringify(def)).not.toContain("Feta grecka");
    expect(filename).toContain("zamowienie");
  });

  it("shows the latest draft per kind", () => {
    renderPanel(
      sentDetail({
        events: [
          draftEvent("order", "d-2", MAILBOX, "2026-10-05T11:00:00+00:00"),
          draftEvent("order", "d-1", "stary@pitabros.pl", "2026-10-05T10:00:00+00:00"),
          ...sentDetail().events,
        ],
      }),
    );
    // The newest order draft wins (its mailbox, not the older one's).
    expect(screen.getByText(new RegExp(`^Szkic zamówienia: .* · ${MAILBOX}$`))).toBeInTheDocument();
    expect(screen.queryByText(/stary@pitabros\.pl/)).not.toBeInTheDocument();
    expect(screen.getByText("Szkic listy kierowcy: jeszcze nie utworzony")).toBeInTheDocument();
    expect(screen.getByText(/^Oznaczony jako wysłany: /)).toBeInTheDocument();
  });
});

// ---- final impl review fixes -------------------------------------------------

const RECORDED: TransportEvent = {
  event_id: "EV-x",
  transport_id: TRN,
  event_type: "order_draft_created",
  details: "",
} as TransportEvent;

/** A sent batch whose order draft d-old sits in the order mailbox. */
function resendDetail(): TransportBatchDetail {
  return sentDetail({ events: [draftEvent("order", "d-old", MAILBOX), ...sentDetail().events] });
}

/** makeDetail()/sentDetail() orders with ORD-P's extra_items replaced. */
function withPagoExtras(
  base: TransportBatchDetail,
  extraItems: string,
): TransportBatchDetail {
  return {
    ...base,
    orders: base.orders.map((o) => (o.order_id === "ORD-P" ? { ...o, extra_items: extraItems } : o)),
  };
}

function reopenEvent(at: string): TransportEvent {
  return {
    event_id: `EV-reopen-${at}`,
    transport_id: TRN,
    event_type: "batch_reopened",
    at,
    details: "",
  };
}

describe("TransportSendPanel — recording the draft", () => {
  it("a failed record keeps the previous draft and says to delete one of the two by hand", async () => {
    vi.mocked(api.transportDraftCreated).mockRejectedValue(
      new ApiError(409, `Transport batch ${TRN} is not sent (status=draft)`),
    );
    renderPanel(resendDetail());
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic" }));

    // A 4xx is final — no retry.
    expect(api.transportDraftCreated).toHaveBeenCalledTimes(1);
    expect(gmailDraft.deleteGmailDraft).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      `Nowy szkic jest w Szkicach ${MAILBOX}, ale aplikacja go nie zapisała`,
    );
    expect(alert).toHaveTextContent("Poprzedni szkic NIE został usunięty");
    expect(alert).toHaveTextContent("Usuń ręcznie jeden z nich, żeby nie wysłać dwóch.");
    expect(screen.getByRole("status")).toHaveTextContent("Szkic utworzony");
  });

  it("a 503 on the record is retried once, then the previous draft is replaced", async () => {
    vi.mocked(api.transportDraftCreated)
      .mockRejectedValueOnce(
        new ApiError(503, "the Gmail draft exists but its record could not be saved — retry"),
      )
      .mockImplementationOnce(async () => {
        callLog.push("record");
        return RECORDED;
      });
    renderPanel(resendDetail());
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic" }));

    expect(api.transportDraftCreated).toHaveBeenCalledTimes(2);
    expect(callLog).toEqual(["token", "pdf", "draft", "record", "delete"]);
    expect(gmailDraft.deleteGmailDraft).toHaveBeenCalledWith("tok", "d-old");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a network error is retried once; a second failure keeps the previous draft", async () => {
    vi.mocked(api.transportDraftCreated).mockRejectedValue(new ApiError(0, "Failed to fetch"));
    renderPanel(resendDetail());
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic" }));

    expect(api.transportDraftCreated).toHaveBeenCalledTimes(2);
    expect(gmailDraft.deleteGmailDraft).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Poprzedni szkic NIE został usunięty");
  });

  it("a 422 is never retried", async () => {
    vi.mocked(api.transportDraftCreated).mockRejectedValue(
      new ApiError(422, "approved_extras: List should have at most 50 items"),
    );
    renderPanel(makeDetail());
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));

    expect(api.transportDraftCreated).toHaveBeenCalledTimes(1);
    // No previous draft: the plain "not recorded" warning.
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kolejne „Wyślij” nie zastąpi tego szkicu — przed ponownym wysłaniem usuń go ręcznie.",
    );
  });
});

describe("TransportSendPanel — approved extras limits and staleness", () => {
  it("a ticked extra over 300 characters disables the confirm button with a reason", async () => {
    const ok = "A".repeat(300);
    const tooLong = "B".repeat(301);
    renderPanel(withPagoExtras(makeDetail(), `${ok}\n${tooLong}`));
    await click(orderButton());
    const confirm = screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" });

    await click(screen.getByLabelText(`Pita Bros Wola: ${ok}`));
    expect(confirm).toBeEnabled();

    await click(screen.getByLabelText(`Pita Bros Wola: ${tooLong}`));
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("group")).toHaveTextContent(
      "Pozycja spoza katalogu ma ponad 300 znaków",
    );
    await click(confirm);
    expect(orderDraft.acquireVerifiedGmailToken).not.toHaveBeenCalled();

    await click(screen.getByLabelText(`Pita Bros Wola: ${tooLong}`));
    expect(confirm).toBeEnabled();
  });

  it("more than 50 ticked extras disable the confirm button with a reason", async () => {
    const many = Array.from({ length: 51 }, (_, i) => `Pozycja ${i + 1}`).join("\n");
    renderPanel(withPagoExtras(makeDetail(), many));
    await click(orderButton());
    const boxes = within(screen.getByRole("group")).getAllByRole("checkbox");
    expect(boxes).toHaveLength(51);
    for (const box of boxes) await click(box);

    const confirm = screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("group")).toHaveTextContent(
      "Zaznaczono 51 pozycji spoza katalogu — można najwyżej 50.",
    );
    await click(confirm);
    expect(orderDraft.acquireVerifiedGmailToken).not.toHaveBeenCalled();

    await click(boxes[50]);
    expect(confirm).toBeEnabled();
  });

  it("a ticked line whose text changed on a refresh is neither printed nor sent", async () => {
    const h = renderPanel(sentDetail());
    await click(orderButton());
    await click(screen.getByLabelText("Pita Bros Wola: Feta grecka - 5 kg"));

    // Same key (ORD-P#1), different text.
    h.rerender(withPagoExtras(sentDetail(), "Tacki - 2 opak\nFeta grecka - 7 kg"));
    expect(screen.getByLabelText("Pita Bros Wola: Feta grecka - 7 kg")).not.toBeChecked();

    await click(screen.getByRole("button", { name: "Zlecenie odbioru (PDF)" }));
    expect(JSON.stringify(vi.mocked(transportPdf.downloadTransportPdf).mock.calls[0][0])).not.toContain(
      "Feta grecka",
    );

    await click(screen.getByRole("button", { name: "Utwórz szkic" }));
    const pdfDef = JSON.stringify(vi.mocked(transportPdf.generateTransportPdfBase64).mock.calls[0][0]);
    expect(pdfDef).not.toContain("Feta grecka");
    expect(vi.mocked(api.transportDraftCreated).mock.calls[0][0].approved_extras).toEqual([]);
  });

  it("a ticked line whose text changed in the re-fetch after finalize is dropped", async () => {
    renderPanel(makeDetail(), {
      fetched: withPagoExtras(sentDetail(), "Tacki - 2 opak\nFeta grecka - 7 kg"),
    });
    await click(orderButton());
    await click(screen.getByLabelText("Pita Bros Wola: Feta grecka - 5 kg"));
    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));

    const pdfDef = JSON.stringify(vi.mocked(transportPdf.generateTransportPdfBase64).mock.calls[0][0]);
    expect(pdfDef).not.toContain("Feta grecka");
    expect(vi.mocked(api.transportDraftCreated).mock.calls[0][0].approved_extras).toEqual([]);
  });
});

describe("TransportSendPanel — deadlines", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a hung Gmail draft call ends in the 'failed after finalize' error and frees the buttons", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.mocked(orderDraft.createVerifiedDraftWithToken).mockImplementation(
      () => new Promise<{ id: string }>(() => undefined),
    );
    const h = renderPanel(makeDetail());
    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));

    expect(screen.getByRole("button", { name: "Tworzenie szkicu…" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Transport jest już oznaczony jako wysłany");
    expect(alert).toHaveTextContent("Gmail nie odpowiedział w ciągu 60 s");
    expect(api.transportDraftCreated).not.toHaveBeenCalled();
    expect(h.onChanged).toHaveBeenCalled();
    // busy cleared: the card's confirm is usable again.
    expect(
      screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }),
    ).toBeEnabled();
  });
});

describe("TransportSendPanel — KOREKTA default", () => {
  it("is pre-ticked when 'Cofnij wysłanie' came after the last order draft", async () => {
    renderPanel(
      makeDetail({
        events: [
          reopenEvent("2026-10-05T11:00:00+00:00"),
          draftEvent("order", "d-old", MAILBOX, "2026-10-05T10:00:00+00:00"),
        ],
      }),
    );
    await click(orderButton());
    expect(screen.getByLabelText(/To korekta zlecenia/)).toBeChecked();
    expect(
      screen.getByText("Zaznaczone, bo po ostatnim szkicu zamówienia było „Cofnij wysłanie”."),
    ).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));
    const args = vi.mocked(orderDraft.createVerifiedDraftWithToken).mock.calls[0][1];
    expect(args.subject.startsWith("KOREKTA - ")).toBe(true);
  });

  it("stays unticked when the last order draft is newer than the reopen", async () => {
    renderPanel(
      sentDetail({
        events: [
          draftEvent("order", "d-new", MAILBOX, "2026-10-05T12:00:00+00:00"),
          reopenEvent("2026-10-05T11:00:00+00:00"),
          ...sentDetail().events,
        ],
      }),
    );
    await click(orderButton());
    expect(screen.getByLabelText(/To korekta zlecenia/)).not.toBeChecked();
    expect(screen.queryByText(/Zaznaczone, bo po ostatnim szkicu/)).not.toBeInTheDocument();
  });

  it("an aborted reopen (batch_reopen_aborted) does not pre-tick it", async () => {
    renderPanel(
      sentDetail({
        events: [
          { ...reopenEvent("2026-10-05T13:00:00+00:00"), event_type: "batch_reopen_aborted" },
          draftEvent("order", "d-old", MAILBOX, "2026-10-05T12:00:00+00:00"),
          ...sentDetail().events,
        ],
      }),
    );
    await click(orderButton());
    expect(screen.getByLabelText(/To korekta zlecenia/)).not.toBeChecked();
  });
});

describe("TransportSendPanel — busy reporting", () => {
  it("reports busy while a send runs and idle once it ends", async () => {
    let releaseToken: (token: string) => void = () => undefined;
    vi.mocked(orderDraft.acquireVerifiedGmailToken).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          releaseToken = resolve;
        }),
    );
    const onBusyChange = vi.fn();
    renderPanel(makeDetail(), { onBusyChange });
    expect(onBusyChange).toHaveBeenLastCalledWith(false);

    await click(orderButton());
    await click(screen.getByRole("button", { name: "Utwórz szkic i oznacz jako wysłane" }));
    expect(onBusyChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      releaseToken("tok");
    });
    expect(api.transportDraftCreated).toHaveBeenCalled();
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it("a PDF download alone does not count as busy", async () => {
    let releaseDownload: () => void = () => undefined;
    vi.mocked(transportPdf.downloadTransportPdf).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseDownload = resolve;
        }),
    );
    const onBusyChange = vi.fn();
    renderPanel(makeDetail(), { onBusyChange });
    await click(screen.getByRole("button", { name: "Lista dla kierowcy (PDF)" }));
    expect(onBusyChange).not.toHaveBeenCalledWith(true);
    await act(async () => {
      releaseDownload();
    });
  });
});
