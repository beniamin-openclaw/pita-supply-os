// Manager order archive (week2-feedback-quantities Phase 5). Read-only browse
// of received orders older than the live queue keeps (closed lane) plus the
// cancelled ones, which have no live lane at all. Same QueueCard rows and the
// same location/supplier filter bar as /manager; a days selector (7/14/30/60,
// finance precedent) bounds the window client-side. Detail reuses
// OrderDetailPane in its read-only branch — every action prop is a no-op
// because a closed/cancelled order never renders an action button.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { AppHeader } from "../../components/ui/AppHeader";
import { useT } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { daysSince } from "../../lib/dates";
import type { ManagerOrderDetail, ManagerQueueItem } from "../../types";
import { type LaneChip, ManagerFilterBar } from "./ManagerFilterBar";
import { QueueCard, type QueueLane } from "./ManagerQueue";
import { OrderDetailPane } from "./OrderDetailPane";

const DAYS_OPTIONS: readonly number[] = [7, 14, 30, 60];
const DEFAULT_DAYS = 30;
const ALL_LANES: readonly QueueLane[] = ["closed", "cancelled"];

const ARCHIVE_LANES: LaneChip[] = [
  { lane: "closed", labelKey: "manager.archive.lane.closed" },
  { lane: "cancelled", labelKey: "manager.archive.lane.cancelled" },
];

interface ArchiveLane {
  key: QueueLane;
  titleKey: StringKey;
  items: ManagerQueueItem[] | null;
}

/** Archive age of a row: last receipt for closed orders, submission for
 *  cancelled ones (the queue item carries no cancelled_at). */
function archiveAgeDays(item: ManagerQueueItem, now: Date): number | null {
  return daysSince(item.last_received_at ?? item.captain_submitted_at, now);
}

function noop(): void {}

// Mirrors api.managerArchiveLane's limit: the backend returns the newest N per
// lane BEFORE the client-side day window, so a full page means older rows exist.
const ARCHIVE_LIMIT = 200;

