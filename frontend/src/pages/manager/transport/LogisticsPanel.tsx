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

import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

import { useT } from "../../../i18n";
import type { TransportBatchDetail, TransportBatchPatchRequest } from "../../../types";
import { buildLogisticsOptions } from "../lib/transport";

interface LogisticsPanelProps {
  detail: TransportBatchDetail;
  driverSuggestions: string[];
  vehicleSuggestions: string[];
  // Operator-configured driver/vehicle dictionaries (parsed from the
  // draft-config `_meta` lists — see TransportPage), merged with
  // driverSuggestions/vehicleSuggestions below to build each dropdown's
  // option list.
  driverOptions: string[];
  vehicleOptions: string[];
  busy: boolean;
  onSave: (patch: TransportBatchPatchRequest) => void;
}

/** Sentinel select value for the "Inny — wpisz ręcznie…" escape hatch. Never
 * a real driver/vehicle name (the leading NUL-like marker keeps it from ever
 * colliding with an operator-entered value). */
const OTHER_VALUE = "__other__";

type FieldMode = "select" | "manual";

interface LogisticsFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  configured: string[];
  suggestions: string[];
  emptyLabel: string;
  otherLabel: string;
  backLabel: string;
}

/** One driver/vehicle field: a real `<select>` seeded from the operator's
 * configured dictionary + historical suggestions + the field's current saved
 * value, with a manual free-text escape hatch ("Inny — wpisz ręcznie…") for
 * a name not on any list. Falls back to a plain text input (today's
 * pre-dropdown behavior) when there is no configured dictionary AND no
 * historical suggestion to offer — a select with only "Inny" would be worse
 * than a text box.
 */
function LogisticsField({
  id,
  label,
  value,
  onChange,
  configured,
  suggestions,
  emptyLabel,
  otherLabel,
  backLabel,
}: LogisticsFieldProps) {
  const options = useMemo(
    () => buildLogisticsOptions(configured, suggestions, value || null),
    // Only recompute from the INITIAL value — the list must not reshuffle as
    // the operator types in manual mode or picks a different select option.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [configured, suggestions],
  );

  const hasNoOptions = configured.length === 0 && suggestions.length === 0;
  const [mode, setMode] = useState<FieldMode>(() =>
    hasNoOptions || (value !== "" && !options.includes(value)) ? "manual" : "select",
  );

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (hasNoOptions || mode === "manual") {
    return (
      <div>
        <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id={id}
            type="text"
            autoFocus={!hasNoOptions}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
          {!hasNoOptions && (
            <button
              type="button"
              onClick={() => setMode("select")}
              aria-label={backLabel}
              title={backLabel}
              className="shrink-0 rounded-lg border border-gray-300 bg-white p-2 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          if (e.target.value === OTHER_VALUE) {
            setMode("manual");
            return;
          }
          onChange(e.target.value);
        }}
        className={inputClass}
      >
        <option value="">{emptyLabel}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        <option value={OTHER_VALUE}>{otherLabel}</option>
      </select>
    </div>
  );
}

export function LogisticsPanel({
  detail,
  driverSuggestions,
  vehicleSuggestions,
  driverOptions,
  vehicleOptions,
  busy,
  onSave,
}: LogisticsPanelProps) {
  const { t } = useT();
  const [name, setName] = useState(detail.name ?? "");
  const [driver, setDriver] = useState(detail.driver ?? "");
  const [vehicle, setVehicle] = useState(detail.vehicle ?? "");
  const [pickupDate, setPickupDate] = useState(detail.pickup_date ?? "");
  const [pickupTime, setPickupTime] = useState(detail.pickup_time ?? "");
  const [limitKg, setLimitKg] = useState(detail.limit_kg != null ? String(detail.limit_kg) : "");
  const [notes, setNotes] = useState(detail.notes ?? "");

  const dirty =
    name !== (detail.name ?? "") ||
    driver !== (detail.driver ?? "") ||
    vehicle !== (detail.vehicle ?? "") ||
    pickupDate !== (detail.pickup_date ?? "") ||
    pickupTime !== (detail.pickup_time ?? "") ||
    limitKg !== (detail.limit_kg != null ? String(detail.limit_kg) : "") ||
    notes !== (detail.notes ?? "");

  const handleSave = () => {
    const parsedLimit = limitKg.trim() === "" ? null : Number(limitKg.replace(",", "."));
    onSave({
      // Blank -> omit the field entirely (undefined), not null: a batch
      // never given a name should keep falling back to
      // transportDisplayLabel's "Transport {supplier} · {date}" default
      // rather than being explicitly set to an empty string.
      name: name.trim() === "" ? undefined : name.trim(),
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
        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="trn-name" className="block text-xs font-semibold text-slate-600 mb-1">
            {t("manager.transport.logistics.nameLabel")}
          </label>
          <input
            id="trn-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <LogisticsField
          id="trn-driver"
          label={t("manager.transport.logistics.driverLabel")}
          value={driver}
          onChange={setDriver}
          configured={driverOptions}
          suggestions={driverSuggestions}
          emptyLabel={t("manager.transport.logistics.emptyOption")}
          otherLabel={t("manager.transport.logistics.otherOption")}
          backLabel={t("manager.transport.logistics.backToList")}
        />

        <LogisticsField
          id="trn-vehicle"
          label={t("manager.transport.logistics.vehicleLabel")}
          value={vehicle}
          onChange={setVehicle}
          configured={vehicleOptions}
          suggestions={vehicleSuggestions}
          emptyLabel={t("manager.transport.logistics.emptyOption")}
          otherLabel={t("manager.transport.logistics.otherOption")}
          backLabel={t("manager.transport.logistics.backToList")}
        />

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
