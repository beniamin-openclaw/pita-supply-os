// Vitest global setup. Registers @testing-library/jest-dom matchers
// (toBeInTheDocument, etc.) and — because we run with globals:false — wires up
// React Testing Library's between-test DOM cleanup explicitly.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
});
