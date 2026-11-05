import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getToken } from "../../auth";
import { wasteRequest, WasteRequestError } from "../../apiClient";
import { useT } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { CaptainTabs } from "./components/CaptainTabs";
import { Header } from "./components/Header";
import { WasteQuantityInput } from "./components/WasteQuantityInput";
import { parseWasteQuantity, type WasteUnit } from "./lib/wasteQuantity";
import { afterSaveFailure, reportMatchesPayload, todayWarsaw, wasteErrorKey, type WasteCatalogItem, type WastePayload, type WasteReport } from "./lib/wasteReport";

type Row = { product: string; description: string; quantity: string; unit: "kg" | "szt"; reason: string; detail: string };
type Draft = { date: string; rows: Row[]; batch: string; frozen: WastePayload | null };
const blank = (): Row => ({ product: "", description: "", quantity: "", unit: "kg", reason: "", detail: "" });
const fresh = (): Draft => ({ date: todayWarsaw(), rows: [], batch: crypto.randomUUID(), frozen: null });

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
  function patchRow(index: number, patch: Partial<Row>, product = "") {
    if (!draft || draft.frozen) return;
    setInvalidField(null);
    persist({ ...draft, rows: index < 0 ? [...draft.rows, {...blank(), product, ...patch}] : draft.rows.map((r, i) => i === index ? { ...r, ...patch } : r) });
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
      if (persist(fresh(), payload)) { setMessage(t("waste.saved")); }
    } catch (e) {
      if (getToken("captain") !== token) return;
      const frozen = afterSaveFailure(payload, e, !!draft.frozen);
      if (!persist({ ...draft, batch: frozen ? draft.batch : crypto.randomUUID(), frozen })) return;
      setError(frozen ? t("waste.uncertain") : t(wasteErrorKey(e)));
    } finally { pending.current = false; setBusy(false); }
  }
  function submit() {
    if (!draft || draft.frozen || busy) return;
    const selected = draft.rows.map((row, index) => ({row,index})).filter(({row}) => row.quantity.trim() || row.description.trim() || row.reason || row.detail.trim());
    const lines = selected.map(({row}) => {
      const item = catalog.find(p => p.product_id === row.product);
      const unit: WasteUnit = row.product === "__other__" ? row.unit : item?.display_unit || "szt";
      return { product_id: item?.product_id || null, description: row.product === "__other__" ? row.description.trim() : null, quantity: row.quantity.trim().replace(",", "."), unit, reason: row.reason, reason_detail: row.reason === "other" ? row.detail.trim() : null };
    });
    let invalid: { index: number; field: string } | null = !draft.date || draft.date > todayWarsaw() ? { index: -1, field: "date" } : null;
    for (let i = 0; !invalid && i < lines.length; i++) {
      const line = lines[i];
      if (!catalog.some(p => p.product_id === selected[i].row.product) && selected[i].row.product !== "__other__") invalid = { index: i, field: "product" };
      else if (selected[i].row.product === "__other__" && (!line.description || line.description.length > 120)) invalid = { index: i, field: "description" };
      else if (!parseWasteQuantity(line.quantity, line.unit)) invalid = { index: i, field: "quantity" };
      else if (!["burned", "dropped", "expired", "spoiled", "other"].includes(line.reason)) invalid = { index: i, field: "reason" };
      else if (line.reason === "other" && (!line.reason_detail || line.reason_detail.length > 500)) invalid = { index: i, field: "detail" };
    }
    if (invalid || lines.length === 0 || lines.length > 100) {
      setError(t("waste.invalid"));
      const sourceIndex = invalid && invalid.index >= 0 ? selected[invalid.index].index : -1;
      setInvalidField(invalid ? {...invalid,index:sourceIndex} : null);
      const row = document.querySelector<HTMLElement>(`[data-waste-row="${sourceIndex}"]`);
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
      if (persist(fresh(), draft.frozen)) { setMessage(t("waste.saved")); setError(""); }
    } catch { if (!staleRef.current) setError(t("waste.uncertain")); } finally { pending.current = false; setBusy(false); }
  }
  const locked = busy || stale || !!draft?.frozen;
  const selectedCount = draft?.rows.filter(row => row.quantity.trim() || row.description.trim() || row.reason || row.detail.trim()).length || 0;
  const control = "min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
  function renderRow(row: Row, index: number, item?: WasteCatalogItem, renderKey = `other-${index}`) {
    const name = item ? (lang === "pl" ? item.name_pl : item.name_en) : t("waste.other");
    const unit = row.product === "__other__" ? row.unit : item?.display_unit || "szt";
    const entered = !!(row.quantity.trim() || row.description.trim() || row.reason || row.detail.trim());
    return <fieldset key={renderKey} data-waste-row={index} aria-label={name} disabled={locked}
      className={`rounded-xl border bg-white p-3 sm:p-4 space-y-3 ${entered ? "border-blue-300 border-l-4 border-l-brand" : "border-slate-200"}`}>
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">{name}</h3>
        {entered && <button type="button" className="min-h-11 px-2 text-sm text-slate-600 underline" aria-label={`${t("waste.clear")} — ${name}`} onClick={() => persist({...draft!,rows:draft!.rows.filter((_,i)=>i!==index)})}>{t("waste.clear")}</button>}
      </div>
      {!item && <><label className="block text-sm text-slate-600">{t("waste.description")}<input data-waste-field="description" {...fieldProps(index,"description")} required maxLength={120} className={`${control} block w-full mt-1`} value={row.description} onChange={e=>patchRow(index,{description:e.target.value})}/></label>
        <label className="block text-sm text-slate-600">{t("waste.unit")}<select className={`${control} mt-1 block`} value={row.unit} onChange={e=>patchRow(index,{unit:e.target.value as "kg"|"szt",quantity:""})}><option value="kg">kg</option><option value="szt">szt</option></select></label></>}
      <WasteQuantityInput required={entered} labelContext={name} value={row.quantity} unit={unit} additions={item?.quick_additions || []} error={invalidField?.index===index && invalidField.field==="quantity"} onChange={quantity=>patchRow(index,{quantity},item?.product_id)} />
      {(entered || !item) && <label className="block text-sm text-slate-600">{t("waste.reason")}<span className="sr-only"> — {name}</span><select data-waste-field="reason" {...fieldProps(index,"reason")} required className={`${control} block w-full mt-1`} value={row.reason} onChange={e=>patchRow(index,{reason:e.target.value})}><option value="">{t("waste.choose")}</option>{["burned","dropped","expired","spoiled","other"].map(reason=><option key={reason} value={reason}>{t(`waste.${reason}` as StringKey)}</option>)}</select></label>}
      {row.reason==="other" && <label className="block text-sm text-slate-600">{t("waste.reasonDetail")}<span className="sr-only"> — {name}</span><input data-waste-field="detail" {...fieldProps(index,"detail")} required maxLength={500} className={`${control} block w-full mt-1`} value={row.detail} onChange={e=>patchRow(index,{detail:e.target.value})}/></label>}
      {!item && <button type="button" className="min-h-11 text-sm underline text-slate-600" onClick={()=>persist({...draft!,rows:draft!.rows.filter((_,i)=>i!==index)})}>{t("waste.remove")}</button>}
    </fieldset>;
  }
  return <div className="min-h-screen bg-slate-50 pb-28"><Header token={token || ""} locationName="" onShowOrders={()=>navigate("/captain-v2/orders")} onShowInventory={()=>navigate("/captain-v2/inventory-count")}/><CaptainTabs/>
    <main className="mx-auto max-w-3xl p-4">
      <div className="flex flex-wrap justify-between items-center gap-3"><h1 className="text-xl font-semibold">{t("waste.title")}</h1><Link className="min-h-11 inline-flex items-center text-sm font-semibold text-brand underline" to="/captain-v2/waste-history">{t("waste.historyLink")}</Link></div>
      <p className="mt-1 text-sm text-slate-500">{t("waste.entryHint")}</p>
      {error && <p id="waste-validation-error" role="alert" className="my-3 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}{message && <p role="status" className="my-3 rounded-lg bg-green-50 p-3 text-green-800">{message}</p>}
      {draft && <div data-waste-form className="space-y-5 mt-4">
        <label className="block text-sm font-medium text-slate-600">{t("waste.date")}<input data-waste-date {...fieldProps(-1,"date")} className={`${control} block mt-1`} type="date" max={todayWarsaw()} required value={draft.date} disabled={locked} onChange={e=>{setInvalidField(null);persist({...draft,date:e.target.value});}}/></label>
        {catalog.length===0 && !error && <p role="status" className="text-sm text-slate-500">{t("waste.loading")}</p>}
        {(["fridge","freezer","dry"] as const).map(section=><section key={section} aria-label={t(`waste.${section}`)} className="space-y-2"><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 pt-2">{t(`waste.${section}`)}</h2>{catalog.filter(item=>item.section===section).flatMap(item=>{
          const matches=draft.rows.map((row,index)=>({row,index})).filter(({row})=>row.product===item.product_id);
          return matches.length ? matches.map(({row,index}, occurrence)=>renderRow(row,index,item,`${item.product_id}-${occurrence}`)) : [renderRow({...blank(),product:item.product_id},-1,item,`${item.product_id}-0`)];
        })}</section>)}
        {draft.rows.map((row,index)=>(row.product==="__other__" || (catalog.length>0 && !catalog.some(item=>item.product_id===row.product))) && (row.product || row.quantity || row.description || row.reason || row.detail) ? renderRow(row,index) : null)}
        <button type="button" className={`${control} text-sm font-semibold text-brand w-full`} disabled={locked || draft.rows.length>=100} onClick={()=>persist({...draft,rows:[...draft.rows,{...blank(),product:"__other__"}]})}>{t("waste.add")}</button>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]"><div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-semibold text-slate-900">{t("waste.selected",{count:selectedCount})}</p><p className="text-xs text-slate-500">{t("waste.draftHint")}</p></div>
          {!draft.frozen ? <button type="button" className="min-h-11 rounded-lg bg-brand px-5 py-2 font-semibold text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500" disabled={busy || stale || catalog.length===0 || selectedCount===0} onClick={submit}>{t("waste.save")}</button> : <div className="flex flex-wrap gap-2"><button disabled={busy || stale} className={control} onClick={()=>void readback()}>{t("waste.readback")}</button><button disabled={busy || stale} className={control} onClick={()=>void save(draft.frozen!)}>{t("waste.retry")}</button></div>}
        </div>{draft.frozen && <p className="max-w-3xl mx-auto mt-2 text-xs text-amber-800">{t("waste.uncertain")}</p>}</div>
      </div>}
    </main></div>;
}
