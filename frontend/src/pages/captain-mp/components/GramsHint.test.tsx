import { useState } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import { DecimalInput } from "../../../components/ui/DecimalInput";
import { GramsHint } from "./GramsHint";
import { innermostText } from "../../../test/innermostText";

function Host({ spy, name }: { spy: (v: number | "") => void; name: string }) {
  const [value, setValue] = useState<number | "">("");
  const change = (v: number | ""): void => {
    spy(v);
    setValue(v);
  };
  return (
    <LangProvider>
      <GramsHint value={value} onChange={change} names={[name]} unit="szt" inputId="stock-P1">
        <DecimalInput id="stock-P1" inputMode="decimal" value={value} onChange={change} />
      </GramsHint>
    </LangProvider>
  );
}

const input = (): HTMLInputElement => document.getElementById("stock-P1") as HTMLInputElement;

afterEach(cleanup);

describe("GramsHint", () => {
  it("proposes pieces only after blur; accept replaces the value", () => {
    const spy = vi.fn();
    render(<Host spy={spy} name="Prymat Pieprz czarny mielony 820g" />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "400" } });
    expect(screen.queryByTestId("grams-hint")).not.toBeInTheDocument();
    fireEvent.blur(input());
    expect(
      screen.getByText(innermostText("Czy chodziło o 0,5 szt? (1 szt = 820 g)")),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tak, wpisz 0,5 szt" }));
    expect(spy).toHaveBeenLastCalledWith(0.5);
    expect(input().value).toBe("0.5");
    expect(screen.queryByTestId("grams-hint")).not.toBeInTheDocument();
  });

  it("dismiss keeps the typed value", () => {
    const spy = vi.fn();
    render(<Host spy={spy} name="Prymat Oregano 110g" />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "400" } });
    fireEvent.blur(input());
    fireEvent.click(screen.getByRole("button", { name: "Nie" }));
    expect(screen.queryByTestId("grams-hint")).not.toBeInTheDocument();
    expect(input().value).toBe("400");
  });

  it("no hint for a normal count or a name without weight", () => {
    const { unmount } = render(<Host spy={vi.fn()} name="Prymat Oregano 110g" />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "12" } });
    fireEvent.blur(input());
    expect(screen.queryByTestId("grams-hint")).not.toBeInTheDocument();
    unmount();
    render(<Host spy={vi.fn()} name="Pita biała" />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "400" } });
    fireEvent.blur(input());
    expect(screen.queryByTestId("grams-hint")).not.toBeInTheDocument();
  });
});
