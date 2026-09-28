import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import { CoveragePrompt } from "./CoveragePrompt";

function renderPrompt(value: 1 | 3 | null) {
  const onChange = vi.fn();
  render(
    <LangProvider>
      <CoveragePrompt value={value} onChange={onChange} />
    </LangProvider>,
  );
  return onChange;
}

describe("CoveragePrompt", () => {
  it("shows the reminder and two unpressed choices", () => {
    renderPrompt(null);
    expect(screen.getByText("Pamiętaj o ilościach na 3 dni!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "na 1 dzień" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.getByRole("button", { name: "na 3 dni (do końca tygodnia)" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Czy ilości wystarczą do końca weekendu?")).toBeNull();
  });

  it("reports a choice", () => {
    const onChange = renderPrompt(null);
    fireEvent.click(screen.getByRole("button", { name: "na 1 dzień" }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("asks the weekend question only for 3 days", () => {
    renderPrompt(3);
    expect(
      screen.getByRole("button", { name: "na 3 dni (do końca tygodnia)" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Czy ilości wystarczą do końca weekendu?")).toBeInTheDocument();
  });

  it("does not ask the weekend question for 1 day", () => {
    renderPrompt(1);
    expect(screen.queryByText("Czy ilości wystarczą do końca weekendu?")).toBeNull();
  });
});
