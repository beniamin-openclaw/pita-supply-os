import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LangProvider } from "../../i18n";
import { setToken } from "../../auth";
import { getNameSuggestions } from "../../lib/nameSuggestions";
import { WasteReportPage } from "./WasteReportPage";
const catalog={items:[{product_id:"tomato",name_pl:"Pomidor",name_en:"Tomato",section:"fridge",unit:"kg",display_unit:"g",quick_additions:["50","100"],calibration:"supported"}]};
const products=[{product_id:"PBOX",product_name_pl:"Extra box",inventory_unit:"box",active:false},{product_id:"PGRAM",product_name_pl:"Extra gram",inventory_unit:"g",active:true},{product_id:"PNO",product_name_pl:"No unit",inventory_unit:" ",active:true},{product_id:"PC",product_name_pl:"Container",inventory_unit:"pojemnik",active:true}];
const json=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s});
const saved=(b:string)=>{const p=JSON.parse(b);return {report_id:"r1",...p,lines:p.lines.map((l:Record<string,unknown>)=>({...l,submitted_quantity:l.quantity,submitted_unit:l.unit}))};};
function mount(){return render(<LangProvider><MemoryRouter><WasteReportPage/></MemoryRouter></LangProvider>);}
async function tomato(){await screen.findByRole("group",{name:"Pomidor"});fireEvent.click(screen.getByRole("button",{name:"+100 g"}));fireEvent.change(screen.getByLabelText("Powód — Pomidor"),{target:{value:"dropped"}});}
function mock(){const posts:string[]=[];vi.stubGlobal("fetch",vi.fn(async(url:string,init?:RequestInit)=>{if(url.includes("catalog"))return json(catalog);if(url.endsWith("/api/products"))return json(products);if(init?.method==="POST"){posts.push(String(init.body));return json(saved(posts.at(-1)!));}return json({reports:[],totals:[],next_cursor:null});}));return posts;}
beforeEach(()=>{localStorage.clear();setToken("captain","captain-a");vi.stubGlobal("crypto",webcrypto);});afterEach(()=>vi.unstubAllGlobals());
describe("waste reporter and master products",()=>{
 it("blocks a blank reporter and focuses the field",async()=>{const posts=mock();mount();await tomato();fireEvent.click(screen.getByRole("button",{name:"Zapisz straty"}));expect(posts).toHaveLength(0);expect(screen.getByLabelText(/Imię zgłaszającego/)).toHaveFocus();});
 it("trims attribution, restores draft and remembers only confirmed name",async()=>{const posts=mock();const v=mount();await tomato();fireEvent.change(screen.getByLabelText(/Imię zgłaszającego/),{target:{value:"  Ala  "}});expect(getNameSuggestions("reported_by")).toEqual([]);v.unmount();mount();expect(await screen.findByLabelText(/Imię zgłaszającego/)).toHaveValue("  Ala  ");await screen.findByRole("group",{name:"Pomidor"});fireEvent.click(screen.getByRole("button",{name:"Zapisz straty"}));await screen.findByText("Zapisano straty.");expect(JSON.parse(posts[0]).reported_by).toBe("Ala");expect(getNameSuggestions("reported_by")).toEqual(["Ala"]);});
 it("chooses inactive products, preserves exact source/unit on reload",async()=>{const posts=mock();const v=mount();await screen.findByRole("group",{name:"Pomidor"});fireEvent.change(screen.getByLabelText(/Imię zgłaszającego/),{target:{value:"Ben"}});fireEvent.click(screen.getByRole("button",{name:"Dodaj produkt"}));fireEvent.click(await screen.findByRole("option",{name:"Extra box box"}));const card=screen.getByRole("group",{name:"Extra box"});fireEvent.click(within(card).getByRole("button",{name:"+1 box"}));fireEvent.click(within(card).getByRole("button",{name:"+1 box"}));fireEvent.change(within(card).getByLabelText(/Powód/),{target:{value:"spoiled"}});v.unmount();mount();const restored=await screen.findByRole("group",{name:"Extra box"});expect(within(restored).getByLabelText("Ilość (box) — Extra box")).toHaveValue("2");await screen.findByRole("group",{name:"Pomidor"});fireEvent.click(screen.getByRole("button",{name:"Zapisz straty"}));await screen.findByText("Zapisano straty.");expect(JSON.parse(posts[0]).lines).toEqual([{product_id:null,source_product_id:"PBOX",description:null,quantity:"2",unit:"box",reason:"spoiled",reason_detail:null}]);});
 it("accepts fractional base grams and exposes missing-unit products disabled",async()=>{const posts=mock();mount();await screen.findByRole("group",{name:"Pomidor"});fireEvent.change(screen.getByLabelText(/Imię zgłaszającego/),{target:{value:"Ala"}});fireEvent.click(screen.getByRole("button",{name:"Dodaj produkt"}));expect(await screen.findByRole("option",{name:/No unit/})).toBeDisabled();expect(screen.getByRole("option",{name:"Container pojemnik"})).toBeEnabled();fireEvent.click(screen.getByRole("option",{name:"Extra gram g"}));fireEvent.change(screen.getByLabelText("Ilość (g) — Extra gram"),{target:{value:"0,125"}});fireEvent.change(screen.getByLabelText("Powód — Extra gram"),{target:{value:"dropped"}});fireEvent.click(screen.getByRole("button",{name:"Zapisz straty"}));await screen.findByText("Zapisano straty.");expect(JSON.parse(posts[0]).lines[0]).toMatchObject({source_product_id:"PGRAM",quantity:"0.125",unit:"g"});});
});


