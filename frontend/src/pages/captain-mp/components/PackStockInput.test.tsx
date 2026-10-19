import { useState } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import { PackStockInput } from "./PackStockInput";
import { innermostText } from "../../../test/innermostText";

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
    expect(screen.getByText(innermostText("= 1 blok + 5 kg (20 kg)"))).toBeInTheDocument();
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
    expect(screen.getByText(innermostText("Czy chodziło o 6 bloków (90 kg)?"))).toBeInTheDocument();
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
    expect(screen.getByText(innermostText("= 1 block + 5 kg (20 kg)"))).toBeInTheDocument();
  });
});

describe("PackStockInput — N1 double entry on a stock count", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("describes the fields with the prompt while it shows; an external change clears it", () => {
    const { packs, loose } = setup("", [40]);
    fireEvent.change(packs(), { target: { value: "2" } });
    fireEvent.change(loose(), { target: { value: "30" } });
    expect(screen.getByText(/ta sama ilość/)).toBeInTheDocument();
    expect(loose().getAttribute("aria-describedby")).toContain("current-P1-double");
    fireEvent.click(screen.getByRole("button", { name: "external30" }));
    expect(screen.queryByText(/ta sama ilość/)).not.toBeInTheDocument();
    expect(loose().getAttribute("aria-describedby")).not.toContain("current-P1-double");
  });

  it("'Nie' hides it for that pair only; a new pair asks again", () => {
    const { packs, loose } = setup("", [40]);
    fireEvent.change(packs(), { target: { value: "2" } });
    fireEvent.change(loose(), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Nie, razem 60 kg" }));
    expect(screen.queryByText(/ta sama ilość/)).not.toBeInTheDocument();
    fireEvent.change(packs(), { target: { value: "3" } });
    fireEvent.change(loose(), { target: { value: "45" } });
    expect(screen.getByText(/ta sama ilość/)).toBeInTheDocument();
  });

  it("English copy", () => {
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k === "supply_os_lang" ? "en" : null),
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
    const { packs, loose } = setup("", [40]);
    fireEvent.change(packs(), { target: { value: "2" } });
    fireEvent.change(loose(), { target: { value: "30" } });
    expect(
      screen.getByText(
        innermostText("That is 60 kg in total. Are 30 kg and 2 blocks the same amount?"),
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No, 60 kg in total" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, only 30 kg" })).toBeInTheDocument();
  });
});

// captain-kg-reading: the stock reading adds the kg only for a piece base unit,
// the stock copy and a known per-piece weight.
describe("PackStockInput kg reading", () => {
  function renderPack(props: {
    value: number | "";
    baseUnit: string;
    packUnit: string;
    upp: number;
    gramsPerUnit: number | null;
    copy?: "stock" | "order";
  }) {
    render(
      <LangProvider>
        <PackStockInput
          idPrefix="kg-P1"
          value={props.value}
          onChange={vi.fn()}
          unitsPerPack={props.upp}
          packUnit={props.packUnit}
          baseUnit={props.baseUnit}
          label="Obecny stan"
          copy={props.copy}
          gramsPerUnit={props.gramsPerUnit}
        />
      </LangProvider>,
    );
    return document.getElementById("kg-P1-reading") as HTMLElement;
  }

  it("24 szt in kartons of 12 at 200 g: = 2 kartony (24 szt · 4,8 kg)", () => {
    const reading = renderPack({
      value: 24,
      baseUnit: "szt",
      packUnit: "karton",
      upp: 12,
      gramsPerUnit: 200,
    });
    expect(reading).toHaveTextContent("= 2 kartony (24 szt · 4,8 kg)");
  });

  it("a kg base unit never gets a kg part (unit check reads baseUnit, not packUnit)", () => {
    const reading = renderPack({
      value: 30,
      baseUnit: "kg",
      packUnit: "szt",
      upp: 15,
      gramsPerUnit: 15000,
    });
    expect(reading).toHaveTextContent("= 2 szt (30 kg)");
    expect(reading.textContent).not.toMatch(/450/);
  });

  it("the bulk-pack order copy ignores gramsPerUnit", () => {
    const reading = renderPack({
      value: 24,
      baseUnit: "szt",
      packUnit: "karton",
      upp: 12,
      gramsPerUnit: 200,
      copy: "order",
    });
    expect(reading).toHaveTextContent("= 2 kartony (24 szt)");
  });

  it("a 0 count reads = 0 szt with no kg", () => {
    const reading = renderPack({
      value: 0,
      baseUnit: "szt",
      packUnit: "karton",
      upp: 12,
      gramsPerUnit: 200,
    });
    expect(reading).toHaveTextContent(/^= 0 szt$/);
  });

  it("without a weight the reading is unchanged", () => {
    const reading = renderPack({
      value: 24,
      baseUnit: "szt",
      packUnit: "karton",
      upp: 12,
      gramsPerUnit: null,
    });
    expect(reading).toHaveTextContent(/^= 2 kartony \(24 szt\)$/);
  });

  // The reserved own line is for kg-capable rows only; every other row keeps
  // the reading beside the fields exactly as before.
  it.each([
    ["no weight", { baseUnit: "szt", gramsPerUnit: null }],
    ["kg base unit", { baseUnit: "kg", gramsPerUnit: 15000 }],
    ["order copy", { baseUnit: "szt", gramsPerUnit: 200, copy: "order" as const }],
  ])("layout unchanged: %s", (_label, p) => {
    const reading = renderPack({ value: 24, packUnit: "karton", upp: 12, ...p });
    expect(reading).toHaveClass("py-3");
    expect(reading).not.toHaveClass("basis-full");
  });

  it("kg-capable row: the reading takes its own line, even before a count", () => {
    const reading = renderPack({
      value: "",
      baseUnit: "szt",
      packUnit: "karton",
      upp: 12,
      gramsPerUnit: 200,
    });
    expect(reading).toHaveClass("basis-full");
    expect(reading).not.toHaveClass("py-3");
  });
});
