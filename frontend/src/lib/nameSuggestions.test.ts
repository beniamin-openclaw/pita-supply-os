import { describe, it, expect, afterEach, vi } from "vitest";
import { getNameSuggestions, addNameSuggestion } from "./nameSuggestions";

// Map-backed localStorage stub — mirrors the pattern in apiClient.test.ts /
// transport.test.ts (avoids depending on jsdom's real localStorage, and lets
// us simulate a throwing storage for the private-mode/quota cases below).
function stubStorage(entries: Record<string, string> = {}): Map<string, string> {
  const store = new Map(Object.entries(entries));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

function stubThrowingStorage(): void {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("storage disabled");
    },
    setItem: () => {
      throw new Error("storage disabled");
    },
    removeItem: () => {
      throw new Error("storage disabled");
    },
    clear: () => {
      throw new Error("storage disabled");
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getNameSuggestions", () => {
  it("returns [] when nothing has been stored for the role", () => {
    stubStorage();
    expect(getNameSuggestions("ordered_by")).toEqual([]);
  });

  it("returns the stored names for the role", () => {
    stubStorage({ supply_os_name_suggestions_ordered_by: JSON.stringify(["Ala", "Bartek"]) });
    expect(getNameSuggestions("ordered_by")).toEqual(["Ala", "Bartek"]);
  });

  it("returns [] on corrupt JSON instead of throwing", () => {
    stubStorage({ supply_os_name_suggestions_ordered_by: "{not json" });
    expect(getNameSuggestions("ordered_by")).toEqual([]);
  });

  it("returns [] when the stored value is valid JSON but not an array", () => {
    stubStorage({ supply_os_name_suggestions_ordered_by: JSON.stringify({ foo: "bar" }) });
    expect(getNameSuggestions("ordered_by")).toEqual([]);
  });

  it("filters out non-string entries from a malformed array", () => {
    stubStorage({
      supply_os_name_suggestions_ordered_by: JSON.stringify(["Ala", 42, null, "Bartek"]),
    });
    expect(getNameSuggestions("ordered_by")).toEqual(["Ala", "Bartek"]);
  });

  it("returns [] instead of throwing when storage access itself throws", () => {
    stubThrowingStorage();
    expect(getNameSuggestions("ordered_by")).toEqual([]);
  });
});

describe("addNameSuggestion", () => {
  it("adds a name so it is returned by getNameSuggestions", () => {
    stubStorage();
    addNameSuggestion("ordered_by", "Ala");
    expect(getNameSuggestions("ordered_by")).toEqual(["Ala"]);
  });

  it("puts the most recently added name first", () => {
    stubStorage();
    addNameSuggestion("ordered_by", "Ala");
    addNameSuggestion("ordered_by", "Bartek");
    expect(getNameSuggestions("ordered_by")).toEqual(["Bartek", "Ala"]);
  });

  it("moves an existing name to the front instead of duplicating it", () => {
    stubStorage();
    addNameSuggestion("ordered_by", "Ala");
    addNameSuggestion("ordered_by", "Bartek");
    addNameSuggestion("ordered_by", "Ala");
    expect(getNameSuggestions("ordered_by")).toEqual(["Ala", "Bartek"]);
  });

  it("dedupes case-insensitively, keeping the latest casing", () => {
    stubStorage();
    addNameSuggestion("ordered_by", "ala");
    addNameSuggestion("ordered_by", "Bartek");
    addNameSuggestion("ordered_by", "ALA");
    expect(getNameSuggestions("ordered_by")).toEqual(["ALA", "Bartek"]);
  });

  it("trims surrounding whitespace before storing", () => {
    stubStorage();
    addNameSuggestion("ordered_by", "  Ala  ");
    expect(getNameSuggestions("ordered_by")).toEqual(["Ala"]);
  });

  it("ignores a blank or whitespace-only name", () => {
    stubStorage();
    addNameSuggestion("ordered_by", "   ");
    addNameSuggestion("ordered_by", "");
    expect(getNameSuggestions("ordered_by")).toEqual([]);
  });

  it("caps the list at 10 names, dropping the oldest", () => {
    stubStorage();
    for (let i = 1; i <= 11; i++) {
      addNameSuggestion("ordered_by", `Name${i}`);
    }
    const names = getNameSuggestions("ordered_by");
    expect(names).toHaveLength(10);
    expect(names[0]).toBe("Name11");
    expect(names).not.toContain("Name1"); // oldest, pushed out
  });

  it("keeps roles independent — ordered_by and received_by don't leak", () => {
    stubStorage();
    addNameSuggestion("ordered_by", "Kapitan Ala");
    addNameSuggestion("received_by", "Magazynier Bartek");
    expect(getNameSuggestions("ordered_by")).toEqual(["Kapitan Ala"]);
    expect(getNameSuggestions("received_by")).toEqual(["Magazynier Bartek"]);
  });

  it("never throws when storage access itself throws", () => {
    stubThrowingStorage();
    expect(() => addNameSuggestion("ordered_by", "Ala")).not.toThrow();
  });
});
