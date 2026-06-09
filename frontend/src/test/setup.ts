// Vitest global setup. Registers @testing-library/jest-dom matchers
// (toBeInTheDocument, etc.) and — because we run with globals:false — wires up
// React Testing Library's between-test DOM cleanup explicitly.
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Clear localStorage before each test so locale-dependent tests (LangProvider
// reads supply_os_lang) are not contaminated by a prior test that set
// a different language.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});
