import { describe, it, expect } from "vitest";

import type { ManagerOrderDetail, ManagerOrderLineDetail } from "../../../types";
import {
  dirtySavePayload,
  dispatchPayload,
  hasDirtyDrafts,
  isOrderEmpty,
  seedDrafts,
} from "./draftState";

// Marek's report (order-line-zero-qty): after Zapisz the reload reseeded a
// saved 0 as the captain quantity, so the line came back and the dispatch
// payload / e-mail carried it again.

function line(
  id: string,
  captain: number,
  manager: number,
  managerSet?: boolean,
): ManagerOrderLineDetail {
  const l = {
    order_line_id: id,
    captain_final_qty_purchase: captain,
    manager_final_qty_purchase: manager,
    manager_comment: "",
  } as ManagerOrderLineDetail;
  if (managerSet !== undefined) l.manager_final_set = managerSet;
  return l;
}

function detail(lines: ManagerOrderLineDetail[]): ManagerOrderDetail {
  return { lines } as ManagerOrderDetail;
}

describe("draft state — explicit Manager zero survives the reload", () => {
  const zeroed = line("OL-1", 5, 0, true);
  const untouched = line("OL-2", 3, 0, false);
  const lines = [zeroed, untouched];

  it("reseeds a saved explicit 0 as 0 and an untouched line at the captain qty", () => {
    const drafts = seedDrafts(detail(lines));
    expect(drafts["OL-1"].qty).toBe(0);
    expect(drafts["OL-2"].qty).toBe(3);
  });

  it("is not dirty right after the reload (no phantom unsaved change)", () => {
    const drafts = seedDrafts(detail(lines));
    expect(hasDirtyDrafts(drafts, lines)).toBe(false);
    expect(dirtySavePayload(drafts, lines)).toEqual([]);
  });

  it("dispatch payload sends the explicit 0, not the captain qty", () => {
    const drafts = seedDrafts(detail(lines));
    expect(dispatchPayload(drafts, lines)).toEqual([
      { order_line_id: "OL-1", manager_final_qty_purchase: 0, manager_comment: "" },
      { order_line_id: "OL-2", manager_final_qty_purchase: 3, manager_comment: "" },
    ]);
  });

  it("an order whose every line was zeroed is empty (dispatch blocked)", () => {
    const all = [line("OL-1", 5, 0, true), line("OL-2", 3, 0, true)];
    expect(isOrderEmpty(seedDrafts(detail(all)), all)).toBe(true);
  });

  it("zeroing a cell then saving: the payload carries 0 for that line only", () => {
    const fresh = [line("OL-1", 5, 0), line("OL-2", 3, 0)];
    const drafts = seedDrafts(detail(fresh));
    drafts["OL-1"] = { ...drafts["OL-1"], qty: 0 };
    expect(dirtySavePayload(drafts, fresh)).toEqual([
      { order_line_id: "OL-1", manager_final_qty_purchase: 0, manager_comment: "" },
    ]);
  });
});
