// Print/PDF views for a Transport batch (v3 Phase 10, redesigned for the v4
// feedback round — feature 3 — to replicate the legacy PDFs' structure):
// two buttons open the same window.print() dialog — the system "Save as
// PDF" — over a purpose-built document:
//   - LISTA DLA KIEROWCY (driver): navy title bar, a logistics header table,
//     a navy "PAGO / LINEAGE" section bar, and a per-product x per-location
//     MATRIX (one column per location) with a bold Razem (total) column.
//     Internal only — never sent to the supplier.
//   - ZLECENIE ODBIORU WŁASNEGO (Pago order): navy title bar, two side-by-side
//     header boxes ("Dane podmiotu" — the fixed Pago entity, PAGO only —
//     and "Dane dokumentu"), then a totals-only table (Nr katalogowy | Jm. |
//     Ilość). No location ever appears in the product table.
// Document data comes from the pure builders in lib/transport.ts; this
// component only lays it out and toggles print visibility via a
// `@media print` stylesheet — everything else on the page is hidden while
// printing, only `.transport-print-area` (and its children) stays visible.

import { useEffect, useMemo, useState } from "react";

import { useT } from "../../../i18n";
import type { TransportBatchDetail } from "../../../types";
import { buildTransportDriverPrintDoc, buildTransportPagoPrintDoc } from "../lib/transport";

interface PrintViewsProps {
  detail: TransportBatchDetail;
}

type PrintDoc = "driver" | "pago" | null;

const NAVY = "#1f3864";
const LIGHT_BLUE = "#d9e8f5";

