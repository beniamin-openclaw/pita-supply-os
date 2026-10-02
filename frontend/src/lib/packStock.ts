// Pack stock helpers — pago-stock-packs-plus-kg. Convert a base-unit quantity
// to/from "full packs + loose base units", format the combined reading, and
// decide when a loose value looks like a pack count. Pure, no React.

import type { Lang } from "../i18n";
import { packUnitLabel } from "../i18n/packUnits";
import { formatQtyG, isPackBased } from "./packUnits";

const EPS = 1e-6;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Base qty -> whole packs + loose remainder (0 <= loose < upp, 3 dp). */
export function splitPackStock(base: number, upp: number): { packs: number; loose: number } {
  if (base <= 0) return { packs: 0, loose: base };
  let packs = Math.floor(base / upp + EPS);
  let loose = round3(base - packs * upp);
  if (loose <= 0) loose = 0; // also normalizes -0
  if (loose >= upp) {
    packs += 1;
    loose = round3(loose - upp);
  }
  return { packs, loose };
}

/** packs × upp + loose (3 dp); both blank -> blank. */
export function combinePackStock(
  packs: number | "",
  loose: number | "",
  upp: number,
): number | "" {
  if (packs === "" && loose === "") return "";
  return round3((packs || 0) * upp + (loose || 0));
}

/** Locale-formatted base quantity, up to 3 fraction digits. */
export function formatBaseQty(n: number, lang: Lang): string {
  const locale = lang === "en" ? "en-GB" : "pl-PL";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(n);
}

/** "1 blok + 5 kg", "2 bloki", "6 kg". */
export function formatPackStock(
  base: number,
  upp: number,
  packUnit: string,
  baseUnit: string,
  lang: Lang,
): string {
  const { packs, loose } = splitPackStock(base, upp);
  const parts: string[] = [];
  if (packs > 0) parts.push(`${formatBaseQty(packs, lang)} ${packUnitLabel(packs, packUnit, lang)}`);
  if (loose !== 0 || packs === 0) {
    parts.push(`${formatBaseQty(loose, lang)} ${packUnitLabel(loose, baseUnit, lang)}`);
  }
  return parts.join(" + ");
}

/** Suggested pack count when a loose value looks like it was meant as packs. */
export function suggestPackCount(args: {
  packs: number | "";
  loose: number | "";
  upp: number;
  references: Array<number | null | undefined>;
}): number | null {
  const { packs, loose, upp, references } = args;
  if (!isPackBased(upp)) return null;
  if (packs !== "" && packs !== 0) return null;
  if (typeof loose !== "number" || !(loose > 0 && loose < upp)) return null;
  if (!Number.isInteger(loose * 2)) return null;
  const refs = references.filter(
    (r): r is number => typeof r === "number" && Number.isFinite(r) && r > 0,
  );
  if (refs.length === 0) return null;
  if (Math.max(...refs) < 2 * upp) return null;
  return loose;
}

/**
 * D35 wording of a purchase quantity with a bulk pack, for the supplier e-mail
 * and the copy lists — twin of gmail_url._format_case_qty, Polish only:
 *   whole cases   -> "6 kartonów (24 paczki)"
 *   cases + loose -> "6 kartonów + 2 paczki (26 paczek)"
 *   under 1 case  -> "2 paczki" (no case part)
 * The split is `splitPackStock` (EPS 1e-6, 3-decimal loose), numbers are
 * `formatQtyG`, units are declined by `packUnitLabel`.
 */
export function formatCaseQty(
  qty: number,
  unitsPerCase: number,
  caseUnit: string,
  unit: string,
): string {
  const label = (n: number, u: string): string => (u ? packUnitLabel(n, u, "pl") : "");
  const total = `${formatQtyG(qty)} ${label(qty, unit)}`.trimEnd();
  const { packs, loose } = splitPackStock(qty, unitsPerCase);
  if (packs < 1) return total;
  let out = `${formatQtyG(packs)} ${label(packs, caseUnit)}`;
  if (loose > 0) out += ` + ${formatQtyG(loose)} ${label(loose, unit)}`.trimEnd();
  return `${out} (${total})`;
}
