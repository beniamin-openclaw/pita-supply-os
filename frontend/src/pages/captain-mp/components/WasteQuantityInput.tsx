import { useT } from "../../../i18n";
import { useState } from "react";
import { addWasteQuantity, parseWasteQuantity, type WasteUnit } from "../lib/wasteQuantity";

export function WasteQuantityInput({ value, onChange, unit, additions, disabled = false, error = false, labelContext, required = true }: { value: string; onChange: (value: string) => void; unit: WasteUnit; additions: string[]; disabled?: boolean; error?: boolean; labelContext?: string; required?: boolean }) {
  const { t } = useT();
  const [overflow, setOverflow] = useState(false);
  const invalid = value.trim() !== "" && parseWasteQuantity(value, unit) === null;
  return <div><label>{t("waste.quantity")} ({unit}){labelContext && <span className="sr-only"> — {labelContext}</span>}<input data-waste-field="quantity" required={required} pattern={unit === "g" ? "[0-9]+" : "[0-9]+([.,][0-9]{1,3})?"} className="block w-full rounded-lg border border-slate-300 px-3 py-2 min-h-11 text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" inputMode="decimal" value={value} disabled={disabled} onChange={e => { setOverflow(false); onChange(e.target.value); }} aria-invalid={invalid || error} aria-describedby={error ? "waste-validation-error" : undefined} /></label>
    <div className="flex flex-wrap gap-2 mt-2">{additions.slice(0, 3).map(amount => <button type="button" key={amount} className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 active:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" disabled={disabled || invalid} onClick={() => { const next = addWasteQuantity(value, amount, unit); if (next !== null) { setOverflow(false); onChange(next); } else setOverflow(true); }}>+{amount} {unit}</button>)}</div>
    {overflow && <p role="alert" className="text-red-700">{t("waste.quantityOverflow")}</p>}
  </div>;
}
