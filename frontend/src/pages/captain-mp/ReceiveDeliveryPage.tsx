// Captain goods-receipt screen (GR-01). Reached from an order that is
// manager_sent: the Captain records delivered-vs-ordered per line, attaches WZ
// photos, and confirms. Persist-first: the receipt is saved (JSON) before the
// photos upload (multipart) — if the photo step fails, the receipt survives
// (flagged received_with_missing_wz) and the upload is retryable in place.

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Loader2, PackageCheck } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { useT } from "../../i18n";
import type { CaptainOrderDetail, ManagerOrderLineDetail, ReceiptLineSubmit } from "../../types";

import { PhotoUploadControl } from "./components/PhotoUploadControl";
import { ReceiptLineCard } from "./components/ReceiptLineCard";
import { SkeletonCard } from "./components/SkeletonCard";
import { Toast, type ToastProps } from "./components/Toast";

/** Effective ordered qty = manager_final if > 0 else captain_final (mirrors the
 *  dispatch rule — the quantity actually ordered from the supplier). */
function effectiveOrdered(line: ManagerOrderLineDetail): number {
  return line.manager_final_qty_purchase > 0
    ? line.manager_final_qty_purchase
    : line.captain_final_qty_purchase;
}

// WZ photo upload writes to a private Supabase Storage bucket (server-side,
// service_role key); photos are viewed via short-lived signed URLs. Enabled now
// that the receipt-photos endpoint targets Supabase (the old Drive path was a
// dead end — a service account has no Drive storage quota, 403 storageQuotaExceeded).
// If storage is unconfigured the backend 503s and the receipt still saves
// (quantities + variances), flagged missing-WZ.
const WZ_PHOTOS_ENABLED = true;

export function ReceiveDeliveryPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { order_id } = useParams<{ order_id: string }>();

  const [order, setOrder] = useState<CaptainOrderDetail | null>(null);
  const [delivered, setDelivered] = useState<Record<string, number | "">>({});
  const [receivedBy, setReceivedBy] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdReceiptId, setCreatedReceiptId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastProps | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error") =>
      setToast({ message, type, onClose: () => setToast(null) }),
    [],
  );

  useEffect(() => {
    if (!order_id) return;
    let cancelled = false;
    api
      .captainOrder(order_id)
      .then((data) => {
        if (cancelled) return;
        if (data.status !== "manager_sent") {
          // Only dispatched orders can be received — bounce back to detail.
          navigate(`/captain-v2/orders/${data.order_id}`, { replace: true });
          return;
        }
        setLoadError(null);
        setOrder(data);
        const built: Record<string, number | ""> = {};
        for (const l of data.lines) built[l.order_line_id] = effectiveOrdered(l);
        setDelivered(built);
      })
      .catch((e: ApiError) => {
        if (cancelled) return;
        if (e.status !== 401) setLoadError(e.detail);
      });
    return () => {
      cancelled = true;
    };
  }, [order_id, navigate]);

  const handleLineChange = useCallback((orderLineId: string, value: number | "") => {
    setDelivered((prev) => ({ ...prev, [orderLineId]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!order || !receivedBy.trim()) return;
    setIsSubmitting(true);
    // Track the receipt id across this call so a photo-step failure is reported
    // (and retried) distinctly from a submit failure.
    let receiptId = createdReceiptId;
    try {
      if (!receiptId) {
        const lines: ReceiptLineSubmit[] = order.lines.map((l) => {
          const v = delivered[l.order_line_id];
          return {
            order_line_id: l.order_line_id,
            received_qty_purchase: v === "" || v === undefined ? effectiveOrdered(l) : v,
          };
        });
        const resp = await api.receiptSubmit({
          order_id: order.order_id,
          received_by: receivedBy.trim(),
          lines,
        });
        receiptId = resp.receipt_id;
        setCreatedReceiptId(receiptId);
      }
      if (photos.length > 0) {
        await api.receiptUploadPhotos(receiptId, photos);
      }
      showToast(t("delivery.successToast"), "success");
      setTimeout(() => navigate(`/captain-v2/orders/${order.order_id}`), 700);
    } catch (err) {
      const photoStage = receiptId !== null; // receipt already saved → photo step failed
      const detail = err instanceof ApiError ? err.detail : String(err);
      if (err instanceof ApiError && err.status === 401) {
        // global handler re-opens auth; nothing to do here
      } else if (photoStage) {
        showToast(t("delivery.photoErrorToast", { detail }), "error");
      } else {
        showToast(t("delivery.errorToast", { detail }), "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [order, receivedBy, delivered, photos, createdReceiptId, navigate, showToast, t]);

  const submitDisabled = isSubmitting || !receivedBy.trim();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-28">
      {toast && <Toast {...toast} />}

      <header className="bg-brand text-white px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/captain-v2/orders/${order_id}`)}
            aria-label={t("orders.title")}
            className="shrink-0 p-2 -ml-2 active:bg-white/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1 className="font-semibold text-lg tracking-tight truncate leading-tight">
              {t("delivery.pageTitle")}
              {order ? ` · ${order.supplier_name}` : ""}
            </h1>
            {order && (
              <p className="text-xs text-white/70 font-mono truncate leading-tight">
                {order.order_id} · {order.order_date}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        {loadError && (
          <div className="mb-4 rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <div className="font-semibold">{t("manager.error")}</div>
            <div className="mt-1">{loadError}</div>
          </div>
        )}

        {!order && !loadError ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : order ? (
          <>
            <p className="mb-4 text-sm text-slate-600">{t("delivery.intro")}</p>

            <label className="mb-4 block">
              <span className="text-sm font-semibold text-slate-900">
                {t("delivery.receivedByLabel")}
              </span>
              <input
                type="text"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder={t("delivery.receivedByPlaceholder")}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </label>

            <div className="mb-4">
              {order.lines.map((line) => (
                <ReceiptLineCard
                  key={line.order_line_id}
                  line={line}
                  ordered={effectiveOrdered(line)}
                  delivered={delivered[line.order_line_id] ?? ""}
                  onChange={handleLineChange}
                />
              ))}
            </div>

            {WZ_PHOTOS_ENABLED && (
              <PhotoUploadControl photos={photos} onChange={setPhotos} disabled={isSubmitting} />
            )}
          </>
        ) : null}
      </main>

      {order && (
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-bar z-30">
          <div className="max-w-3xl mx-auto">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitDisabled}
              className={`flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                submitDisabled ? "bg-gray-500 cursor-not-allowed" : "bg-brand active:bg-brand-active"
              }`}
            >
              {isSubmitting ? (
                <Loader2 size={16} aria-hidden="true" className="animate-spin" />
              ) : (
                <PackageCheck size={16} aria-hidden="true" />
              )}
              {isSubmitting
                ? t("delivery.submittingBtn")
                : createdReceiptId
                  ? t("delivery.retryPhotos")
                  : t("delivery.submitBtn")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
