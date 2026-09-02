// "Overrule all" reason control (Phase 1a). Renders as a sibling section of
// PrefillControl — same visual/structural idiom (a bordered card above the
// order-line list) — but applies a Captain-picked reason across the whole
// order instead of pre-filling stock from a count.
//
// Behaviour: the Captain picks ONE reason, then Apply sets it on every line
// that currently requires a reason and doesn't have one yet. A line where a
// reason was already picked is never touched — there is deliberately no
// "overwrite all" mode (mirrors the fill-empties-only PrefillControl action,
// not its destructive overwrite/clear ones). The actual line-selection logic
// lives in the pure, unit-tested `overruleAll` (lib/overruleAll.ts); this
// component only collects the reason + comment and calls `onApply`.
//
// OTHER requires a comment (mirrors ReasonPicker.tsx:32-33) — Apply stays
// disabled until one is typed, so a batch action can never produce an
// incomplete OTHER reason.
//
// COLLAPSED BY DEFAULT (operator feedback, 2026-09-02): this is an occasional
// shortcut, not part of the normal ordering rhythm, so it sits as a one-line
// disclosure above the product list and only opens when asked for. Expanded it
// would push the first product card down the screen on every single order.

import { useState } from "react";
import type { ReasonCode } from "../types";
import { REASON_CODES } from "../types";
import { useT } from "../../../i18n";
import type { StringKey } from "../../../i18n/strings";

interface OverruleAllControlProps {
  onApply: (reason: ReasonCode, comment: string) => void;
}

function reasonLabelKey(code: ReasonCode): StringKey {
  return `reason.codes.${code}` as StringKey;
}

export function OverruleAllControl({ onApply }: OverruleAllControlProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReasonCode | "">("");
  const [comment, setComment] = useState("");

  const showComment = reason === "OTHER";
  const commentMissing = showComment && comment.trim().length === 0;
  const applyDisabled = reason === "" || commentMissing;

  const handleApply = () => {
    // Narrow `reason` directly (rather than branching on `applyDisabled`,
    // which TS's control-flow analysis already treats as encoding this same
    // `reason === ""` check — re-testing it there trips a "no overlap" error).
    if (reason === "") return;
    if (reason === "OTHER" && comment.trim().length === 0) return;
    onApply(reason, comment);
    // Reset AND re-collapse so the control never implies a standing selection
    // is still "armed", and the product list springs back into view.
    setReason("");
    setComment("");
    setOpen(false);
  };

  return (
    <section
      className="mb-4 rounded-xl border border-violet-300 bg-violet-50"
      aria-label={t("captain.overruleAllTitle")}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="overrule-all-body"
        className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <span>{t("captain.overruleAllTitle")}</span>
        <span aria-hidden="true" className="text-xs text-violet-700">
          {open ? "▾" : "▸"}
        </span>
      </button>

      {!open ? null : (
      <div id="overrule-all-body" className="px-3 pb-3">
      <p className="text-xs text-violet-800 mb-2">{t("captain.overruleAllHint")}</p>

      <label htmlFor="overrule-all-reason" className="sr-only">
        {t("reason.label")}
      </label>
      <select
        id="overrule-all-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value as ReasonCode | "")}
        className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-2"
      >
        <option value="" disabled>
          {t("reason.placeholder")}
        </option>
        {REASON_CODES.map((code) => (
          <option key={code} value={code}>
            {t(reasonLabelKey(code))}
          </option>
        ))}
      </select>

      {showComment && (
        <div className="mb-2">
          <label htmlFor="overrule-all-comment" className="sr-only">
            {t("reason.commentRequiredLabel")}
          </label>
          <textarea
            id="overrule-all-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("reason.commentPlaceholder")}
            rows={2}
            required
            aria-invalid={commentMissing}
            className={`w-full px-3 py-2 bg-white border rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 resize-none ${
              commentMissing ? "border-red-500" : "border-gray-300"
            }`}
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleApply}
        disabled={applyDisabled}
        className="w-full px-3 py-2.5 rounded-lg bg-violet-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
      >
        {t("captain.overruleAllApply")}
      </button>
      </div>
      )}
    </section>
  );
}
