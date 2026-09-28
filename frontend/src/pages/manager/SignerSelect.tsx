// "Podpis" select for the supplier order e-mail (order-email-v2) — shared by
// the dispatch and dosyłka panels. Renders nothing when no signer is configured.

import { useT } from "../../i18n";
import type { OrderEmailSigner } from "../../types";

interface SignerSelectProps {
  id: string;
  signers: OrderEmailSigner[] | undefined;
  value: OrderEmailSigner | null;
  disabled?: boolean;
  onChange: (email: string) => void;
}

export function SignerSelect({ id, signers, value, disabled, onChange }: SignerSelectProps) {
  const { t } = useT();
  if (!signers || signers.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <label className="w-16 shrink-0 text-xs font-semibold text-slate-500" htmlFor={id}>
        {t("manager.dispatch.signer")}
      </label>
      <select
        id={id}
        value={value?.email ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {signers.map((s) => (
          <option key={s.email || s.name} value={s.email ?? ""}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
