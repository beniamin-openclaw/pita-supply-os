// Hamburger dropdown menu — lightweight, no portal.
// Options:
//   - Moje zamówienia (placeholder, wired in E4 if onShowOrders provided)
//   - Język: PL / EN toggle
//   - Debug (dev only)
//   - Wyloguj

import { useEffect, useRef, useState } from "react";
import { Menu, X, Check } from "lucide-react";
import { clearToken } from "../../../auth";
import { useT } from "../../../i18n";

interface HamburgerMenuProps {
  onShowOrders?: () => void;
}

export function HamburgerMenu({ onShowOrders }: HamburgerMenuProps) {
  const { t, lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function handleLogout() {
    clearToken("captain");
    location.reload();
  }

  const isDev = import.meta.env.MODE === "development";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? t("header.menuClose") : t("header.menuOpen")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="p-2.5 -mr-1 active:bg-white/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a4480]"
      >
        {open ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t("hamburger.menuLabel")}
          className="absolute right-0 top-full mt-2 w-60 bg-white text-slate-900 rounded-lg shadow-2xl border border-slate-200 py-1 z-50"
        >
          {onShowOrders && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onShowOrders();
              }}
              className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:bg-slate-100"
            >
              {t("hamburger.orders")}
            </button>
          )}

          {/* Language section */}
          <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {t("hamburger.lang.label")}
          </div>
          <div className="px-2 pb-2 flex gap-1">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={lang === "pl"}
              onClick={() => setLang("pl")}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                lang === "pl"
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {lang === "pl" && <Check size={14} aria-hidden="true" />}
              {t("hamburger.lang.pl")}
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={lang === "en"}
              onClick={() => setLang("en")}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                lang === "en"
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {lang === "en" && <Check size={14} aria-hidden="true" />}
              {t("hamburger.lang.en")}
            </button>
          </div>

          {isDev && (
            <a
              role="menuitem"
              href="/debug"
              className="block w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 border-t border-slate-200"
            >
              {t("hamburger.debug")}
            </a>
          )}
          <div className="border-t border-slate-200 my-1" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50 active:bg-red-100 focus-visible:outline-none focus-visible:bg-red-50"
          >
            {t("hamburger.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