export function ManagerArchivePage(): ReactElement {
  const { t } = useT();
  const navigate = useNavigate();

  const [closed, setClosed] = useState<ManagerQueueItem[] | null>(null);
  const [cancelled, setCancelled] = useState<ManagerQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number>(DEFAULT_DAYS);

  const [filterSupplierId, setFilterSupplierId] = useState<string | null>(null);
  const [filterLocationId, setFilterLocationId] = useState<string | null>(null);
  const [visibleLanes, setVisibleLanes] = useState<Set<QueueLane>>(
    () => new Set<QueueLane>(ALL_LANES),
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ManagerOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = useCallback((msg: string, ok: boolean): void => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    let stale = false;
    Promise.all([api.managerArchiveLane("closed"), api.managerArchiveLane("cancelled")])
      .then(([cls, cnc]) => {
        if (stale) return;
        setClosed(cls);
        setCancelled(cnc);
        setError(null);
      })
      .catch((e: ApiError) => {
        if (stale) return;
        if (e.status !== 401) setError(e.detail);
      });
    return () => {
      stale = true;
    };
  }, []);

  const latestDetailRequest = useRef<string | null>(null);

  const handleSelect = useCallback(
    (orderId: string): void => {
      if (orderId === selectedId) return;
      setSelectedId(orderId);
      setDetail(null);
      latestDetailRequest.current = orderId;
      setDetailLoading(true);
      api
        .managerOrder(orderId)
        .then((d) => {
          if (latestDetailRequest.current !== orderId) return;
          setDetail(d);
        })
        .catch((e: ApiError) => {
          if (latestDetailRequest.current !== orderId) return;
          if (e.status !== 401) showToast(t("manager.actionError", { detail: e.detail }), false);
        })
        .finally(() => {
          if (latestDetailRequest.current === orderId) setDetailLoading(false);
        });
    },
    [selectedId, showToast, t],
  );

  const supplierOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const arr of [closed, cancelled]) {
      for (const q of arr ?? []) byId.set(q.supplier_id, q.supplier_name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [closed, cancelled]);

  const locationOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const arr of [closed, cancelled]) {
      for (const q of arr ?? []) byId.set(q.location_id, q.location_name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [closed, cancelled]);

  const effectiveSupplierId =
    filterSupplierId && supplierOptions.some((o) => o.id === filterSupplierId)
      ? filterSupplierId
      : null;
  const effectiveLocationId =
    filterLocationId && locationOptions.some((o) => o.id === filterLocationId)
      ? filterLocationId
      : null;

  const filterLane = (arr: ManagerQueueItem[] | null): ManagerQueueItem[] | null => {
    if (arr === null) return null;
    const now = new Date();
    let out = arr.filter((q) => {
      const age = archiveAgeDays(q, now);
      return age === null || age <= days;
    });
    if (effectiveSupplierId) out = out.filter((q) => q.supplier_id === effectiveSupplierId);
    if (effectiveLocationId) out = out.filter((q) => q.location_id === effectiveLocationId);
    return out;
  };

  const anyFilterActive =
    effectiveSupplierId !== null ||
    effectiveLocationId !== null ||
    visibleLanes.size < ALL_LANES.length;

  const handleToggleLane = useCallback((lane: QueueLane): void => {
    setVisibleLanes((prev) => {
      const next = new Set(prev);
      if (next.has(lane)) next.delete(lane);
      else next.add(lane);
      return next;
    });
  }, []);

  const handleClearFilters = useCallback((): void => {
    setFilterSupplierId(null);
    setFilterLocationId(null);
    setVisibleLanes(new Set<QueueLane>(ALL_LANES));
  }, []);

  const lanes: ArchiveLane[] = [
    { key: "closed", titleKey: "manager.archive.lane.closed", items: filterLane(closed) },
    { key: "cancelled", titleKey: "manager.archive.lane.cancelled", items: filterLane(cancelled) },
  ];
  const shownLanes = lanes.filter((l) => visibleLanes.has(l.key));

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 pb-12">
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

      <AppHeader className="sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/manager")}
            aria-label={t("manager.archive.back")}
            className="-ml-2 rounded-md p-2 transition-colors active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="text-lg font-semibold tracking-tight">{t("manager.archive.title")}</h1>
        </div>
      </AppHeader>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
        <p className="mb-3 text-xs text-slate-500">{t("manager.archive.intro")}</p>

        {error && (
          <div
            className="mb-4 rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900"
            role="alert"
          >
            <div className="font-semibold">{t("manager.error")}</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full lg:w-[360px] lg:shrink-0">
            <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
              <label
                htmlFor="mgr-archive-days"
                className="mb-1 block text-xs font-semibold text-slate-800"
              >
                {t("manager.archive.daysLabel")}
              </label>
              <select
                id="mgr-archive-days"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:text-sm"
              >
                {DAYS_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {t("manager.archive.daysOptionLabel", { n: d })}
                  </option>
                ))}
              </select>
              {((closed?.length ?? 0) >= ARCHIVE_LIMIT ||
                (cancelled?.length ?? 0) >= ARCHIVE_LIMIT) && (
                <p className="mt-2 text-xs text-slate-500">
                  {t("manager.archive.capNotice", { n: ARCHIVE_LIMIT })}
                </p>
              )}
            </div>
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
              lanes={ARCHIVE_LANES}
            />

            <div className="space-y-3">
              {shownLanes.map((lane) => {
                const count = lane.items?.length ?? 0;
                return (
                  <section
                    key={lane.key}
                    className="rounded-lg border border-slate-200 bg-white"
                  >
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {t(lane.titleKey)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 tabular-nums">
                        {count}
                      </span>
                    </div>
                    <div className="border-t border-slate-100 p-2">
                      {lane.items === null ? (
                        <p className="px-2 py-3 text-xs text-slate-400">{t("manager.loading")}</p>
                      ) : count === 0 ? (
                        <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
                          {t("manager.archive.empty")}
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {lane.items.map((q) => (
                            <QueueCard
                              key={q.order_id}
                              item={q}
                              selected={q.order_id === selectedId}
                              onSelect={handleSelect}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <OrderDetailPane
              selectedId={selectedId}
              detail={detail}
              loading={detailLoading}
              busyId={null}
              drafts={{}}
              availableToAdd={[]}
              onAddLine={noop}
              onClaim={noop}
              onRelease={noop}
              onCancel={noop}
              onSave={noop}
              onDispatch={noop}
              onQtyChange={noop}
              onCommentChange={noop}
              onToast={showToast}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
