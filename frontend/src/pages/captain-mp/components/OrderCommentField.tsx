// Order-level Captain comment (training-feedback-0901 Phase 1b) — free text
// sent as `captain_note`. Its OWN field on the backend, deliberately never
// folded into `notes`: `manager_release` overwrites `notes` with the send-back
// reason and `captain_order_edit` blanks it on every save, so a comment stored
// there would be silently destroyed (hardening.md D2). Shared by the create
// screen (CaptainMP) and the edit screen (OrderEditPage).
//
// Phase 7 (week2-feedback-quantities): for a supplier with a note prompt
// (supplierPrompts.ts — Coca-Cola "crates") two small numeric inputs precede
// the textarea. `value` is ALWAYS the full stored `captain_note` (crates line
// + free text): this component parses it on render and re-serialises on every
// change, so both screens keep a single string in state and a note loaded on
// the edit screen has its crates line picked back up automatically.

import { useT } from "../../../i18n";
import {
  blankCrates,
  composeCaptainNote,
  parseCaptainNote,
  supplierNotePrompt,
  type CratesCounts,
} from "../lib/supplierPrompts";

interface OrderCommentFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Active supplier — selects the note prompt variant (if any). */
  supplierId?: string | null;
}

function parseCount(raw: string): number | "" {
  if (raw.trim() === "") return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n : "";
}

export function OrderCommentField({ value, onChange, supplierId }: OrderCommentFieldProps) {
  const { t } = useT();
  const prompt = supplierNotePrompt(supplierId);
  const parsed = parseCaptainNote(value);
  // With a crates prompt the textarea shows only the free text; without one
  // the whole note (including any legacy crates line) is plain text.
  const crates: CratesCounts = parsed.crates ?? blankCrates();
  const text = prompt === "crates" ? parsed.rest : value;

  const updateCrates = (patch: Partial<CratesCounts>): void => {
    onChange(composeCaptainNote({ ...crates, ...patch }, parsed.rest));
  };
  const updateText = (next: string): void => {
    if (prompt === "crates") {
      onChange(composeCaptainNote(parsed.crates, next));
    } else {
      onChange(next);
    }
  };

  const cratesInputClass =
    "w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="mb-4">
      {prompt === "crates" && (
        <fieldset className="mb-3">
          <legend className="block text-xs font-semibold text-slate-700 mb-1">
            {t("captain.orderComment.crates.legend")}
          </legend>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs text-slate-600">
              {t("captain.orderComment.crates.empty")}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={crates.empty}
                onChange={(e) => updateCrates({ empty: parseCount(e.target.value) })}
                className={cratesInputClass}
              />
            </label>
            <label className="flex flex-col text-xs text-slate-600">
              {t("captain.orderComment.crates.withBottles")}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={crates.withBottles}
                onChange={(e) => updateCrates({ withBottles: parseCount(e.target.value) })}
                className={cratesInputClass}
              />
            </label>
          </div>
        </fieldset>
      )}
      <label
        htmlFor="order-captain-note"
        className="block text-xs font-semibold text-slate-700 mb-1"
      >
        {t("captain.orderComment.label")}
      </label>
      <textarea
        id="order-captain-note"
        value={text}
        onChange={(e) => updateText(e.target.value)}
        placeholder={t("captain.orderComment.placeholder")}
        rows={2}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  );
}
