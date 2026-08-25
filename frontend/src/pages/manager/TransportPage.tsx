// Manager Transport ("TO" — combined delivery run) workspace (to-ordering-pago
// Phase 3 + v2 ADDENDUM). Combines several locations' submitted/claimed orders
// for one supplier into a single Transport batch, then lets the manager work
// the batch as a DRAFT: edit quantities per product x location cell, add
// products, add a location with no captain submission, remove a member order,
// set logistics (driver/vehicle/pickup/limit), preview the total weight — and
// finally finalize (draft -> sent), which mirrors v1's totals/driver-list/
// email/copy view exactly, now read-only.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { AppHeader } from "../../components/ui/AppHeader";
import { roundQty } from "../../components/ui/number";
import { useT } from "../../i18n";
import { statusVisual } from "../captain-mp/lib/orderStatus";
import {
  anyTransportDirty,
  buildTransportDriverText,
  buildTransportGmailUrl,
  collectLogisticsSuggestions,
  hasValidRecipient,
  loadSeenTransports,
  markTransportSeen,
  seedTransportDrafts,
  transportDirtySavePayloads,
  transportDisplayLabel,
  type TransportDraftMap,
} from "./lib/transport";
import { AddLocationPicker } from "./transport/AddLocationPicker";
import { HistorySection } from "./transport/HistorySection";
import { LocationMultiSelectModal } from "./transport/LocationMultiSelectModal";
import { LogisticsPanel } from "./transport/LogisticsPanel";
import { PrintViews } from "./transport/PrintViews";
import { TransportMatrix } from "./transport/TransportMatrix";
import { WeightStrip } from "./transport/WeightStrip";
import type {
  Location,
  OrderableItem,
  Supplier,
  TransportBatchDetail,
  TransportBatchOrder,
  TransportBatchPatchRequest,
  TransportBatchSummary,
  TransportEligibleOrder,
  TransportSkippedOrder,
} from "../../types";

interface CreateResult {
  transportId: string;
  combinedCount: number;
  skipped: TransportSkippedOrder[];
}

interface FinalizeResult {
  sentCount: number;
  skipped: TransportSkippedOrder[];
}

interface CancelResult {
  releasedCount: number;
  cancelledCount: number;
  skipped: TransportSkippedOrder[];
}

