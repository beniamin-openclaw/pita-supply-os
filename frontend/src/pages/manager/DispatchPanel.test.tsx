import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../../i18n";
import type { ManagerOrderDetail, ManagerOrderLineDetail } from "../../types";
import { DispatchPanel } from "./DispatchPanel";

function makeLine(overrides: Partial<ManagerOrderLineDetail> = {}): ManagerOrderLineDetail {
  return {
    order_line_id: "OL-ORD-1-001",
    product_id: "P001",
    product_name_pl: "Pita",
    inventory_unit: "szt",
    is_critical: false,
    supplier_product_id: "SP001",
    supplier_product_name: "Pita 15cm",
    purchase_unit: "karton",
    units_per_purchase_unit: 60,
    current_stock_qty_base: 10,
    target_stock_qty_base: 100,
    max_stock_qty_base: 120,
    allow_over_max_due_to_packaging: false,
    suggested_qty_base: 90,
    suggested_qty_purchase: 2,
    captain_final_qty_purchase: 2,
    captain_final_qty_base: 120,
    manager_final_qty_purchase: 0,
    manager_final_qty_base: 0,
    captain_comment: "",
    manager_comment: "",
    ...overrides,
  };
}

function makeDetail(overrides: Partial<ManagerOrderDetail> = {}): ManagerOrderDetail {
  return {
    order_id: "ORD-1",
    location_id: "WOLA",
    location_name: "Pita Bros Wola",
    supplier_id: "SUP_PAGO",
    supplier_name: "Pago",
    supplier_email: "orders@example.test",
    ordering_method: "email",
    supplier_notes: "",
    order_date: "2026-09-20",
    status: "manager_claimed",
    notes: "",
    lines: [makeLine()],
    receipts: [],
    ...overrides,
  };
}

function renderPanel(detail: ManagerOrderDetail): void {
  render(
    <MemoryRouter>
      <LangProvider>
        <DispatchPanel
          detail={detail}
          drafts={{}}
          busy={false}
          onDispatch={() => {}}
          onToast={() => {}}
        />
      </LangProvider>
    </MemoryRouter>,
  );
}

describe("DispatchPanel — transport-only supplier", () => {
  it("renders the notice and the Transport link", () => {
    renderPanel(makeDetail({ ordering_method: "transport" }));
    expect(screen.getByText(/Wysyłka: przez Transport/)).toBeInTheDocument();
    expect(
      screen.getByText(/Pago zamawia się wyłącznie w ramach transportu zbiorczego/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Przejdź do ekranu Transport" })).toHaveAttribute(
      "href",
      "/manager/transport",
    );
  });

  it("renders no dispatch affordance at all", () => {
    renderPanel(makeDetail({ ordering_method: "transport" }));
    // Positive anchor first: without it every assertion below would also pass
    // on a branch that silently rendered nothing at all.
    expect(screen.getByRole("link", { name: "Przejdź do ekranu Transport" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Otwórz w Gmail" })).toBeNull();
    expect(screen.queryByText("Otwórz w Gmail")).toBeNull();
    expect(screen.queryByRole("button", { name: /Oznacz jako zamówione/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Kopiuj treść" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Kopiuj listę" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("DispatchPanel — other channels untouched", () => {
  it("email channel with a valid supplier_email still renders the Gmail link", () => {
    renderPanel(makeDetail({ ordering_method: "email" }));
    const gmail = screen.getByRole("link", { name: "Otwórz w Gmail" });
    expect(gmail).toHaveAttribute("href", expect.stringContaining("mail.google.com"));
    expect(screen.queryByText("Przejdź do ekranu Transport")).toBeNull();
  });
});

// Map-backed localStorage stub (same pattern as nameSuggestions.test.ts).
function stubStorage(entries: Record<string, string> = {}): Map<string, string> {
  const store = new Map(Object.entries(entries));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

describe("DispatchPanel — signer (order-email-v2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const signers = [
    { name: "Marek Złotopolski", phone: "+48 662 184 258", email: "marek@pitabros.pl" },
    { name: "Sławomir Glanowski", phone: "+48 692 840 194", email: "slawek@pitabros.pl" },
  ];

  it("defaults to the first signer and re-seeds the body on change", () => {
    const store = stubStorage();
    renderPanel(makeDetail({ email_signers: signers }));
    const body = screen.getByLabelText("Treść:") as HTMLTextAreaElement;
    expect(body.value).toContain("Pozdrawiam,\nMarek Złotopolski");
    fireEvent.change(screen.getByLabelText("Podpis:"), {
      target: { value: "slawek@pitabros.pl" },
    });
    expect((screen.getByLabelText("Treść:") as HTMLTextAreaElement).value).toContain(
      "Pozdrawiam,\nSławomir Glanowski",
    );
    expect(store.get("supply_os_order_email_signer")).toBe("slawek@pitabros.pl");
  });

  it("passes the chosen signer to onDispatch from the Gmail link", () => {
    stubStorage({ supply_os_order_email_signer: "slawek@pitabros.pl" });
    const onDispatch = vi.fn();
    render(
      <MemoryRouter>
        <LangProvider>
          <DispatchPanel
            detail={makeDetail({ email_signers: signers })}
            drafts={{}}
            busy={false}
            onDispatch={onDispatch}
            onToast={() => {}}
          />
        </LangProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Otwórz w Gmail" }));
    expect(onDispatch).toHaveBeenCalledWith("email", "slawek@pitabros.pl");
  });

  it("shows no signer select when none is configured", () => {
    renderPanel(makeDetail());
    expect(screen.queryByLabelText("Podpis:")).toBeNull();
  });
});
