// N4: the confirm button must never look dead — with an empty "received by"
// name a click shows an inline error at the field instead of doing nothing.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { LangProvider } from "../../i18n";
import type { CaptainOrderDetail } from "../../types";

const captainOrder = vi.fn();
const receiptSubmit = vi.fn();
vi.mock("../../apiClient", () => ({
  ApiError: class ApiError extends Error {
    status = 0;
    detail = "";
  },
  api: {
    captainOrder: (id: string) => captainOrder(id),
    receiptSubmit: (...args: unknown[]) => receiptSubmit(...args),
  },
}));

import { ReceiveDeliveryPage } from "./ReceiveDeliveryPage";

const ORDER = {
  order_id: "ORD-1",
  order_date: "2026-10-03",
  status: "manager_sent",
  supplier_name: "Test Supplier",
  lines: [
    {
      order_line_id: "L1",
      product_id: "P1",
      product_name_pl: "Produkt 1",
      inventory_unit: "kg",
      purchase_unit: "karton",
      units_per_purchase_unit: 5,
      captain_final_qty_purchase: 2,
      manager_final_qty_purchase: null,
    },
  ],
} as unknown as CaptainOrderDetail;

function renderPage(): void {
  render(
    <LangProvider>
      <MemoryRouter initialEntries={["/captain-v2/orders/ORD-1/receive"]}>
        <Routes>
          <Route path="/captain-v2/orders/:order_id/receive" element={<ReceiveDeliveryPage />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>,
  );
}

const MSG = "Wpisz, kto odebrał dostawę";
const CONFIRM = /Zatwierdź odbiór/i;

describe("ReceiveDeliveryPage received-by message (N4)", () => {
  beforeEach(() => {
    captainOrder.mockReset();
    receiptSubmit.mockReset();
    captainOrder.mockResolvedValue(ORDER);
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  it("keeps the confirm button clickable and shows a persistent hint while the name is empty", async () => {
    renderPage();
    const btn = await screen.findByRole("button", { name: CONFIRM });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(MSG)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clicking confirm with an empty name shows the inline error, focuses the field, and does not submit", async () => {
    renderPage();
    const btn = await screen.findByRole("button", { name: CONFIRM });
    fireEvent.click(btn);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(MSG);
    const input = screen.getByPlaceholderText("Imię i nazwisko");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
    expect(document.activeElement).toBe(input);
    expect(receiptSubmit).not.toHaveBeenCalled();
  });

  it("clears the error and hint once a name is typed", async () => {
    renderPage();
    const btn = await screen.findByRole("button", { name: CONFIRM });
    fireEvent.click(btn);
    await screen.findByRole("alert");
    fireEvent.change(screen.getByPlaceholderText("Imię i nazwisko"), {
      target: { value: "Ela" },
    });
    await waitFor(() => expect(screen.queryByText(MSG)).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the error out of the field's accessible name (it is only the description)", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: CONFIRM }));
    const alert = await screen.findByRole("alert");
    // input[list] → combobox. The name must stay the label alone; the error is
    // announced once, via aria-describedby.
    const field = screen.getByRole("combobox", { name: "Kto odebrał" });
    expect(field.getAttribute("aria-describedby")).toBe(alert.id);
  });

  it("submits once with the trimmed name when the name is filled", async () => {
    receiptSubmit.mockResolvedValue({ receipt_id: "R-1" });
    renderPage();
    const btn = await screen.findByRole("button", { name: CONFIRM });
    fireEvent.change(screen.getByPlaceholderText("Imię i nazwisko"), {
      target: { value: "  Ela  " },
    });
    fireEvent.click(btn);
    await waitFor(() => expect(receiptSubmit).toHaveBeenCalledTimes(1));
    expect(receiptSubmit.mock.calls[0][0]).toMatchObject({
      order_id: "ORD-1",
      received_by: "Ela",
      lines: [{ order_line_id: "L1", received_qty_purchase: 2 }],
    });
  });

  it("still disables the button while a delivered line is blank (recount gate unchanged)", async () => {
    renderPage();
    const btn = await screen.findByRole("button", { name: CONFIRM });
    fireEvent.change(screen.getByPlaceholderText("Imię i nazwisko"), {
      target: { value: "Ela" },
    });
    fireEvent.change(screen.getByLabelText("Dostarczono — Produkt 1"), {
      target: { value: "" },
    });
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(btn);
    expect(receiptSubmit).not.toHaveBeenCalled();
  });
});
