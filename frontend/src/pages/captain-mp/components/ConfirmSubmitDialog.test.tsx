// ConfirmSubmitDialog — the non-blocking "already sent today" warning
// (captain-sent-today): shown with the time, announced via aria-describedby,
// and the Captain can still confirm.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import { ConfirmSubmitDialog, type SentTodayWarning } from "./ConfirmSubmitDialog";

const SUBMITTED_AT = "2026-10-17T08:15:00Z";
const WARSAW_TIME = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(SUBMITTED_AT));

function renderDialog(
  sentToday: SentTodayWarning | null,
  criticalMissing: string[] = [],
): { onConfirm: ReturnType<typeof vi.fn> } {
  const onConfirm = vi.fn();
  render(
    <LangProvider>
      <ConfirmSubmitDialog
        open
        lineCount={3}
        deviationCount={0}
        reasonCount={0}
        criticalMissing={criticalMissing}
        onConfirm={onConfirm}
        onCancel={() => {}}
        sentToday={sentToday}
      />
    </LangProvider>,
  );
  return { onConfirm };
}

describe("ConfirmSubmitDialog — sent today", () => {
  it("warns with the time and still lets the Captain send", () => {
    const { onConfirm } = renderDialog({ supplierName: "Bukat", submittedAt: SUBMITTED_AT });
    expect(screen.getByTestId("confirm-sent-today")).toHaveTextContent(
      `Dziś już wysłano zamówienie do Bukat (${WARSAW_TIME}). Wysłać kolejne?`,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-describedby")).toBe(
      "confirm-submit-summary confirm-submit-sent-today",
    );
    fireEvent.click(screen.getByRole("button", { name: "Wyślij mimo to" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("drops the time when the order carries none", () => {
    renderDialog({ supplierName: "Bukat", submittedAt: null });
    expect(screen.getByTestId("confirm-sent-today")).toHaveTextContent(
      "Dziś już wysłano zamówienie do Bukat. Wysłać kolejne?",
    );
  });

  it("combines with the critical warning", () => {
    renderDialog({ supplierName: "Bukat", submittedAt: SUBMITTED_AT }, ["Pita"]);
    expect(screen.getByRole("dialog").getAttribute("aria-describedby")).toBe(
      "confirm-submit-summary confirm-submit-sent-today confirm-submit-warning",
    );
    expect(screen.getByRole("button", { name: "Wyślij mimo to" })).toBeInTheDocument();
  });

  it("defaults to no warning when the prop is omitted", () => {
    render(
      <LangProvider>
        <ConfirmSubmitDialog
          open
          lineCount={3}
          deviationCount={0}
          reasonCount={0}
          criticalMissing={[]}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </LangProvider>,
    );
    expect(screen.queryByTestId("confirm-sent-today")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog").getAttribute("aria-describedby")).toBe(
      "confirm-submit-summary",
    );
    expect(screen.getByRole("button", { name: "Tak, wyślij" })).toBeInTheDocument();
  });

  it("keeps the plain confirm without any warning", () => {
    renderDialog(null);
    expect(screen.queryByTestId("confirm-sent-today")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog").getAttribute("aria-describedby")).toBe(
      "confirm-submit-summary",
    );
    expect(screen.getByRole("button", { name: "Tak, wyślij" })).toBeInTheDocument();
  });
});
