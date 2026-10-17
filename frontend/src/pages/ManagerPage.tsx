// Manager dispatch — two-pane shell.
//   - left pane  : ManagerQueue (3 status groups, 20s auto-refresh)
//   - right pane : OrderDetailPane (editable per-line table + channel dispatch)
//
// G2: per-line draft state (qty + comment) lives HERE, keyed by order_line_id,
//     seeded from the loaded detail. Save (PATCH) sends the full read-modify-
//     write payload for dirty lines only and stays manager_claimed. Selecting
//     another order with unsaved dirty edits prompts a confirm.
// G3: dispatch is channel-aware; the payload is built from the draft effective
//     quantities and sent_method maps 1:1 from ordering_method. For the email
//     channel the editable-body Gmail URL is built in the DispatchPanel; this
//     parent's onDispatch performs the state write-back.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "../apiClient";
import { clearToken } from "../auth";
import { useT } from "../i18n";
import { AppHeader } from "../components/ui/AppHeader";
import type {
  ManagerOrderDetail,
  ManagerQueueItem,
  OrderableItem,
  OrderingMethod,
  Supplier,
} from "../types";
import { ManagerFilterBar } from "./manager/ManagerFilterBar";
import { ManagerQueue, type QueueLane } from "./manager/ManagerQueue";
import type { DispatchOpts } from "./manager/DispatchPanel";
import { OrderDetailPane } from "./manager/OrderDetailPane";
import {
  type DraftMap,
  dirtySavePayload,
  dispatchPayload,
  hasDirtyDrafts,
  seedDrafts,
} from "./manager/lib/draftState";
import { isOrderEditable } from "./manager/lib/managerLine";
import {
  type DraftedOrder,
  gmailDraftsUrl,
  loadDraftedOrders,
  openDraftTab,
  saveDraftedOrders,
} from "./manager/lib/orderEmailDraft";
import { QUEUE_LANE_LIMIT } from "./manager/lib/queueAge";
import { buildSupplierOptions } from "./manager/lib/supplierOptions";
import { groupSupplierOptions, supplierFilterMatches } from "../lib/supplierGroups";

// The queue is deliberately NOT pinned to a location: `manager_queue` treats
// location_id as an optional filter, so omitting it returns every location. It
// used to be hardcoded to "WOLA", which silently hid a second location's orders
// the moment BRACKA went live (bracka-rollout). Narrowing to one location is now
// a client-side filter in ManagerFilterBar, like the supplier one.

