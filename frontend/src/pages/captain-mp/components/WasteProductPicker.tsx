import { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { wasteRequest } from "../../../apiClient";
import { getToken } from "../../../auth";
import { useT } from "../../../i18n";
import type { Product } from "../../../types";

export function WasteProductPicker({ token, disabled, onSelect }: { token: string | null; disabled: boolean; onSelect: (product: Product) => void }): React.ReactElement {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open || products) return;
    let active = true;
    wasteRequest<Product[]>("/api/products", "captain", token).then(result => {
      if (active && getToken("captain") === token) setProducts(result);
    }).catch(() => { if (active && getToken("captain") === token) setError(true); });
    return () => { active = false; };
  }, [open, products, retry, token]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (event: MouseEvent): void => { if (container.current && !container.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent): void => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  useEffect(() => {
    if (open) container.current?.scrollIntoView?.({block:"center"});
  }, [open, products, error]);
  const filtered = products?.filter(product => product.product_name_pl.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) || product.product_id.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) || [];
  return <div ref={container} className="relative">
    <button type="button" className="min-h-11 inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-400 bg-white px-4 py-3 text-sm font-semibold text-brand disabled:opacity-50" aria-expanded={open && !disabled} aria-haspopup="listbox" disabled={disabled} onClick={() => { setQuery(""); if (!open) setError(false); setOpen(value => !value); }}><Plus size={16} aria-hidden="true"/>{t("waste.addProduct")}</button>
    {open && !disabled && <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-sm">
      <label className="flex gap-2 items-center border-b border-slate-100 p-3"><Search size={16} aria-hidden="true"/><span className="sr-only">{t("waste.productSearch")}</span><input ref={input} className="min-h-11 min-w-0 flex-1 bg-transparent text-base focus:outline-none" placeholder={t("waste.productSearch")} value={query} onChange={event => setQuery(event.target.value)}/></label>
      {!products && !error && <p role="status" className="p-3 text-sm text-slate-500">{t("waste.loading")}</p>}
      {error && <div className="p-3 text-sm text-red-700"><p role="alert">{t("waste.productsError")}</p><button type="button" className="min-h-11 underline" onClick={() => { setError(false); setRetry(value => value + 1); }}>{t("waste.load")}</button></div>}
      {products && <ul role="listbox" aria-label={t("waste.productSearch")} className="max-h-64 overflow-y-auto py-1">{filtered.length ? filtered.map(product => <li key={product.product_id}><button type="button" role="option" aria-selected={false} disabled={!product.inventory_unit.trim()} className="min-h-11 w-full flex justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50" onClick={() => { if (!disabled && getToken("captain") === token && product.inventory_unit.trim()) { onSelect(product); setOpen(false); setQuery(""); } }}><span>{product.product_name_pl}</span>{" "}<span className="shrink-0 text-slate-500">{product.inventory_unit.trim() ? product.inventory_unit : t("waste.productUnitMissing")}</span></button></li>) : <li className="p-3 text-sm text-slate-500">{t("waste.productsEmpty")}</li>}</ul>}
    </div>}
  </div>;
}
