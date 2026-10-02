// A unit of measure (szt, kg, zgrzewka …) rendered bold and dark so the Captain
// can tell it from the number next to it at a glance (feedback-1001 D11/D29).
// Copy still lives in src/i18n/ — this only styles an interpolated piece.

import type { ReactNode } from "react";

import type { Lang } from "../../../i18n";
import { formatPacksParts } from "../../../lib/packUnits";

interface UnitLabelProps {
  children: ReactNode;
}

export function UnitLabel({ children }: UnitLabelProps) {
  return <span className="font-bold text-slate-900">{children}</span>;
}

interface PackQtyProps {
  n: number;
  unit: string;
  lang: Lang;
}

/** "<qty> <bold declined pack unit>" — the styled twin of `formatPacks`. */
export function PackQty({ n, unit, lang }: PackQtyProps) {
  const parts = formatPacksParts(n, unit, lang);
  return (
    <>
      {parts.qty} <UnitLabel>{parts.unit}</UnitLabel>
    </>
  );
}
