import { describe, expect, it } from "vitest";
import { afterSaveFailure } from "./wasteReport";
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