export function ManagerPage() {
  const { t } = useT();
  const [submitted, setSubmitted] = useState<ManagerQueueItem[] | null>(null);
  const [claimed, setClaimed] = useState<ManagerQueueItem[] | null>(null);
  const [sent, setSent] = useState<ManagerQueueItem[] | null>(null);
  const [closed, setClosed] = useState<ManagerQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Master-data suppliers for the filter (manager-queue-control, D11). null =
  // not loaded or failed; the filter then falls back to the queue's suppliers.
  const [allSuppliers, setAllSuppliers] = useState<Supplier[] | null>(null);

  // Queue filters (S-05) — ephemeral, client-side.
  const [filterSupplierId, setFilterSupplierId] = useState<string | null>(null);
  const [filterLocationId, setFilterLocationId] = useState<string | null>(null);
  const [visibleLanes, setVisibleLanes] = useState<Set<QueueLane>>(
    () => new Set<QueueLane>(["submitted", "claimed", "sent", "closed"]),
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ManagerOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Per-line draft state for the selected order (G2). Reseeded on every detail
  // load; dirty = differs from the seeded baseline.
  const [drafts, setDrafts] = useState<DraftMap>({});

  // Orderable products for the selected order, for the add-line picker
  // (add-product-to-order). Populated only for a manager_claimed order; [] for
  // every other lane. The picker filters out products already on the order.
  const [orderableForSelected, setOrderableForSelected] = useState<OrderableItem[]>([]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  // gmail/mailto compose URLs from dispatches done in THIS session, keyed by
  // order_id — lets us show a clickable "Otwórz email" link on a manager_sent
  // detail (the queue/detail endpoints don't carry the compose URL).
  const [dispatchedLinks, setDispatchedLinks] = useState<Record<string, string>>({});
  // Orders sent this session through a verified Gmail draft -> the mailbox
  // holding the draft, its link and whether the tab opened (order-email-v2,
  // supplier-email-v21). Mirrored to sessionStorage (impl-review S3) so a
  // blocked tab's "not sent yet" warning survives a reload of this tab; the
  // queue marks those orders too.
  const [draftedOrders, setDraftedOrders] = useState<Record<string, DraftedOrder>>(
    loadDraftedOrders,
  );
  useEffect(() => {
    saveDraftedOrders(draftedOrders);
  }, [draftedOrders]);
  // The manager opened the draft from the amber line (a fresh click, so the
  // browser allows it): the warning has done its job.
  const handleDraftOpened = useCallback((orderId: string): void => {
    setDraftedOrders((prev) =>
      prev[orderId] && !prev[orderId].opened
        ? { ...prev, [orderId]: { ...prev[orderId], opened: true } }
        : prev,
    );
  }, []);
  const unsentDraftIds = useMemo<Set<string>>(
    () =>
      new Set(
        Object.entries(draftedOrders)
          .filter(([, d]) => !d.opened)
          .map(([id]) => id),
      ),
    [draftedOrders],
  );
  // Order with a Gmail draft in progress (order-email-v2). While set, the page
  // refuses every other action — switching orders mid-draft used to drop the
  // dispatch silently (or build it from another order's lines).
  const [draftingId, setDraftingId] = useState<string | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // True (and says why) while a Gmail draft is being created.
  const blockedByDraft = useCallback((): boolean => {
    if (!draftingId) return false;
    showToast(t("manager.draft.pageLocked"), false);
    return true;
  }, [draftingId, showToast, t]);

  const handleDraftingChange = useCallback((orderId: string, drafting: boolean) => {
    setDraftingId((prev) => (drafting ? orderId : prev === orderId ? null : prev));
  }, []);

  const loadQueue = useCallback(() => {
    Promise.all([
      api.managerQueue(undefined, "captain_submitted"),
      // Claimed + sent at the backend's 200 clamp, not the default 50: the
      // stalled orders the D16 markers count are the OLDEST in their lane, and
      // the sent lane only drains on receipt (manager-queue-control).
      api.managerQueue(undefined, "manager_claimed", QUEUE_LANE_LIMIT),
      api.managerQueue(undefined, "manager_sent", QUEUE_LANE_LIMIT),
      api.managerQueue(undefined, "closed"),
    ])
      .then(([sub, clm, snt, cls]) => {
        setSubmitted(sub);
        setClaimed(clm);
        setSent(snt);
        setClosed(cls);
        setError(null);
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setError(e.detail);
      });
  }, []);

  // 20s auto-refresh of the queue — matched to the backend orders TTL
  // (ORDERS_TTL_SECONDS) so a newly submitted order surfaces within ~20s. A
  // slower poll would mask the shorter cache. Selection is independent state, so
  // it survives the refresh; the detail pane is reloaded separately on selection.
  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 20_000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  // Suppliers change rarely — one load per visit. "manager" role: this screen
  // holds no captain token (lessons.md). A failure only narrows the filter.
  useEffect(() => {
    let cancelled = false;
    api
      .suppliers("manager")
      .then((list) => {
        if (!cancelled) setAllSuppliers(list);
      })
      .catch(() => {
        if (!cancelled) setAllSuppliers(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tracks the most recently requested detail order id so async responses can
  // detect staleness (the user picked another order before this one resolved).
  const latestDetailRequest = useRef<string | null>(null);

  const loadDetail = useCallback(
    (orderId: string) => {
      latestDetailRequest.current = orderId;
      setDetailLoading(true);
      api
        .managerOrder(orderId)
        .then((d) => {
          if (latestDetailRequest.current !== orderId) return; // stale
          setDetail(d);
          setDrafts(seedDrafts(d)); // reseed draft baseline on every load
          // Add-product (add-product-to-order): only an editable order (claimed,
          // or sent-and-still-editable — Phase 6) can take new lines, so fetch
          // the supplier's orderable list just for those. Non-fatal — the picker
          // stays hidden if it fails.
          if (isOrderEditable(d)) {
            api
              // Full supplier list: products outside this location's list stay
              // behind the picker's one-off checkbox (manager-add-any-product).
              .managerOrderable(d.supplier_id, d.location_id, true)
              .then((orderable) => {
                if (latestDetailRequest.current !== orderId) return; // stale
                setOrderableForSelected(orderable);
              })
              .catch(() => {
                if (latestDetailRequest.current === orderId) setOrderableForSelected([]);
              });
          } else {
            setOrderableForSelected([]);
          }
        })
        .catch((e: ApiError) => {
          if (latestDetailRequest.current !== orderId) return; // stale
          if (e.status === 404) {
            setSelectedId(null);
            setDetail(null);
            setDrafts({});
            showToast(t("manager.actionError", { detail: e.detail }), false);
          } else if (e.status !== 401) {
            showToast(t("manager.actionError", { detail: e.detail }), false);
          }
        })
        .finally(() => {
          if (latestDetailRequest.current === orderId) setDetailLoading(false);
        });
    },
    [showToast, t],
  );

  // Warn before discarding unsaved dirty edits when switching orders.
  const confirmDiscardIfDirty = useCallback((): boolean => {
    if (detail && isOrderEditable(detail) && hasDirtyDrafts(drafts, detail.lines)) {
      return window.confirm(t("manager.unsavedWarning"));
    }
    return true;
  }, [detail, drafts, t]);

  const handleSelect = useCallback(
    (orderId: string) => {
      if (orderId === selectedId) return;
      if (blockedByDraft()) return;
      if (!confirmDiscardIfDirty()) return;
      setSelectedId(orderId);
      setDetail(null);
      setDrafts({});
      setOrderableForSelected([]);
      loadDetail(orderId);
    },
    [selectedId, blockedByDraft, confirmDiscardIfDirty, loadDetail],
  );

  // Browser-level guard for tab close / reload with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (detail && isOrderEditable(detail) && hasDirtyDrafts(drafts, detail.lines)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [detail, drafts]);

  const refreshAll = useCallback(
    (orderId: string) => {
      loadQueue();
      loadDetail(orderId);
    },
    [loadQueue, loadDetail],
  );

  const handleQtyChange = useCallback((orderLineId: string, qty: number) => {
    setDrafts((prev) => ({
      ...prev,
      [orderLineId]: { qty, comment: prev[orderLineId]?.comment ?? "" },
    }));
  }, []);

  const handleCommentChange = useCallback((orderLineId: string, comment: string) => {
    setDrafts((prev) => ({
      ...prev,
      [orderLineId]: { qty: prev[orderLineId]?.qty ?? 0, comment },
    }));
  }, []);

  const handleClaim = useCallback(
    async (orderId: string) => {
      if (blockedByDraft()) return;
      setBusyId(orderId);
      try {
        await api.managerClaim(orderId);
        showToast(t("manager.claimedOk"), true);
        refreshAll(orderId);
      } catch (e) {
        const detailMsg = e instanceof ApiError ? e.detail : String(e);
        showToast(t("manager.actionError", { detail: detailMsg }), false);
      } finally {
        setBusyId(null);
      }
    },
    [blockedByDraft, refreshAll, showToast, t],
  );

  const handleRelease = useCallback(
    async (orderId: string) => {
      if (blockedByDraft()) return;
      if (!confirmDiscardIfDirty()) return;
      const reason = window.prompt(t("manager.releasePrompt"));
      if (!reason || reason.trim() === "") return;
      setBusyId(orderId);
      try {
        await api.managerRelease(orderId, reason.trim());
        showToast(t("manager.releasedOk"), true);
        refreshAll(orderId);
      } catch (e) {
        const detailMsg = e instanceof ApiError ? e.detail : String(e);
        showToast(t("manager.actionError", { detail: detailMsg }), false);
      } finally {
        setBusyId(null);
      }
    },
    [blockedByDraft, confirmDiscardIfDirty, refreshAll, showToast, t],
  );

  // Cancel (soft-delete) a pre-dispatch order with a required reason trace.
  // Mirrors release; on success the order leaves the queue (status → cancelled).
  const handleCancel = useCallback(
    async (orderId: string) => {
      if (blockedByDraft()) return;
      if (!confirmDiscardIfDirty()) return;
      if (!window.confirm(t("manager.cancelConfirm"))) return;
      const reason = window.prompt(t("manager.cancelPrompt"));
      if (!reason || reason.trim() === "") return;
      setBusyId(orderId);
      try {
        await api.managerCancel(orderId, reason.trim());
        showToast(t("manager.cancelledOk"), true);
        refreshAll(orderId);
      } catch (e) {
        const detailMsg = e instanceof ApiError ? e.detail : String(e);
        showToast(t("manager.actionError", { detail: detailMsg }), false);
      } finally {
        setBusyId(null);
      }
    },
    [blockedByDraft, confirmDiscardIfDirty, refreshAll, showToast, t],
  );

  // Close a sent order with no receipt (close-without-receipt, D5): confirm,
  // then a required reason that the backend keeps as an order event.
  const handleCloseWithoutReceipt = useCallback(
    async (orderId: string) => {
      if (blockedByDraft()) return;
      if (!confirmDiscardIfDirty()) return;
      if (!window.confirm(t("manager.closeWithoutReceiptConfirm"))) return;
      const reason = window.prompt(t("manager.closeWithoutReceiptPrompt"));
      if (!reason || reason.trim() === "") return;
      setBusyId(orderId);
      try {
        await api.managerClose(orderId, reason.trim());
        showToast(t("manager.closedWithoutReceiptOk"), true);
        refreshAll(orderId);
      } catch (e) {
        const detailMsg = e instanceof ApiError ? e.detail : String(e);
        showToast(t("manager.actionError", { detail: detailMsg }), false);
      } finally {
        setBusyId(null);
      }
    },
    [blockedByDraft, confirmDiscardIfDirty, refreshAll, showToast, t],
  );

  // Save (PATCH) — full read-modify-write payload for DIRTY lines only; stays
  // manager_claimed. Empty payload is a no-op (allowed by the contract). On
  // success the detail reloads (reseeding the draft baseline → clears dirty).
  const handleSave = useCallback(
    async (orderId: string) => {
      if (!detail) return;
      if (blockedByDraft()) return;
      const finals = dirtySavePayload(drafts, detail.lines);
      if (finals.length === 0) return;
      setBusyId(orderId);
      try {
        await api.managerSave(orderId, finals);
        showToast(t("manager.saved"), true);
        refreshAll(orderId);
      } catch (e) {
        const detailMsg = e instanceof ApiError ? e.detail : String(e);
        showToast(t("manager.actionError", { detail: detailMsg }), false);
      } finally {
        setBusyId(null);
      }
    },
    [blockedByDraft, detail, drafts, refreshAll, showToast, t],
  );

  // Dispatch state-write — payload is the FULL draft line set (every line,
  // non-empty), sent_method maps 1:1 from ordering_method. For the email
  // channel the DispatchPanel already opened the (edited-body) Gmail link via a
  // clicked <a>; this just persists manager_final + status + sent_method.
  const handleDispatch = useCallback(
    async (
      orderId: string,
      sentMethod: OrderingMethod,
      signerEmail?: string | null,
      opts?: DispatchOpts,
    ) => {
      // The draft path calls this after an await, through the closure captured
      // at click time — so `detail`/`drafts` are the clicked order's. Anything
      // else (another order loaded, an action already in flight) is refused;
      // with a draft already in Gmail that must be said, never dropped silently.
      if (!detail || detail.order_id !== orderId || busyId) {
        if (opts?.draftMailbox) {
          showToast(
            t("manager.draft.dispatchFailed", {
              mailbox: opts.draftMailbox,
              detail: t("manager.draft.orderChanged"),
            }),
            false,
          );
        }
        return;
      }
      const manager_finals = dispatchPayload(drafts, detail.lines);
      setBusyId(orderId);
      try {
        const resp = await api.managerDispatch({
          order_id: orderId,
          manager_finals,
          sent_method: sentMethod,
          // The chosen signer, so the server re-open URL signs identically.
          signer_email: sentMethod === "email" ? signerEmail ?? null : null,
        });
        // Non-email channels have no email artifact — "marked as ordered" is
        // the accurate confirmation there; email keeps the dispatched copy.
        if (opts?.draftMailbox) {
          showToast(t("manager.draft.done", { mailbox: opts.draftMailbox }), true);
          const mailbox = opts.draftMailbox;
          const url = opts.draftUrl || gmailDraftsUrl(mailbox);
          // Open THAT draft only now — the order is marked sent, so the manager
          // never holds an open draft the app did not record (WP3). A blocked
          // tab leaves the amber "not sent yet" line with the link.
          const opened = openDraftTab(url);
          setDraftedOrders((prev) => ({ ...prev, [orderId]: { mailbox, url, opened } }));
        } else {
          showToast(
            t(sentMethod === "email" ? "manager.dispatchedOk" : "manager.markedOrdered"),
            true,
          );
        }
        // Keep any server-built compose URL so "Otwórz email" works on the sent
        // detail (email channel only; null for portal/phone/manual). A Filber
        // "zamówione (bez e-maila)" is sent as "manual" on an e-mail supplier:
        // the backend still builds a URL, but no e-mail went out, so no link.
        if (resp.gmail_compose_url && sentMethod === "email") {
          setDispatchedLinks((prev) => ({ ...prev, [orderId]: resp.gmail_compose_url! }));
        }
        refreshAll(orderId);
      } catch (e) {
        const detailMsg = e instanceof ApiError ? e.detail : String(e);
        // A verified draft already exists — say so, it is unsent and harmless.
        showToast(
          opts?.draftMailbox
            ? t("manager.draft.dispatchFailed", { mailbox: opts.draftMailbox, detail: detailMsg })
            : t("manager.actionError", { detail: detailMsg }),
          false,
        );
      } finally {
        setBusyId(null);
      }
    },
    [busyId, detail, drafts, refreshAll, showToast, t],
  );

  // Add one ad-hoc product line to the claimed order (add-product-to-order). The
  // line is persisted server-side at qty 0; we then re-fetch the detail and MERGE
  // the new line into the draft map (NOT seedDrafts — that would wipe the
  // manager's other unsaved edits). The Manager sets the qty via the existing
  // save/dispatch flow afterwards.
  const handleAddLine = useCallback(
    async (
      orderId: string,
      productId: string,
      supplierProductId: string,
      allowUnconfigured = false,
    ) => {
      if (blockedByDraft()) return;
      setBusyId(orderId);
      try {
        const resp = await api.managerAddLine(
          orderId,
          productId,
          supplierProductId,
          allowUnconfigured,
        );
        const newDetail = await api.managerOrder(orderId);
        if (latestDetailRequest.current !== orderId) return; // user moved on
        setDetail(newDetail);
        setDrafts((prev) => ({
          ...prev,
          [resp.order_line_id]: { qty: 0, comment: "" },
        }));
        showToast(t("manager.addLineOk"), true);
      } catch (e) {
        const detailMsg = e instanceof ApiError ? e.detail : String(e);
        showToast(t("manager.actionError", { detail: detailMsg }), false);
      } finally {
        setBusyId(null);
      }
    },
    [blockedByDraft, showToast, t],
  );

  // Products that can still be added to the selected order: the supplier's
  // orderable list minus what's already on the order (add-product-to-order).
  const availableToAdd = useMemo<OrderableItem[]>(() => {
    if (!detail) return [];
    const present = new Set(detail.lines.map((l) => l.product_id));
    return orderableForSelected.filter((o) => !present.has(o.product_id));
  }, [detail, orderableForSelected]);

  // Queue filters (S-05): the supplier options are every active ordering
  // supplier plus any supplier with orders in the queue (D11 — Spec Food had no
  // orders, so a queue-only list never showed it); the lanes toggle which
  // groups render. Both ephemeral. effectiveSupplierId resolves at render so a
  // supplier that drops out of the options after a refresh falls back to "all"
  // — no setState-in-effect.
  // Pago and Magazyn Mory show as one option (D4, lib/supplierGroups.ts).
  const supplierOptions = useMemo(
    () =>
      groupSupplierOptions(buildSupplierOptions(allSuppliers, [submitted, claimed, sent, closed]), t),
    [allSuppliers, submitted, claimed, sent, closed, t],
  );

  // Location options (bracka-rollout). Derived from all FOUR lanes, unlike the
  // supplier options above: a location whose only orders are already closed
  // would otherwise be missing from the filter even though its tiles render in
  // the (default-visible) closed lane. The label is the joined location_name
  // (F4) — the queue item now carries it, mirroring supplier_name below.
  const locationOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const arr of [submitted, claimed, sent, closed]) {
      for (const q of arr ?? []) byId.set(q.location_id, q.location_name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [submitted, claimed, sent, closed]);

  const effectiveSupplierId =
    filterSupplierId && supplierOptions.some((o) => o.id === filterSupplierId)
      ? filterSupplierId
      : null;

  // Same resolve-at-render guard as the supplier filter: a location that drops
  // out of the queue after a refresh falls back to "all" without setState.
  const effectiveLocationId =
    filterLocationId && locationOptions.some((o) => o.id === filterLocationId)
      ? filterLocationId
      : null;

  const filterQueue = (arr: ManagerQueueItem[] | null) => {
    if (arr === null) return null;
    let out = arr;
    if (effectiveSupplierId) {
      const sel = effectiveSupplierId;
      out = out.filter((q) => supplierFilterMatches(sel, q.supplier_id));
    }
    if (effectiveLocationId) out = out.filter((q) => q.location_id === effectiveLocationId);
    return out;
  };

  const anyFilterActive =
    effectiveSupplierId !== null || effectiveLocationId !== null || visibleLanes.size < 4;

  const handleToggleLane = useCallback((lane: QueueLane) => {
    setVisibleLanes((prev) => {
      const next = new Set(prev);
      if (next.has(lane)) next.delete(lane);
      else next.add(lane);
      return next;
    });
  }, []);

  // Reset to the SAME four-lane set the initial state and `anyFilterActive`
  // (`size < 4`) use — the old three-lane reset left "clear" permanently
  // active and hid the closed lane (Phase 5 reconciliation).
  const handleClearFilters = useCallback(() => {
    setFilterSupplierId(null);
    setFilterLocationId(null);
    setVisibleLanes(new Set<QueueLane>(["submitted", "claimed", "sent", "closed"]));
  }, []);

  // cutoff_iso is only on the queue item, not on ManagerOrderDetail — look it
  // up from whichever group holds the selected order.
  const selectedCutoffIso = selectedId
    ? [submitted, claimed, sent]
        .flatMap((g) => g ?? [])
        .find((q) => q.order_id === selectedId)?.cutoff_iso ?? null
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {toast && (
        <div
          role={toast.ok ? "status" : "alert"}
          className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border px-4 py-2 text-sm font-medium shadow-lg ${
            toast.ok
              ? "border-green-300 bg-green-50 text-green-900"
              : "border-red-400 bg-red-50 text-red-900"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <AppHeader>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <h1 className="text-base font-semibold">PITA BROS — Manager Dispatch</h1>
          <div className="flex items-center gap-3">
            <Link
              to="/manager/inventory"
              className="rounded border border-blue-300 px-2 py-1 text-xs hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t("manager.inventory.navLink")}
            </Link>
            <Link
              to="/manager/suggestion-review"
              className="rounded border border-blue-300 px-2 py-1 text-xs hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t("manager.review.navLink")}
            </Link>
            <Link
              to="/manager/transport"
              className="rounded border border-blue-300 px-2 py-1 text-xs hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t("manager.transport.navLink")}
            </Link>
            <Link
              to="/manager/finance"
              className="rounded border border-blue-300 px-2 py-1 text-xs hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t("manager.finance.navLink")}
            </Link>
            <Link
              to="/manager/archive"
              className="rounded border border-blue-300 px-2 py-1 text-xs hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t("manager.archive.navLink")}
            </Link>
            <button
              type="button"
              onClick={loadQueue}
              className="rounded border border-blue-300 px-2 py-1 text-xs hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t("manager.refresh")}
            </button>
            <button
              type="button"
              onClick={() => {
                clearToken("manager");
                location.reload();
              }}
              className="rounded text-xs underline opacity-80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t("manager.logout")}
            </button>
          </div>
        </div>
      </AppHeader>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {error && (
          <div className="mb-4 rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <div className="font-semibold">{t("manager.error")}</div>
            <div className="mt-1">{error}</div>
            <button
              type="button"
              onClick={loadQueue}
              className="mt-2 rounded border border-red-400 bg-white px-2 py-1 text-xs hover:bg-red-100"
            >
              {t("manager.tryAgain")}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full lg:w-[360px] lg:shrink-0">
            <ManagerFilterBar
              locationOptions={locationOptions}
              selectedLocationId={effectiveLocationId}
              onLocationChange={setFilterLocationId}
              supplierOptions={supplierOptions}
              selectedSupplierId={effectiveSupplierId}
              onSupplierChange={setFilterSupplierId}
              visibleLanes={visibleLanes}
              onToggleLane={handleToggleLane}
              onClear={handleClearFilters}
              anyActive={anyFilterActive}
            />
            <ManagerQueue
              submitted={filterQueue(submitted)}
              claimed={filterQueue(claimed)}
              sent={filterQueue(sent)}
              closed={filterQueue(closed)}
              selectedId={selectedId}
              onSelect={handleSelect}
              visibleLanes={visibleLanes}
              unsentDraftIds={unsentDraftIds}
            />
          </div>
          <div className="min-w-0 flex-1">
            <OrderDetailPane
              selectedId={selectedId}
              detail={detail}
              loading={detailLoading}
              busyId={busyId}
              draftingId={draftingId}
              cutoffIso={selectedCutoffIso}
              dispatchedEmailUrl={selectedId ? dispatchedLinks[selectedId] ?? null : null}
              drafted={selectedId ? draftedOrders[selectedId] ?? null : null}
              onDraftOpened={handleDraftOpened}
              drafts={drafts}
              availableToAdd={availableToAdd}
              onAddLine={handleAddLine}
              onClaim={handleClaim}
              onRelease={handleRelease}
              onCancel={handleCancel}
              onCloseWithoutReceipt={handleCloseWithoutReceipt}
              onSave={handleSave}
              onDispatch={handleDispatch}
              onQtyChange={handleQtyChange}
              onCommentChange={handleCommentChange}
              onToast={showToast}
              onDraftingChange={handleDraftingChange}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
