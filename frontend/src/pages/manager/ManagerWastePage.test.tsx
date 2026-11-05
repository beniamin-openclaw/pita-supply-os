import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LangProvider } from "../../i18n";
import { setToken } from "../../auth";
import { ManagerWastePage } from "./ManagerWastePage";

const json = (value: unknown) => new Response(JSON.stringify(value), {status:200});
const report = {report_id:"r1",location_id:"WOLA",business_date:"2026-11-04",batch_uuid:"b",created_at:"2026-11-04T12:00:00Z",lines:[{line_id:"l1",name_pl:"Pomidor",name_en:"Tomato",quantity:"0.1",unit:"kg",reason:"dropped",reason_detail:null,description:null,voided_at:null}]};
beforeEach(() => { localStorage.clear(); setToken("manager", "manager-token"); });
afterEach(() => vi.unstubAllGlobals());
describe("manager waste", () => {
  it("shows totals and retained voided entries after an audited void", async () => {
    let voided = false;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string,string>)?.Authorization).toBe("Bearer manager-token");
      if (url.includes("/api/locations")) return json([{location_id:"WOLA",location_name:"Wola"}]);
      if (url.includes("/void")) { expect(JSON.parse(String(init?.body))).toEqual({reason:"pomyłka"}); voided = true; return json(report); }
      return json({reports:[{...report, lines:[{...report.lines[0],voided_at:voided ? "2026-11-04T13:00:00Z" : null,void_reason:voided ? "pomyłka" : null,void_role:voided ? "manager" : null}]}], totals:voided ? [] : [{location_id:"WOLA",name_pl:"Pomidor",name_en:"Tomato",description:null,quantity:"0.1",unit:"kg"}],next_cursor:null});
    });
    vi.stubGlobal("fetch", fetcher);
    render(<LangProvider><MemoryRouter><ManagerWastePage /></MemoryRouter></LangProvider>);
    expect(await screen.findByText("WOLA: Pomidor — 0.1 kg")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Unieważnij"}));
    fireEvent.change(screen.getByLabelText("Powód unieważnienia"),{target:{value:"pomyłka"}});
    fireEvent.click(screen.getByRole("button",{name:"Potwierdź unieważnienie"}));
    expect(await screen.findByText(/Unieważniono: pomyłka/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("WOLA: Pomidor — 0.1 kg")).not.toBeInTheDocument());
  });
  it("does not void when the manager token changes before confirmation", async () => {
    const fetcher = vi.fn(async (url: string) => url.includes("locations") ? json([]) : json({reports:[report],totals:[],next_cursor:null}));
    vi.stubGlobal("fetch", fetcher);
    render(<LangProvider><MemoryRouter><ManagerWastePage /></MemoryRouter></LangProvider>);
    fireEvent.click(await screen.findByRole("button",{name:"Unieważnij"}));
    fireEvent.change(screen.getByLabelText("Powód unieważnienia"),{target:{value:"pomyłka"}});
    setToken("manager", "another");
    fireEvent.click(screen.getByRole("button",{name:"Potwierdź unieważnienie"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Zmieniono kod dostępu");
    expect(fetcher.mock.calls.some(([url]) => url.includes("/void"))).toBe(false);
  });
  it("identifies the void target and clears it when a filter changes", async () => {
    const fetcher = vi.fn(async (url: string) => url.includes("locations") ? json([{location_id:"WOLA",location_name:"Wola"}]) : json({reports:[report],totals:[],next_cursor:null}));
    vi.stubGlobal("fetch", fetcher);
    render(<LangProvider><MemoryRouter><ManagerWastePage /></MemoryRouter></LangProvider>);
    fireEvent.click(await screen.findByRole("button",{name:"Unieważnij"}));
    expect(screen.getByText(/2026-11-04 · WOLA · Pomidor · 0.1 kg/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Powód unieważnienia"),{target:{value:"pomyłka"}});
    fireEvent.change(screen.getByLabelText("Lokal"),{target:{value:"WOLA"}});
    expect(screen.queryByRole("button",{name:"Potwierdź unieważnienie"})).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url]) => url.includes("/void"))).toBe(false);
  });
});
