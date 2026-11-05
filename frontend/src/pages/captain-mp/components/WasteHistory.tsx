import { useEffect, useRef, useState } from "react";
import { apiGetBlob, wasteRequest } from "../../../apiClient";
import { getToken, type Role } from "../../../auth";
import { useT } from "../../../i18n";
import type { StringKey } from "../../../i18n/strings";
import type { Location } from "../../../types";
import { todayWarsaw, wasteErrorKey, type WasteLine, type WasteList, type WasteReport } from "../lib/wasteReport";
import { wasteDateRange, type WasteDatePreset } from "../lib/wasteDateRange";

export function WasteHistory({ role, token, refresh, initialDate }: { role: Role; token: string | null; refresh: number; initialDate?: string }) {
  const { t, lang, formatDateTime } = useT();
  const [from, setFrom] = useState(() => initialDate || todayWarsaw());
  const [to, setTo] = useState(() => initialDate || todayWarsaw());
  const [location, setLocation] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [data, setData] = useState<WasteList | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ report: WasteReport; line: WasteLine } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const filterVersion = useRef(0);
  const mutationPending = useRef(false);
  const invalidDates = !from || !to || from > to || to > todayWarsaw();
  const control = "min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50";
  const params = (): URLSearchParams => {
    const q = new URLSearchParams({date_from: from, date_to: to});
    if (location && role === "manager") q.set("location_id", location);
    return q;
  };
  function changeFilters(next: {from?: string; to?: string; location?: string}): void {
    generation.current++; filterVersion.current++;
    setData(null); setError(""); setVoidTarget(null); setReason(""); setLoading(false);
    if (next.from !== undefined) setFrom(next.from);
    if (next.to !== undefined) setTo(next.to);
    if (next.location !== undefined) setLocation(next.location);
  }
  async function load(cursor?: string): Promise<void> {
    const id = ++generation.current;
    const q = params();
    if (cursor) q.set("cursor", cursor); else setData(null);
    setLoading(true); setError("");
    try {
      const next = await wasteRequest<WasteList>(`/api/${role}/waste/reports?${q}`, role, token);
      if (id !== generation.current || getToken(role) !== token) return;
      setData(old => cursor && old ? {...next, reports: [...old.reports, ...next.reports]} : next);
    } catch (e) {
      if (id === generation.current && getToken(role) === token) setError(t(wasteErrorKey(e)));
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => { if (!invalidDates) void load(); }, 0);
    return () => { clearTimeout(timer); generation.current++; }; // eslint-disable-line react-hooks/exhaustive-deps -- Request counter invalidation, not DOM cleanup.
  }, [refresh, from, to, location]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { filterVersion.current++; }, []);
  useEffect(() => {
    if (role !== "manager") return;
    let active = true;
    wasteRequest<Location[]>("/api/locations", role, token).then(value => { if (active && getToken(role) === token) setLocations(value); }).catch(() => {});
    return () => { active = false; };
  }, [role, token]);
  async function doVoid(): Promise<void> {
    if (!voidTarget || !reason.trim() || reason.length > 500 || mutationPending.current) return;
    const version = filterVersion.current;
    mutationPending.current = true; setBusy(true);
    try {
      await wasteRequest(`/api/${role}/waste/reports/${encodeURIComponent(voidTarget.report.report_id)}/lines/${encodeURIComponent(voidTarget.line.line_id)}/void`, role, token, {reason: reason.trim()});
      if (getToken(role) !== token || version !== filterVersion.current) return;
      setVoidTarget(null); setReason(""); await load();
    } catch (e) {
      if (version === filterVersion.current) setError(t(wasteErrorKey(e)));
    } finally { mutationPending.current = false; setBusy(false); }
  }
  async function exportCsv(): Promise<void> {
    if (exporting || invalidDates) return;
    const version = filterVersion.current;
    const query = params().toString();
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 30000);
    setExporting(true); setError("");
    try {
      const blob = await apiGetBlob(`/api/${role}/waste/export?${query}`, role, token, controller.signal);
      if (getToken(role) !== token || version !== filterVersion.current) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `waste-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) {
      if (version === filterVersion.current && getToken(role) === token) setError(t(wasteErrorKey(e)));
    } finally { clearTimeout(deadline); setExporting(false); }
  }
  function preset(value: WasteDatePreset): void {
    const range = wasteDateRange(value);
    if (range.from === from && range.to === to) { setVoidTarget(null); setReason(""); void load(); }
    else changeFilters(range);
  }
  const name = (line: WasteLine): string => line.description || (lang === "pl" ? line.name_pl : line.name_en);
  return <section className="space-y-5" aria-label={t("waste.history")}>
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-4">
      <div className="flex flex-wrap gap-2" aria-label={t("waste.period")}>
        {(["today","week","month"] as const).map(value => { const range = wasteDateRange(value); return <button type="button" key={value} aria-pressed={from===range.from && to===range.to} className={`${control} font-semibold ${from===range.from && to===range.to ? "border-brand text-brand bg-blue-50" : "text-slate-600"}`} onClick={()=>preset(value)}>{t(`waste.period.${value}`)}</button>; })}
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="min-w-0 text-xs font-medium text-slate-500">{t("waste.from")}<input className={`${control} block mt-1 max-w-full`} type="date" max={todayWarsaw()} value={from} onChange={e=>changeFilters({from:e.target.value})}/></label>
        <label className="min-w-0 text-xs font-medium text-slate-500">{t("waste.to")}<input className={`${control} block mt-1 max-w-full`} type="date" max={todayWarsaw()} value={to} onChange={e=>changeFilters({to:e.target.value})}/></label>
        {role==="manager" && <label className="min-w-0 text-xs font-medium text-slate-500">{t("waste.location")}<select className={`${control} block mt-1 max-w-full`} value={location} onChange={e=>changeFilters({location:e.target.value})}><option value="">{t("waste.allLocations")}</option>{locations.map(l=><option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}</select></label>}
        <button type="button" disabled={loading || invalidDates} className={control} onClick={()=>void load()}>{t("waste.load")}</button>
        <button type="button" disabled={exporting || loading || invalidDates} className={`${control} ml-auto font-semibold text-brand`} onClick={()=>void exportCsv()}>{t(exporting ? "waste.exporting" : "waste.export")}</button>
      </div>
      {invalidDates && <p role="alert" className="text-sm text-red-700">{t("waste.waste_invalid_date")}</p>}
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading && <p role="status" className="text-sm text-slate-500">{t("waste.loading")}</p>}
    {data && <>
      <div className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-semibold text-slate-900">{t("waste.totals")}</h2><p className="mt-1 text-xs text-slate-500">{from} — {to}</p><ul className="mt-3 grid gap-2 sm:grid-cols-2">{data.totals.map((v,i)=><li className="rounded-lg bg-slate-50 px-3 py-2 text-sm tabular-nums" key={i}>{role==="manager" && `${v.location_id}: `}{v.description || (lang==="pl" ? v.name_pl : v.name_en)} — {v.quantity} {v.unit}</li>)}</ul></div>
      <div className="space-y-3"><h2 className="text-sm font-semibold text-slate-600">{t("waste.history")}</h2>
        {data.reports.length===0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">{t("waste.empty")}</p>}
        {data.reports.map(report=><article key={report.report_id} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><h3 className="bg-slate-50 px-4 py-3 font-semibold text-sm">{report.business_date} {role==="manager" && report.location_id}</h3><ul className="divide-y divide-slate-100">{report.lines.map(line=><li key={line.line_id} className="px-4 py-3 space-y-1"><div className="flex justify-between gap-3 text-sm"><span className="font-medium text-slate-900">{name(line)}</span><span className="shrink-0 tabular-nums font-semibold">{line.quantity} {line.unit}</span></div><div className="text-xs text-slate-500">{t(`waste.${line.reason}` as StringKey)}{line.reason_detail && ` · ${line.reason_detail}`}</div>{line.voided_at ? <p className="text-xs text-red-700 break-words">{t("waste.voided")}: {line.void_reason} ({t(line.void_role==="manager" ? "waste.role.manager" : "waste.role.captain")}, {formatDateTime(line.voided_at)})</p> : <button type="button" className="min-h-11 text-xs text-red-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={()=>{setVoidTarget({report,line});setReason("");}}>{t("waste.void")}</button>}</li>)}</ul></article>)}
      </div>
      {data.next_cursor && <button type="button" disabled={loading} className={`${control} w-full`} onClick={()=>void load(data.next_cursor!)}>{t("waste.more")}</button>}
    </>}
    {voidTarget && <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3"><p className="text-sm font-semibold">{voidTarget.report.business_date} · {voidTarget.report.location_id} · {name(voidTarget.line)} · {voidTarget.line.quantity} {voidTarget.line.unit}</p><label className="block text-sm">{t("waste.voidReason")}<input className={`${control} block w-full mt-1`} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="flex flex-wrap gap-2"><button type="button" className={control} disabled={busy || !reason.trim()} onClick={()=>void doVoid()}>{t("waste.confirmVoid")}</button><button type="button" className={control} disabled={busy} onClick={()=>{setVoidTarget(null);setReason("");}}>{t("waste.cancel")}</button></div></div>}
  </section>;
}
