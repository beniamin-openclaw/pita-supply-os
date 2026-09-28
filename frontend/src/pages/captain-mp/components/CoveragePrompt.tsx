// Thursday coverage prompt (delivery-calendar). Informational only: the choice
// is stored on the order for the Manager and never changes the suggestion math
// or blocks submit. Shown only when the proposal says `coverage_prompt`.

import { CalendarRange } from "lucide-react";
import { useT } from "../../../i18n";

export type CoverageDays = 1 | 3;

interface CoveragePromptProps {
  value: CoverageDays | null;
  onChange: (value: CoverageDays) => void;
}

export function CoveragePrompt({ value, onChange }: CoveragePromptProps) {
  const { t } = useT();
  const options: { days: CoverageDays; label: string }[] = [
    { days: 1, label: t("coverage.oneDay") },
    { days: 3, label: t("coverage.threeDays") },
  ];

  return (
    <section
      aria-label={t("coverage.question")}
      className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm"
    >
      <div className="flex items-start gap-2 text-sky-900 font-semibold">
        <CalendarRange size={16} aria-hidden="true" className="shrink-0 mt-0.5" />
        <span>{t("coverage.reminder")}</span>
      </div>
      <div className="mt-1 text-xs text-sky-900/80">{t("coverage.question")}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(({ days, label }) => {
          const selected = value === days;
          return (
            <button
              key={days}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(days)}
              className={`px-3 py-2 rounded-md border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                selected
                  ? "bg-sky-700 border-sky-700 text-white"
                  : "bg-white border-sky-300 text-sky-900"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {value === 3 && (
        <div className="mt-2 text-xs font-semibold text-sky-900">
          {t("coverage.weekendCheck")}
        </div>
      )}
    </section>
  );
}
