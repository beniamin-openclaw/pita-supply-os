// Status → chip (label + Tailwind classes) lookups for the "Faktury vs
// dostawy" finance screen. Mirrors src/i18n/categoryLabels.ts's precedent: a
// small standalone PL/EN map for a closed, backend-defined vocabulary (the
// receipt/line status enums), rather than one STRINGS entry per status —
// keeps the chip's label + color decided in exactly one place.

import type { Lang } from "../../../i18n";
import type { FinanceLineStatus, FinanceReceiptStatus } from "../../../types";

interface ChipSpec {
  pl: string;
  en: string;
  className: string;
}

// Receipt-level status (FinanceReceiptItem.status). Order matches the
// backend comment in app/models.py: no_invoice | unsure | possible_collective
// | ok | diff | confirmed | mismatch.
const RECEIPT_CHIPS: Record<FinanceReceiptStatus, ChipSpec> = {
  no_invoice: {
    pl: "Brak faktury",
    en: "No invoice",
    className: "bg-slate-100 text-slate-600",
  },
  unsure: {
    pl: "Kandydat niepewny",
    en: "Uncertain candidate",
    className: "bg-gray-100 text-gray-600",
  },
  possible_collective: {
    pl: "Faktura zbiorcza?",
    en: "Collective invoice?",
    className: "bg-blue-100 text-blue-700",
  },
  // Deliberately NOT solid green — "probably matches" is the engine's guess,
  // not a human confirmation (that's `confirmed`, below).
  ok: {
    pl: "Prawdopodobnie zgodne",
    en: "Probably matches",
    className: "bg-emerald-100 text-emerald-800",
  },
  diff: {
    pl: "Różnice",
    en: "Differences",
    className: "bg-amber-100 text-amber-800",
  },
  confirmed: {
    pl: "Zgodne ✓",
    en: "Confirmed ✓",
    className: "bg-green-600 text-white",
  },
  mismatch: {
    pl: "Niezgodność ✗",
    en: "Mismatch ✗",
    className: "bg-red-100 text-red-700",
  },
};

const FALLBACK_RECEIPT_CHIP: ChipSpec = {
  pl: "Nieznany status",
  en: "Unknown status",
  className: "bg-slate-100 text-slate-600",
};

export function receiptStatusLabel(status: string, lang: Lang): string {
  const spec = RECEIPT_CHIPS[status as FinanceReceiptStatus] ?? FALLBACK_RECEIPT_CHIP;
  return lang === "en" ? spec.en : spec.pl;
}

export function receiptStatusClass(status: string): string {
  return (RECEIPT_CHIPS[status as FinanceReceiptStatus] ?? FALLBACK_RECEIPT_CHIP).className;
}

// Line-level status (FinanceLineCompare.status): ok | ok_converted | qty_diff
// | not_on_invoice.
const LINE_CHIPS: Record<FinanceLineStatus, ChipSpec> = {
  ok: { pl: "Zgodne", en: "Match", className: "bg-green-100 text-green-700" },
  ok_converted: {
    pl: "Przeliczone",
    en: "Converted",
    className: "bg-amber-100 text-amber-800",
  },
  qty_diff: {
    pl: "Różnica ilości",
    en: "Qty difference",
    className: "bg-red-100 text-red-700",
  },
  not_on_invoice: {
    pl: "Brak na fakturze",
    en: "Not on invoice",
    className: "bg-red-100 text-red-700",
  },
};

const FALLBACK_LINE_CHIP: ChipSpec = {
  pl: "—",
  en: "—",
  className: "bg-slate-100 text-slate-600",
};

export function lineStatusLabel(status: string, lang: Lang): string {
  const spec = LINE_CHIPS[status as FinanceLineStatus] ?? FALLBACK_LINE_CHIP;
  return lang === "en" ? spec.en : spec.pl;
}

export function lineStatusClass(status: string): string {
  return (LINE_CHIPS[status as FinanceLineStatus] ?? FALLBACK_LINE_CHIP).className;
}
