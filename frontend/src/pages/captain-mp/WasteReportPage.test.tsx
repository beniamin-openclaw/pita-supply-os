import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LangProvider } from "../../i18n";
import { setToken } from "../../auth";
import { WasteReportPage } from "./WasteReportPage";

const catalog = { items: [{ product_id: "tomato", name_pl: "Pomidor", name_en: "Tomato", section: "fridge", unit: "kg", display_unit: "g", quick_additions: ["50", "100"], calibration: "provisional" }] };
const list = { reports: [], totals: [], next_cursor: null };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const saved = (body: string) => { const p = JSON.parse(body); return { report_id: "r1", batch_uuid: p.batch_uuid, business_date: p.business_date, lines: p.lines.map((line: Record<string, unknown>) => ({...line, submitted_quantity: line.quantity, submitted_unit: line.unit})) }; };
function mount() { return render(<LangProvider><MemoryRouter><WasteReportPage /></MemoryRouter></LangProvider>); }
async function fill() {
  const product = await screen.findByLabelText("Produkt");
  await waitFor(() => expect(within(product).getByText("Pomidor")).toBeInTheDocument());
  fireEvent.change(product, { target: { value: "tomato" } });
  fireEvent.click(screen.getByRole("button", { name: "+100 g" }));
  fireEvent.change(screen.getByLabelText("Powód"), { target: { value: "dropped" } });
}
beforeEach(() => { localStorage.clear(); setToken("captain", "captain-a"); vi.stubGlobal("crypto", webcrypto); });
afterEach(() => { vi.unstubAllGlobals(); });
describe("waste save lifecycle", () => {
  it("retains an uncertain submission through 404 and retries its identical payload", async () => {
    const posts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("catalog")) return json(catalog);
      if (url.includes("by-batch")) return json({ detail: { code: "waste_not_found", write_outcome: "rejected" } }, 404);
      if (init?.method === "POST") { posts.push(String(init.body)); if (posts.length === 1) throw new Error("lost"); return json(saved(posts[1])); }
      return json(list);
    }));
    mount(); await fill(); fireEvent.click(screen.getByRole("button", {name: "Zapisz straty"}));
    expect(await screen.findByRole("button", {name: "Sprawdź zapis"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: "Sprawdź zapis"}));
    await waitFor(() => expect(screen.getByRole("button", {name: "Ponów ten sam zapis"})).toBeEnabled());
    expect(screen.getByLabelText("Produkt")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", {name: "Ponów ten sam zapis"}));
    expect(await screen.findByText("Zapisano straty.")).toBeInTheDocument();
    expect(posts).toHaveLength(2); expect(posts[1]).toBe(posts[0]);
  });
  it("retains editable input after 422 with a fresh batch on correction", async () => {
    const posts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("catalog")) return json(catalog);
      if (init?.method === "POST") { posts.push(String(init.body)); return posts.length === 1 ? json({detail: []}, 422) : json(saved(posts[1])); }
      return json(list);
    }));
    mount(); await fill(); fireEvent.click(screen.getByRole("button", {name:"Zapisz straty"}));
    await waitFor(() => expect(screen.getByLabelText("Ilość (g)")).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Ilość (g)"), {target:{value:"150"}});
    fireEvent.click(screen.getByRole("button", {name:"Zapisz straty"}));
    await screen.findByText("Zapisano straty.");
    expect(JSON.parse(posts[0]).batch_uuid).not.toBe(JSON.parse(posts[1]).batch_uuid);
  });
  it("keeps the original frozen when a later retry is rejected before writing", async () => {
    const posts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("catalog")) return json(catalog);
      if (init?.method === "POST") {
        posts.push(String(init.body));
        if (posts.length === 1) throw new Error("unknown outcome");
        return json({detail:{code:"waste_unavailable",write_outcome:"rejected"}}, 503);
      }
      return json(list);
    }));
    mount(); await fill(); fireEvent.click(screen.getByRole("button", {name:"Zapisz straty"}));
    fireEvent.click(await screen.findByRole("button", {name:"Ponów ten sam zapis"}));
    await waitFor(() => expect(posts).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole("button", {name:"Ponów ten sam zapis"})).toBeEnabled());
    expect(screen.getByLabelText("Produkt")).toBeDisabled();
    expect(posts[1]).toBe(posts[0]);
    const draftKey = Object.keys(localStorage).find(k => k.startsWith("supply_os_waste_"))!;
    expect(JSON.parse(localStorage.getItem(draftKey)!).frozen.batch_uuid).toBe(JSON.parse(posts[0]).batch_uuid);
  });
  it("never submits a draft after the token changes", async () => {
    const fetcher = vi.fn(async (url: string) => json(url.includes("catalog") ? catalog : list));
    vi.stubGlobal("fetch", fetcher); mount(); await fill();
    setToken("captain", "captain-b");
    fireEvent.click(screen.getByRole("button", {name:"Zapisz straty"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Zmieniono kod dostępu");
    expect(fetcher.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toHaveLength(0);
  });
  it("restores the frozen in-flight draft and blocks retry under another token", async () => {
    let finish: (response: Response) => void = () => {};
    const posts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("catalog")) return json(catalog);
      if (init?.method === "POST") { posts.push(String(init.body)); return new Promise<Response>(resolve => { finish = resolve; }); }
      return json(list);
    }));
    const view = mount(); await fill(); fireEvent.click(screen.getByRole("button", {name:"Zapisz straty"}));
    await waitFor(() => expect(posts).toHaveLength(1));
    view.unmount(); mount();
    expect(await screen.findByRole("button", {name:"Ponów ten sam zapis"})).toBeEnabled();
    setToken("captain", "other"); fireEvent.click(screen.getByRole("button", {name:"Ponów ten sam zapis"}));
    expect(posts).toHaveLength(1);
    expect(await screen.findByRole("alert")).toHaveTextContent("Zmieniono kod dostępu");
    finish(json(saved(posts[0])));
  });
  it("saves multiple rows together, rejects invalid raw input, then appends a new batch", async () => {
    const posts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("catalog")) return json(catalog);
      if (init?.method === "POST") { posts.push(String(init.body)); return json(saved(posts.at(-1)!)); }
      return json(list);
    }));
    mount(); await fill();
    fireEvent.click(screen.getByRole("button", {name:"Dodaj pozycję"}));
    const products = screen.getAllByLabelText("Produkt");
    fireEvent.change(products[1], {target:{value:"__other__"}});
    fireEvent.change(screen.getByLabelText("Nazwa produktu"), {target:{value:"Sos"}});
    fireEvent.change(screen.getByLabelText("Ilość (kg)"), {target:{value:"1x"}});
    fireEvent.change(screen.getAllByLabelText("Powód")[1], {target:{value:"other"}});
    fireEvent.change(screen.getByLabelText("Wyjaśnienie"), {target:{value:"Próba"}});
    fireEvent.click(screen.getByRole("button", {name:"Zapisz straty"}));
    expect(posts).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Ilość (kg)"), {target:{value:"0,125"}});
    fireEvent.click(screen.getByRole("button", {name:"Zapisz straty"}));
    await screen.findByText("Zapisano straty.");
    expect(JSON.parse(posts[0]).lines).toHaveLength(2);
    expect(JSON.parse(posts[0]).lines[1].quantity).toBe("0.125");
    await fill(); fireEvent.click(screen.getByRole("button", {name:"Zapisz straty"}));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(JSON.parse(posts[1]).batch_uuid).not.toBe(JSON.parse(posts[0]).batch_uuid);
    expect(JSON.parse(posts[1]).lines).toHaveLength(1);
  });
  it("blocks a stale same-token tab from overwriting an in-flight frozen batch", async () => {
    let finish: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("catalog")) return json(catalog);
      if (init?.method === "POST") return new Promise<Response>(resolve => { finish = resolve; });
      return json(list);
    }));
    const first = mount(); await fill();
    const second = mount();
    await waitFor(() => expect(within(second.container).getByLabelText("Ilość (g)")).toHaveValue("100"));
    fireEvent.click(within(first.container).getByRole("button", {name:"Zapisz straty"}));
    const draftKey = Object.keys(localStorage).find(k => k.startsWith("supply_os_waste_"))!;
    await waitFor(() => expect(JSON.parse(localStorage.getItem(draftKey)!).frozen).toBeTruthy());
    const frozen = localStorage.getItem(draftKey);
    fireEvent.change(within(second.container).getByLabelText("Ilość (g)"), {target:{value:"150"}});
    expect(localStorage.getItem(draftKey)).toBe(frozen);
    expect(within(second.container).getByRole("alert")).toHaveTextContent("Szkic zmienił się w innej karcie");
    expect(within(second.container).getByRole("button", {name:"Zapisz straty"})).toBeDisabled();
    finish(json({}));
  });
  it("preserves a newer draft when an earlier save succeeds late", async () => {
    let finish: (response: Response) => void = () => {};
    let body = "";
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("catalog")) return json(catalog);
      if (init?.method === "POST") { body = String(init.body); return new Promise<Response>(resolve => { finish = resolve; }); }
      return json(list);
    }));
    mount(); await fill(); fireEvent.click(screen.getByRole("button", {name:"Zapisz straty"}));
    await waitFor(() => expect(body).not.toBe(""));
    const draftKey = Object.keys(localStorage).find(k => k.startsWith("supply_os_waste_"))!;
    const newer = JSON.stringify({...JSON.parse(localStorage.getItem(draftKey)!), batch:"new-batch", frozen:null, rows:[{product:"tomato",quantity:"200",unit:"kg",description:"",reason:"dropped",detail:""}]});
    localStorage.setItem(draftKey, newer);
    finish(json(saved(body)));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Szkic zmienił się w innej karcie"));
    expect(localStorage.getItem(draftKey)).toBe(newer);
  });
  it("locks the form immediately on another tab's storage event", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => json(url.includes("catalog") ? catalog : list)));
    mount(); await fill();
    const draftKey = Object.keys(localStorage).find(k => k.startsWith("supply_os_waste_"))!;
    const replacement = JSON.stringify({...JSON.parse(localStorage.getItem(draftKey)!), batch:"new-batch"});
    localStorage.setItem(draftKey, replacement);
    fireEvent(window, new StorageEvent("storage", {key:draftKey, newValue:replacement}));
    expect(screen.getByRole("alert")).toHaveTextContent("Szkic zmienił się w innej karcie");
    expect(screen.getByLabelText("Ilość (g)")).toBeDisabled();
    expect(screen.getByRole("button", {name:"Zapisz straty"})).toBeDisabled();
  });
  it("focuses and marks custom invalid fields, including whitespace and overflow", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => json(url.includes("catalog") ? catalog : list)));
    mount(); await fill();
    fireEvent.change(screen.getByLabelText("Produkt"), {target:{value:"__other__"}});
    fireEvent.change(screen.getByLabelText("Nazwa produktu"), {target:{value:"   "}});
    fireEvent.change(screen.getByLabelText("Ilość (kg)"), {target:{value:"1000000"}});
    fireEvent.change(screen.getByLabelText("Powód"), {target:{value:"other"}});
    fireEvent.change(screen.getByLabelText("Wyjaśnienie"), {target:{value:"   "}});
    fireEvent.click(screen.getByRole("button", {name:"Zapisz straty"}));
    expect(screen.getByLabelText("Nazwa produktu")).toHaveFocus();
    expect(screen.getByLabelText("Nazwa produktu")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Nazwa produktu")).toHaveAttribute("aria-describedby", "waste-validation-error");
    fireEvent.change(screen.getByLabelText("Nazwa produktu"), {target:{value:"Sos"}});
    fireEvent.click(screen.getByRole("button", {name:"Zapisz straty"}));
    expect(screen.getByLabelText("Ilość (kg)")).toHaveFocus();
    expect(screen.getByLabelText("Ilość (kg)")).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(screen.getByLabelText("Ilość (kg)"), {target:{value:"1"}});
    fireEvent.click(screen.getByRole("button", {name:"Zapisz straty"}));
    expect(screen.getByLabelText("Wyjaśnienie")).toHaveFocus();
    expect(screen.getByLabelText("Wyjaśnienie")).toHaveAttribute("aria-invalid", "true");
  });
});
