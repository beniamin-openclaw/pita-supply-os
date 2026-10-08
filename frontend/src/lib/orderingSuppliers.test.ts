import { describe, it, expect, vi } from "vitest";

import {
  INTERNAL_SUPPLIER_ID,
  isOrderingSupplier,
  loadCaptainSuppliers,
  pickDefaultSupplier,
} from "./orderingSuppliers";
import type { Supplier } from "../types";

describe("isOrderingSupplier", () => {
  it("drops on-site production", () => {
    expect(isOrderingSupplier({ supplier_id: INTERNAL_SUPPLIER_ID, active: true })).toBe(false);
    expect(INTERNAL_SUPPLIER_ID).toBe("SUP_INTERNAL");
  });

  it("drops inactive suppliers", () => {
    expect(isOrderingSupplier({ supplier_id: "SUP_SELGROS", active: false })).toBe(false);
  });

  it("keeps active external suppliers", () => {
    expect(isOrderingSupplier({ supplier_id: "SUP_BUKAT", active: true })).toBe(true);
    expect(isOrderingSupplier({ supplier_id: "SUP_PAGO", active: true })).toBe(true);
  });

  it("filters a supplier list, keeping order", () => {
    const list = [
      { supplier_id: "SUP_BLUESERV", active: true },
      { supplier_id: "SUP_INTERNAL", active: true },
      { supplier_id: "SUP_BUKAT", active: true },
      { supplier_id: "SUP_OLD", active: false },
    ];
    expect(list.filter(isOrderingSupplier).map((s) => s.supplier_id)).toEqual([
      "SUP_BLUESERV",
      "SUP_BUKAT",
    ]);
  });
});

describe("pickDefaultSupplier", () => {
  const sup = (id: string) => ({ supplier_id: id });
  it("picks the pilot when present", () => {
    expect(pickDefaultSupplier([sup("SUP_A"), sup("SUP_BUKAT")], "SUP_BUKAT")?.supplier_id).toBe(
      "SUP_BUKAT",
    );
  });
  it("falls back to the first tab", () => {
    expect(pickDefaultSupplier([sup("SUP_A"), sup("SUP_B")], "SUP_BUKAT")?.supplier_id).toBe(
      "SUP_A",
    );
  });
  it("returns null for an empty list", () => {
    expect(pickDefaultSupplier([], "SUP_BUKAT")).toBeNull();
  });
});

describe("loadCaptainSuppliers", () => {
  const sup = (id: string, active = true) => ({ supplier_id: id, active }) as Supplier;

  it("uses the scoped list, filtered", async () => {
    const global = vi.fn();
    const out = await loadCaptainSuppliers(
      async () => [sup("SUP_A"), sup(INTERNAL_SUPPLIER_ID), sup("SUP_OLD", false)],
      global,
    );
    expect(out.map((s) => s.supplier_id)).toEqual(["SUP_A"]);
    expect(global).not.toHaveBeenCalled();
  });

  it("falls back to the global list when the scoped call fails (404)", async () => {
    const out = await loadCaptainSuppliers(
      async () => {
        throw Object.assign(new Error("nf"), { status: 404 });
      },
      async () => [sup("SUP_G"), sup(INTERNAL_SUPPLIER_ID)],
    );
    expect(out.map((s) => s.supplier_id)).toEqual(["SUP_G"]);
  });

  it("does not retry on 401", async () => {
    const global = vi.fn();
    await expect(
      loadCaptainSuppliers(async () => {
        throw Object.assign(new Error("unauth"), { status: 401 });
      }, global),
    ).rejects.toMatchObject({ status: 401 });
    expect(global).not.toHaveBeenCalled();
  });
});
