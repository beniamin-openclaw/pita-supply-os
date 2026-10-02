import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { LangProvider, useT } from "./index";
import { formatPacks, formatPacksParts } from "../lib/packUnits";

function Probe() {
  const { tParts } = useT();
  return (
    <p data-testid="out">
      {tParts("card.belowMin", { min: 5, unit: <b>kg</b> })}
    </p>
  );
}

describe("tParts", () => {
  it("keeps the template text and renders node vars as elements", () => {
    render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );
    expect(screen.getByTestId("out")).toHaveTextContent("Poniżej minimum: 5 kg");
    expect(screen.getByTestId("out").querySelector("b")?.textContent).toBe("kg");
  });
});

describe("formatPacksParts", () => {
  it("joins to exactly formatPacks", () => {
    for (const [n, unit] of [[1, "zgrzewka"], [1.7, "zgrzewka"], [5, "karton"]] as const) {
      const p = formatPacksParts(n, unit, "pl");
      expect(`${p.qty} ${p.unit}`).toBe(formatPacks(n, unit, "pl"));
    }
  });
});
