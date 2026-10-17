import { describe, expect, it } from "vitest";

import { STRINGS } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { TRANSPORT_CHIP_SUPPLIER_IDS } from "../pages/manager/lib/transport";
import {
  groupSupplierOptions,
  MARK_ORDERED_EMAIL_SUPPLIER_IDS,
  PAGO_MORY_SUPPLIER_IDS,
  supplierFilterMatches,
} from "./supplierGroups";

const plLabel = (key: StringKey): string => STRINGS[key].pl;

describe("supplierGroups (D4)", () => {
  it("one 'Pago + Magazyn Mory' option replaces both members, sorted by name", () => {
    const out = groupSupplierOptions(
      [
        { id: "SUP_BUKAT", name: "Bukat" },
        { id: "SUP_MORY", name: "Magazyn Mory" },
        { id: "SUP_PAGO", name: "Pago" },
        { id: "SUP_SPEC", name: "Spec Food" },
      ],
      plLabel,
    );
    expect(out).toEqual([
      { id: "SUP_BUKAT", name: "Bukat" },
      { id: "GRP_PAGO_MORY", name: "Pago + Magazyn Mory" },
      { id: "SUP_SPEC", name: "Spec Food" },
    ]);
  });

  it("shows the group when only one member is listed, and not at all without members", () => {
    expect(groupSupplierOptions([{ id: "SUP_MORY", name: "Mory" }], plLabel)).toEqual([
      { id: "GRP_PAGO_MORY", name: "Pago + Magazyn Mory" },
    ]);
    expect(groupSupplierOptions([{ id: "SUP_BUKAT", name: "Bukat" }], plLabel)).toEqual([
      { id: "SUP_BUKAT", name: "Bukat" },
    ]);
  });

  it("the group filter matches both members and nothing else", () => {
    expect(supplierFilterMatches("GRP_PAGO_MORY", "SUP_PAGO")).toBe(true);
    expect(supplierFilterMatches("GRP_PAGO_MORY", "SUP_MORY")).toBe(true);
    expect(supplierFilterMatches("GRP_PAGO_MORY", "SUP_BUKAT")).toBe(false);
    expect(supplierFilterMatches("SUP_BUKAT", "SUP_BUKAT")).toBe(true);
    expect(supplierFilterMatches("SUP_BUKAT", "SUP_PAGO")).toBe(false);
  });

  it("Transport chips use the same pair; only Filber gets mark-ordered on e-mail", () => {
    expect(TRANSPORT_CHIP_SUPPLIER_IDS).toBe(PAGO_MORY_SUPPLIER_IDS);
    expect(MARK_ORDERED_EMAIL_SUPPLIER_IDS).toEqual(["SUP_FILBER"]);
  });
});
