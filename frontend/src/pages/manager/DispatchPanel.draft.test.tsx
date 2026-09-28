// order-email-v2: the verified Gmail draft path in the dispatch panel.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../../i18n";
import type { ManagerOrderDetail } from "../../types";

vi.mock("./lib/orderEmailDraft", async (importOriginal) => {
  const real = await importOriginal<typeof import("./lib/orderEmailDraft")>();
  return {
    ...real,
    getGoogleClientId: vi.fn(() => "client-id"),
    createVerifiedOrderDraft: vi.fn(async () => ({ draftId: "r-1" })),
  };
});

import { DispatchPanel } from "./DispatchPanel";
import * as orderDraft from "./lib/orderEmailDraft";

function makeDetail(overrides: Partial<ManagerOrderDetail> = {}): ManagerOrderDetail {
  return {
    order_id: "ORD-1",
    location_id: "BRACKA",
    location_name: "Pita Bros Bracka",
    supplier_id: "SUP_BUKAT",
    supplier_name: "Bukat",
    supplier_email: "biuro@bukat.com",
    cc_email: "biuro@pitabros.pl",
    location_email: "pitabrosbracka@gmail.com",
    sender_email: "bracka@pitabros.pl",
    order_mailbox: "biuro@pitabros.pl",
    email_signers: [
      { name: "Marek Złotopolski", phone: "+48 662 184 258", email: "marek@pitabros.pl" },
    ],
    ordering_method: "email",
    supplier_notes: "",
    order_date: "2026-09-28",
    status: "manager_claimed",
    notes: "",
    lines: [
      {
        order_line_id: "OL-1",
        product_id: "P1",
        product_name_pl: "Pomidor",
        inventory_unit: "kg",
        is_critical: false,
        supplier_product_id: "SP1",
        supplier_product_name: "Pomidor",
        purchase_unit: "kg",
        units_per_purchase_unit: 1,
        current_stock_qty_base: 0,
        target_stock_qty_base: 0,
        max_stock_qty_base: 0,
        allow_over_max_due_to_packaging: false,
        suggested_qty_base: 0,
        suggested_qty_purchase: 0,
        captain_final_qty_purchase: 18,
        captain_final_qty_base: 18,
        manager_final_qty_purchase: 0,
        manager_final_qty_base: 0,
        captain_comment: "",
        manager_comment: "",
      },
    ],
    receipts: [],
    ...overrides,
  } as ManagerOrderDetail;
}

function renderPanel(detail: ManagerOrderDetail, onDispatch = vi.fn()) {
  render(
    <MemoryRouter>
      <LangProvider>
        <DispatchPanel detail={detail} drafts={{}} busy={false} onDispatch={onDispatch} onToast={() => {}} />
      </LangProvider>
    </MemoryRouter>,
  );
  return onDispatch;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  });
  vi.mocked(orderDraft.getGoogleClientId).mockReturnValue("client-id");
  vi.mocked(orderDraft.createVerifiedOrderDraft).mockReset();
  vi.mocked(orderDraft.createVerifiedOrderDraft).mockResolvedValue({ draftId: "r-1" });
});
afterEach(() => vi.unstubAllGlobals());

describe("DispatchPanel — Gmail draft (order-email-v2)", () => {
  it("shows Od / DW (location mailbox only) and the draft button", () => {
    renderPanel(makeDetail());
    expect(screen.getByText("Pita Bros Bracka <bracka@pitabros.pl>")).toBeInTheDocument();
    expect(screen.getByText("pitabrosbracka@gmail.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zrób draft w Gmailu" })).toBeEnabled();
  });

  it("a verified draft dispatches with the signer and the mailbox", async () => {
    const onDispatch = renderPanel(makeDetail());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Zrób draft w Gmailu" }));
    });
    const call = vi.mocked(orderDraft.createVerifiedOrderDraft).mock.calls[0][0];
    expect(call.mailbox).toBe("biuro@pitabros.pl");
    expect(call.from).toEqual({ name: "Pita Bros Bracka", email: "bracka@pitabros.pl" });
    expect(call.to).toBe("biuro@bukat.com");
    expect(call.cc).toBe("pitabrosbracka@gmail.com");
    expect(call.body).toContain("Marek Złotopolski");
    expect(onDispatch).toHaveBeenCalledWith("email", "marek@pitabros.pl", {
      draftMailbox: "biuro@pitabros.pl",
    });
  });

  it("a failed draft does not dispatch and shows the reason", async () => {
    vi.mocked(orderDraft.createVerifiedOrderDraft).mockRejectedValue(
      new orderDraft.WrongMailboxError("beniamin@pitabros.pl"),
    );
    const onDispatch = renderPanel(makeDetail());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Zrób draft w Gmailu" }));
    });
    expect(onDispatch).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("beniamin@pitabros.pl");
  });

  it("while drafting the fallback link is inert", async () => {
    let finish: (v: { draftId: string }) => void = () => {};
    vi.mocked(orderDraft.createVerifiedOrderDraft).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const onDispatch = renderPanel(makeDetail());
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Zrób draft w Gmailu" }));
    });
    expect(screen.queryByRole("link", { name: "Otwórz w Gmail" })).toBeNull();
    const inert = screen.getByText("Otwórz w Gmail");
    expect(inert).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(inert);
    expect(onDispatch).not.toHaveBeenCalled();
    await act(async () => finish({ draftId: "r-1" }));
    expect(onDispatch).toHaveBeenCalledTimes(1);
  });

  it("without a client id: no draft button, the link still works", () => {
    vi.mocked(orderDraft.getGoogleClientId).mockReturnValue("");
    const onDispatch = renderPanel(makeDetail());
    expect(screen.queryByRole("button", { name: "Zrób draft w Gmailu" })).toBeNull();
    // DW falls back to the link's rule (office copy + location mailbox).
    expect(screen.getByText("biuro@pitabros.pl, pitabrosbracka@gmail.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Otwórz w Gmail" }));
    expect(onDispatch).toHaveBeenCalledWith("email", "marek@pitabros.pl");
  });

  it("transport branch still renders no Gmail control", () => {
    renderPanel(makeDetail({ ordering_method: "transport" }));
    expect(screen.queryByRole("button", { name: "Zrób draft w Gmailu" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Otwórz w Gmail" })).toBeNull();
  });
});
