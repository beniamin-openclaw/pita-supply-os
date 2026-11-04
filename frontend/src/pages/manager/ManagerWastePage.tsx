import { Link } from "react-router-dom";
import { useState } from "react";
import { getToken } from "../../auth";
import { AppHeader } from "../../components/ui/AppHeader";
import { useT } from "../../i18n";
import { WasteHistory } from "../captain-mp/components/WasteHistory";

export function ManagerWastePage() {
  const { t } = useT();
  const [token] = useState(() => getToken("manager"));
  return <div className="min-h-screen bg-slate-50"><AppHeader><div className="mx-auto max-w-7xl px-4 py-3 flex justify-between"><h1>{t("waste.title")}</h1><Link to="/manager" className="underline">{t("waste.back")}</Link></div></AppHeader><main className="mx-auto max-w-7xl p-4"><WasteHistory role="manager" token={token} refresh={0} /></main></div>;
}
