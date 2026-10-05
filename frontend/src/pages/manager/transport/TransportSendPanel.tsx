// "Dokumenty i wysyłka" — the ONE place a Transport batch is sent and marked
// (transport-v2, replaces PrintViews.tsx and the draft footer's
// "Zapisz i wyślij" / "Zatwierdź transport").
//
// What it offers:
//   - two PDF downloads (driver list, ZOW) for a preview — the ZOW download
//     uses the CURRENTLY ticked approved extras, so the preview is what would
//     be sent;
//   - "Wyślij zamówienie" / "Wyślij listę kierowcy": a click only opens an
//     inline confirmation card (React state, never window.confirm). The
//     card's confirm button is the click that runs the flow, and its FIRST
//     await is acquireVerifiedGmailToken — the Google popup must open inside
//     that click's user activation, so no other await may come before it;
//   - "Oznacz jako wysłane bez maila" (draft batches) and "Cofnij wysłanie"
//     (sent batches).
//
// The app never sends an e-mail: it creates a verified Gmail draft in the
// order mailbox (biuro@) with the PDF attached, records it on the batch
// (draft-created), deletes the superseded draft of the same kind (best
// effort, only after the new one exists AND is recorded), and the Manager
// sends it from Gmail after checking it. Off-catalogue items never go into
// an e-mail body; for the ORDER they reach the ZOW PDF only when ticked here
// (unticked by default — an agreed exception with PAGO).
//
// Every async step has a deadline (lessons.md: no eternal spinners). A
// deadline does not cancel the call — it only stops waiting for it.

import { useEffect, useState, type ReactElement } from "react";
import { Download, Loader2, Mail, RotateCcw, Send } from "lucide-react";

import { api, ApiError } from "../../../apiClient";
import { useT } from "../../../i18n";
import type {
  TransportBatchDetail,
  TransportEvent,
  TransportFinalizeResponse,
  TransportSkippedOrder,
} from "../../../types";
import { buildDriverDraftEmail, buildPagoDraftEmail, deleteGmailDraft } from "../lib/gmailDraft";
import {
  acquireVerifiedGmailToken,
  createVerifiedDraftWithToken,
  describeDraftError,
  getGoogleClientId,
  gmailDraftsUrl,
} from "../lib/orderEmailDraft";
import {
  buildTransportDriverPrintDoc,
  buildTransportPagoPrintDoc,
  hasValidRecipient,
  latestTransportDraft,
  LOGISTICS_FIELD_LABEL_KEYS,
  missingLogisticsFields,
  pagoExtraItemLines,
  sortTransportEvents,
  splitRecipients,
  type TransportExtraLine,
} from "../lib/transport";
import {
  buildDriverPdfDocDefinition,
  buildPagoPdfDocDefinition,
  downloadTransportPdf,
  generateTransportPdfBase64,
  transportPdfFilename,
} from "../lib/transportPdf";

/** Which document a "Wyślij" button creates a draft for. */
export type TransportDraftKind = "order" | "driver";

/** The two document labels of a batch (driver docs / supplier-facing docs). */
export interface TransportDocLabels {
  displayLabel: string;
  pagoDisplayLabel: string;
}

export interface TransportSendPanelProps {
  detail: TransportBatchDetail;
  /** Label of the driver documents (transportDisplayLabel(detail)). */
  displayLabel: string;
  /** Label of the supplier-facing documents (from leadSupplierView(detail)). */
  pagoDisplayLabel: string;
  /** Labels for a re-fetched detail (after finalize the members — and so the
   * cities in an auto-label — can change). Omitted -> the two props above. */
  labelsFor?: (detail: TransportBatchDetail) => TransportDocLabels;
  /** The lead supplier's e-mail list (comma/semicolon separated). */
  supplierEmail?: string | null;
  /** Operator-configured driver-list recipients. */
  driverRecipients?: string | null;
  /** draft-config `order_mailbox` (biuro@) — the draft's mailbox and From. */
  orderMailbox: string;
  /** Unsaved matrix edits on the page — send and mark-only wait for a save. */
  dirty: boolean;
  /** Unsaved Logistics edits (date, time, driver, vehicle…) — the documents
   * are built from the SAVED batch, so send and mark-only wait for a save. */
  logisticsDirty?: boolean;
  /** The page's draft-config fetch (order mailbox, driver recipients):
   * "loading" / "failed" get their own reason instead of "no mailbox".
   * Omitted -> "ready". */
  configStatus?: "loading" | "ready" | "failed";
  /** The panel runs a send / mark-only / undo (downloads do not count) —
   * the page must not unmount it meanwhile, or the result is lost. */
  onBusyChange?: (busy: boolean) => void;
  /** Refresh the batch detail and the history list. */
  onChanged: () => Promise<void>;
  /** A finalize ran (send on a draft batch, or mark-only) — show its result. */
  onFinalized: (res: TransportFinalizeResponse) => void;
  /** Fetch the batch detail (used right after finalize, before the PDF). */
  fetchDetail: (transportId: string) => Promise<TransportBatchDetail>;
}

