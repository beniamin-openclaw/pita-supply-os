import { useState } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import { PackStockInput } from "./PackStockInput";

function Controlled({
  initial,
  spy,
  references,
}: {
  initial: number | "";
  spy: (v: number | "") => void;
  references?: Array<number | null | undefined>;
}) {
  const [value, setValue] = useState<number | "">(initial);
  return (
    <>
      <PackStockInput
        idPrefix="current-P1"
        value={value}
        onChange={(v) => {
          spy(v);
          setValue(v);
        }}
        unitsPerPack={15}
        packUnit="blok"
        baseUnit="kg"
        label="Obecny stan"
        references={references}
      />
      <button type="button" onClick={() => setValue(30)}>
        external30
      </button>
    </>
  );
}

// Simulates the Captain re-typing a field and leaving it (the prompt only
// follows the Captain's own typing, never an untouched value).
function retype(el: HTMLElement, v: string): void {
  fireEvent.focus(el);
  fireEvent.change(el, { target: { value: "" } });
  fireEvent.change(el, { target: { value: v } });
  fireEvent.blur(el);
}

function setup(initial: number | "" = "", references?: Array<number | null | undefined>) {
  const spy = vi.fn();
  render(
    <LangProvider>
      <Controlled initial={initial} spy={spy} references={references} />
    </LangProvider>,
  );
  return {
    spy,
    packs: () => document.getElementById("current-P1-packs") as HTMLInputElement,
    loose: () => document.getElementById("current-P1-loose") as HTMLInputElement,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PackStockInput", () => {
  it("typing 20 in the loose field emits 20 and reads the split", () => {
    const { spy, loose } = setup();
    fireEvent.change(loose(), { target: { value: "20" } });
    expect(spy).toHaveBeenLastCalledWith(20);
    expect(screen.getByText("= 1 blok + 5 kg (20 kg)")).toBeInTheDocument();
    // echo did not re-seed the half-edit
    expect(loose().value).toBe("20");
  });

  it("typing 1 pack then 5 loose emits 20", () => {
    const { spy, packs, loose } = setup();
    fireEvent.change(packs(), { target: { value: "1" } });
    expect(spy).toHaveBeenLastCalledWith(15);
    fireEvent.change(loose(), { target: { value: "5" } });
    expect(spy).toHaveBeenLastCalledWith(20);
  });

  it("clearing both emits blank; 0 alone emits 0", () => {
    const { spy, packs, loose } = setup();
    fireEvent.change(loose(), { target: { value: "0" } });
    expect(spy).toHaveBeenLastCalledWith(0);
    fireEvent.change(packs(), { target: { value: "2" } });
    fireEvent.change(packs(), { target: { value: "" } });
    fireEvent.change(loose(), { target: { value: "" } });
    expect(spy).toHaveBeenLastCalledWith("");
  });

  it("an external value change re-seeds with explicit zeros", () => {
    const { packs, loose } = setup(6);
    expect(packs().value).toBe("0");
    expect(loose().value).toBe("6");
    fireEvent.click(screen.getByText("external30"));
    expect(packs().value).toBe("2");
    expect(loose().value).toBe("0");
  });

  it("the echo of an emitted value does not re-seed a half-typed '2,'", () => {
    const { spy, packs } = setup();
    fireEvent.change(packs(), { target: { value: "2," } });
    expect(spy).toHaveBeenLastCalledWith(30);
    expect(packs().value).toBe("2,");
  });

  it("prompt: appears for loose 6 with references [90] only after blur; yes fixes to 90", () => {
    const { spy, packs, loose } = setup("", [90]);
    fireEvent.focus(loose());
    fireEvent.change(loose(), { target: { value: "6" } });
    expect(screen.queryByText(/Czy chodziło/)).not.toBeInTheDocument();
    fireEvent.blur(loose());
    expect(screen.getByText("Czy chodziło o 6 bloków (90 kg)?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tak, popraw" }));
    expect(spy).toHaveBeenLastCalledWith(90);
    expect(packs().value).toBe("6");
    expect(loose().value).toBe("0");
    expect(screen.queryByText(/Czy chodziło/)).not.toBeInTheDocument();
  });

  it("no prompt on mount for an untouched value", () => {
    setup(6, [90]);
    expect(screen.queryByText(/Czy chodziło/)).not.toBeInTheDocument();
  });

  it("prompt: 'Nie' hides it", () => {
    const { loose } = setup(6, [90]);
    retype(loose(), "6");
    expect(screen.getByText(/Czy chodziło/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nie" }));
    expect(screen.queryByText(/Czy chodziło/)).not.toBeInTheDocument();
  });

  it("no prompt when references are small", () => {
    setup(6, [8, 6]);
    expect(screen.queryByText(/Czy chodziło/)).not.toBeInTheDocument();
  });

  it("English labels", () => {
    // jsdom's localStorage here lacks setItem — stub the store the provider reads.
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k === "supply_os_lang" ? "en" : null),
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
    setup(20);
    expect(screen.getByLabelText("Obecny stan, block")).toBeInTheDocument();
    expect(screen.getByText("= 1 block + 5 kg (20 kg)")).toBeInTheDocument();
  });
});
