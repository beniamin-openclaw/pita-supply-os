import { WasteRequestError } from "../../../apiClient";
import { parseWasteQuantity, type WasteUnit } from "./wasteQuantity";
import type { StringKey } from "../../../i18n/strings";

export interface WasteCatalogItem { product_id: string; name_pl: string; name_en: string; section: "fridge" | "freezer" | "dry"; unit: "kg" | "szt"; display_unit: "g" | "szt"; quick_additions: string[]; calibration: string }
export interface WasteInputLine { product_id: string | null; source_product_id?: string | null; description: string | null; quantity: string; unit: WasteUnit; reason: string; reason_detail: string | null }
export interface WastePayload { batch_uuid: string; business_date: string; reported_by?: string | null; lines: WasteInputLine[] }
export interface WasteLine extends WasteInputLine { line_id: string; name_pl: string; name_en: string; submitted_quantity: string; submitted_unit: WasteUnit; voided_at: string | null; void_reason: string | null; void_role: string | null }
export interface WasteReport { report_id: string; location_id: string; business_date: string; batch_uuid: string; created_at: string; reported_by?: string | null; lines: WasteLine[] }
export interface WasteTotal { location_id: string; product_id: string | null; source_product_id?: string | null; description: string | null; name_pl: string; name_en: string; quantity: string; unit: string }
export interface WasteList { reports: WasteReport[]; totals: WasteTotal[]; next_cursor: string | null }

export function afterSaveFailure(payload: WastePayload, error: unknown, previouslyUncertain = false): WastePayload | null {
  return !previouslyUncertain && error instanceof WasteRequestError && error.kind === "rejected" && error.status !== 409 ? null : payload;
}

export function reportMatchesPayload(report: WasteReport, payload: WastePayload): boolean {
  return (report.reported_by ?? null) === (payload.reported_by ?? null) && report.batch_uuid === payload.batch_uuid && report.business_date === payload.business_date && Array.isArray(report.lines) && report.lines.length === payload.lines.length && payload.lines.every((line, i) => {
    const saved = report.lines[i];
    if (!saved || typeof saved.submitted_quantity !== "string") return false;
    const submitted = line.unit === "g" && !line.source_product_id ? saved.submitted_quantity.replace(/\.0+$/, "") : saved.submitted_quantity;
    const amount = parseWasteQuantity(submitted, line.unit, !!line.source_product_id);
    return amount !== null && (saved.source_product_id ?? null) === (line.source_product_id ?? null) && saved.product_id === line.product_id && saved.description === line.description && saved.submitted_unit === line.unit && amount === parseWasteQuantity(line.quantity, line.unit, !!line.source_product_id) && saved.reason === line.reason && saved.reason_detail === line.reason_detail;
  });
}

export function wasteErrorKey(error: unknown): StringKey {
  if (error instanceof WasteRequestError) {
    if (error.kind === "scope") return "waste.scope";
    if (["waste_unavailable", "waste_conflict", "waste_not_found", "waste_invalid_date", "waste_invalid_cursor", "waste_storage_error", "waste_reporter_required", "waste_product_invalid"].includes(error.code)) return `waste.${error.code}` as StringKey;
    if (error.status === 422) return "waste.invalid";
  }
  return "waste.error";
}

export function todayWarsaw(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
