// Reason picker — shown when card requires a reason. i18n via useT().

import type { ReasonCode } from "../types";
import { REASON_CODES } from "../types";
import { useT } from "../../../i18n";
import type { StringKey } from "../../../i18n/strings";

interface ReasonPickerProps {
  value?: ReasonCode | "";
  comment?: string;
  onChange: (reason: string, comment: string) => void;
  productId: string;
  invalid?: boolean;
}

function reasonLabelKey(code: ReasonCode): StringKey {
  return `reason.codes.${code}` as StringKey;
}

export function ReasonPicker({
  value,
  comment,
  onChange,
  productId,
  invalid,
}: ReasonPickerProps) {
  const { t } = useT();
  const selectId = `reason-${productId}`;
  const commentId = `comment-${productId}`;
  const errorId = `reason-error-${productId}`;

  const showComment = value === "OTHER";
  const commentRequired = value === "OTHER";

  return (
    <div className="mt-3 p-3 bg-white/70 rounded-lg border border-gray-300 space-y-3">
      <div>
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-slate-800 mb-1"
        >
          {t("reason.label")}
        </label>
        <select
          id={selectId}
          value={value || ""}
          onChange={(e) => onChange(e.target.value, comment || "")}
          aria-invalid={invalid && !value}
          aria-describedby={invalid && !value ? errorId : undefined}
          className={`w-full px-3 py-3 bg-white border rounded-md text-[16px] sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            invalid && !value ? "border-red-500" : "border-gray-300"
          }`}
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
        {invalid && !value && (
          <p id={errorId} className="mt-1 text-xs text-red-700">
            {t("reason.invalid")}
          </p>
        )}
      </div>

      {showComment && (
        <div>
          <label
            htmlFor={commentId}
            className="block text-xs font-semibold text-slate-800 mb-1"
          >
            {commentRequired
              ? t("reason.commentRequiredLabel")
              : t("reason.commentOptionalLabel")}
          </label>
          <textarea
            id={commentId}
            value={comment || ""}
            onChange={(e) => onChange(value || "", e.target.value)}
            placeholder={t("reason.commentPlaceholder")}
            rows={2}
            required={commentRequired}
            aria-invalid={commentRequired && !comment}
            className={`w-full px-3 py-2 bg-white border rounded-md text-[16px] sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none ${
              commentRequired && !comment ? "border-red-500" : "border-gray-300"
            }`}
          />
        </div>
      )}
    </div>
  );
}
