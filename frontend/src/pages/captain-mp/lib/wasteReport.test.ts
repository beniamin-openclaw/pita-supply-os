import { describe, expect, it } from "vitest";
import { afterSaveFailure, reportMatchesPayload, type WastePayload, type WasteReport } from "./wasteReport";
import { WasteRequestError } from "../../../apiClient";

describe("uncertain waste saves", () => {
  const payload = { batch_uuid: "one", business_date: "2026-11-04", lines: [] };
  it("freezes exact payload for unknown outcomes, including racing 404", () => {
    expect(afterSaveFailure(payload, new WasteRequestError("unknown", 0, "network"))).toEqual(payload);
    expect(afterSaveFailure(payload, new WasteRequestError("unknown", 404, "waste_not_found"))).toEqual(payload);
  });
  it("allows editing after a definite 422 rejection", () => {
    expect(afterSaveFailure(payload, new WasteRequestError("rejected", 422, "validation"))).toBeNull();
  });
  it("does not create a fresh key after a conflict with an existing batch", () => {
    expect(afterSaveFailure(payload, new WasteRequestError("rejected", 409, "waste_conflict"))).toEqual(payload);
  });
  it("keeps an uncertain original frozen when a retry is definitively rejected", () => {
    expect(afterSaveFailure(payload, new WasteRequestError("rejected", 503, "waste_unavailable"), true)).toEqual(payload);
  });
});


describe("confirmed response identity", () => {
  const payload: WastePayload = {batch_uuid:"one",business_date:"2026-11-04",reported_by:"Ala",lines:[{product_id:null,source_product_id:"P1",description:null,quantity:"0.125",unit:"g",reason:"dropped",reason_detail:null}]};
  const report = {...payload,report_id:"r1",lines:payload.lines.map(line=>({...line,submitted_quantity:line.quantity,submitted_unit:line.unit}))} as WasteReport;
  it("requires both immutable reporter and master source to match", () => {
    expect(reportMatchesPayload(report,payload)).toBe(true);
    expect(reportMatchesPayload({...report,reported_by:"Ben"},payload)).toBe(false);
    expect(reportMatchesPayload({...report,lines:[{...report.lines[0],source_product_id:"P2"}]},payload)).toBe(false);
    expect(reportMatchesPayload({...report,lines:[{...report.lines[0],source_product_id:null}]},payload)).toBe(false);
  });
  it("accepts legacy missing attribution/source as null without altering the body", () => {
    const legacy: WastePayload = {batch_uuid:"old",business_date:"2026-11-04",lines:[{product_id:"tomato",description:null,quantity:"100",unit:"g",reason:"dropped",reason_detail:null}]};
    const before=JSON.stringify(legacy);
    const response={...legacy,reported_by:null,report_id:"old-r1",lines:legacy.lines.map(line=>({...line,source_product_id:null,submitted_quantity:"100.000",submitted_unit:"g"}))} as WasteReport;
    expect(reportMatchesPayload(response,legacy)).toBe(true);
    expect(JSON.stringify(legacy)).toBe(before);
  });
});
