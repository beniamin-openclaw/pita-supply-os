import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { getToken } from "../../auth";
import { useT } from "../../i18n";
import { Header } from "./components/Header";
import { CaptainTabs } from "./components/CaptainTabs";
import { HistorySegment } from "./components/HistorySegment";
import { WasteHistory } from "./components/WasteHistory";

export function WasteHistoryPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [token] = useState(() => getToken("captain"));
  return <div className="min-h-screen bg-slate-50 pb-12"><Header token={token || ""} locationName="" onShowOrders={()=>navigate("/captain-v2/orders")} onShowInventory={()=>navigate("/captain-v2/inventory-count")}/><CaptainTabs/>
    <main className="mx-auto max-w-3xl p-4"><HistorySegment/><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold">{t("waste.reports")}</h1><Link className="inline-flex min-h-11 items-center rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white" to="/captain-v2/waste-report">{t("waste.add")}</Link></div><WasteHistory role="captain" token={token} refresh={0}/></main></div>;
}
