import { useEffect, useRef, useState } from "react";
import { apiGetBlob, wasteRequest } from "../../../apiClient";
import { getToken, type Role } from "../../../auth";
import { useT } from "../../../i18n";
import type { StringKey } from "../../../i18n/strings";
import type { Location } from "../../../types";
import { todayWarsaw, wasteErrorKey, type WasteLine, type WasteList, type WasteReport } from "../lib/wasteReport";

export function WasteHistory({ role, token, refresh, initialDate }: { role: Role; token: string | null; refresh: number; initialDate?: string }) {
  const { t, lang } = useT();
  const [from, setFrom] = useState(() => initialDate || todayWarsaw());
  const [to, setTo] = useState(() => initialDate || todayWarsaw());
  const [location, setLocation] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [data, setData] = useState<WasteList | null>(null);
  const [error, setError] = useState("");
  const [voidTarget, setVoidTarget] = useState<{ report: WasteReport; line: WasteLine } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const mutationPending = useRef(false);
  const params = () => { const q = new URLSearchParams({ date_from: from, date_to: to }); if (location && role === "manager") q.set("location_id", location); return q; };
  async function load(cursor?: string) {
    const id = ++generation.current;
    const q = params(); if (cursor) q.set("cursor", cursor);
    try {
      const next = await wasteRequest<WasteList>(`/api/${role}/waste/reports?${q}`, role, token);
      if (id !== generation.current || getToken(role) !== token) return;
      setData((old) => cursor && old ? { ...next, reports: [...old.reports, ...next.reports] } : next);
      setError("");
    } catch (e) {
      if (id === generation.current && getToken(role) === token) setError(t(wasteErrorKey(e)));
    }
  }
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => { clearTimeout(timer); generation.current++; }; /* filters load on explicit button */ }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (role === "manager") wasteRequest<Location[]>("/api/locations", role, token).then((v) => { if (getToken(role) === token) setLocations(v); }).catch(() => {}); }, [role, token]);
  async function doVoid() {
    if (!voidTarget || !reason.trim() || reason.length > 500 || mutationPending.current) return;
    mutationPending.current = true;
    setBusy(true);
    try {
      await wasteRequest(`/api/${role}/waste/reports/${encodeURIComponent(voidTarget.report.report_id)}/lines/${encodeURIComponent(voidTarget.line.line_id)}/void`, role, token, { reason: reason.trim() });
      if (getToken(role) !== token) return;
      setVoidTarget(null); setReason(""); await load();
    } catch (e) { setError(t(wasteErrorKey(e))); } finally { mutationPending.current = false; setBusy(false); }
  }
  async function exportCsv() {
    try {
      const blob = await apiGetBlob(`/api/manager/waste/export?${params()}`, "manager", token);
      if (getToken(role) !== token) return;
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "waste.csv"; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(t(wasteErrorKey(e))); }
  }
  return <section className="mt-8 space-y-3" aria-label={t("waste.history")}>
    <h2 className="text-lg font-semibold">{t("waste.history")}</h2>
    <div className="flex flex-wrap gap-2 items-end">
      <label>{t("waste.from")}<input className="block border rounded p-2" type="date" value={from} onChange={e => { generation.current++; setData(null); setVoidTarget(null); setReason(""); setFrom(e.target.value); }} /></label>
      <label>{t("waste.to")}<input className="block border rounded p-2" type="date" value={to} onChange={e => { generation.current++; setData(null); setVoidTarget(null); setReason(""); setTo(e.target.value); }} /></label>
      {role === "manager" && <label>{t("waste.location")}<select className="block border rounded p-2" value={location} onChange={e => { generation.current++; setData(null); setVoidTarget(null); setReason(""); setLocation(e.target.value); }}><option value="">{t("waste.allLocations")}</option>{locations.map(l => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}</select></label>}
      <button className="border rounded p-2" onClick={() => void load()}>{t("waste.load")}</button>
      {role === "manager" && <button className="border rounded p-2" onClick={() => void exportCsv()}>{t("waste.export")}</button>}
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {data && <><h3 className="font-semibold">{t("waste.totals")}</h3><ul>{data.totals.map((v, i) => <li key={i}>{role === "manager" && `${v.location_id}: `}{v.description || (lang === "pl" ? v.name_pl : v.name_en)} — {v.quantity} {v.unit}</li>)}</ul>
      {data.reports.length === 0 && <p>{t("waste.empty")}</p>}
      {data.reports.map(report => <article key={report.report_id} className="rounded border bg-white p-3"><h3 className="font-semibold">{report.business_date} {role === "manager" && report.location_id}</h3><ul>{report.lines.map(line => <li key={line.line_id} className="py-1">{line.description || (lang === "pl" ? line.name_pl : line.name_en)} — {line.quantity} {line.unit}; {t(`waste.${line.reason}` as StringKey)} {line.reason_detail || ""} {line.voided_at ? <span className="text-red-700">{t("waste.voided")}: {line.void_reason} ({line.void_role}, {line.voided_at})</span> : <button className="underline text-red-700" onClick={() => { setVoidTarget({ report, line }); setReason(""); }}>{t("waste.void")}</button>}</li>)}</ul></article>)}
      {data.next_cursor && <button className="border rounded p-2" onClick={() => void load(data.next_cursor!)}>{t("waste.more")}</button>}</>}
    {voidTarget && <div className="rounded border border-red-300 p-3"><p>{voidTarget.report.business_date} · {voidTarget.report.location_id} · {voidTarget.line.description || (lang === "pl" ? voidTarget.line.name_pl : voidTarget.line.name_en)} · {voidTarget.line.quantity} {voidTarget.line.unit}</p><label>{t("waste.voidReason")}<input className="block border rounded p-2 w-full" maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label><button className="border rounded p-2 mt-2" disabled={busy || !reason.trim()} onClick={() => void doVoid()}>{t("waste.confirmVoid")}</button></div>}
  </section>;
}