it("keeps a scoped restored master snapshot visible when both metadata sources fail", async () => {
  mock(); const first=mount();
  await screen.findByRole("group",{name:"Pomidor"});
  fireEvent.change(screen.getByLabelText(/Imię zgłaszającego/),{target:{value:"Ala"}});
  fireEvent.click(screen.getByRole("button",{name:"Dodaj produkt"}));
  fireEvent.click(await screen.findByRole("option",{name:"Container pojemnik"}));
  fireEvent.click(screen.getByRole("button",{name:"+1 pojemnik"}));
  first.unmount();
  vi.stubGlobal("fetch",vi.fn(async()=>json({},503)));
  mount();
  expect(await screen.findByRole("group",{name:"Container"})).toBeInTheDocument();
  expect(screen.getByLabelText("Ilość (pojemnik) — Container")).toHaveValue("1");
  fireEvent.click(screen.getByRole("button",{name:"Dodaj produkt"}));
  expect(await screen.findByText("Nie udało się wczytać bazy produktów. Spróbuj ponownie.")).toBeInTheDocument();
  expect(screen.getByLabelText(/Imię zgłaszającego/)).toHaveValue("Ala");
  expect(screen.getByLabelText("Ilość (pojemnik) — Container")).toHaveValue("1");
});

it("retries product metadata loading without touching entered paper quantities", async () => {
  let reads=0;
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>{
    if(url.includes("catalog")) return json(catalog);
    if(url.endsWith("/api/products")) return ++reads===1 ? json({},503) : json(products);
    return json({reports:[],totals:[],next_cursor:null});
  }));
  mount();await tomato();
  fireEvent.click(screen.getByRole("button",{name:"Dodaj produkt"}));
  await screen.findByText("Nie udało się wczytać bazy produktów. Spróbuj ponownie.");
  fireEvent.click(screen.getByRole("button",{name:"Pokaż"}));
  expect(await screen.findByRole("option",{name:"Extra box box"})).toBeInTheDocument();
  expect(screen.getByLabelText("Ilość (g) — Pomidor")).toHaveValue("100");
});

it("ignores a master-list response completed after access changes", async () => {
  let finish:(r:Response)=>void=()=>{};
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.includes("catalog") ? json(catalog) : new Promise<Response>(resolve=>{finish=resolve;})));
  mount();await screen.findByRole("group",{name:"Pomidor"});
  fireEvent.click(screen.getByRole("button",{name:"Dodaj produkt"}));
  setToken("captain","captain-b");
  await act(async()=>{finish(json(products));});
  expect(screen.queryByRole("option",{name:"Extra box box"})).not.toBeInTheDocument();
});

it("preserves a frozen legacy body with no new fields through reload, 404 and exact retry", async () => {
  const frozen={batch_uuid:"legacy",business_date:"2026-11-04",lines:[{product_id:"tomato",description:null,quantity:"100",unit:"g",reason:"dropped",reason_detail:null}]};
  const digest=await webcrypto.subtle.digest("SHA-256",new TextEncoder().encode("captain-a"));
  const key=`supply_os_waste_${Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("")}`;
  localStorage.setItem(key,JSON.stringify({date:frozen.business_date,rows:[{product:"tomato",description:"",quantity:"100",unit:"kg",reason:"dropped",detail:""}],batch:"legacy",frozen}));
  const posts:string[]=[];
  vi.stubGlobal("fetch",vi.fn(async(url:string,init?:RequestInit)=>{
    if(url.includes("catalog"))return json(catalog);
    if(url.includes("by-batch"))return json({detail:{code:"waste_not_found",write_outcome:"rejected"}},404);
    if(init?.method==="POST"){posts.push(String(init.body));return json(saved(posts[0]));}
    return json({reports:[],totals:[],next_cursor:null});
  }));
  const view=mount();
  expect(await screen.findByText(/To starszy niepotwierdzony raport bez imienia/)).toBeInTheDocument();
  expect(screen.getByLabelText(/Imię zgłaszającego/)).toBeDisabled();
  view.unmount();mount();
  fireEvent.click(await screen.findByRole("button",{name:"Sprawdź zapis"}));
  await waitFor(()=>expect(screen.getByRole("button",{name:"Ponów ten sam zapis"})).toBeEnabled());
  expect(JSON.parse(localStorage.getItem(key)!).frozen).toEqual(frozen);
  fireEvent.click(screen.getByRole("button",{name:"Ponów ten sam zapis"}));
  await screen.findByText("Zapisano straty.");
  expect(posts).toEqual([JSON.stringify(frozen)]);
  expect(getNameSuggestions("reported_by")).toEqual([]);
});

it("keeps an uncertain reporter out of name suggestions until a matching readback", async () => {
  let body="";
  vi.stubGlobal("fetch",vi.fn(async(url:string,init?:RequestInit)=>{
    if(url.includes("catalog"))return json(catalog);
    if(init?.method==="POST"){body=String(init.body);throw new Error("lost response");}
    if(url.includes("by-batch"))return json(saved(body));
    return json({reports:[],totals:[],next_cursor:null});
  }));
  mount();await tomato();
  fireEvent.change(screen.getByLabelText(/Imię zgłaszającego/),{target:{value:"Ben"}});
  fireEvent.click(screen.getByRole("button",{name:"Zapisz straty"}));
  await waitFor(()=>expect(screen.getByRole("button",{name:"Sprawdź zapis"})).toBeEnabled());
  expect(getNameSuggestions("reported_by")).toEqual([]);
  fireEvent.click(screen.getByRole("button",{name:"Sprawdź zapis"}));
  await screen.findByText("Zapisano straty.");
  expect(getNameSuggestions("reported_by")).toEqual(["Ben"]);
});
