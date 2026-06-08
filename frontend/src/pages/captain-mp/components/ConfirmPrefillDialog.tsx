// Lightweight confirm dialog for the destructive pre-fill actions (Phase 4 /
// FR-023): "Overwrite all" and "Clear all". Mirrors the InventoryCountPage
// ConfirmApproveDialog pattern (Escape + backdrop cancel, mobile bottom-sheet),
// but generic over title/body/labels so both destructive actions reuse it.
// NOT ConfirmSubmitDialog — that one is hardwired to order-submit counts.

import { useEffect } from "react";

interface ConfirmPrefillDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmPrefillDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmPrefillDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-slate-900/50"
        aria-hidden="true"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prefill-confirm-title"
        aria-describedby="prefill-confirm-body"
        className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-200 outline-none"
      >
        <div className="px-5 pt-5 pb-3">
          <h2
            id="prefill-confirm-title"
            className="text-lg font-bold text-slate-900 leading-tight"
          >
            {title}
          </h2>
        </div>
        <div className="px-5 pb-2">
          <p id="prefill-confirm-body" className="text-sm text-slate-700">
            {body}
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 pt-3 pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-3 text-sm font-semibold text-slate-800 bg-gray-100 rounded-lg active:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-6 py-3 text-sm font-semibold text-white rounded-lg bg-red-600 active:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
