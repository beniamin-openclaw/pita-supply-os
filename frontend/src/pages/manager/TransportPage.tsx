// Manager Transport ("TO" — combined delivery run) workspace (to-ordering-pago
// Phase 3 + v2 ADDENDUM). Combines several locations' submitted/claimed orders
// for one supplier into a single Transport batch, then lets the manager work
// the batch as a DRAFT: edit quantities per product x location cell, add
// products, add a location with no captain submission, remove a member order,
// set logistics (driver/vehicle/pickup/limit), preview the total weight — and
// finally finalize (draft -> sent), which mirrors v1's totals/driver-list/
// email/copy view exactly, now read-only.
//
// transport-v2: the supplier <select> is replaced by a filter bar — supplier
// chips (Pago / Magazyn Mory, at least one stays on) pick the eligible-list
// scope and filter the history; city tiles filter both lists. Everything that
// sends or marks a batch (Gmail drafts, mark-only, undo) lives in
// TransportSendPanel.

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { AppHeader } from "../../components/ui/AppHeader";
import { roundQty } from "../../components/ui/number";
import { useT } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { statusVisual } from "../captain-mp/lib/orderStatus";
import {
  anyTransportDirty,
  collectCaptainNotes,
  collectLogisticsSuggestions,
  computePagoWarehouseExclusion,
  loadSeenTransports,
  markTransportSeen,
  parseConfigList,
  seedTransportDrafts,
  transportDirtySavePayloads,
  transportDisplayLabel,
  leadSupplierView,
  orderSupplierId,
  lineSupplierId,
  transportOrdersFor,
  transportSuppliers,
  transportScopeFromChips,
  transportCityOptions,
  filterEligibleByCity,
  filterTransportBatches,
  sortEligibleNewestFirst,
  sortTransportBatches,
  TRANSPORT_CHIP_SUPPLIER_IDS,
  type TransportChips,
  type TransportDraftMap,
} from "./lib/transport";
import { AddLocationPicker } from "./transport/AddLocationPicker";
import { HistorySection } from "./transport/HistorySection";
import { LocationMultiSelectModal } from "./transport/LocationMultiSelectModal";
import { LogisticsPanel } from "./transport/LogisticsPanel";
import { PagoExclusionNotice } from "./transport/PagoExclusionNotice";
import { TransportMatrix } from "./transport/TransportMatrix";
import { TransportSendPanel, type TransportDocLabels } from "./transport/TransportSendPanel";
import { WeightStrip } from "./transport/WeightStrip";
import type {
  Location,
  OrderableItem,
  Supplier,
  TransportBatchDetail,
  TransportBatchOrder,
  TransportBatchPatchRequest,
  TransportBatchSummary,
  TransportDraftConfig,
  TransportEligibleOrder,
  TransportFinalizeResponse,
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

type EligibleScope = { leadSupplierId: string; includeCompanions: boolean };

// The history is fetched once, across all suppliers, newest first.
const TRANSPORT_HISTORY_LIMIT = 100;

const DEFAULT_CHIPS: TransportChips = { pago: true, mory: true };

// The filter bar's supplier chips, in display order.
const CHIP_DEFS: ReadonlyArray<{
  key: keyof TransportChips;
  supplierId: string;
  labelKey: StringKey;
}> = [
  { key: "pago", supplierId: TRANSPORT_CHIP_SUPPLIER_IDS[0], labelKey: "manager.transport.filter.chip.pago" },
  { key: "mory", supplierId: TRANSPORT_CHIP_SUPPLIER_IDS[1], labelKey: "manager.transport.filter.chip.mory" },
];

/** Is this supplier's chip on? A supplier without a chip always counts as on. */
function chipOn(chips: TransportChips, supplierId: string): boolean {
  const def = CHIP_DEFS.find((d) => d.supplierId === supplierId);
  return def ? chips[def.key] : true;
}

/** The city filter for a set of switched-off tiles (lowercase keys):
 * null = every tile on = no filter. */
function cityFilterFor(
  options: string[],
  excluded: ReadonlySet<string>,
): ReadonlySet<string> | null {
  if (excluded.size === 0) return null;
  return new Set(options.filter((c) => !excluded.has(c.toLowerCase())));
}

/** One automatic retry of a failed draft-config fetch, after this delay. */
const DRAFT_CONFIG_RETRY_MS = 3000;

/** State of the draft-config fetch, as the send panel needs it. */
type DraftConfigStatus = "loading" | "ready" | "failed";

/** A batch's suppliers (lead first); an older backend sends no list. */
function batchSupplierIds(b: TransportBatchSummary): string[] {
  return b.supplier_ids && b.supplier_ids.length > 0 ? b.supplier_ids : [b.supplier_id];
}

export function TransportPage(): ReactElement {
  const { t, lang, formatDateTime } = useT();
  const navigate = useNavigate();

  // Filter bar (transport-v2) -----------------------------------------------
  // Supplier chips: both on by default, the last one on cannot be turned off;
  // they pick the eligible-list scope and filter the history. City tiles:
  // every city on by default; `excludedCities` holds the lowercase keys of
  // the tiles switched off (empty = no city filter).
  const [chips, setChips] = useState<TransportChips>(DEFAULT_CHIPS);
  const scope = useMemo<EligibleScope>(() => transportScopeFromChips(chips), [chips]);
  const [excludedCities, setExcludedCities] = useState<ReadonlySet<string>>(() => new Set());

  // Supplier master data — no longer a picker: the lead supplier's e-mail
  // (send panel) and the names on the history badges. Unfiltered.
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);

  // Locations master data — for the draft "add location" picker (Manager-only
  // caller; api.locations needs role="manager" or it 401s silently).
  // Deliberately UNFILTERED by `active` (v5.2 operator request: "wszystkie
  // lokalizacje z firmy"): a Transport run delivers to locations not yet
  // onboarded for captains (`active=false` means "no captain flow yet", not
  // "doesn't take deliveries" — the legacy sheet always spanned the whole
  // company). Backend add-location has no active gate either; a location with
  // no supplier settings just prefills 0 products and its empty column is
  // auto-removed at finalize. Sorted by name for a scannable modal list.
  const [locations, setLocations] = useState<Location[]>([]);
  useEffect(() => {
    api
      .locations("manager")
      .then((data) =>
        setLocations(
          [...data].sort((a, b) => a.location_name.localeCompare(b.location_name, "pl")),
        ),
      )
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

  // City tiles over ALL manager locations (not only those with orders), so a
  // tile never appears or disappears as the lists reload.
  const cityOptions = useMemo(
    () => transportCityOptions(locations.map((l) => l.location_id), locationsById),
    [locations, locationsById],
  );
  const cityFilter = useMemo(
    () => cityFilterFor(cityOptions, excludedCities),
    [cityOptions, excludedCities],
  );

  // v4/v5: "Zrob draft w Gmailu" driver-recipients + operator-configured
  // driver/vehicle dictionaries (Logistics panel dropdowns) all come off ONE
  // draft-config fetch — kept as the whole object so downstream consumers
  // (TransportSendPanel's driverRecipients/orderMailbox, LogisticsPanel's
  // driverOptions/vehicleOptions) each project the field they need. Fetched
  // on mount and retried ONCE after DRAFT_CONFIG_RETRY_MS; a second failure
  // degrades to null (each consumer then sees its own "" degrade) and the
  // send panel says to reload instead of claiming there is no mailbox.
  const [draftConfig, setDraftConfig] = useState<TransportDraftConfig | null>(null);
  const [draftConfigStatus, setDraftConfigStatus] = useState<DraftConfigStatus>("loading");
  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;
    const load = (retriesLeft: number): void => {
      api
        .transportDraftConfig()
        .then((cfg) => {
          if (cancelled) return;
          setDraftConfig(cfg);
          setDraftConfigStatus("ready");
        })
        .catch(() => {
          if (cancelled) return;
          if (retriesLeft > 0) {
            retryTimer = window.setTimeout(() => load(retriesLeft - 1), DRAFT_CONFIG_RETRY_MS);
            return;
          }
          setDraftConfig(null);
          setDraftConfigStatus("failed");
        });
    };
    load(1);
    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, []);
  const driverRecipients = draftConfig?.driver_recipients || null;
  const configuredDrivers = useMemo(
    () => parseConfigList(draftConfig?.drivers),
    [draftConfig],
  );
  const configuredVehicles = useMemo(
    () => parseConfigList(draftConfig?.vehicles),
    [draftConfig],
  );

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

  // Latest request wins — chip clicks can overlap a slow response.
  const eligibleRequestRef = useRef(0);
  const fetchEligible = useCallback((s: EligibleScope): void => {
    const request = ++eligibleRequestRef.current;
    api
      .transportEligible(s.leadSupplierId, s.includeCompanions)
      .then((data) => {
        if (request === eligibleRequestRef.current) setEligible(data);
      })
      .catch((e: ApiError) => {
        if (request === eligibleRequestRef.current && e.status !== 401) {
          setEligibleError(e.detail);
        }
      });
  }, []);

  const loadEligible = useCallback(
    (s: EligibleScope): void => {
      setEligible(null);
      setEligibleError(null);
      setSelected(new Set());
      fetchEligible(s);
    },
    [fetchEligible],
  );

  // Initial load with the default chips. fetchEligible sets state only from
  // promise callbacks, never synchronously in this effect body
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    fetchEligible(transportScopeFromChips(DEFAULT_CHIPS));
  }, [fetchEligible]);

  // Past batches -----------------------------------------------------------------
  const [batches, setBatches] = useState<TransportBatchSummary[] | null>(null);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [selectedTransportId, setSelectedTransportId] = useState<string | null>(null);
  // The open batch, readable from async callbacks: a refresh that resolves
  // after the Manager opened another batch must not overwrite it.
  const selectedIdRef = useRef<string | null>(null);
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
  const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState<CancelResult | null>(null);

  // Reported by the open batch's panels (both reset to false on unmount):
  // unsaved Logistics edits, and a send / mark-only / undo in progress.
  const [logisticsDirty, setLogisticsDirty] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);

  // v3 Phase 7 — cancelled batches hidden from the list by default.
  const [showCancelled, setShowCancelled] = useState(false);

  // v3 Phase 9 — manager-first grid creation (location multi-select modal).
  const [gridCreateOpen, setGridCreateOpen] = useState(false);
  const [gridCreateBusy, setGridCreateBusy] = useState(false);

  // History: ONE fetch across all suppliers, filtered and sorted client-side
  // by the chips and city tiles. Latest request wins.
  const batchesRequestRef = useRef(0);
  const fetchBatches = useCallback((includeCancelled: boolean): void => {
    const request = ++batchesRequestRef.current;
    api
      .transportBatches(undefined, TRANSPORT_HISTORY_LIMIT, includeCancelled)
      .then((data) => {
        if (request !== batchesRequestRef.current) return;
        setBatches(data);
        setBatchesError(null);
      })
      .catch((e: ApiError) => {
        if (request === batchesRequestRef.current && e.status !== 401) setBatchesError(e.detail);
      });
  }, []);

  // List-only refetch: never resets the open detail (it used to close the
  // draft panel mid-edit and discard unsaved matrix edits).
  const reloadBatchList = useCallback((): void => {
    fetchBatches(showCancelled);
  }, [fetchBatches, showCancelled]);

  useEffect(() => {
    fetchBatches(false);
  }, [fetchBatches]);

  useEffect(() => {
    let cancelled = false;
    api
      // "manager": this screen only ever holds a Manager token, so the default
      // captain role would send no Authorization header and 401.
      .suppliers("manager")
      .then((data) => {
        if (!cancelled) setSuppliers(data);
      })
      .catch((e: ApiError) => {
        if (!cancelled && e.status !== 401) setSuppliersError(e.detail);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSelected = (orderId: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  // The eligible list as shown: newest first, city-filtered.
  const visibleEligibleFor = useCallback(
    (cities: ReadonlySet<string> | null): TransportEligibleOrder[] =>
      eligible
        ? filterEligibleByCity(sortEligibleNewestFirst(eligible), cities, locationsById)
        : [],
    [eligible, locationsById],
  );
  const visibleEligible = useMemo(
    () => visibleEligibleFor(cityFilter),
    [visibleEligibleFor, cityFilter],
  );

  // The selection as the Manager sees it: only visible orders count, are
  // summed and go to create — a hidden order is never combined.
  const selectedVisible = useMemo(
    () => visibleEligible.filter((o) => selected.has(o.order_id)),
    [visibleEligible, selected],
  );
  const selectionTotal = useMemo(
    () => selectedVisible.reduce((sum, o) => sum + (o.total_value_estimate_pln ?? 0), 0),
    [selectedVisible],
  );

  // ---- filter bar handlers -----------------------------------------------------

  const toggleChip = (key: keyof TransportChips): void => {
    const next: TransportChips = { ...chips, [key]: !chips[key] };
    if (!next.pago && !next.mory) return; // the last chip on stays on
    setChips(next);
    loadEligible(transportScopeFromChips(next));
  };

  const applyExcludedCities = (next: ReadonlySet<string>): void => {
    setExcludedCities(next);
    // Prune the selection to what stays visible, so switching a city back on
    // never brings back a forgotten tick.
    const visibleIds = new Set(
      visibleEligibleFor(cityFilterFor(cityOptions, next)).map((o) => o.order_id),
    );
    setSelected((prev) => new Set([...prev].filter((id) => visibleIds.has(id))));
  };

  const toggleCity = (city: string): void => {
    const key = city.toLowerCase();
    const next = new Set(excludedCities);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    applyExcludedCities(next);
  };

  const resetCities = (): void => applyExcludedCities(new Set());

  // History rows: only batches carrying a supplier whose chip is on, in the
  // selected cities, newest run first.
  const visibleBatches = useMemo(() => {
    if (!batches) return null;
    const supplierIds = new Set(
      CHIP_DEFS.filter((d) => chips[d.key]).map((d) => d.supplierId),
    );
    return sortTransportBatches(
      filterTransportBatches(batches, { supplierIds, cities: cityFilter }, locationsById),
    );
  }, [batches, chips, cityFilter, locationsById]);

  // Short supplier name for a badge: the chip label for Pago / Magazyn Mory,
  // else the master-data name.
  const supplierBadgeName = useCallback(
    (id: string, fallback?: string): string => {
      const def = CHIP_DEFS.find((d) => d.supplierId === id);
      if (def) return t(def.labelKey);
      return suppliers?.find((s) => s.supplier_id === id)?.supplier_name || fallback || id;
    },
    [suppliers, t],
  );

  // Batch detail ----------------------------------------------------------------
  const fetchOrderable = useCallback((batchDetail: TransportBatchDetail): void => {
    if (batchDetail.status !== "draft") {
      setOrderableByOrderId({});
      return;
    }
    Promise.all(
      batchDetail.orders.map((o) =>
        api
          // Each member's OWN supplier — a Magazyn Mory order on a Pago run
          // offers Mory's catalogue (transport-pago-mory-combined).
          // Full supplier list incl. products outside the location's list —
          // offered only as a one-location add (manager-add-any-product).
          .managerOrderable(orderSupplierId(o, batchDetail), o.location_id, true)
          .then((items) => [o.order_id, items] as const)
          .catch(() => [o.order_id, []] as const),
      ),
    ).then((pairs) => {
      // A late answer for a batch that is no longer open must not overwrite
      // the open batch's catalogue.
      if (selectedIdRef.current !== batchDetail.transport_id) return;
      setOrderableByOrderId(Object.fromEntries(pairs));
    });
  }, []);

  const selectBatch = useCallback(
    (transportId: string): void => {
      setSelectedTransportId(transportId);
      selectedIdRef.current = transportId;
      setDetail(null);
      setDetailError(null);
      setDetailLoading(true);
      setDrafts({});
      setOrderableByOrderId({});
      setFinalizeResult(null);
      setCancelResult(null);
      api
        .transportBatch(transportId)
        .then((d) => {
          // Click A, then B: A's late answer must not replace B.
          if (selectedIdRef.current !== transportId) return;
          setDetail(d);
          setDrafts(seedTransportDrafts(d.orders));
          fetchOrderable(d);
          markTransportSeen(transportId);
          setSeenTransports((prev) => new Set(prev).add(transportId));
          scrollDetailIntoView();
        })
        .catch((e: ApiError) => {
          if (selectedIdRef.current !== transportId) return;
          if (e.status !== 401) setDetailError(e.detail);
        })
        .finally(() => {
          if (selectedIdRef.current === transportId) setDetailLoading(false);
        });
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
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    setCreateResult(null);
    api
      // The chip scope picks the lead supplier; allow_companions only with
      // both chips on (Magazyn Mory orders then join a Pago batch).
      .transportCreate({
        supplier_id: scope.leadSupplierId,
        order_ids: orderIds,
        allow_companions: scope.includeCompanions,
      })
      .then((resp) => {
        setCreateResult({
          transportId: resp.transport_id,
          combinedCount: resp.combined.length,
          skipped: resp.skipped,
        });
        loadEligible(scope);
        reloadBatchList();
        selectBatch(resp.transport_id);
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setCreateError(e.detail);
      })
      .finally(() => setCreating(false));
  }, [scope, creating, loadEligible, reloadBatchList, selectBatch]);

  const handleCreate = useCallback(() => {
    if (selectedVisible.length === 0) return;
    runCreate(selectedVisible.map((o) => o.order_id));
  }, [selectedVisible, runCreate]);

  const handleCreateEmpty = useCallback(() => {
    runCreate([]);
  }, [runCreate]);

  // "Pokaż anulowane": refetch the list only — the open detail stays.
  const handleToggleShowCancelled = useCallback(() => {
    const next = !showCancelled;
    setShowCancelled(next);
    fetchBatches(next);
  }, [showCancelled, fetchBatches]);

  // Refresh the open batch and the history rows. Resolves once the detail is
  // in — the send panel awaits it before re-enabling its buttons.
  // `preserveDrafts` may be decided from the fresh detail (send panel: keep
  // the matrix edits unless the status changed).
  const refreshDetailAsync = useCallback(
    async (
      transportId: string,
      preserveDrafts: boolean | ((fresh: TransportBatchDetail) => boolean) = false,
    ): Promise<void> => {
      reloadBatchList();
      try {
        const d = await api.transportBatch(transportId);
        if (selectedIdRef.current !== transportId) return; // another batch is open now
        setDetail(d);
        // Reseed clears dirty state — right after a matrix save / add /
        // remove, wrong after a logistics-only save (it would discard
        // unsaved quantity edits the manager is still working on).
        const keepDrafts = typeof preserveDrafts === "function" ? preserveDrafts(d) : preserveDrafts;
        if (!keepDrafts) setDrafts(seedTransportDrafts(d.orders));
        fetchOrderable(d);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return;
        if (selectedIdRef.current !== transportId) return;
        setDetailError(e instanceof ApiError ? e.detail : String(e));
      }
    },
    [reloadBatchList, fetchOrderable],
  );

  const refreshDetail = useCallback(
    (transportId: string, preserveDrafts = false): void => {
      void refreshDetailAsync(transportId, preserveDrafts);
    },
    [refreshDetailAsync],
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

  // Scoped to ONE supplier section (transport-pago-mory-combined): a Pago
  // product is never offered to — and would 400 on — a Magazyn Mory order.
  const handleAddProductAll = useCallback(
    (productId: string, sectionSupplierId: string) => {
      if (!detail) return;
      const targets = transportOrdersFor(detail, sectionSupplierId)
        .filter((order) => !order.lines.some((l) => l.product_id === productId))
        .map((order) => {
          // Add-to-all never uses the one-off override: only orders whose
          // location normally carries the product get it.
          const item = (orderableByOrderId[order.order_id] ?? []).find(
            (o) => o.product_id === productId && o.configured_for_location !== false,
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

  // One product for ONE member order (manager-add-any-product): the "+" in an
  // empty matrix cell and the "for one location only" picker. A product outside
  // the location's list goes through the add-line override. The line is written
  // to that location's order, so the pickup, the e-mail and the goods receipt
  // all carry it. Drafts are preserved — other unsaved edits survive the add.
  const handleAddProductOne = useCallback(
    (order: TransportBatchOrder, item: OrderableItem) => {
      if (!detail) return;
      setAddAllBusy(true);
      api
        .managerAddLine(
          order.order_id,
          item.product_id,
          item.supplier_product_id,
          item.configured_for_location === false,
        )
        .then(() => {
          showToast(
            t("manager.transport.matrix.addOneOk", {
              product: item.product_name_pl,
              location: order.location_name,
            }),
            true,
          );
          refreshDetail(detail.transport_id, true);
        })
        .catch((e: ApiError) => {
          showToast(
            t("manager.transport.matrix.addProductAllError", {
              locations: `${order.location_name}: ${e.detail}`,
            }),
            false,
          );
        })
        .finally(() => setAddAllBusy(false));
    },
    [detail, refreshDetail, showToast, t],
  );

  // ---- v2 draft workstation: add location -------------------------------------

  // Per supplier section: a location that only has a Pago order can still get
  // a Magazyn Mory column, and vice versa (transport-pago-mory-combined).
  const locationsNotInSection = useCallback(
    (sectionSupplierId: string): Location[] => {
      if (!detail) return locations;
      const present = new Set(
        transportOrdersFor(detail, sectionSupplierId).map((o) => o.location_id),
      );
      return locations.filter((l) => !present.has(l.location_id));
    },
    [locations, detail],
  );

  const handleAddLocation = useCallback(
    (location: Location, sectionSupplierId: string) => {
      if (!detail) return;
      setAddLocationBusy(true);
      api
        // prefill_products=true, same as the grid-create flow. Without it the
        // new location's order lands with ZERO lines, so every product already
        // in the matrix renders as an un-fillable dash for that column and the
        // Manager has to re-add each product by hand (operator, 2026-09-02).
        // Prefilling gives the location a zero-qty line for every product it
        // can order from this supplier; a zero drops out of the totals, the
        // driver list and the email, so an untouched column costs nothing.
        // supplier_id only for a companion section, so the lead's request is
        // byte-identical to before.
        .transportAddLocation(
          detail.transport_id,
          location.location_id,
          true,
          sectionSupplierId === detail.supplier_id ? undefined : sectionSupplierId,
        )
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
        selectedIdRef.current = null;
        setDetail(null);
        reloadBatchList();
      })
      .catch((e: ApiError) => {
        showToast(t("manager.transport.cancel.error", { detail: e.detail }), false);
      })
      .finally(() => setCancelling(false));
  }, [detail, reloadBatchList, showToast, t]);

  // ---- v3 Phase 9: manager-first grid creation ---------------------------------

  const handleGridCreateConfirm = useCallback(
    (locationIds: string[]) => {
      if (locationIds.length === 0) return;
      setGridCreateBusy(true);
      api
        .transportCreate({
          supplier_id: scope.leadSupplierId,
          order_ids: [],
          allow_companions: scope.includeCompanions,
        })
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
          loadEligible(scope);
          reloadBatchList();
          selectBatch(transportId);
        })
        .catch((e: ApiError) => {
          showToast(t("manager.transport.createError", { detail: e.detail }), false);
        })
        .finally(() => setGridCreateBusy(false));
    },
    [scope, locations, loadEligible, reloadBatchList, selectBatch, showToast, t],
  );

  // rows = product, cols = detail.location_ids (private driver matrix — sent
  // view only). Grouped by supplier (transport-pago-mory-combined): a Pago run
  // that carried Magazyn Mory orders shows a Pago block, then a Mory block,
  // each under its own header row when more than one supplier has lines.
  const matrix = useMemo(() => {
    if (!detail) return null;
    return transportSuppliers(detail)
      .map((sup) => ({
        supplier: sup,
        rows: detail.lines
          .filter((line) => lineSupplierId(line, detail) === sup.supplier_id)
          .map((line) => {
            const byLocation = new Map<string, number>();
            line.per_location.forEach((pl) => {
              byLocation.set(
                pl.location_id,
                roundQty((byLocation.get(pl.location_id) ?? 0) + pl.qty_purchase),
              );
            });
            return { line, byLocation };
          }),
      }))
      .filter((block) => block.rows.length > 0);
  }, [detail]);
  const showSupplierHeaders = (matrix?.length ?? 0) > 1;

  // Draft sections: one editable matrix per supplier the batch can carry —
  // the lead first, then (on a Pago batch) Magazyn Mory. A section with
  // members always shows; an empty one only while its chip is on (so a Mory
  // column can still be added from an empty section).
  const draftSections = useMemo(() => {
    if (!detail) return [];
    return transportSuppliers(detail)
      .map((sup) => ({
        supplier: sup,
        orders: transportOrdersFor(detail, sup.supplier_id),
      }))
      .filter((section) => section.orders.length > 0 || chipOn(chips, section.supplier.supplier_id));
  }, [detail, chips]);

  // ---- send panel wiring ------------------------------------------------------

  // Labels of a (re-fetched) detail — finalize can auto-remove empty columns,
  // which changes the cities in an auto-label.
  const docLabelsFor = useCallback(
    (d: TransportBatchDetail): TransportDocLabels => ({
      displayLabel: transportDisplayLabel(d, t, displayLabelOpts),
      pagoDisplayLabel: transportDisplayLabel(leadSupplierView(d), t, displayLabelOpts),
    }),
    [t, displayLabelOpts],
  );
  const fetchBatchDetail = useCallback(
    (transportId: string): Promise<TransportBatchDetail> => api.transportBatch(transportId),
    [],
  );
  const handlePanelFinalized = useCallback((res: TransportFinalizeResponse): void => {
    if (selectedIdRef.current !== res.transport_id) return; // another batch is open now
    setFinalizeResult({ sentCount: res.sent.length, skipped: res.skipped });
  }, []);
  // Re-seed the matrix only when the status changed (draft -> sent after a
  // send / mark-only, sent -> draft after an undo); otherwise — e.g. a
  // driver-list send on a draft batch — keep edits typed during the send.
  // `detail` is the batch as it was when the panel's action started.
  const handlePanelChanged = useCallback((): Promise<void> => {
    if (!detail) return Promise.resolve();
    const statusBefore = detail.status;
    return refreshDetailAsync(
      detail.transport_id,
      (fresh: TransportBatchDetail): boolean => fresh.status === statusBefore,
    );
  }, [detail, refreshDetailAsync]);
  // A send in progress must finish on the open batch: opening another one
  // would unmount its panel and lose the result or the error.
  const switchBlocked = (transportId: string): boolean =>
    sendBusy && transportId !== selectedTransportId;

  const locationNameById = useMemo(() => {
    const byId = new Map<string, string>();
    detail?.orders.forEach((o) => byId.set(o.location_id, o.location_name));
    return byId;
  }, [detail]);

  // Captain's per-order comment, Manager-only (training-feedback-0901 F1
  // point 5) — never reaches a supplier-facing body or PDF, only this screen.
  const captainNotes = useMemo(() => (detail ? collectCaptainNotes(detail.orders) : []), [detail]);

  // Excluded-Pago-lines notice (F0/F7) — computed independent of the
  // print/draft click handlers (which build their own doc lazily) so it can
  // render eagerly alongside the print/draft buttons.
  const pagoExclusion = useMemo(
    () => (detail ? computePagoWarehouseExclusion(detail) : null),
    [detail],
  );

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
        {toast && (
          <div
            role={toast && !toast.ok ? "alert" : "status"}
            className={`rounded border px-3 py-2 text-sm ${
              toast && !toast.ok
                ? "border-red-400 bg-red-50 text-red-900"
                : "border-green-300 bg-green-50 text-green-900"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* ---- Filter bar (transport-v2) ---- */}
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          {suppliersError && (
            <div className="text-sm text-red-700" role="alert">
              {t("manager.transport.filter.suppliersError", { detail: suppliersError })}
            </div>
          )}
          <div>
            <div id="trn-filter-suppliers" className="mb-1 text-xs font-semibold text-slate-600">
              {t("manager.transport.filter.suppliersLabel")}
            </div>
            <div role="group" aria-labelledby="trn-filter-suppliers" className="flex flex-wrap gap-2">
              {CHIP_DEFS.map((def) => {
                const on = chips[def.key];
                const lastOn = on && CHIP_DEFS.filter((d) => chips[d.key]).length === 1;
                return (
                  <button
                    key={def.key}
                    type="button"
                    aria-pressed={on}
                    disabled={lastOn}
                    title={lastOn ? t("manager.transport.filter.lastChipTitle") : undefined}
                    onClick={() => toggleChip(def.key)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed ${
                      on
                        ? "border-blue-700 bg-blue-700 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {t(def.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
          {cityOptions.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-3">
                <span id="trn-filter-cities" className="text-xs font-semibold text-slate-600">
                  {t("manager.transport.filter.citiesLabel")}
                </span>
                {excludedCities.size > 0 && (
                  <button
                    type="button"
                    onClick={resetCities}
                    className="text-xs font-semibold text-blue-700 underline decoration-dotted hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {t("manager.transport.filter.allCities")}
                  </button>
                )}
              </div>
              <div role="group" aria-labelledby="trn-filter-cities" className="flex flex-wrap gap-2">
                {cityOptions.map((city) => {
                  const on = !excludedCities.has(city.toLowerCase());
                  return (
                    <button
                      key={city}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleCity(city)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                        on
                          ? "border-blue-300 bg-blue-50 text-blue-900"
                          : "border-slate-200 bg-white text-slate-400 line-through hover:bg-slate-50"
                      }`}
                    >
                      {city}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
          {!eligibleError && eligible !== null && visibleEligible.length === 0 && (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
              <p>
                {t(
                  eligible.length === 0
                    ? "manager.transport.eligible.empty"
                    : "manager.transport.eligible.emptyFiltered",
                )}
              </p>
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

          {visibleEligible.length > 0 && (
            <>
              <ul className="space-y-2 mb-3">
                {visibleEligible.map((o) => {
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
                            {o.supplier_id !== scope.leadSupplierId && (
                              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                                {o.supplier_name}
                              </span>
                            )}
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
                    count: selectedVisible.length,
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
                    disabled={selectedVisible.length === 0 || creating}
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
          {!batchesError && batches !== null && visibleBatches !== null && visibleBatches.length === 0 && (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
              {t(
                batches.length === 0
                  ? "manager.transport.batches.empty"
                  : "manager.transport.batches.emptyFiltered",
              )}
            </div>
          )}

          {visibleBatches && visibleBatches.length > 0 && (
            <ul className="space-y-2">
              {visibleBatches.map((b) => (
                <li key={b.transport_id}>
                  <button
                    type="button"
                    disabled={switchBlocked(b.transport_id)}
                    title={
                      switchBlocked(b.transport_id)
                        ? t("manager.transport.batches.busySwitchTitle")
                        : undefined
                    }
                    onClick={() => {
                      // Re-opening even the open batch remounts its send panel.
                      if (sendBusy) return;
                      if (
                        (dirty || logisticsDirty) &&
                        b.transport_id !== selectedTransportId &&
                        !window.confirm(t("manager.transport.unsavedSwitchConfirm"))
                      ) {
                        return;
                      }
                      selectBatch(b.transport_id);
                    }}
                    className={`w-full text-left rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed ${
                      b.status === "cancelled" ? "opacity-60" : ""
                    } ${
                      selectedTransportId === b.transport_id
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
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
                      {batchSupplierIds(b).map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-800"
                        >
                          {supplierBadgeName(id, id === b.supplier_id ? b.supplier_name : undefined)}
                        </span>
                      ))}
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

                  {captainNotes.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <div className="mb-1 font-semibold">
                        {t("manager.transport.captainNotes.title")}
                      </div>
                      <ul className="space-y-0.5">
                        {captainNotes.map((n) => (
                          <li key={n.orderId}>
                            <span className="font-semibold">{n.locationName}:</span>{" "}
                            <span className="whitespace-pre-line">{n.note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <LogisticsPanel
                    key={detail.transport_id}
                    detail={detail}
                    driverSuggestions={driverSuggestions}
                    vehicleSuggestions={vehicleSuggestions}
                    driverOptions={configuredDrivers}
                    vehicleOptions={configuredVehicles}
                    busy={logisticsSaving}
                    onSave={handleSaveLogistics}
                    onDirtyChange={setLogisticsDirty}
                  />

                  {pagoExclusion && <PagoExclusionNotice exclusion={pagoExclusion} />}

                  <TransportSendPanel
                    // Remount per batch; a distinct key from its sibling
                    // LogisticsPanel (duplicate sibling keys break reconciling).
                    key={`send-${detail.transport_id}`}
                    detail={detail}
                    displayLabel={transportDisplayLabel(detail, t, displayLabelOpts)}
                    pagoDisplayLabel={transportDisplayLabel(
                      leadSupplierView(detail),
                      t,
                      displayLabelOpts,
                    )}
                    labelsFor={docLabelsFor}
                    supplierEmail={suppliers?.find((s) => s.supplier_id === detail.supplier_id)?.email}
                    driverRecipients={driverRecipients}
                    orderMailbox={draftConfig?.order_mailbox ?? ""}
                    configStatus={draftConfigStatus}
                    dirty={dirty}
                    logisticsDirty={logisticsDirty}
                    onBusyChange={setSendBusy}
                    onChanged={handlePanelChanged}
                    onFinalized={handlePanelFinalized}
                    fetchDetail={fetchBatchDetail}
                  />

                  {/* A finalize result (send on a draft batch, or mark-only).
                      Shown while the batch is sent, or when nothing was sent
                      (the skipped reasons explain why); hidden after an undo. */}
                  {finalizeResult && (detail.status === "sent" || finalizeResult.sentCount === 0) && (
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

                  <HistorySection events={detail.events} />

                  {isDraft ? (
                    <>
                      {draftSections.map((section) => (
                        <div key={section.supplier.supplier_id} className="space-y-2">
                          {section.orders.length > 0 ? (
                            <TransportMatrix
                              orders={section.orders}
                              title={
                                draftSections.length > 1
                                  ? t("manager.transport.section.title", {
                                      supplier: section.supplier.supplier_name,
                                    })
                                  : undefined
                              }
                              editable
                              drafts={drafts}
                              onQtyChange={handleQtyChange}
                              orderableByOrderId={orderableByOrderId}
                              onAddProductAll={(productId) =>
                                handleAddProductAll(productId, section.supplier.supplier_id)
                              }
                              onAddProductOne={handleAddProductOne}
                              addAllBusy={addAllBusy}
                              onRemoveOrder={handleRemoveOrder}
                              busyOrderId={busyOrderId}
                            />
                          ) : (
                            <>
                              {draftSections.length > 1 && (
                                <h3 className="text-sm font-semibold text-slate-800">
                                  {t("manager.transport.section.title", {
                                    supplier: section.supplier.supplier_name,
                                  })}
                                </h3>
                              )}
                              <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                                {t("manager.transport.section.empty")}
                              </div>
                            </>
                          )}
                          <AddLocationPicker
                            items={locationsNotInSection(section.supplier.supplier_id)}
                            disabled={addLocationBusy}
                            onSelect={(location) =>
                              handleAddLocation(location, section.supplier.supplier_id)
                            }
                          />
                        </div>
                      ))}

                      <div className="flex flex-wrap items-center gap-3">
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
                          // Not while the send panel is marking this batch sent.
                          disabled={cancelling || sendBusy}
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
                              {matrix.map((block) => (
                                <Fragment key={block.supplier.supplier_id}>
                                  {showSupplierHeaders && (
                                    <tr className="border-t border-gray-200 bg-slate-100">
                                      <td colSpan={2} className="px-3 py-1.5 text-xs font-semibold text-slate-700">
                                        {block.supplier.supplier_name}
                                      </td>
                                    </tr>
                                  )}
                                  {block.rows.map(({ line }) => (
                                    <tr
                                      key={`${block.supplier.supplier_id}:${line.product_id}`}
                                      className="border-t border-gray-100"
                                    >
                                      <td className="px-3 py-2">{line.product_name_pl}</td>
                                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                                        {line.total_qty_purchase} {line.purchase_unit}
                                      </td>
                                    </tr>
                                  ))}
                                </Fragment>
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
                              {matrix.map((block) => (
                                <Fragment key={block.supplier.supplier_id}>
                                  {showSupplierHeaders && (
                                    <tr className="border-t border-gray-200 bg-slate-100">
                                      <td
                                        colSpan={detail.location_ids.length + 1}
                                        className="px-3 py-1.5 text-xs font-semibold text-slate-700"
                                      >
                                        {block.supplier.supplier_name}
                                      </td>
                                    </tr>
                                  )}
                                  {block.rows.map(({ line, byLocation }) => (
                                    <tr
                                      key={`${block.supplier.supplier_id}:${line.product_id}`}
                                      className="border-t border-gray-100"
                                    >
                                      <td className="px-3 py-2">{line.product_name_pl}</td>
                                      {detail.location_ids.map((locId) => (
                                        <td key={locId} className="px-3 py-2 text-right tabular-nums">
                                          {byLocation.has(locId) ? byLocation.get(locId) : "–"}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </Fragment>
                              ))}
                            </tbody>
                          </table>
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
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="truncate">{o.location_name}</span>
                                  {orderSupplierId(o, detail) !== detail.supplier_id && (
                                    <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                                      {o.supplier_name || orderSupplierId(o, detail)}
                                    </span>
                                  )}
                                </span>
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
