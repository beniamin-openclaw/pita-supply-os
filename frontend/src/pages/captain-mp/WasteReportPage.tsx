import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../../auth";
import { wasteRequest, WasteRequestError } from "../../apiClient";
import { useT } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { CaptainTabs } from "./components/CaptainTabs";
import { Header } from "./components/Header";
import { WasteHistory } from "./components/WasteHistory";
import { WasteQuantityInput } from "./components/WasteQuantityInput";
import { parseWasteQuantity, type WasteUnit } from "./lib/wasteQuantity";
import { afterSaveFailure, reportMatchesPayload, todayWarsaw, wasteErrorKey, type WasteCatalogItem, type WastePayload, type WasteReport } from "./lib/wasteReport";

type Row = { product: string; description: string; quantity: string; unit: "kg" | "szt"; reason: string; detail: string };
type Draft = { date: string; rows: Row[]; batch: string; frozen: WastePayload | null };
const blank = (): Row => ({ product: "", description: "", quantity: "", unit: "kg", reason: "", detail: "" });
const fresh = (): Draft => ({ date: todayWarsaw(), rows: [blank()], batch: crypto.randomUUID(), frozen: null });

export function WasteReportPage() {
  const { t, lang } = useT();
  const translate = useRef(t);
  useEffect(() => { translate.current = t; }, [t]);
  const navigate = useNavigate();
  const [token] = useState(() => getToken("captain"));
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [catalog, setCatalog] = useState<WasteCatalogItem[]>([]);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<{ index: number; field: string } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const snapshot = useRef<string | null>(null);
  const staleRef = useRef(false);
  const [stale, setStale] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    async function init() {
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token ?? ""));
      const scopedKey = `supply_os_waste_${Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, "0")).join("")}`;
      if (!alive || getToken("captain") !== token) return;
      let value: Draft | null = null;
      try { snapshot.current = localStorage.getItem(scopedKey); value = JSON.parse(snapshot.current || "null") as Draft | null; } catch { /* leave the existing draft untouched */ }
      setKey(scopedKey); setDraft(value || fresh());
      try { const result = await wasteRequest<{ items: WasteCatalogItem[] }>("/api/captain/waste/catalog", "captain", token); if (alive && getToken("captain") === token) setCatalog(result.items); }
      catch (e) { if (alive && getToken("captain") === token) setError(translate.current(wasteErrorKey(e))); }
    }
    void init(); return () => { alive = false; };
  }, [token]);
  useEffect(() => {
    if (!key) return;
    function changed(event: StorageEvent) {
      if (event.key !== key && event.key !== null) return;
      if (localStorage.getItem(key!) !== snapshot.current) { staleRef.current = true; setStale(true); setError(t("waste.stale")); }
    }
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [key, t]);
  function currentDraft(): boolean {
    if (!key || getToken("captain") !== token) { setError(t("waste.scope")); return false; }
    try {
      if (staleRef.current || localStorage.getItem(key) !== snapshot.current) {
        staleRef.current = true; setStale(true); setError(t("waste.stale")); return false;
      }
      return true;
    } catch { setError(t("waste.error")); return false; }
  }
  function persist(next: Draft, completed?: WastePayload): boolean {
    if (!key || getToken("captain") !== token) { setError(t("waste.scope")); return false; }
    if (!currentDraft()) return false;
    try {
      if (completed) {
        const existing = JSON.parse(snapshot.current || "null") as Draft | null;
        if (!existing?.frozen || JSON.stringify(existing.frozen) !== JSON.stringify(completed)) {
          staleRef.current = true; setStale(true); setError(t("waste.stale")); return false;
        }
      }
      const raw = JSON.stringify(next); localStorage.setItem(key, raw); snapshot.current = raw; setDraft(next); return true;
    }
    catch { setError(t("waste.error")); return false; }
  }
  function patchRow(index: number, patch: Partial<Row>) {
    if (!draft || draft.frozen) return;
    setInvalidField(null);
    persist({ ...draft, rows: draft.rows.map((r, i) => i === index ? { ...r, ...patch } : r) });
  }
  function fieldProps(index: number, field: string) {
    const invalid = invalidField?.index === index && invalidField.field === field;
    return { "aria-invalid": invalid || undefined, "aria-describedby": invalid ? "waste-validation-error" : undefined };
  }
  async function save(payload: WastePayload) {
    if (!draft || pending.current) return;
    if (getToken("captain") !== token) { setError(t("waste.scope")); return; }
    if (!persist({ ...draft, frozen: payload })) return;
    pending.current = true;
    setBusy(true); setError("");
    try {
      const report = await wasteRequest<WasteReport>("/api/captain/waste/reports", "captain", token, payload);
      if (getToken("captain") !== token) return;
      if (!report?.report_id || !reportMatchesPayload(report, payload)) throw new WasteRequestError("unknown", 200, "decode");
      if (persist(fresh(), payload)) { setMessage(t("waste.saved")); setRefresh(x => x + 1); }
    } catch (e) {
      if (getToken("captain") !== token) return;
      const frozen = afterSaveFailure(payload, e, !!draft.frozen);
      if (!persist({ ...draft, batch: frozen ? draft.batch : crypto.randomUUID(), frozen })) return;
      setError(frozen ? t("waste.uncertain") : t(wasteErrorKey(e)));
    } finally { pending.current = false; setBusy(false); }
  }
  function submit() {
    if (!draft || draft.frozen || busy) return;
    const lines = draft.rows.map(row => {
      const item = catalog.find(p => p.product_id === row.product);
      const unit: WasteUnit = row.product === "__other__" ? row.unit : item?.display_unit || "szt";
      return { product_id: item?.product_id || null, description: row.product === "__other__" ? row.description.trim() : null, quantity: row.quantity.trim().replace(",", "."), unit, reason: row.reason, reason_detail: row.reason === "other" ? row.detail.trim() : null };
    });
    let invalid: { index: number; field: string } | null = !draft.date || draft.date > todayWarsaw() ? { index: -1, field: "date" } : null;
    for (let i = 0; !invalid && i < lines.length; i++) {
      const line = lines[i];
      if (!catalog.some(p => p.product_id === draft.rows[i].product) && draft.rows[i].product !== "__other__") invalid = { index: i, field: "product" };
      else if (draft.rows[i].product === "__other__" && (!line.description || line.description.length > 120)) invalid = { index: i, field: "description" };
      else if (!parseWasteQuantity(line.quantity, line.unit)) invalid = { index: i, field: "quantity" };
      else if (!["burned", "dropped", "expired", "spoiled", "other"].includes(line.reason)) invalid = { index: i, field: "reason" };
      else if (line.reason === "other" && (!line.reason_detail || line.reason_detail.length > 500)) invalid = { index: i, field: "detail" };
    }
    if (invalid || lines.length === 0 || lines.length > 100) {
      setError(t("waste.invalid"));
      setInvalidField(invalid);
      const row = invalid && invalid.index >= 0 ? document.querySelectorAll<HTMLElement>("[data-waste-row]")[invalid.index] : null;
      const target = invalid?.field === "date" ? document.querySelector<HTMLElement>("[data-waste-date]") : row?.querySelector<HTMLElement>(`[data-waste-field="${invalid?.field}"]`);
      target?.focus(); return;
    }
    void save({ batch_uuid: draft.batch, business_date: draft.date, lines });
  }
  async function readback() {
    if (!draft?.frozen || pending.current || !currentDraft()) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await wasteRequest<WasteReport>(`/api/captain/waste/reports/by-batch/${encodeURIComponent(draft.frozen.batch_uuid)}`, "captain", token);
      if (getToken("captain") !== token) return;
      if (!result?.report_id || !reportMatchesPayload(result, draft.frozen)) throw new Error();
      if (persist(fresh(), draft.frozen)) { setMessage(t("waste.saved")); setRefresh(x => x + 1); setError(""); }
    } catch { if (!staleRef.current) setError(t("waste.uncertain")); } finally { pending.current = false; setBusy(false); }
  }
  const locked = busy || stale || !!draft?.frozen;
  return <div className="min-h-screen bg-slate-50"><Header token={token || ""} locationName="" onShowOrders={() => navigate("/captain-v2/orders")} onShowInventory={() => navigate("/captain-v2/inventory-count")} /><CaptainTabs />
    <main className="mx-auto max-w-3xl p-4"><h1 className="text-xl font-semibold">{t("waste.title")}</h1>
      {error && <p id="waste-validation-error" role="alert" className="my-2 text-red-700">{error}</p>}{message && <p role="status">{message}</p>}
      {draft && <div data-waste-form className="space-y-4 mt-4"><label>{t("waste.date")}<input data-waste-date {...fieldProps(-1, "date")} className="block border rounded p-2" type="date" max={todayWarsaw()} required value={draft.date} disabled={locked} onChange={e => { setInvalidField(null); persist({ ...draft, date: e.target.value }); }} /></label>
        {draft.rows.map((row, i) => { const item = catalog.find(p => p.product_id === row.product); const unit = row.product === "__other__" ? row.unit : item?.display_unit || "szt"; return <fieldset data-waste-row key={i} className="space-y-3 rounded border bg-white p-3" disabled={locked}>
          <label>{t("waste.product")}<select data-waste-field="product" {...fieldProps(i, "product")} required className="block w-full rounded border p-2" value={row.product} onChange={e => patchRow(i, { product: e.target.value, quantity: "", description: "" })}><option value="">{t("waste.choose")}</option>{(["fridge", "freezer", "dry"] as const).map(section => <optgroup key={section} label={t(`waste.${section}`)}>{catalog.filter(p => p.section === section).map(p => <option key={p.product_id} value={p.product_id}>{lang === "pl" ? p.name_pl : p.name_en}</option>)}</optgroup>)}<option value="__other__">{t("waste.other")}</option></select></label>
          {row.product === "__other__" && <><label>{t("waste.description")}<input data-waste-field="description" {...fieldProps(i, "description")} required maxLength={120} className="block w-full border rounded p-2" value={row.description} onChange={e => patchRow(i, { description: e.target.value })} /></label><label>{t("waste.unit")}<select className="block border rounded p-2" value={row.unit} onChange={e => patchRow(i, { unit: e.target.value as "kg" | "szt", quantity: "" })}><option value="kg">kg</option><option value="szt">szt</option></select></label></>}
          <WasteQuantityInput value={row.quantity} unit={unit} additions={item?.quick_additions || []} error={invalidField?.index === i && invalidField.field === "quantity"} onChange={quantity => patchRow(i, { quantity })} />
          <label>{t("waste.reason")}<select data-waste-field="reason" {...fieldProps(i, "reason")} required className="block w-full border rounded p-2" value={row.reason} onChange={e => patchRow(i, { reason: e.target.value })}><option value="">{t("waste.choose")}</option>{["burned", "dropped", "expired", "spoiled", "other"].map(reason => <option key={reason} value={reason}>{t(`waste.${reason}` as StringKey)}</option>)}</select></label>
          {row.reason === "other" && <label>{t("waste.reasonDetail")}<input data-waste-field="detail" {...fieldProps(i, "detail")} required maxLength={500} className="block w-full border rounded p-2" value={row.detail} onChange={e => patchRow(i, { detail: e.target.value })} /></label>}
          {draft.rows.length > 1 && <button type="button" className="underline" onClick={() => persist({ ...draft, rows: draft.rows.filter((_, n) => n !== i) })}>{t("waste.remove")}</button>}
        </fieldset>; })}
        {!draft.frozen && <><button type="button" className="border rounded p-2 mr-2" disabled={busy || stale || draft.rows.length >= 100} onClick={() => persist({ ...draft, rows: [...draft.rows, blank()] })}>{t("waste.add")}</button><button type="button" className="rounded bg-blue-700 text-white p-2" disabled={busy || stale || catalog.length === 0} onClick={submit}>{t("waste.save")}</button></>}
        {draft.frozen && <><p>{t("waste.uncertain")}</p><button disabled={busy || stale} className="border rounded p-2 mr-2" onClick={() => void readback()}>{t("waste.readback")}</button><button disabled={busy || stale} className="border rounded p-2" onClick={() => void save(draft.frozen!)}>{t("waste.retry")}</button></>}
      </div>}
      {draft && <WasteHistory key={draft.date} role="captain" token={token} refresh={refresh} initialDate={draft.date} />}
    </main></div>;
}
