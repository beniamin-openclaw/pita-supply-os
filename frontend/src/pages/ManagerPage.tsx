// Manager dispatch — two-pane shell.
//   - left pane  : ManagerQueue (3 status groups, 60s auto-refresh)
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

import { api, ApiError } from "../apiClient";
import { clearToken } from "../auth";
import { useT } from "../i18n";
import type {
  ManagerOrderDetail,
  ManagerQueueItem,
  OrderingMethod,
} from "../types";
import { ManagerFilterBar } from "./manager/ManagerFilterBar";
import { ManagerQueue, type QueueLane } from "./manager/ManagerQueue";
import { OrderDetailPane } from "./manager/OrderDetailPane";
import {
  type DraftMap,
  dirtySavePayload,
  dispatchPayload,
  hasDirtyDrafts,
  seedDrafts,
} from "./manager/lib/draftState";

const LOCATION_ID = "WOLA"; // single-location queue today (matches F3 + spec §1 non-goals)

export function ManagerPage() {
  const { t } = useT();
  const [submitted, setSubmitted] = useState<ManagerQueueItem[] | null>(null);
  const [claimed, setClaimed] = useState<ManagerQueueItem[] | null>(null);
  const [sent, setSent] = useState<ManagerQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Queue filters (S-05) — ephemeral, client-side.
  const [filterSupplierId, setFilterSupplierId] = useState<string | null>(null);
  const [visibleLanes, setVisibleLanes] = useState<Set<QueueLane>>(
    () => new Set<QueueLane>(["submitted", "claimed", "sent"]),
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ManagerOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Per-line draft state for the selected order (G2). Reseeded on every detail
  // load; dirty = differs from the seeded baseline.
  const [drafts, setDrafts] = useState<DraftMap>({});

  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  // gmail/mailto compose URLs from dispatches done in THIS session, keyed by
  // order_id — lets us show a clickable "Otwórz email" link on a manager_sent
  // detail (the queue/detail endpoints don't carry the compose URL).
  const [dispatchedLinks, setDispatchedLinks] = useState<Record<string, string>>({});

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadQueue = useCallback(() => {
    setError(null);
    Promise.all([
      api.managerQueue(LOCATION_ID, "captain_submitted"),
      api.managerQueue(LOCATION_ID, "manager_claimed"),
      api.managerQueue(LOCATION_ID, "manager_sent"),
    ])
      .then(([sub, clm, snt]) => {
        setSubmitted(sub);
        setClaimed(clm);
        setSent(snt);
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setError(e.detail);
      });
  }, []);

  // 60s auto-refresh of the queue. Selection is independent state, so it
  // survives the refresh; the detail pane is reloaded separately on selection.
  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 60_000);
    return () => clearInterval(interval);
  }, [loadQueue]);

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
    if (detail && detail.status === "manager_claimed" && hasDirtyDrafts(drafts, detail.lines)) {
      return window.confirm(t("manager.unsavedWarning"));
    }
    return true;
  }, [detail, drafts, t]);

  const handleSelect = useCallback(
    (orderId: string) => {
      if (orderId === selectedId) return;
      if (!confirmDiscardIfDirty()) return;
      setSelectedId(orderId);
      setDetail(null);
      setDrafts({});
      loadDetail(orderId);
    },
    [selectedId, confirmDiscardIfDirty, loadDetail],
  );

  // Browser-level guard for tab close / reload with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (detail && detail.status === "manager_claimed" && hasDirtyDrafts(drafts, detail.lines)) {
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
    [refreshAll, showToast, t],
  );

  const handleRelease = useCallback(
    async (orderId: string) => {
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
    [confirmDiscardIfDirty, refreshAll, showToast, t],
  );

  // Save (PATCH) — full read-modify-write payload for DIRTY lines only; stays
  // manager_claimed. Empty payload is a no-op (allowed by the contract). On
  // success the detail reloads (reseeding the draft baseline → clears dirty).
  const handleSave = useCallback(
    async (orderId: string) => {
      if (!detail) return;
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
    [detail, drafts, refreshAll, showToast, t],
  );

  // Dispatch state-write — payload is the FULL draft line set (every line,
  // non-empty), sent_method maps 1:1 from ordering_method. For the email
  // channel the DispatchPanel already opened the (edited-body) Gmail link via a
  // clicked <a>; this just persists manager_final + status + sent_method.
  const handleDispatch = useCallback(
    async (orderId: string, sentMethod: OrderingMethod) => {
      if (!detail) return;
      const manager_finals = dispatchPayload(drafts, detail.lines);
      setBusyId(orderId);
      try {
        const resp = await api.managerDispatch({
          order_id: orderId,
          manager_finals,
          sent_method: sentMethod,
        });
        showToast(t("manager.dispatchedOk"), true);
        // Keep any server-built compose URL so "Otwórz email" works on the sent
        // detail (email channel only; null for portal/phone/manual).
        if (resp.gmail_compose_url) {
          setDispatchedLinks((prev) => ({ ...prev, [orderId]: resp.gmail_compose_url! }));
        }
        refreshAll(orderId);
      } catch (e) {
        const detailMsg = e instanceof ApiError ? e.detail : String(e);
        showToast(t("manager.actionError", { detail: detailMsg }), false);
      } finally {
        setBusyId(null);
      }
    },
    [detail, drafts, refreshAll, showToast, t],
  );

  // Queue filters (S-05): supplier options derive from the loaded queue (only
  // suppliers that have orders → no dead options); the lanes toggle which groups
  // render. Both ephemeral. effectiveSupplierId resolves at render so a supplier
  // that drops out of the queue after a refresh falls back to "all" — no
  // setState-in-effect.
  const supplierOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const arr of [submitted, claimed, sent]) {
      for (const q of arr ?? []) byId.set(q.supplier_id, q.supplier_name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [submitted, claimed, sent]);

  const effectiveSupplierId =
    filterSupplierId && supplierOptions.some((o) => o.id === filterSupplierId)
      ? filterSupplierId
      : null;

  const filterBySupplier = (arr: ManagerQueueItem[] | null) =>
    arr === null
      ? null
      : effectiveSupplierId
        ? arr.filter((q) => q.supplier_id === effectiveSupplierId)
        : arr;

  const anyFilterActive = effectiveSupplierId !== null || visibleLanes.size < 3;

  const handleToggleLane = useCallback((lane: QueueLane) => {
    setVisibleLanes((prev) => {
      const next = new Set(prev);
      if (next.has(lane)) next.delete(lane);
      else next.add(lane);
      return next;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterSupplierId(null);
    setVisibleLanes(new Set<QueueLane>(["submitted", "claimed", "sent"]));
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

      <header className="bg-[#1a4480] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <h1 className="text-base font-semibold">PITA BROS — Manager Dispatch</h1>
          <div className="flex items-center gap-3">
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
      </header>

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
              supplierOptions={supplierOptions}
              selectedSupplierId={effectiveSupplierId}
              onSupplierChange={setFilterSupplierId}
              visibleLanes={visibleLanes}
              onToggleLane={handleToggleLane}
              onClear={handleClearFilters}
              anyActive={anyFilterActive}
            />
            <ManagerQueue
              submitted={filterBySupplier(submitted)}
              claimed={filterBySupplier(claimed)}
              sent={filterBySupplier(sent)}
              selectedId={selectedId}
              onSelect={handleSelect}
              visibleLanes={visibleLanes}
            />
          </div>
          <div className="min-w-0 flex-1">
            <OrderDetailPane
              selectedId={selectedId}
              detail={detail}
              loading={detailLoading}
              busyId={busyId}
              cutoffIso={selectedCutoffIso}
              dispatchedEmailUrl={selectedId ? dispatchedLinks[selectedId] ?? null : null}
              drafts={drafts}
              onClaim={handleClaim}
              onRelease={handleRelease}
              onSave={handleSave}
              onDispatch={handleDispatch}
              onQtyChange={handleQtyChange}
              onCommentChange={handleCommentChange}
              onToast={showToast}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
