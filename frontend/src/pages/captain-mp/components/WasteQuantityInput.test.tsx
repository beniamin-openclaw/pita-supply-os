import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { LangProvider } from "../../../i18n";
import { WasteQuantityInput } from "./WasteQuantityInput";

function Example() { const [value, setValue] = useState(""); return <LangProvider><WasteQuantityInput value={value} onChange={setValue} unit="g" additions={["50", "100"]} /></LangProvider>; }
describe("WasteQuantityInput", () => {
  it("adds repeated and mixed tiles and disables additions for invalid text", () => {
    render(<Example />);
    fireEvent.click(screen.getByRole("button", {name: "+100 g"}));
    fireEvent.click(screen.getByRole("button", {name: "+100 g"}));
    fireEvent.click(screen.getByRole("button", {name: "+50 g"}));
    const input = screen.getByLabelText("Ilość (g)");
    expect(input).toHaveValue("250");
    fireEvent.change(input, {target: {value: "250x"}});
    expect(screen.getByRole("button", {name: "+50 g"})).toBeDisabled();
  });
});
