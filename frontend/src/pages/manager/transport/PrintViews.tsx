// Print/PDF views for a Transport batch (v3 Phase 10, to-ordering-pago
// ADDENDUM v3): two buttons open the same window.print() dialog — the system
// "Save as PDF" — over a purpose-built document: the PRIVATE driver list
// (per-product totals WITH the per-location breakdown + a logistics header)
// or the Pago (supplier) order list (totals only, no location ever appears).
// Document data comes from the pure builders in lib/transport.ts; this
// component only lays it out and toggles print visibility via a
// `@media print` stylesheet — everything else on the page is hidden while
// printing, only `.transport-print-area` (and its children) stays visible.

import { useEffect, useState } from "react";

import { useT } from "../../../i18n";
import type { TransportBatchDetail } from "../../../types";
import { buildTransportDriverPrintDoc, buildTransportPagoPrintDoc } from "../lib/transport";

interface PrintViewsProps {
  detail: TransportBatchDetail;
}

type PrintDoc = "driver" | "pago" | null;

export function PrintViews({ detail }: PrintViewsProps) {
  const { t } = useT();
  const [active, setActive] = useState<PrintDoc>(null);

  useEffect(() => {
    if (!active) return;
    // Let the printable content commit to the DOM before invoking print.
    const id = window.setTimeout(() => window.print(), 50);
    const onAfterPrint = () => setActive(null);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [active]);

  const driverDoc = active === "driver" ? buildTransportDriverPrintDoc(detail) : null;
  const pagoDoc = active === "pago" ? buildTransportPagoPrintDoc(detail) : null;

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .transport-print-area, .transport-print-area * { visibility: visible; }
          .transport-print-area { position: absolute; top: 0; left: 0; width: 100%; }
        }
        @media screen {
          .transport-print-area { display: none; }
        }
      `}</style>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActive("driver")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {t("manager.transport.print.driverButton")}
        </button>
        <button
          type="button"
          onClick={() => setActive("pago")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {t("manager.transport.print.pagoButton")}
        </button>
      </div>

      <div className="transport-print-area">
        {driverDoc && (
          <div>
            <h2>{t("manager.transport.print.driverTitle")}</h2>
            <p>
              {driverDoc.transportId}
              {driverDoc.date ? ` — ${t("manager.transport.print.dateLabel")}: ${driverDoc.date}` : ""}
            </p>
            <p>
              {t("manager.transport.print.supplierLabel")}: {driverDoc.supplierName}
            </p>
            {driverDoc.driver && (
              <p>
                {t("manager.transport.print.driverLabel")}: {driverDoc.driver}
              </p>
            )}
            {driverDoc.vehicle && (
              <p>
                {t("manager.transport.print.vehicleLabel")}: {driverDoc.vehicle}
              </p>
            )}
            <table>
              <thead>
                <tr>
                  <th>{t("manager.transport.print.productCol")}</th>
                  <th>{t("manager.transport.print.qtyCol")}</th>
                  <th>{t("manager.transport.print.locationCol")}</th>
                </tr>
              </thead>
              <tbody>
                {driverDoc.products.map((p) => (
                  <tr key={p.productId}>
                    <td>{p.name}</td>
                    <td>
                      {p.totalQty} {p.unit}
                    </td>
                    <td>
                      {p.perLocation.map((pl) => (
                        <div key={pl.location}>
                          {pl.location}: {pl.qty} {p.unit}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagoDoc && (
          <div>
            <h2>{t("manager.transport.print.pagoTitle")}</h2>
            <p>
              {pagoDoc.transportId}
              {pagoDoc.pickupDate ? ` — ${t("manager.transport.print.dateLabel")}: ${pagoDoc.pickupDate}` : ""}
            </p>
            <p>
              {t("manager.transport.print.supplierLabel")}: {pagoDoc.supplierName}
            </p>
            <table>
              <thead>
                <tr>
                  <th>{t("manager.transport.print.productCol")}</th>
                  <th>{t("manager.transport.print.qtyCol")}</th>
                </tr>
              </thead>
              <tbody>
                {pagoDoc.products.map((p) => (
                  <tr key={p.productId}>
                    <td>{p.name}</td>
                    <td>
                      {p.qty} {p.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