export function PrintViews({ detail }: PrintViewsProps) {
  const { t } = useT();
  const [active, setActive] = useState<PrintDoc>(null);
  // Recomputed each time a doc is opened (deliberate: `active` is the
  // trigger), so the footer always shows the moment THIS print was opened.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const generatedAt = useMemo(() => new Date().toLocaleString("pl-PL"), [active]);

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

  const driverDoc = active === "driver" ? buildTransportDriverPrintDoc(detail, t) : null;
  const pagoDoc = active === "pago" ? buildTransportPagoPrintDoc(detail) : null;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body * { visibility: hidden; }
          .transport-print-area, .transport-print-area * { visibility: visible; }
          .transport-print-area { position: absolute; top: 0; left: 0; width: 100%; }
        }
        @media screen {
          .transport-print-area { display: none; }
        }
        .trn-print-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .trn-print-table th, .trn-print-table td { border: 1px solid #94a3b8; padding: 4px 6px; text-align: left; }
        .trn-print-table thead th { background: ${NAVY}; color: #ffffff; font-weight: 700; }
        .trn-print-table tbody tr:nth-child(even) { background: #f1f5f9; }
        .trn-print-header-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
        .trn-print-header-table td { border: 1px solid #94a3b8; padding: 4px 6px; }
        .trn-print-header-table td.trn-label { background: ${LIGHT_BLUE}; font-weight: 700; width: 30%; }
        .trn-title-bar { background: ${NAVY}; color: #ffffff; font-weight: 700; text-align: center; padding: 8px; font-size: 15px; margin-bottom: 10px; }
        .trn-section-bar { background: ${NAVY}; color: #ffffff; font-weight: 700; text-align: center; padding: 6px; font-size: 12px; margin: 10px 0 6px; }
        .trn-light-bar { background: ${LIGHT_BLUE}; font-weight: 700; text-align: center; padding: 6px; font-size: 12px; margin: 10px 0 6px; }
        .trn-print-footer { margin-top: 10px; font-size: 9px; color: #64748b; }
        .trn-total-cell { font-weight: 700; }
        .trn-entity-boxes { display: flex; gap: 10px; margin-bottom: 10px; }
        .trn-entity-boxes > div { flex: 1; }
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
            <div className="trn-title-bar">{t("manager.transport.print.driverBarTitle")}</div>

            <table className="trn-print-header-table">
              <tbody>
                <tr>
                  <td className="trn-label">{t("manager.transport.print.locationsRowLabel")}</td>
                  <td colSpan={3}>{driverDoc.locationsLine}</td>
                </tr>
                <tr>
                  <td className="trn-label">{t("manager.transport.print.dateLabel")}</td>
                  <td>{driverDoc.date}</td>
                  <td className="trn-label">{t("manager.transport.print.timeLabel")}</td>
                  <td>{driverDoc.time}</td>
                </tr>
                <tr>
                  <td className="trn-label">{t("manager.transport.print.driverLabel")}</td>
                  <td>{driverDoc.driver}</td>
                  <td className="trn-label">{t("manager.transport.print.docNumberLabel")}</td>
                  <td>
                    {driverDoc.displayLabel} <span style={{ color: "#94a3b8" }}>({driverDoc.transportId})</span>
                  </td>
                </tr>
                <tr>
                  <td className="trn-label">{t("manager.transport.print.vehicleLabel")}</td>
                  <td colSpan={3}>{driverDoc.vehicle}</td>
                </tr>
              </tbody>
            </table>

            <div className="trn-section-bar">{driverDoc.supplierBarText}</div>

            <table className="trn-print-table">
              <thead>
                <tr>
                  <th>{t("manager.transport.print.lpCol")}</th>
                  <th>{t("manager.transport.print.productCol")}</th>
                  <th>{t("manager.transport.print.unitCol")}</th>
                  {driverDoc.locations.map((loc) => (
                    <th key={loc}>LOC • {loc}</th>
                  ))}
                  <th>{t("manager.transport.print.totalCol")}</th>
                </tr>
              </thead>
              <tbody>
                {driverDoc.products.map((p, idx) => (
                  <tr key={p.productId}>
                    <td>{idx + 1}</td>
                    <td>{p.name}</td>
                    <td>{p.unit}</td>
                    {p.qtyByLocation.map((qty, i) => (
                      <td key={driverDoc.locations[i]}>{qty}</td>
                    ))}
                    <td className="trn-total-cell">{p.totalQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="trn-print-footer">
              {t("manager.transport.print.footerGenerated", { when: generatedAt })} — {driverDoc.transportId}
            </div>
          </div>
        )}

        {pagoDoc && (
          <div>
            <div className="trn-title-bar">{pagoDoc.titleBarText}</div>

            <div className="trn-entity-boxes">
              {pagoDoc.entity && (
                <div>
                  <div className="trn-section-bar">{t("manager.transport.print.pagoDoc.entityBoxTitle")}</div>
                  <table className="trn-print-header-table">
                    <tbody>
                      <tr>
                        <td className="trn-label">{t("manager.transport.print.pagoDoc.fullNameLabel")}</td>
                        <td>{pagoDoc.entity.name}</td>
                      </tr>
                      <tr>
                        <td className="trn-label">{t("manager.transport.print.pagoDoc.nipLabel")}</td>
                        <td>{pagoDoc.entity.nip}</td>
                      </tr>
                      <tr>
                        <td className="trn-label">{t("manager.transport.print.pagoDoc.address1Label")}</td>
                        <td>{pagoDoc.entity.address1}</td>
                      </tr>
                      <tr>
                        <td className="trn-label">{t("manager.transport.print.pagoDoc.address2Label")}</td>
                        <td>{pagoDoc.entity.address2}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <div className="trn-section-bar">{t("manager.transport.print.pagoDoc.docBoxTitle")}</div>
                <table className="trn-print-header-table">
                  <tbody>
                    <tr>
                      <td className="trn-label">{t("manager.transport.print.docNumberLabel")}</td>
                      <td>{pagoDoc.transportId}</td>
                    </tr>
                    <tr>
                      <td className="trn-label">{t("manager.transport.print.pagoDoc.pickupDateLabel")}</td>
                      <td>{pagoDoc.pickupDate}</td>
                    </tr>
                    <tr>
                      <td className="trn-label">{t("manager.transport.print.pagoDoc.locationsLabel")}</td>
                      <td>{pagoDoc.locationsLine}</td>
                    </tr>
                    <tr>
                      <td className="trn-label">{t("manager.transport.print.pagoDoc.typeLabel")}</td>
                      <td>{t("manager.transport.print.pagoDoc.typeValue")}</td>
                    </tr>
                    <tr>
                      <td className="trn-label">{t("manager.transport.print.driverLabel")}</td>
                      <td>{pagoDoc.driver}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {pagoDoc.isPago && (
              <div className="trn-light-bar">{t("manager.transport.print.pagoDoc.pickupBar")}</div>
            )}

            <table className="trn-print-header-table">
              <tbody>
                <tr>
                  <td className="trn-label">{t("manager.transport.print.vehicleLabel")}</td>
                  <td>{pagoDoc.vehicle}</td>
                  <td className="trn-label">{t("manager.transport.print.pagoDoc.pickupTimeLabel")}</td>
                  <td>{pagoDoc.pickupTime}</td>
                </tr>
              </tbody>
            </table>

            <table className="trn-print-table">
              <thead>
                <tr>
                  <th>{t("manager.transport.print.lpCol")}</th>
                  <th>{t("manager.transport.print.pagoDoc.catalogCol")}</th>
                  <th>{t("manager.transport.print.unitCol")}</th>
                  <th>{t("manager.transport.print.qtyCol")}</th>
                </tr>
              </thead>
              <tbody>
                {pagoDoc.products.map((p, idx) => (
                  <tr key={p.productId}>
                    <td>{idx + 1}</td>
                    <td>{p.name}</td>
                    <td>{p.unit}</td>
                    <td>{p.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="trn-print-footer">
              {t("manager.transport.print.footerGenerated", { when: generatedAt })} — {pagoDoc.transportId}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