type Busy = "downloadDriver" | "downloadPago" | TransportDraftKind | "mark" | "reopen" | null;

interface ReopenResult {
  count: number;
  skipped: TransportSkippedOrder[];
}

/** Readable message out of an ApiError / Error / anything else. */
function errorDetail(e: unknown): string {
  if (e instanceof ApiError) return e.detail;
  if (e instanceof Error && e.message) return e.message;
  return String(e);
}

/** deleteGmailDraft throws "Gmail API error 404: …" when the draft is gone —
 * it was sent from Gmail or removed by hand. That is the expected case. */
function isGmailNotFound(e: unknown): boolean {
  return e instanceof Error && /^Gmail API error 404\b/.test(e.message);
}

function sameMailbox(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** "…delivery already recorded for: Wola, Bracka" -> "Wola, Bracka". */
function deliveredLocations(detail: string): string | null {
  const m = /delivery already recorded for:\s*(.+)$/.exec(detail);
  return m ? m[1].trim() : null;
}

/** Deadline of every step after the Google token. */
const STEP_DEADLINE_MS = 60_000;
/** Deadline of the token step. requestGmailAccessToken has its own 90 s
 * sign-in timeout; this one only catches a hang in the mailbox check after
 * it, so it must stay longer than 90 s. */
const TOKEN_DEADLINE_MS = 120_000;

/** Mirrors TransportDraftCreatedRequest.approved_extras on the backend
 * (max_length=50 items, each max_length=300 characters) — checked before the
 * token, so a 422 can never come after the draft already exists. */
const MAX_APPROVED_EXTRAS = 50;
const MAX_APPROVED_EXTRA_CHARS = 300;

/** A step that did not settle within its deadline. */
class StepTimeoutError extends Error {}

/** Reject with StepTimeoutError(message) when `promise` has not settled
 * within `ms`. The underlying call keeps running — only the wait stops. */
function withDeadline<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new StepTimeoutError(message)), ms);
    promise.then(
      (value: T) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** draft-created is retried once only when the request may not have reached
 * the backend or the backend failed (network error = ApiError 0, a 5xx, or
 * no answer within the deadline). A 4xx is final. A retry after a write that
 * did land only adds a second identical event, which is harmless. */
function isRetriableRecordError(e: unknown): boolean {
  if (e instanceof StepTimeoutError) return true;
  return e instanceof ApiError && (e.status === 0 || e.status >= 500);
}

/** Length in code points, as Pydantic's max_length counts a str. */
function charCount(text: string): number {
  return Array.from(text).length;
}

function shortened(text: string, max = 40): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : text;
}

