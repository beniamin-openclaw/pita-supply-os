import { Link, useLocation } from "react-router-dom";
import { useT } from "../../i18n";

export function OperationalReportsSegment() {
  const { t } = useT();
  const { pathname } = useLocation();
  return <nav aria-label={t("waste.modules")} className="mb-4 flex flex-wrap gap-2">{([
    ["/manager/inventory", "manager.inventory.navLink"],
    ["/manager/waste", "waste.reports"],
  ] as const).map(([path,key])=><Link key={path} to={path} aria-current={pathname.startsWith(path) ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${pathname.startsWith(path) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600"}`}>{t(key)}</Link>)}</nav>;
}
