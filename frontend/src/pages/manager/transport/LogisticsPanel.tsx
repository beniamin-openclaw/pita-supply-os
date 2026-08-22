// Editable logistics panel for a Transport batch (v2, to-ordering-pago
// ADDENDUM v2): Kierowca / Samochód / Data odbioru / Godzina odbioru / Limit
// kg / Uwagi, saved via PATCH /api/manager/transport/batch/{id}. Allowed in
// BOTH draft and sent state (the backend allows logistics edits after send —
// design decision 6), unlike the qty matrix which is draft-only.
//
// Local form state is seeded from `detail` and reconciled by REMOUNTING this
// component on `key={detail.transport_id}` from the parent (mirrors
// DispatchPanel's `key={detail.order_id}` pattern in OrderDetailPane) rather
// than an effect that re-seeds on prop change — simpler and avoids a
// setState-in-effect footgun.

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { useT } from "../../../i18n";
import type { TransportBatchDetail, TransportBatchPatchRequest } from "../../../types";

interface LogisticsPanelProps {
  detail: TransportBatchDetail;
  driverSuggestions: string[];
  vehicleSuggestions: string[];
  busy: boolean;
  onSave: (patch: TransportBatchPatchRequest) => void;
}

export function LogisticsPanel({
  detail,
  driverSuggestions,
  vehicleSuggestions,
  busy,
  onSave,
}: LogisticsPanelProps) {
  const { t } = useT();
  const [driver, setDriver] = useState(detail.driver ?? "");
  const [vehicle, setVehicle] = useState(detail.vehicle ?? "");
  const [pickupDate, setPickupDate] = useState(detail.pickup_date ?? "");
  const [pickupTime, setPickupTime] = useState(detail.pickup_time ?? "");
  const [limitKg, setLimitKg] = useState(detail.limit_kg != null ? String(detail.limit_kg) : "");
  const [notes, setNotes] = useState(detail.notes ?? "");

  const dirty =
    driver !== (detail.driver ?? "") ||
    vehicle !== (detail.vehicle ?? "") ||
    pickupDate !== (detail.pickup_date ?? "") ||
    pickupTime !== (detail.pickup_time ?? "") ||
    limitKg !== (detail.limit_kg != null ? String(detail.limit_kg) : "") ||
    notes !== (detail.notes ?? "");

  const handleSave = () => {
    const parsedLimit = limitKg.trim() === "" ? null : Number(limitKg.replace(",", "."));
    onSave({
      driver: driver.trim() === "" ? null : driver.trim(),
      vehicle: vehicle.trim() === "" ? null : vehicle.trim(),
      pickup_date: pickupDate.trim() === "" ? null : pickupDate,
      pickup_time: pickupTime.trim() === "" ? null : pickupTime.trim(),
      limit_kg: parsedLimit != null && Number.isFinite(parsedLimit) ? parsedLimit : null,
      notes: notes,
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">
        {t("manager.transport.logistics.title")}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="trn-driver" className="block text-xs font-semibold text-slate-600 mb-1">
            {t("manager.transport.logistics.driverLabel")}
          </label>
          <input
            id="trn-driver"
            type="text"
            list="trn-driver-suggestions"
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="trn-driver-suggestions">
            {driverSuggestions.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="trn-vehicle" className="block text-xs font-semibold text-slate-600 mb-1">
            {t("manager.transport.logistics.vehicleLabel")}
          </label>
          <input
            id="trn-vehicle"
            type="text"
            list="trn-vehicle-suggestions"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="trn-vehicle-suggestions">
            {vehicleSuggestions.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="trn-pickup-date" className="block text-xs font-semibold text-slate-600 mb-1">
            {t("manager.transport.logistics.pickupDateLabel")}
          </label>
          <input
            id="trn-pickup-date"
            type="date"
            value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="trn-pickup-time" className="block text-xs font-semibold text-slate-600 mb-1">
            {t("manager.transport.logistics.pickupTimeLabel")}
          </label>
          <input
            id="trn-pickup-time"
            type="text"
            placeholder="14:00"
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="trn-limit-kg" className="block text-xs font-semibold text-slate-600 mb-1">
            {t("manager.transport.logistics.limitKgLabel")}
          </label>
          <input
            id="trn-limit-kg"
            type="text"
            inputMode="decimal"
            value={limitKg}
            onChange={(e) => setLimitKg(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="trn-notes" className="block text-xs font-semibold text-slate-600 mb-1">
            {t("manager.transport.logistics.notesLabel")}
          </label>
          <textarea
            id="trn-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {dirty && (
        <button
          type="button"
          disabled={busy}
          onClick={handleSave}
          className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {busy ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {t("manager.transport.logistics.saveBusy")}
            </span>
          ) : (
            t("manager.transport.logistics.saveButton")
          )}
        </button>
      )}
    </div>
  );
}