function isoMs(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** True when a "Cofnij wysłanie" (batch_reopened) is newer than the latest
 * order draft: the first ZOW has then usually already gone to PAGO, so the
 * next one should be marked KOREKTA. A draft without a usable time counts as
 * older than any reopen (the safer default). */
function reopenedSinceOrderDraft(
  events: TransportEvent[] | null | undefined,
  draftAt: string,
): boolean {
  const reopens = (events ?? [])
    .filter((e) => e.event_type === "batch_reopened")
    .map((e) => isoMs(e.at))
    .filter((ms): ms is number => ms !== null);
  if (reopens.length === 0) return false;
  const draftMs = isoMs(draftAt);
  return draftMs === null || Math.max(...reopens) > draftMs;
}

const BUTTON_BASE =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";
const BUTTON_OUTLINE = `${BUTTON_BASE} border border-slate-300 text-slate-800 hover:bg-slate-50 focus-visible:ring-blue-500`;
const BUTTON_PRIMARY = `${BUTTON_BASE} bg-green-700 text-white hover:bg-green-800 focus-visible:ring-green-500`;

export function TransportSendPanel({
  detail,
  displayLabel,
  pagoDisplayLabel,
  labelsFor,
  supplierEmail,
  driverRecipients,
  orderMailbox,
  dirty,
  logisticsDirty = false,
  configStatus = "ready",
  onBusyChange,
  onChanged,
  onFinalized,
  fetchDetail,
}: TransportSendPanelProps): ReactElement {
  const { t, formatDateTime } = useT();

  const [busy, setBusy] = useState<Busy>(null);
  const [confirmKind, setConfirmKind] = useState<TransportDraftKind | null>(null);
  // Ticked off-catalogue lines: TransportExtraLine.key -> the text that was
  // ticked. Unticked by default; kept while this batch is open so the ZOW
  // preview download and the send use the same set. A line counts as ticked
  // only while its CURRENT text still equals the ticked text — the key is
  // positional (`${orderId}#${n}`), so a refresh that changes the line under
  // the same key unticks it instead of sending a text nobody approved.
  const [approvedExtras, setApprovedExtras] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [correction, setCorrection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [successMailbox, setSuccessMailbox] = useState<string | null>(null);
  const [reopenResult, setReopenResult] = useState<ReopenResult | null>(null);

  // Report a running send / mark-only / undo to the page; false again on
  // unmount so the page can never stay locked.
  const flowBusy = busy !== null && busy !== "downloadDriver" && busy !== "downloadPago";
  useEffect(() => {
    if (!onBusyChange) return undefined;
    onBusyChange(flowBusy);
    return () => onBusyChange(false);
  }, [flowBusy, onBusyChange]);

  const isDraft = detail.status === "draft";
  const isSent = detail.status === "sent";
  const isCancelled = detail.status === "cancelled";
  const clientId = getGoogleClientId();
  const mailbox = orderMailbox.trim();

  const extraLines: TransportExtraLine[] = pagoExtraItemLines(detail);
  const isApproved = (line: TransportExtraLine): boolean =>
    approvedExtras.get(line.key) === line.text;
  const approvedLines = extraLines.filter(isApproved);
  const previousOrder = latestTransportDraft(detail.events, "order");
  const previousDriver = latestTransportDraft(detail.events, "driver");
  const correctionByDefault =
    previousOrder !== null && reopenedSinceOrderDraft(detail.events, previousOrder.at);
  const sentEvent = sortTransportEvents(detail.events ?? []).find(
    (e) => e.event_type === "batch_sent" && e.at,
  );
  const stepTimeout = t("manager.transport.send.timeout", { seconds: STEP_DEADLINE_MS / 1000 });

  const resetMessages = (): void => {
    setError(null);
    setWarnings([]);
    setSuccessMailbox(null);
    setReopenResult(null);
  };

  // ---- why a "Wyślij" button is disabled (null = enabled) -------------------

  // Unsaved edits on the page, matrix first — one line each.
  const unsavedReasons: string[] = [
    ...(dirty ? [t("manager.transport.send.reason.dirty")] : []),
    ...(logisticsDirty ? [t("manager.transport.send.reason.logisticsDirty")] : []),
  ];
  const unsavedReason: string | null = unsavedReasons[0] ?? null;
  const configReason: string | null =
    configStatus === "loading"
      ? t("manager.transport.send.reason.configLoading")
      : configStatus === "failed"
        ? t("manager.transport.send.reason.configFailed")
        : null;

  const orderReason = ((): string | null => {
    if (unsavedReason) return unsavedReason;
    if (isDraft && detail.orders.length === 0) return t("manager.transport.send.reason.noOrders");
    if (configReason) return configReason;
    if (!hasValidRecipient(supplierEmail)) {
      return t(
        isDraft
          ? "manager.transport.send.reason.noOrderRecipientMarkOnly"
          : "manager.transport.send.reason.noOrderRecipient",
      );
    }
    if (!mailbox) return t("manager.transport.send.reason.noMailbox");
    return null;
  })();

  const driverReason = ((): string | null => {
    if (unsavedReason) return unsavedReason;
    if (configReason) return configReason;
    if (!hasValidRecipient(driverRecipients)) {
      return t("manager.transport.send.reason.noDriverRecipient");
    }
    if (!mailbox) return t("manager.transport.send.reason.noMailbox");
    return null;
  })();

  const reasonFor = (kind: TransportDraftKind): string | null =>
    kind === "order" ? orderReason : driverReason;

  // The ticked extras must fit the draft-created record — checked on the
  // card's confirm button only (the ticks are changed on the card itself).
  const extrasReason = ((): string | null => {
    if (approvedLines.length > MAX_APPROVED_EXTRAS) {
      return t("manager.transport.send.reason.tooManyExtras", {
        count: approvedLines.length,
        max: MAX_APPROVED_EXTRAS,
      });
    }
    const tooLong = approvedLines.find(
      (line) => charCount(line.text) > MAX_APPROVED_EXTRA_CHARS,
    );
    if (tooLong) {
      return t("manager.transport.send.reason.extraTooLong", {
        max: MAX_APPROVED_EXTRA_CHARS,
        text: shortened(tooLong.text),
      });
    }
    return null;
  })();

  /** Why the card's confirm button is disabled (null = enabled). */
  const confirmReasonFor = (kind: TransportDraftKind): string | null =>
    kind === "order" ? (orderReason ?? extrasReason) : driverReason;

  /** Refresh the page before releasing the buttons — bounded, and its own
   * errors are the page's to report. */
  const refreshAfter = async (): Promise<void> => {
    try {
      await withDeadline(onChanged(), STEP_DEADLINE_MS, stepTimeout);
    } catch {
      // the page reports its own refresh errors
    }
  };

  // ---- PDF downloads (preview) ---------------------------------------------

  const handleDownload = async (which: "driver" | "pago"): Promise<void> => {
    setError(null);
    setBusy(which === "driver" ? "downloadDriver" : "downloadPago");
    try {
      const generatedAt = new Date().toLocaleString("pl-PL");
      if (which === "driver") {
        const doc = buildTransportDriverPrintDoc(detail, displayLabel);
        await withDeadline(
          downloadTransportPdf(
            buildDriverPdfDocDefinition(doc, t, generatedAt),
            transportPdfFilename(displayLabel, "lista-kierowcy"),
          ),
          STEP_DEADLINE_MS,
          stepTimeout,
        );
      } else {
        const doc = buildTransportPagoPrintDoc(
          detail,
          pagoDisplayLabel,
          approvedLines.map((line) => line.text),
        );
        await withDeadline(
          downloadTransportPdf(
            buildPagoPdfDocDefinition(doc, t, generatedAt),
            transportPdfFilename(pagoDisplayLabel, "zamowienie"),
          ),
          STEP_DEADLINE_MS,
          stepTimeout,
        );
      }
    } catch {
      setError(t("manager.transport.send.downloadError"));
    } finally {
      setBusy(null);
    }
  };

  // ---- "Wyślij …": open the confirmation card (no async work here) ----------

  const openConfirm = (kind: TransportDraftKind): void => {
    resetMessages();
    // Pre-ticked after a "Cofnij wysłanie" that came after the last order
    // draft: a second ZOW without the KOREKTA label risks a double pickup.
    setCorrection(kind === "order" && correctionByDefault);
    setConfirmKind(kind);
  };

  const toggleApproved = (line: TransportExtraLine): void => {
    setApprovedExtras((prev) => {
      const next = new Map(prev);
      if (prev.get(line.key) === line.text) next.delete(line.key);
      else next.set(line.key, line.text);
      return next;
    });
  };

  // ---- the confirm click ---------------------------------------------------

  const handleConfirm = async (kind: TransportDraftKind): Promise<void> => {
    if (busy !== null || reasonFor(kind) !== null) return;
    // Synchronous, before the token: an extras set the record would reject
    // (422) must stop here, not after the draft already exists.
    if (kind === "order" && extrasReason !== null) {
      setError(extrasReason);
      return;
    }
    // Everything the flow needs is captured synchronously, BEFORE the first
    // await: the token request must open its popup inside this click.
    const transportId = detail.transport_id;
    const finalizeFirst = kind === "order" && isDraft;
    const previous = kind === "order" ? previousOrder : previousDriver;
    // Only the lines ticked AND unchanged right now (validated above).
    const approved = new Map(approvedLines.map((line) => [line.key, line.text] as const));
    const asCorrection = kind === "order" && previousOrder !== null && correction;
    const orderTo = splitRecipients(supplierEmail ?? "").join(",");
    const driverTo = splitRecipients(driverRecipients ?? "").join(",");
    const fromName = t("manager.transport.send.fromName");
    const draftTimeout = t("manager.transport.send.timeoutDraft", {
      seconds: STEP_DEADLINE_MS / 1000,
    });
    const tokenTimeout = t("manager.transport.send.timeout", {
      seconds: TOKEN_DEADLINE_MS / 1000,
    });
    setBusy(kind);
    resetMessages();

    let succeeded = false;
    const nextWarnings: string[] = [];
    try {
      // 1. Verified token for the order mailbox — the FIRST await (the call
      //    starts synchronously inside withDeadline's argument).
      let token: string;
      try {
        token = await withDeadline(
          acquireVerifiedGmailToken({ clientId: getGoogleClientId(), mailbox }),
          TOKEN_DEADLINE_MS,
          tokenTimeout,
        );
      } catch (e) {
        setError(describeDraftError(e, t, { mailbox, sender: mailbox }));
        return;
      }

      // 2. ORDER on a DRAFT batch: mark it sent first, then reload it so the
      //    PDF shows the members finalize actually sent.
      let current: TransportBatchDetail = detail;
      let finalized = false;
      if (finalizeFirst) {
        let res: TransportFinalizeResponse;
        try {
          res = await withDeadline(api.transportFinalize(transportId), STEP_DEADLINE_MS, stepTimeout);
        } catch (e) {
          setError(t("manager.transport.send.finalizeError", { detail: errorDetail(e) }));
          return;
        }
        onFinalized(res);
        if (res.sent.length === 0) {
          setError(
            t("manager.transport.send.nothingSent", {
              skipped: res.skipped.map((s) => `${s.order_id}: ${s.reason}`).join("; ") || "—",
            }),
          );
          return;
        }
        finalized = true;
      }

      // 3-4. Document + verified draft. After a successful finalize any
      //      failure here leaves a SENT batch without a draft — say so.
      let draftId: string;
      let approvedTexts: string[] = [];
      try {
        if (finalized) {
          current = await withDeadline(fetchDetail(transportId), STEP_DEADLINE_MS, stepTimeout);
        }
        const labels: TransportDocLabels = labelsFor
          ? labelsFor(current)
          : { displayLabel, pagoDisplayLabel };
        const generatedAt = new Date().toLocaleString("pl-PL");
        let subject: string;
        let body: string;
        let to: string;
        let base64: string;
        let filename: string;
        if (kind === "order") {
          // A ticked line goes in only if its text after the re-fetch is
          // still the ticked text; a line whose order left the batch at
          // finalize, or whose text changed, drops out.
          approvedTexts = pagoExtraItemLines(current)
            .filter((line) => approved.get(line.key) === line.text)
            .map((line) => line.text);
          const doc = buildTransportPagoPrintDoc(current, labels.pagoDisplayLabel, approvedTexts);
          base64 = await withDeadline(
            generateTransportPdfBase64(buildPagoPdfDocDefinition(doc, t, generatedAt)),
            STEP_DEADLINE_MS,
            stepTimeout,
          );
          ({ subject, bodyText: body } = buildPagoDraftEmail(current, labels.pagoDisplayLabel, t, {
            correction: asCorrection,
          }));
          to = orderTo;
          filename = transportPdfFilename(labels.pagoDisplayLabel, "zamowienie");
        } else {
          const doc = buildTransportDriverPrintDoc(current, labels.displayLabel);
          base64 = await withDeadline(
            generateTransportPdfBase64(buildDriverPdfDocDefinition(doc, t, generatedAt)),
            STEP_DEADLINE_MS,
            stepTimeout,
          );
          ({ subject, bodyText: body } = buildDriverDraftEmail(current, labels.displayLabel, t));
          to = driverTo;
          filename = transportPdfFilename(labels.displayLabel, "lista-kierowcy");
        }
        const created = await withDeadline(
          createVerifiedDraftWithToken(token, {
            from: { name: fromName, email: mailbox },
            to,
            subject,
            body,
            attachments: [{ filename, base64, mimeType: "application/pdf" }],
          }),
          STEP_DEADLINE_MS,
          draftTimeout,
        );
        draftId = created.id;
      } catch (e) {
        const reason = describeDraftError(e, t, { mailbox, sender: mailbox });
        setError(
          finalized
            ? t("manager.transport.send.draftFailedAfterFinalize", { detail: reason })
            : reason,
        );
        return;
      }

      // 5. Record the draft on the batch, retried once on a network error /
      //    5xx / timeout. A failure does not undo the draft.
      const recordDraft = (): Promise<TransportEvent> =>
        withDeadline(
          api.transportDraftCreated({
            transport_id: transportId,
            kind,
            gmail_draft_id: draftId,
            mailbox,
            approved_extras: approvedTexts,
            replaced_draft_id: previous?.draftId ?? "",
          }),
          STEP_DEADLINE_MS,
          stepTimeout,
        );
      let recordError: unknown = null;
      try {
        await recordDraft();
      } catch (e) {
        recordError = e;
        if (isRetriableRecordError(e)) {
          try {
            await recordDraft();
            recordError = null;
          } catch (retryError) {
            recordError = retryError;
          }
        }
      }

      // 6. Best effort: delete the superseded draft of the same kind — only
      //    now that the new one exists AND is recorded, and only in the same
      //    mailbox (the token cannot reach another one). 404 = already sent
      //    or removed. When the record failed the history still points at
      //    the previous draft: deleting it would leave the new draft
      //    unknown to the app and the next send would add a third — so it
      //    stays, and the Manager removes one of the two by hand.
      const replaceable =
        previous !== null &&
        previous.draftId !== draftId &&
        sameMailbox(previous.mailbox, mailbox);
      if (recordError !== null) {
        nextWarnings.push(
          t(
            replaceable
              ? "manager.transport.send.recordFailedKeptPrevious"
              : "manager.transport.send.recordFailed",
            { mailbox, detail: errorDetail(recordError) },
          ),
        );
      } else if (replaceable) {
        try {
          await withDeadline(
            deleteGmailDraft(token, previous.draftId),
            STEP_DEADLINE_MS,
            stepTimeout,
          );
        } catch (e) {
          if (!isGmailNotFound(e)) {
            nextWarnings.push(
              t("manager.transport.send.deletePreviousFailed", {
                detail: describeDraftError(e, t, { mailbox, sender: mailbox }),
              }),
            );
          }
        }
      }

      // 7. Done — the Manager checks the draft and sends it from Gmail.
      succeeded = true;
      setSuccessMailbox(mailbox);
      setWarnings(nextWarnings);
      try {
        // Likely popup-blocked this late in the chain; the link is the fallback.
        window.open(gmailDraftsUrl(mailbox), "_blank", "noopener");
      } catch {
        // ignore — the success line carries the link
      }
    } finally {
      if (succeeded) setConfirmKind(null);
      // Refresh before releasing the buttons: a second send must see the
      // draft just recorded, or it would not replace it.
      await refreshAfter();
      setBusy(null);
    }
  };

  // ---- "Oznacz jako wysłane bez maila" (draft batches) ----------------------

  const handleMarkOnly = async (): Promise<void> => {
    if (busy !== null || unsavedReason !== null) return;
    if (!window.confirm(t("manager.transport.send.markOnly.confirm", { id: detail.transport_id }))) {
      return;
    }
    resetMessages();
    setConfirmKind(null);
    setBusy("mark");
    try {
      const res = await withDeadline(
        api.transportFinalize(detail.transport_id),
        STEP_DEADLINE_MS,
        stepTimeout,
      );
      onFinalized(res);
    } catch (e) {
      setError(t("manager.transport.send.markOnly.error", { detail: errorDetail(e) }));
    } finally {
      await refreshAfter();
      setBusy(null);
    }
  };

  // ---- "Cofnij wysłanie" (sent batches) --------------------------------------

  const handleReopen = async (): Promise<void> => {
    if (busy !== null) return;
    if (!window.confirm(t("manager.transport.send.reopen.confirm", { id: detail.transport_id }))) {
      return;
    }
    resetMessages();
    setConfirmKind(null);
    setBusy("reopen");
    try {
      const res = await withDeadline(
        api.transportReopen(detail.transport_id),
        STEP_DEADLINE_MS,
        stepTimeout,
      );
      setReopenResult({ count: res.reopened.length, skipped: res.skipped });
    } catch (e) {
      const msg = errorDetail(e);
      if (e instanceof ApiError && e.status === 404) {
        setError(t("manager.transport.send.reopen.errLegacy"));
      } else if (e instanceof ApiError && e.status === 409) {
        const locations = deliveredLocations(msg);
        setError(
          locations
            ? t("manager.transport.send.reopen.errDelivered", { locations })
            : t("manager.transport.send.reopen.errConflict", { detail: msg }),
        );
      } else if (e instanceof ApiError && e.status === 503) {
        setError(t("manager.transport.send.reopen.errRetry", { detail: msg }));
      } else {
        setError(t("manager.transport.send.reopen.error", { detail: msg }));
      }
    } finally {
      await refreshAfter();
      setBusy(null);
    }
  };

  // ---- render ----------------------------------------------------------------

  const spinner = <Loader2 size={16} className="animate-spin" aria-hidden="true" />;
  const sendReasons = [
    orderReason ? t("manager.transport.send.reasonFor.order", { reason: orderReason }) : null,
    driverReason ? t("manager.transport.send.reasonFor.driver", { reason: driverReason }) : null,
  ].filter((r): r is string => r !== null);
  // "Save first" once per kind of unsaved edit, and one shared reason (e.g.
  // the config failed to load) once — not once per button.
  const shownReasons =
    unsavedReasons.length > 0
      ? unsavedReasons
      : orderReason !== null && orderReason === driverReason
        ? [orderReason]
        : sendReasons;

  const renderConfirmCard = (kind: TransportDraftKind): ReactElement => {
    const reason = confirmReasonFor(kind);
    const recipients = splitRecipients(
      (kind === "order" ? supplierEmail : driverRecipients) ?? "",
    );
    const missing = missingLogisticsFields(detail);
    const previous = kind === "order" ? previousOrder : previousDriver;
    const working = busy === kind;
    return (
      <div
        role="group"
        aria-label={t(
          kind === "order"
            ? "manager.transport.send.confirm.titleOrder"
            : "manager.transport.send.confirm.titleDriver",
        )}
        className="space-y-2 rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-slate-800"
      >
        <div className="font-semibold">
          {t(
            kind === "order"
              ? "manager.transport.send.confirm.titleOrder"
              : "manager.transport.send.confirm.titleDriver",
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <dt className="text-slate-600">{t("manager.transport.send.confirm.to")}</dt>
          <dd className="break-all">{recipients.join(", ")}</dd>
          <dt className="text-slate-600">{t("manager.transport.send.confirm.from")}</dt>
          <dd className="break-all">{mailbox}</dd>
        </dl>

        {missing.length > 0 && (
          <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800">
            {t("manager.transport.send.confirm.missingLogistics", {
              fields: missing.map((f) => t(LOGISTICS_FIELD_LABEL_KEYS[f])).join(", "),
            })}
          </p>
        )}

        {kind === "order" && extraLines.length > 0 && (
          <div className="rounded border border-slate-200 bg-white p-2">
            <p className="mb-1 font-medium">{t("manager.transport.send.confirm.extrasHeading")}</p>
            <ul className="space-y-0.5">
              {extraLines.map((line) => (
                <li key={line.key}>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={isApproved(line)}
                      onChange={() => toggleApproved(line)}
                      disabled={working}
                    />
                    <span>
                      {t("manager.transport.send.confirm.extraLine", {
                        location: line.locationName,
                        text: line.text,
                      })}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {approvedLines.length > 0 && (
              <p className="mt-1 text-xs text-slate-600">
                {t("manager.transport.send.confirm.extrasToPdf")}
              </p>
            )}
          </div>
        )}

        {kind === "order" && previousOrder !== null && (
          <div>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={correction}
                onChange={() => setCorrection((v) => !v)}
                disabled={working}
              />
              <span>{t("manager.transport.send.confirm.correction")}</span>
            </label>
            {correctionByDefault && (
              <p className="ml-6 text-xs text-slate-600">
                {t("manager.transport.send.confirm.correctionPreTicked")}
              </p>
            )}
          </div>
        )}

        <p>
          {t(
            kind === "driver"
              ? "manager.transport.send.confirm.statusDriver"
              : isDraft
                ? "manager.transport.send.confirm.statusOrderDraft"
                : "manager.transport.send.confirm.statusOrderSent",
          )}
        </p>

        {previous !== null &&
          (sameMailbox(previous.mailbox, mailbox) ? (
            <p>
              {t("manager.transport.send.confirm.replacesPrevious", {
                time: previous.at ? formatDateTime(previous.at) : "—",
              })}
            </p>
          ) : (
            <p className="text-amber-800">
              {t("manager.transport.send.confirm.previousOtherMailbox", {
                time: previous.at ? formatDateTime(previous.at) : "—",
                mailbox: previous.mailbox || "—",
              })}
            </p>
          ))}

        {reason && <p className="text-amber-800">{reason}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => void handleConfirm(kind)}
            disabled={busy !== null || reason !== null}
            className={BUTTON_PRIMARY}
          >
            {working ? spinner : <Send size={16} aria-hidden="true" />}
            {working
              ? t("manager.transport.send.working")
              : t(
                  kind === "order" && isDraft
                    ? "manager.transport.send.confirm.submitOrderDraft"
                    : "manager.transport.send.confirm.submit",
                )}
          </button>
          <button
            type="button"
            onClick={() => setConfirmKind(null)}
            disabled={working}
            className={BUTTON_OUTLINE}
          >
            {t("manager.transport.send.confirm.cancel")}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="text-sm font-semibold text-slate-800">{t("manager.transport.send.title")}</h3>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleDownload("driver")}
          disabled={busy !== null}
          className={BUTTON_OUTLINE}
        >
          {busy === "downloadDriver" ? spinner : <Download size={16} aria-hidden="true" />}
          {t("manager.transport.send.downloadDriver")}
        </button>
        <button
          type="button"
          onClick={() => void handleDownload("pago")}
          disabled={busy !== null}
          className={BUTTON_OUTLINE}
        >
          {busy === "downloadPago" ? spinner : <Download size={16} aria-hidden="true" />}
          {t("manager.transport.send.downloadPago")}
        </button>
      </div>
      {approvedLines.length > 0 && (
        <p className="text-xs text-slate-600">
          {t("manager.transport.send.approvedExtrasInPdf", { count: approvedLines.length })}
        </p>
      )}

      {!isCancelled && (
        <>
          {clientId && (
            <div className="space-y-1">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openConfirm("order")}
                  disabled={busy !== null || orderReason !== null}
                  title={orderReason ?? undefined}
                  className={BUTTON_PRIMARY}
                >
                  {busy === "order" ? spinner : <Mail size={16} aria-hidden="true" />}
                  {t("manager.transport.send.orderButton")}
                </button>
                <button
                  type="button"
                  onClick={() => openConfirm("driver")}
                  disabled={busy !== null || driverReason !== null}
                  title={driverReason ?? undefined}
                  className={BUTTON_PRIMARY}
                >
                  {busy === "driver" ? spinner : <Mail size={16} aria-hidden="true" />}
                  {t("manager.transport.send.driverButton")}
                </button>
              </div>
              {shownReasons.length > 0 && (
                <ul className="text-xs text-amber-700">
                  {shownReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!clientId && (
            <div className="space-y-0.5 text-xs">
              <p className="text-slate-600">{t("manager.transport.send.noClientId")}</p>
              {/* Mark-only still works here — say why it is disabled. */}
              {isDraft &&
                unsavedReasons.map((r) => (
                  <p key={r} className="text-amber-700">
                    {r}
                  </p>
                ))}
            </div>
          )}

          {clientId && confirmKind !== null && renderConfirmCard(confirmKind)}

          <div className="space-y-0.5 text-xs text-slate-600">
            {isSent && sentEvent?.at && (
              <div>{t("manager.transport.send.status.sentAt", { time: formatDateTime(sentEvent.at) })}</div>
            )}
            <div>
              {previousOrder
                ? t("manager.transport.send.status.orderDraft", {
                    time: previousOrder.at ? formatDateTime(previousOrder.at) : "—",
                    mailbox: previousOrder.mailbox || "—",
                  })
                : t("manager.transport.send.status.noOrderDraft")}
            </div>
            <div>
              {previousDriver
                ? t("manager.transport.send.status.driverDraft", {
                    time: previousDriver.at ? formatDateTime(previousDriver.at) : "—",
                    mailbox: previousDriver.mailbox || "—",
                  })
                : t("manager.transport.send.status.noDriverDraft")}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDraft && (
              <>
                <button
                  type="button"
                  onClick={() => void handleMarkOnly()}
                  disabled={busy !== null || unsavedReason !== null || detail.orders.length === 0}
                  title={unsavedReason ?? undefined}
                  className={BUTTON_OUTLINE}
                >
                  {busy === "mark" ? spinner : null}
                  {busy === "mark"
                    ? t("manager.transport.send.markOnly.busy")
                    : t("manager.transport.send.markOnly.button")}
                </button>
                <span className="text-xs text-slate-500">
                  {t("manager.transport.send.markOnly.hint")}
                </span>
              </>
            )}
            {isSent && (
              <button
                type="button"
                onClick={() => void handleReopen()}
                disabled={busy !== null}
                className={`${BUTTON_BASE} border border-amber-400 text-amber-800 hover:bg-amber-50 focus-visible:ring-amber-500`}
              >
                {busy === "reopen" ? spinner : <RotateCcw size={16} aria-hidden="true" />}
                {busy === "reopen"
                  ? t("manager.transport.send.reopen.busy")
                  : t("manager.transport.send.reopen.button")}
              </button>
            )}
          </div>
        </>
      )}

      {error && (
        <div role="alert" className="rounded border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      )}
      {warnings.map((w) => (
        <div
          key={w}
          role="alert"
          className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {w}
        </div>
      ))}
      {successMailbox && (
        <div role="status" className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
          {t("manager.transport.send.success", { mailbox: successMailbox })}{" "}
          <a
            href={gmailDraftsUrl(successMailbox)}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
          >
            {t("manager.transport.send.openDrafts")}
          </a>
        </div>
      )}
      {reopenResult && (
        <div role="status" className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <div>{t("manager.transport.send.reopen.ok", { count: reopenResult.count })}</div>
          {reopenResult.skipped.length > 0 && (
            <div className="mt-1">
              <div className="font-semibold">{t("manager.transport.finalize.result.skippedHeader")}</div>
              <ul className="list-inside list-disc">
                {reopenResult.skipped.map((s) => (
                  <li key={s.order_id}>
                    {s.order_id}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