export function TransportPage() {
  const { t, lang, formatDateTime } = useT();
  const navigate = useNavigate();

  // Supplier picker ------------------------------------------------------------
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string>("");

  // Locations master data — for the draft "add location" picker (Manager-only
  // caller; api.locations needs role="manager" or it 401s silently).
  const [locations, setLocations] = useState<Location[]>([]);
  useEffect(() => {
    api
      .locations("manager")
      .then((data) => setLocations(data.filter((l) => l.active)))
      .catch(() => setLocations([]));
  }, []);

  // Feature 1 (v4 feedback round 2): the auto-label's city segment is derived
  // from location master data (already loaded above) — keyed by id for O(1)
  // lookup in transportDisplayLabel.
  const locationsById = useMemo(() => {
    const byId: Record<string, Location> = {};
    for (const l of locations) byId[l.location_id] = l;
    return byId;
  }, [locations]);
  const displayLabelOpts = useMemo(() => ({ lang, locationsById }), [lang, locationsById]);

  // Feature 2 (v4 feedback round 2): "NOWY" badge on a batch never opened yet.
  const [seenTransports, setSeenTransports] = useState<Set<string>>(() => loadSeenTransports());

  // Feature 3 (v4 feedback round 2): scroll the detail panel into view right
  // after a create flow jumps into the newly created transport.
  const detailRef = useRef<HTMLDivElement | null>(null);
  const scrollDetailIntoView = useCallback(() => {
    window.setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  // Eligible orders to combine ---------------------------------------------------
  const [eligible, setEligible] = useState<TransportEligibleOrder[] | null>(null);
  const [eligibleError, setEligibleError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadEligible = useCallback((sid: string) => {
    setEligible(null);
    setEligibleError(null);
    setSelected(new Set());
    api
      .transportEligible(sid)
      .then((data) => setEligible(data))
      .catch((e: ApiError) => {
        if (e.status !== 401) setEligibleError(e.detail);
      });
  }, []);

  // Past batches -----------------------------------------------------------------
  const [batches, setBatches] = useState<TransportBatchSummary[] | null>(null);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [selectedTransportId, setSelectedTransportId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TransportBatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Per-order draft qty state for the selected DRAFT batch (v2). Reseeded on
  // every detail load; keyed by order_id (one column = one order).
  const [drafts, setDrafts] = useState<TransportDraftMap>({});

  // Orderable products per member order (add-product-to-order, per column).
  const [orderableByOrderId, setOrderableByOrderId] = useState<Record<string, OrderableItem[]>>({});

  // Generic busy/error/toast state for the workstation actions below.
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const [matrixSaving, setMatrixSaving] = useState(false);
  const [logisticsSaving, setLogisticsSaving] = useState(false);
  const [addLocationBusy, setAddLocationBusy] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null); // add-product / remove-order per column
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(null);
  const [savingAndSending, setSavingAndSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState<CancelResult | null>(null);

  // v3 Phase 7 — cancelled batches hidden from the list by default.
  const [showCancelled, setShowCancelled] = useState(false);

  // v3 Phase 9 — manager-first grid creation (location multi-select modal).
  const [gridCreateOpen, setGridCreateOpen] = useState(false);
  const [gridCreateBusy, setGridCreateBusy] = useState(false);

  const loadBatches = useCallback((sid: string, includeCancelled = showCancelled) => {
    setBatches(null);
    setBatchesError(null);
    setSelectedTransportId(null);
    setDetail(null);
    api
      .transportBatches(sid, undefined, includeCancelled)
      .then((data) => setBatches(data))
      .catch((e: ApiError) => {
        if (e.status !== 401) setBatchesError(e.detail);
      });
  }, [showCancelled]);

  // Supplier picker triggers both loads on change — deliberately NOT a
  // useEffect reacting to `supplierId`: that pattern calls setState
  // synchronously from the effect body (react-hooks/set-state-in-effect).
  // Loads instead fire from the promise callback below (async — the initial
  // default pick) and from the <select> onChange handler (an event handler),
  // both of which are outside an effect body.
  const selectSupplier = useCallback(
    (sid: string) => {
      setSupplierId(sid);
      loadEligible(sid);
      loadBatches(sid);
    },
    [loadEligible, loadBatches],
  );

  useEffect(() => {
    let cancelled = false;
    api
      // "manager": this screen only ever holds a Manager token, so the default
      // captain role would send no Authorization header and 401 — leaving the
      // picker empty and both sections stuck on "Ładowanie…".
      .suppliers("manager")
      .then((data) => {
        if (cancelled) return;
        const active = data.filter((s) => s.active);
        setSuppliers(active);
        const pago = active.find((s) => s.supplier_id === "SUP_PAGO");
        const defaultId = pago ? pago.supplier_id : (active[0]?.supplier_id ?? "");
        if (defaultId) {
          selectSupplier(defaultId);
        } else {
          // No active supplier to pick: nothing will ever trigger a load, so
          // say so instead of spinning forever.
          setSuppliersError(t("manager.transport.noSuppliers"));
        }
      })
      .catch((e: ApiError) => {
        if (!cancelled && e.status !== 401) setSuppliersError(e.detail);
      });
    return () => {
      cancelled = true;
    };
  }, [selectSupplier, t]);

  const supplier = useMemo(
    () => suppliers?.find((s) => s.supplier_id === supplierId) ?? null,
    [suppliers, supplierId],
  );

  const toggleSelected = (orderId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const selectionTotal = useMemo(() => {
    if (!eligible) return 0;
    return eligible
      .filter((o) => selected.has(o.order_id))
      .reduce((sum, o) => sum + (o.total_value_estimate_pln ?? 0), 0);
  }, [eligible, selected]);

  // Batch detail ----------------------------------------------------------------
  const fetchOrderable = useCallback((batchDetail: TransportBatchDetail) => {
    if (batchDetail.status !== "draft") {
      setOrderableByOrderId({});
      return;
    }
    Promise.all(
      batchDetail.orders.map((o) =>
        api
          .managerOrderable(batchDetail.supplier_id, o.location_id)
          .then((items) => [o.order_id, items] as const)
          .catch(() => [o.order_id, []] as const),
      ),
    ).then((pairs) => {
      setOrderableByOrderId(Object.fromEntries(pairs));
    });
  }, []);

  const selectBatch = useCallback(
    (transportId: string) => {
      setSelectedTransportId(transportId);
      setDetail(null);
      setDetailError(null);
      setDetailLoading(true);
      setDrafts({});
      setOrderableByOrderId({});
      setFinalizeResult(null);
      api
        .transportBatch(transportId)
        .then((d) => {
          setDetail(d);
          setDrafts(seedTransportDrafts(d.orders));
          fetchOrderable(d);
          markTransportSeen(transportId);
          setSeenTransports((prev) => new Set(prev).add(transportId));
          scrollDetailIntoView();
        })
        .catch((e: ApiError) => {
          if (e.status !== 401) setDetailError(e.detail);
        })
        .finally(() => setDetailLoading(false));
    },
    [fetchOrderable, scrollDetailIntoView],
  );

  // Create --------------------------------------------------------------------
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);

  // `orderIds` may be EMPTY — the empty-draft path: with zero submitted
  // orders (Pago on day one) the manager still starts a draft and adds
  // locations inside it, mirroring the legacy sheet's from-nothing flow.
  // Feature 3 (v4 feedback round 2): every successful create — with orders,
  // or the empty-draft path — jumps straight into the new transport's detail
  // (selectBatch also marks it seen + scrolls the panel into view).
  const runCreate = useCallback((orderIds: string[]) => {
    if (!supplierId || creating) return;
    setCreating(true);
    setCreateError(null);
    setCreateResult(null);
    api
      .transportCreate({ supplier_id: supplierId, order_ids: orderIds })
      .then((resp) => {
        setCreateResult({
          transportId: resp.transport_id,
          combinedCount: resp.combined.length,
          skipped: resp.skipped,
        });
        loadEligible(supplierId);
        loadBatches(supplierId);
        selectBatch(resp.transport_id);
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setCreateError(e.detail);
      })
      .finally(() => setCreating(false));
  }, [supplierId, creating, loadEligible, loadBatches, selectBatch]);

  const handleCreate = useCallback(() => {
    if (selected.size === 0) return;
    runCreate(Array.from(selected));
  }, [selected, runCreate]);

  const handleCreateEmpty = useCallback(() => {
    runCreate([]);
  }, [runCreate]);

  // List-only refetch: updates the batches rows WITHOUT resetting the
  // selection/detail (loadBatches resets both — correct on supplier switch,
  // wrong mid-workstation: it silently closed the draft panel after a
  // logistics save and discarded unsaved matrix edits).
  const reloadBatchList = useCallback((sid: string) => {
    api
      .transportBatches(sid, undefined, showCancelled)
      .then((data) => setBatches(data))
      .catch((e: ApiError) => {
        if (e.status !== 401) setBatchesError(e.detail);
      });
  }, [showCancelled]);

  const handleToggleShowCancelled = useCallback(() => {
    setShowCancelled((prev) => {
      const next = !prev;
      if (supplierId) loadBatches(supplierId, next);
      return next;
    });
  }, [supplierId, loadBatches]);

  const refreshDetail = useCallback(
    (transportId: string, preserveDrafts = false) => {
      reloadBatchList(supplierId);
      api
        .transportBatch(transportId)
        .then((d) => {
          setDetail(d);
          // Reseed clears dirty state — right after a matrix save / add /
          // remove, wrong after a logistics-only save (it would discard
          // unsaved quantity edits the manager is still working on).
          if (!preserveDrafts) setDrafts(seedTransportDrafts(d.orders));
          fetchOrderable(d);
        })
        .catch((e: ApiError) => {
          if (e.status !== 401) setDetailError(e.detail);
        });
    },
    [supplierId, reloadBatchList, fetchOrderable],
  );

  const isDraft = detail?.status === "draft";

  // ---- v2 draft workstation: matrix edit + save ------------------------------

  const handleQtyChange = useCallback((orderId: string, orderLineId: string, qty: number) => {
    setDrafts((prev) => {
      const orderDrafts = prev[orderId] ?? {};
      const current = orderDrafts[orderLineId];
      return {
        ...prev,
        [orderId]: {
          ...orderDrafts,
          [orderLineId]: { qty, comment: current?.comment ?? "" },
        },
      };
    });
  }, []);

  const dirty = detail ? anyTransportDirty(detail.orders, drafts) : false;

  const handleSaveMatrix = useCallback(() => {
    if (!detail) return;
    const payloads = transportDirtySavePayloads(detail.orders, drafts);
    if (payloads.length === 0) return;
    setMatrixSaving(true);
    Promise.allSettled(payloads.map((p) => api.managerSave(p.order_id, p.finals)))
      .then((results) => {
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length > 0) {
          const first = failed[0] as PromiseRejectedResult;
          const msg = first.reason instanceof ApiError ? first.reason.detail : String(first.reason);
          showToast(t("manager.transport.matrix.saveError", { detail: msg }), false);
        } else {
          showToast(t("manager.transport.matrix.saveOk", { count: payloads.length }), true);
        }
        refreshDetail(detail.transport_id);
      })
      .finally(() => setMatrixSaving(false));
  }, [detail, drafts, refreshDetail, showToast, t]);

  // ---- Feature 4 (v4 feedback round 2): ONE matrix-wide add-product --------
  // Adds `productId` to EVERY member order where it's orderable and not
  // already present (each order's own orderable entry supplies its
  // supplier_product_id — see buildTransportAddAllOptions). One busy state,
  // one refreshDetail after every call settles; a partial failure names the
  // failed locations rather than silently dropping them.

  const [addAllBusy, setAddAllBusy] = useState(false);

  const handleAddProductAll = useCallback(
    (productId: string) => {
      if (!detail) return;
      const targets = detail.orders
        .filter((order) => !order.lines.some((l) => l.product_id === productId))
        .map((order) => {
          const item = (orderableByOrderId[order.order_id] ?? []).find(
            (o) => o.product_id === productId,
          );
          return item ? { order, item } : null;
        })
        .filter((v): v is { order: TransportBatchOrder; item: OrderableItem } => v !== null);
      if (targets.length === 0) return;

      setAddAllBusy(true);
      Promise.allSettled(
        targets.map(({ order, item }) =>
          api
            .managerAddLine(order.order_id, item.product_id, item.supplier_product_id)
            .then(() => order.location_name)
            .catch((e: ApiError) => {
              throw new Error(`${order.location_name}: ${e.detail}`);
            }),
        ),
      )
        .then((results) => {
          const failed = results.filter(
            (r): r is PromiseRejectedResult => r.status === "rejected",
          );
          if (failed.length > 0) {
            const names = failed.map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
            showToast(
              t("manager.transport.matrix.addProductAllError", { locations: names.join(", ") }),
              false,
            );
          } else {
            showToast(t("manager.transport.matrix.addProductAllOk"), true);
          }
          refreshDetail(detail.transport_id);
        })
        .finally(() => setAddAllBusy(false));
    },
    [detail, orderableByOrderId, refreshDetail, showToast, t],
  );

  // ---- v2 draft workstation: add location -------------------------------------

  const locationsNotInBatch = useMemo(() => {
    if (!detail) return locations;
    const present = new Set(detail.orders.map((o) => o.location_id));
    return locations.filter((l) => !present.has(l.location_id));
  }, [locations, detail]);

  const handleAddLocation = useCallback(
    (location: Location) => {
      if (!detail) return;
      setAddLocationBusy(true);
      api
        .transportAddLocation(detail.transport_id, location.location_id)
        .then(() => {
          showToast(t("manager.transport.addLocation.ok"), true);
          refreshDetail(detail.transport_id);
        })
        .catch((e: ApiError) => {
          showToast(t("manager.transport.addLocation.error", { detail: e.detail }), false);
        })
        .finally(() => setAddLocationBusy(false));
    },
    [detail, refreshDetail, showToast, t],
  );

  // ---- v2 draft workstation: remove order --------------------------------------

  const handleRemoveOrder = useCallback(
    (order: TransportBatchOrder) => {
      if (!detail) return;
      if (!window.confirm(t("manager.transport.removeOrder.confirm", { location: order.location_name }))) {
        return;
      }
      setBusyOrderId(order.order_id);
      api
        .transportRemoveOrder(detail.transport_id, order.order_id)
        .then((resp) => {
          showToast(
            t(
              resp.action === "cancelled"
                ? "manager.transport.removeOrder.okCancelled"
                : "manager.transport.removeOrder.okReleased",
            ),
            true,
          );
          refreshDetail(detail.transport_id);
        })
        .catch((e: ApiError) => {
          showToast(t("manager.transport.removeOrder.error", { detail: e.detail }), false);
        })
        .finally(() => setBusyOrderId(null));
    },
    [detail, refreshDetail, showToast, t],
  );

  // ---- v2 draft workstation: logistics patch -----------------------------------

  const handleSaveLogistics = useCallback(
    (patch: TransportBatchPatchRequest) => {
      if (!detail) return;
      setLogisticsSaving(true);
      api
        .transportBatchPatch(detail.transport_id, patch)
        .then(() => {
          showToast(t("manager.transport.logistics.saveOk"), true);
          refreshDetail(detail.transport_id, true); // keep unsaved matrix edits
        })
        .catch((e: ApiError) => {
          showToast(t("manager.transport.logistics.saveError", { detail: e.detail }), false);
        })
        .finally(() => setLogisticsSaving(false));
    },
    [detail, refreshDetail, showToast, t],
  );

  // ---- v2 draft workstation: finalize --------------------------------------------

  const handleFinalize = useCallback(() => {
    if (!detail) return;
    if (dirty) {
      showToast(t("manager.unsavedWarning"), false);
      return;
    }
    if (!window.confirm(t("manager.transport.finalize.confirm", { id: detail.transport_id }))) {
      return;
    }
    setFinalizing(true);
    setFinalizeResult(null);
    api
      .transportFinalize(detail.transport_id)
      .then((resp) => {
        setFinalizeResult({ sentCount: resp.sent.length, skipped: resp.skipped });
        refreshDetail(detail.transport_id);
      })
      .catch((e: ApiError) => {
        showToast(t("manager.transport.finalize.error", { detail: e.detail }), false);
      })
      .finally(() => setFinalizing(false));
  }, [detail, dirty, refreshDetail, showToast, t]);

  // ---- v3 Phase 7: "Zapisz i wyślij" — save all dirty orders, THEN finalize ----
  // (single busy state; on save failure abort with a toast, never finalize).

  const handleSaveAndSend = useCallback(() => {
    if (!detail) return;
    const payloads = transportDirtySavePayloads(detail.orders, drafts);
    if (payloads.length === 0) return;
    if (!window.confirm(t("manager.transport.finalize.confirm", { id: detail.transport_id }))) {
      return;
    }
    setSavingAndSending(true);
    setFinalizeResult(null);
    Promise.all(payloads.map((p) => api.managerSave(p.order_id, p.finals)))
      .then(() => api.transportFinalize(detail.transport_id))
      .then((resp) => {
        setFinalizeResult({ sentCount: resp.sent.length, skipped: resp.skipped });
        refreshDetail(detail.transport_id);
      })
      .catch((e: ApiError) => {
        showToast(t("manager.transport.finalize.saveAndSendSaveFailed", { detail: e.detail }), false);
        // A save failure aborts before finalize runs, but the matrix may now be
        // partially saved — refresh so drafts reflect what actually persisted.
        refreshDetail(detail.transport_id);
      })
      .finally(() => setSavingAndSending(false));
  }, [detail, drafts, refreshDetail, showToast, t]);

  // ---- v3 Phase 7: cancel draft -------------------------------------------------

  const handleCancelDraft = useCallback(() => {
    if (!detail) return;
    if (!window.confirm(t("manager.transport.cancel.confirm", { id: detail.transport_id }))) {
      return;
    }
    setCancelling(true);
    setCancelResult(null);
    api
      .transportCancel(detail.transport_id)
      .then((resp) => {
        setCancelResult({
          releasedCount: resp.released.length,
          cancelledCount: resp.cancelled.length,
          skipped: resp.skipped,
        });
        showToast(
          t("manager.transport.cancel.ok", {
            released: resp.released.length,
            cancelled: resp.cancelled.length,
          }),
          true,
        );
        // The batch disappears from the default (cancelled-hidden) list —
        // close the detail panel and go back to the list.
        setSelectedTransportId(null);
        setDetail(null);
        reloadBatchList(supplierId);
      })
      .catch((e: ApiError) => {
        showToast(t("manager.transport.cancel.error", { detail: e.detail }), false);
      })
      .finally(() => setCancelling(false));
  }, [detail, supplierId, reloadBatchList, showToast, t]);

  // ---- v3 Phase 9: manager-first grid creation ---------------------------------

  const handleGridCreateConfirm = useCallback(
    (locationIds: string[]) => {
      if (!supplierId || locationIds.length === 0) return;
      setGridCreateBusy(true);
      api
        .transportCreate({ supplier_id: supplierId, order_ids: [] })
        .then(async (createResp) => {
          const transportId = createResp.transport_id;
          const errors: string[] = [];
          for (const locationId of locationIds) {
            const location = locations.find((l) => l.location_id === locationId);
            const label = location?.location_name ?? locationId;
            try {
              showToast(t("manager.transport.gridCreate.progress", { location: label }), true);
              // Sequential by design (plan: "sequentially") — one add-location
              // call at a time so a per-location failure is isolated and named.
               
              await api.transportAddLocation(transportId, locationId, true);
            } catch (e) {
              const detailMsg = e instanceof ApiError ? e.detail : String(e);
              errors.push(`${label}: ${detailMsg}`);
              showToast(
                t("manager.transport.gridCreate.locationError", { location: label, detail: detailMsg }),
                false,
              );
            }
          }
          if (errors.length === 0) {
            showToast(t("manager.transport.gridCreate.done", { count: locationIds.length }), true);
          }
          setGridCreateOpen(false);
          loadEligible(supplierId);
          reloadBatchList(supplierId);
          selectBatch(transportId);
        })
        .catch((e: ApiError) => {
          showToast(t("manager.transport.createError", { detail: e.detail }), false);
        })
        .finally(() => setGridCreateBusy(false));
    },
    [supplierId, locations, loadEligible, reloadBatchList, selectBatch, showToast, t],
  );

  // rows = product, cols = detail.location_ids (private driver matrix — sent
  // view only, unchanged from v1).
  const matrix = useMemo(() => {
    if (!detail) return null;
    return detail.lines.map((line) => {
      const byLocation = new Map<string, number>();
      line.per_location.forEach((pl) => {
        byLocation.set(
          pl.location_id,
          roundQty((byLocation.get(pl.location_id) ?? 0) + pl.qty_purchase),
        );
      });
      return { line, byLocation };
    });
  }, [detail]);

  const locationNameById = useMemo(() => {
    const byId = new Map<string, string>();
    detail?.orders.forEach((o) => byId.set(o.location_id, o.location_name));
    return byId;
  }, [detail]);

  const [copyToast, setCopyToast] = useState<string | null>(null);

  const copyDriverText = useCallback(() => {
    if (!detail) return;
    const text = buildTransportDriverText(detail, t);
    navigator.clipboard
      .writeText(text)
      .then(() => setCopyToast(t("manager.transport.detail.copyToast")))
      .catch(() => setCopyToast(t("manager.transport.detail.copyError")));
    window.setTimeout(() => setCopyToast(null), 3000);
  }, [detail, t]);

  const gmail = useMemo(() => {
    if (!detail || !supplier) return null;
    return buildTransportGmailUrl(detail, supplier, t);
  }, [detail, supplier, t]);

  const emailDisabledReason = useMemo(() => {
    if (!supplier || !hasValidRecipient(supplier.email)) {
      return t("manager.transport.detail.emailHint");
    }
    if (gmail?.tooLong) return t("manager.transport.detail.emailTooLong");
    return null;
  }, [supplier, gmail, t]);

  const driverSuggestions = useMemo(
    () => collectLogisticsSuggestions(batches ?? [], "driver"),
    [batches],
  );
  const vehicleSuggestions = useMemo(
    () => collectLogisticsSuggestions(batches ?? [], "vehicle"),
    [batches],
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-12">
      <AppHeader className="sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/manager")}
            aria-label={t("manager.transport.back")}
            className="p-2 -ml-2 active:bg-white/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="font-semibold text-lg tracking-tight">{t("manager.transport.title")}</h1>
        </div>
      </AppHeader>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 space-y-6">
        {(copyToast || toast) && (
          <div
            role={toast && !toast.ok ? "alert" : "status"}
            className={`rounded border px-3 py-2 text-sm ${
              toast && !toast.ok
                ? "border-red-400 bg-red-50 text-red-900"
                : "border-green-300 bg-green-50 text-green-900"
            }`}
          >
            {copyToast ?? toast?.msg}
          </div>
        )}

        <section>
          <label htmlFor="trn-supplier" className="block text-xs font-semibold text-slate-600 mb-1">
            {t("manager.transport.supplierLabel")}
          </label>
          {suppliersError && <div className="text-sm text-red-700 mb-1">{suppliersError}</div>}
          <select
            id="trn-supplier"
            value={supplierId}
            onChange={(e) => {
              if (
                dirty &&
                !window.confirm(t("manager.transport.unsavedSwitchConfirm"))
              ) {
                e.target.value = supplierId;
                return;
              }
              selectSupplier(e.target.value);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(suppliers ?? []).map((s) => (
              <option key={s.supplier_id} value={s.supplier_id}>
                {s.supplier_name}
              </option>
            ))}
          </select>
        </section>

        {/* ---- Eligible orders (to combine) ---- */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">{t("manager.transport.eligible.title")}</h2>

          {eligibleError && (
            <div className="rounded border-2 border-red-400 bg-red-50 p-3 text-sm text-red-900 mb-3" role="alert">
              {t("manager.transport.eligible.fetchError", { detail: eligibleError })}
            </div>
          )}
          {!eligibleError && eligible === null && (
            <div className="text-sm text-slate-500">{t("manager.transport.eligible.loading")}</div>
          )}
          {!eligibleError && eligible !== null && eligible.length === 0 && (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
              <p>{t("manager.transport.eligible.empty")}</p>
              {/* The empty-eligible state is EXACTLY when the empty-draft path
                  matters most (Pago day one: no submitted orders anywhere) —
                  the manager starts a draft and adds locations inside it. */}
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreateEmpty}
                  className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                >
                  {t("manager.transport.createEmptyButton")}
                </button>
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setGridCreateOpen(true)}
                  className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  {t("manager.transport.gridCreate.button")}
                </button>
              </div>
            </div>
          )}

          {eligible && eligible.length > 0 && (
            <>
              <ul className="space-y-2 mb-3">
                {eligible.map((o) => {
                  const visual = statusVisual(o.status);
                  return (
                    <li key={o.order_id}>
                      <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selected.has(o.order_id)}
                          onChange={() => toggleSelected(o.order_id)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900 truncate">{o.location_name}</span>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${visual.pill}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${visual.dot}`} aria-hidden="true" />
                              {t(visual.labelKey)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {o.captain_submitted_at && formatDateTime(o.captain_submitted_at)}
                            {o.ordered_by
                              ? ` · ${t("manager.transport.eligible.orderedBy", { who: o.ordered_by })}`
                              : ""}
                          </div>
                          <div className="text-xs text-slate-500">
                            {o.line_count} · {(o.total_value_estimate_pln ?? 0).toFixed(2)} PLN
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  {t("manager.transport.eligible.selectedSummary", {
                    count: selected.size,
                    total: selectionTotal.toFixed(2),
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={creating}
                    onClick={handleCreateEmpty}
                    className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                  >
                    {t("manager.transport.createEmptyButton")}
                  </button>
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => setGridCreateOpen(true)}
                    className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    {t("manager.transport.gridCreate.button")}
                  </button>
                  <button
                    type="button"
                    disabled={selected.size === 0 || creating}
                    onClick={handleCreate}
                    className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                  >
                    {creating ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        {t("manager.transport.createBusy")}
                      </span>
                    ) : (
                      t("manager.transport.createButton")
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {createError && (
            <div className="mt-3 rounded border-2 border-red-400 bg-red-50 p-3 text-sm text-red-900" role="alert">
              {t("manager.transport.createError", { detail: createError })}
            </div>
          )}
          {createResult && (
            <div className="mt-3 rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
              <div>
                {t("manager.transport.createResult.combined", {
                  count: createResult.combinedCount,
                  id: createResult.transportId,
                })}
              </div>
              {createResult.skipped.length > 0 && (
                <div className="mt-2">
                  <div className="font-semibold">{t("manager.transport.createResult.skippedHeader")}</div>
                  <ul className="list-disc list-inside">
                    {createResult.skipped.map((s) => (
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

        {/* ---- Past batches + detail ---- */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">{t("manager.transport.batches.title")}</h2>
            <button
              type="button"
              onClick={handleToggleShowCancelled}
              className="text-xs font-semibold text-slate-500 underline decoration-dotted hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {t(
                showCancelled
                  ? "manager.transport.batches.hideCancelled"
                  : "manager.transport.batches.showCancelled",
              )}
            </button>
          </div>

          {batchesError && (
            <div className="rounded border-2 border-red-400 bg-red-50 p-3 text-sm text-red-900 mb-3" role="alert">
              {t("manager.transport.batches.fetchError", { detail: batchesError })}
            </div>
          )}
          {!batchesError && batches === null && (
            <div className="text-sm text-slate-500">{t("manager.transport.batches.loading")}</div>
          )}
          {!batchesError && batches !== null && batches.length === 0 && (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
              {t("manager.transport.batches.empty")}
            </div>
          )}

          {batches && batches.length > 0 && (
            <ul className="space-y-2">
              {batches.map((b) => (
                <li key={b.transport_id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        dirty &&
                        b.transport_id !== selectedTransportId &&
                        !window.confirm(t("manager.transport.unsavedSwitchConfirm"))
                      ) {
                        return;
                      }
                      selectBatch(b.transport_id);
                    }}
                    className={`w-full text-left rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      b.status === "cancelled" ? "opacity-60" : ""
                    } ${
                      selectedTransportId === b.transport_id
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {transportDisplayLabel(b, t, displayLabelOpts)}
                      </span>
                      <span className="text-[10px] text-slate-400">{b.transport_id}</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          b.status === "draft"
                            ? "border-amber-300 bg-amber-50 text-amber-800"
                            : b.status === "cancelled"
                              ? "border-red-300 bg-red-50 text-red-700"
                              : "border-slate-300 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {t(
                          b.status === "draft"
                            ? "manager.transport.status.draft"
                            : b.status === "cancelled"
                              ? "manager.transport.status.cancelled"
                              : "manager.transport.status.sent",
                        )}
                      </span>
                      {b.status !== "cancelled" && !seenTransports.has(b.transport_id) && (
                        <span className="inline-flex items-center rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700">
                          {t("manager.transport.badge.new")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600">{b.created && formatDateTime(b.created)}</div>
                    <div className="text-xs text-slate-500">
                      {t("manager.transport.batches.rowSubtitle", {
                        count: b.order_count,
                        locations: b.location_ids.join(", "),
                      })}
                      {b.driver ? ` · ${b.driver}` : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedTransportId && (
            <div ref={detailRef} className="mt-4 border-t border-slate-100 pt-4">
              {detailLoading && (
                <div className="text-sm text-slate-500">{t("manager.transport.detail.loading")}</div>
              )}
              {detailError && (
                <div className="rounded border-2 border-red-400 bg-red-50 p-3 text-sm text-red-900" role="alert">
                  {t("manager.transport.detail.fetchError", { detail: detailError })}
                </div>
              )}

              {detail && (
                <div className="space-y-4">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {transportDisplayLabel(detail, t, displayLabelOpts)}
                    </h3>
                    <span className="text-xs text-slate-400">{detail.transport_id}</span>
                  </div>

                  <WeightStrip detail={detail} />

                  <LogisticsPanel
                    key={detail.transport_id}
                    detail={detail}
                    driverSuggestions={driverSuggestions}
                    vehicleSuggestions={vehicleSuggestions}
                    busy={logisticsSaving}
                    onSave={handleSaveLogistics}
                  />

                  <PrintViews detail={detail} displayLabel={transportDisplayLabel(detail, t, displayLabelOpts)} />

                  <HistorySection events={detail.events} />

                  {isDraft ? (
                    <>
                      <TransportMatrix
                        orders={detail.orders}
                        editable
                        drafts={drafts}
                        onQtyChange={handleQtyChange}
                        orderableByOrderId={orderableByOrderId}
                        onAddProductAll={handleAddProductAll}
                        addAllBusy={addAllBusy}
                        onRemoveOrder={handleRemoveOrder}
                        busyOrderId={busyOrderId}
                      />

                      <div className="flex flex-wrap items-center gap-3">
                        <AddLocationPicker
                          items={locationsNotInBatch}
                          disabled={addLocationBusy}
                          onSelect={handleAddLocation}
                        />
                        {dirty && (
                          <button
                            type="button"
                            disabled={matrixSaving}
                            onClick={handleSaveMatrix}
                            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          >
                            {matrixSaving ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                                {t("manager.transport.matrix.saveBusy")}
                              </span>
                            ) : (
                              t("manager.transport.matrix.saveButton")
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={cancelling}
                          onClick={handleCancelDraft}
                          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                        >
                          {cancelling ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                              {t("manager.transport.cancel.busy")}
                            </span>
                          ) : (
                            t("manager.transport.cancel.button")
                          )}
                        </button>

                        <div className="ml-auto flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            {dirty && (
                              <button
                                type="button"
                                disabled={savingAndSending}
                                onClick={handleSaveAndSend}
                                className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                              >
                                {savingAndSending ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                                    {t("manager.transport.finalize.saveAndSendBusy")}
                                  </span>
                                ) : (
                                  t("manager.transport.finalize.saveAndSendButton")
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={finalizing || dirty || detail.orders.length === 0}
                              onClick={handleFinalize}
                              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                            >
                              {finalizing ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                                  {t("manager.transport.finalize.busy")}
                                </span>
                              ) : (
                                t("manager.transport.finalize.button")
                              )}
                            </button>
                          </div>
                          {/* Permanent inline hint while dirty — the finalize UX fix
                              (v3 design decision 3): the button used to just silently
                              4s-toast on click with unsaved edits; now it stays
                              disabled with an always-visible explanation. */}
                          {dirty && (
                            <span className="text-xs text-amber-700">
                              {t("manager.transport.finalize.disabledHint")}
                            </span>
                          )}
                        </div>
                      </div>

                      {cancelResult && (
                        <div className="rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
                          <div>
                            {t("manager.transport.cancel.ok", {
                              released: cancelResult.releasedCount,
                              cancelled: cancelResult.cancelledCount,
                            })}
                          </div>
                          {cancelResult.skipped.length > 0 && (
                            <div className="mt-2">
                              <div className="font-semibold">
                                {t("manager.transport.finalize.result.skippedHeader")}
                              </div>
                              <ul className="list-disc list-inside">
                                {cancelResult.skipped.map((s) => (
                                  <li key={s.order_id}>
                                    {s.order_id}: {s.reason}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {finalizeResult && (
                        <div className="rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
                          <div>
                            {t("manager.transport.finalize.result.sent", { count: finalizeResult.sentCount })}
                          </div>
                          {finalizeResult.skipped.length > 0 && (
                            <div className="mt-2">
                              <div className="font-semibold">
                                {t("manager.transport.finalize.result.skippedHeader")}
                              </div>
                              <ul className="list-disc list-inside">
                                {finalizeResult.skipped.map((s) => (
                                  <li key={s.order_id}>
                                    {s.order_id}: {s.reason}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    matrix && (
                      <>
                        <h3 className="text-sm font-semibold text-slate-800 mb-2">
                          {t("manager.transport.detail.totalsTitle")}
                        </h3>
                        <div className="overflow-x-auto mb-4">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                              <tr>
                                <th className="text-left font-semibold px-3 py-2">
                                  {t("manager.transport.detail.productCol")}
                                </th>
                                <th className="text-right font-semibold px-3 py-2">
                                  {t("manager.transport.detail.qtyCol")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.lines.map((line) => (
                                <tr key={line.product_id} className="border-t border-gray-100">
                                  <td className="px-3 py-2">{line.product_name_pl}</td>
                                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                                    {line.total_qty_purchase} {line.purchase_unit}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <h3 className="text-sm font-semibold text-slate-800 mb-2">
                          {t("manager.transport.detail.matrixTitle")}
                        </h3>
                        <div className="overflow-x-auto mb-4">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                              <tr>
                                <th className="text-left font-semibold px-3 py-2">
                                  {t("manager.transport.detail.productCol")}
                                </th>
                                {detail.location_ids.map((locId) => (
                                  <th key={locId} className="text-right font-semibold px-3 py-2 whitespace-nowrap">
                                    {locationNameById.get(locId) ?? locId}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {matrix.map(({ line, byLocation }) => (
                                <tr key={line.product_id} className="border-t border-gray-100">
                                  <td className="px-3 py-2">{line.product_name_pl}</td>
                                  {detail.location_ids.map((locId) => (
                                    <td key={locId} className="px-3 py-2 text-right tabular-nums">
                                      {byLocation.has(locId) ? byLocation.get(locId) : "–"}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <button
                            type="button"
                            onClick={copyDriverText}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            {t("manager.transport.detail.copyButton")}
                          </button>

                          {!emailDisabledReason && gmail ? (
                            <a
                              href={gmail.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                            >
                              {t("manager.transport.detail.emailButton")}
                            </a>
                          ) : (
                            <span
                              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                              title={emailDisabledReason ?? undefined}
                            >
                              {t("manager.transport.detail.emailButton")}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-semibold text-slate-800 mb-2">
                          {t("manager.transport.detail.ordersTitle")}
                        </h3>
                        <ul className="space-y-1 text-sm text-slate-700">
                          {detail.orders.map((o) => {
                            const discrepancy = o.received_discrepancy_count ?? 0;
                            const received = o.received_count ?? 0;
                            return (
                              <li key={o.order_id} className="flex items-center justify-between gap-2">
                                <span className="truncate">{o.location_name}</span>
                                <span className="flex items-center gap-2 shrink-0">
                                  {/* Delivery status chip (v3 Phase 8) — mirrors
                                      ManagerQueue's receipt signal styling. Only
                                      meaningful once the batch is SENT — a draft
                                      was never dispatched, so "waiting for
                                      delivery" would mislead (review OBS). */}
                                  {detail.status !== "sent" ? null : discrepancy > 0 ? (
                                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-800">
                                      <span aria-hidden="true">⚠</span>{" "}
                                      {t("manager.transport.delivery.discrepancy", { count: discrepancy })}
                                    </span>
                                  ) : received > 0 ? (
                                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-semibold text-green-900">
                                      <span aria-hidden="true">✓</span>{" "}
                                      {t("manager.transport.delivery.delivered")}
                                    </span>
                                  ) : (
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                      {t("manager.transport.delivery.waiting")}
                                    </span>
                                  )}
                                  <span className="text-xs text-slate-500">{o.order_id}</span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {gridCreateOpen && (
        <LocationMultiSelectModal
          locations={locations}
          busy={gridCreateBusy}
          onCancel={() => setGridCreateOpen(false)}
          onConfirm={handleGridCreateConfirm}
        />
      )}
    </div>
  );
}
