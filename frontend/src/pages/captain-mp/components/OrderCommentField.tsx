// Order-level Captain comment (training-feedback-0901 Phase 1b) — free text
// sent as `captain_note`. Its OWN field on the backend, deliberately never
// folded into `notes`: `manager_release` overwrites `notes` with the send-back
// reason and `captain_order_edit` blanks it on every save, so a comment stored
// there would be silently destroyed (hardening.md D2). Shared by the create
// screen (CaptainMP) and the edit screen (OrderEditPage).

import { useT } from "../../../i18n";

interface OrderCommentFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function OrderCommentField({ value, onChange }: OrderCommentFieldProps) {
  const { t } = useT();
  return (
    <div className="mb-4">
      <label
        htmlFor="order-captain-note"
        className="block text-xs font-semibold text-slate-700 mb-1"
      >
        {t("captain.orderComment.label")}
      </label>
      <textarea
        id="order-captain-note"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("captain.orderComment.placeholder")}
        rows={2}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  );
}
