import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import { InventorySubmittedCard } from "./InventorySubmittedCard";

function renderCard(overrides: Partial<Parameters<typeof InventorySubmittedCard>[0]> = {}) {
  const onViewHistory = vi.fn();
  const onNewCount = vi.fn();
  render(
    <LangProvider>
      <InventorySubmittedCard
        submittedAt={Date.UTC(2026, 8, 6, 12, 34)}
        who="Ala"
        lineCount={12}
        onViewHistory={onViewHistory}
        onNewCount={onNewCount}
        {...overrides}
      />
    </LangProvider>,
  );
  return { onViewHistory, onNewCount };
}

describe("InventorySubmittedCard", () => {
  it("renders the title", () => {
    renderCard();
    expect(screen.getByText("Remanent zapisany")).toBeInTheDocument();
  });

  it("shows submit date+time, who counted and the pluralized line count", () => {
    renderCard({ who: "Ala", lineCount: 12 });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("6.09.2026, 14:34"); // pl-PL, Europe/Warsaw
    expect(status).toHaveTextContent("Ala");
    expect(status).toHaveTextContent("12 pozycji");
  });

  it("calls onViewHistory when the primary button is clicked", () => {
    const { onViewHistory, onNewCount } = renderCard();
    fireEvent.click(screen.getByText("Zobacz w historii"));
    expect(onViewHistory).toHaveBeenCalledTimes(1);
    expect(onNewCount).not.toHaveBeenCalled();
  });

  it("calls onNewCount when the secondary button is clicked", () => {
    const { onViewHistory, onNewCount } = renderCard();
    fireEvent.click(screen.getByText("Nowy remanent"));
    expect(onNewCount).toHaveBeenCalledTimes(1);
    expect(onViewHistory).not.toHaveBeenCalled();
  });
});
