import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../../../i18n";
import { setToken } from "../../../auth";
import { WasteHistory } from "./WasteHistory";
import { wasteDateRange } from "../lib/wasteDateRange";

const empty = {reports:[],totals:[],next_cursor:null};
const json = (value: unknown, status=200) => new Response(JSON.stringify(value),{status});
const data = {...empty,totals:[{location_id:"WOLA",name_pl:"Pomidor",name_en:"Tomato",quantity:"0.1",unit:"kg"}]};
function mount() { return render(<LangProvider><WasteHistory role="captain" token="captain-only" refresh={0}/></LangProvider>); }
beforeEach(()=>{localStorage.clear();setToken("captain","captain-only");});
afterEach(()=>vi.unstubAllGlobals());
describe("waste history filters and CSV",()=>{
  it("uses inclusive preset dates and clears old results after a failed replacement",async()=>{
    const urls: string[]=[];
    const fetcher=vi.fn(async(url:string)=>{urls.push(url);return url.includes(wasteDateRange("week").from) ? json({},503) : json(data);});
    vi.stubGlobal("fetch",fetcher); mount();
    expect(await screen.findByText("Pomidor — 0.1 kg")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Ostatnie 7 dni"}));
    expect(screen.queryByText("Pomidor — 0.1 kg")).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    const range=wasteDateRange("week");
    expect(urls.at(-1)).toContain(`date_from=${range.from}&date_to=${range.to}`);
    expect(screen.getByRole("button",{name:"Pokaż"})).toBeEnabled();
  });
  it("ignores an older result after a newer filter request",async()=>{
    let finish: (r:Response)=>void=()=>{};
    let reads=0;
    vi.stubGlobal("fetch",vi.fn(async()=>{reads++;return reads===1 ? new Promise<Response>(resolve=>{finish=resolve;}) : json(empty);}));
    mount();await waitFor(()=>expect(reads).toBe(1));
    fireEvent.click(screen.getByRole("button",{name:"Ostatnie 7 dni"}));
    await screen.findByText("Brak zapisów w tym okresie.");
    finish(json(data));await waitFor(()=>expect(screen.queryByText("Pomidor — 0.1 kg")).not.toBeInTheDocument());
  });
  it("pins Captain CSV role and drops a download completed for an old filter",async()=>{
    let finish: (r:Response)=>void=()=>{};
    const fetcher=vi.fn(async(url:string,init?:RequestInit)=>{
      expect((init?.headers as Record<string,string>).Authorization).toBe("Bearer captain-only");
      if(url.includes("/export")) {expect(url).toContain("/api/captain/waste/export?");expect(init?.signal).toBeInstanceOf(AbortSignal);return new Promise<Response>(resolve=>{finish=resolve;});}
      return json(empty);
    });
    vi.stubGlobal("fetch",fetcher);
    const create=vi.fn(()=>"blob:test");Object.defineProperty(URL,"createObjectURL",{value:create,configurable:true});
    mount();await screen.findByText("Brak zapisów w tym okresie.");
    fireEvent.click(screen.getByRole("button",{name:"Pobierz CSV"}));
    expect(await screen.findByRole("button",{name:"Pobieranie…"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Ostatnie 7 dni"}));
    finish(new Response("csv"));
    await waitFor(()=>expect(screen.getByRole("button",{name:"Pobierz CSV"})).toBeEnabled());
    expect(create).not.toHaveBeenCalled();
  });
  it("shows export failure and lets the operator retry",async()=>{
    vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.includes("/export") ? json({},503) : json(empty)));
    mount();await screen.findByText("Brak zapisów w tym okresie.");
    fireEvent.click(screen.getByRole("button",{name:"Pobierz CSV"}));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Pobierz CSV"})).toBeEnabled();
  });
});

it("reloads an already selected preset instead of clearing the view indefinitely",async()=>{
  const fetcher=vi.fn(async()=>json(data));vi.stubGlobal("fetch",fetcher);mount();
  await screen.findByText("Pomidor — 0.1 kg");
  fireEvent.click(screen.getByRole("button",{name:"Dzisiaj"}));
  await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("Pomidor — 0.1 kg")).toBeInTheDocument();
});
