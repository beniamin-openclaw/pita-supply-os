// Pre-submit confirmation modal (Phase F5).
// Intercepts the Captain "Wyślij" button: shows an order summary and, if any
// CRITICAL product has nothing ordered, an inline (non-blocking) warning.
// The captain can always go back ("Wróć i popraw") or confirm ("Tak, wyślij" /
// "Wyślij mimo to" when the critical warning is present).
//
// Accessibility: role=dialog + aria-modal, focus moves to the dialog on open and
// is trapped inside it (Tab/Shift+Tab cycle), Escape = cancel, backdrop click =
// cancel, body scroll is locked while open, focus is restored on close, and the
// critical warning (when present) is part of aria-describedby so screen readers
// announce it. PLN is intentionally omitted (the captain screen hides money);
// the summary uses line / deviation / reason counts instead.

import { useEffect, useRef } from "react";
import { AlertTriangle, Send, X } from "lucide-react";
import { useT } from "../../../i18n";

interface ConfirmSubmitDialogProps {
  open: boolean;
  lineCount: number;
  deviationCount: number;
  reasonCount: number;
  /** Names of critical products with nothing ordered (empty/0). */
  criticalMissing: string[];
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ConfirmSubmitDialog({
  open,
  lineCount,
  deviationCount,
  reasonCount,
  criticalMissing,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: ConfirmSubmitDialogProps) {
  const { t, tPlural } = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Focus management + body-scroll lock: remember opener, focus the dialog, lock
  // the page behind it (mobile captain screen), restore both on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Defer so the node is mounted before we focus it.
    const id = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Escape closes (= cancel).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const hasCriticalWarning = criticalMissing.length > 0;

  const linesText = tPlural("sticky.summary", "lines", lineCount);
  const devsText = tPlural("sticky.summary", "deviations", deviationCount);
  const reasonsText = tPlural("sticky.summary", "reasons", reasonCount);
  const summary = `${linesText} · ${devsText} · ${reasonsText}`;

  // Focus trap: keep Tab/Shift+Tab cycling between the dialog's own buttons so a
  // keyboard / screen-reader user cannot tab into the page behind the modal.
  const onTrapKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled])",
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || active === dialogRef.current) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="presentation"
    >
      {/* Backdrop — click cancels. */}
      <div
        className="absolute inset-0 bg-slate-900/50"
        aria-hidden="true"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-submit-title"
        aria-describedby={
          hasCriticalWarning
            ? "confirm-submit-summary confirm-submit-warning"
            : "confirm-submit-summary"
        }
        tabIndex={-1}
        onKeyDown={onTrapKeyDown}
        className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-200 outline-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <h2
            id="confirm-submit-title"
            className="text-lg font-bold text-slate-900 leading-tight"
          >
            {t("confirm.title")}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("confirm.back")}
            className="shrink-0 -mr-1 -mt-1 p-1.5 rounded-lg text-slate-500 hover:bg-gray-100 active:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-2">
          <p id="confirm-submit-summary" className="text-sm text-slate-700">
            {t("confirm.summary", { summary })}
          </p>

          {hasCriticalWarning && (
            <div
              id="confirm-submit-warning"
              className="mt-4 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3"
            >
              <AlertTriangle
                size={20}
                aria-hidden="true"
                className="shrink-0 mt-0.5 text-amber-700"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-amber-900">
                  {t("confirm.criticalMissing")}
                </div>
                <div className="mt-1 text-sm text-amber-900/90 break-words">
                  {criticalMissing.join(", ")}
                </div>
                <div className="mt-2 text-sm text-amber-900">
                  {t("confirm.criticalAsk")}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 pt-3 pb-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-3 text-sm font-semibold text-slate-800 bg-gray-100 rounded-lg active:bg-gray-200 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {t("confirm.back")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              hasCriticalWarning
                ? "bg-amber-700 active:bg-amber-800 focus-visible:ring-amber-500"
                : "bg-[#1a4480] active:bg-blue-900 focus-visible:ring-blue-500"
            }`}
          >
            <Send size={16} aria-hidden="true" />
            {hasCriticalWarning ? t("confirm.sendAnyway") : t("confirm.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
