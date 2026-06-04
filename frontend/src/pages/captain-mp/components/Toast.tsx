// Accessible toast — fixes A11y BLOCKER B2.
// - role + aria-live so screen readers announce
// - manual close button (don't rely only on auto-dismiss; 3s is too short for slower readers)
// - sticky for errors, auto-dismiss only for success (WCAG 2.2.1 Timing Adjustable)
// - motion respects prefers-reduced-motion via global CSS

import { useEffect } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { useT } from "../../../i18n";

export type ToastType = "success" | "error";

export interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  const { t } = useT();
  const isSuccess = type === "success";

  useEffect(() => {
    if (!isSuccess) return; // errors stay until dismissed
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [isSuccess, onClose]);

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      aria-live={isSuccess ? "polite" : "assertive"}
      aria-atomic="true"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-4 motion-safe:duration-300"
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
          isSuccess
            ? "bg-green-50 border-green-300 text-green-900"
            : "bg-red-50 border-red-400 text-red-900"
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 size={20} className="text-green-700" aria-hidden="true" />
        ) : (
          <XCircle size={20} className="text-red-700" aria-hidden="true" />
        )}
        <span className="text-sm font-medium">{message}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("toast.close")}
          className="ml-2 p-1 rounded-md hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
