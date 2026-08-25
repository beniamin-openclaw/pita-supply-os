// Auto-extracted by general-purpose sub-agent (Sonnet, 2026-05-24), reviewed by Opus.
// To add a string: append to STRINGS with both `pl` and `en` set. To change a
// string permanently, edit here and use `t('key')` in the component. To pull a
// string out at runtime use `useT()` from `./index.ts`.

export interface StringEntry {
  pl: string;
  en: string;
}

export const STRINGS = {
  // Header + hamburger ------------------------------------------------------
  "header.title": { pl: "PITA BROS — Zamówienia", en: "PITA BROS — Orders" },
  "header.locationLabel": { pl: "Lokalizacja: ", en: "Location: " },
  "header.captainLabel": { pl: "Kapitan: ", en: "Captain: " },
  "header.dayLabel": { pl: "Dzień: ", en: "Day: " },
  "header.menuOpen": { pl: "Otwórz menu", en: "Open menu" },
  "header.menuClose": { pl: "Zamknij menu", en: "Close menu" },
  "hamburger.menuLabel": { pl: "Menu kapitana", en: "Captain menu" },
  "hamburger.orders": { pl: "Moje zamówienia", en: "My orders" },
  "hamburger.lang.label": { pl: "Język", en: "Language" },
  "hamburger.lang.pl": { pl: "Polski", en: "Polish" },
  "hamburger.lang.en": { pl: "Angielski", en: "English" },
  "hamburger.debug": { pl: "Debug", en: "Debug" },
  "hamburger.logout": { pl: "Wyloguj", en: "Log out" },

  // Supplier picker ---------------------------------------------------------
  "supplier.navLabel": { pl: "Dostawcy", en: "Suppliers" },
  "supplier.lineCountLabel": { pl: "{count} pozycji", en: "{count} items" },

  // Captain page-level ------------------------------------------------------
  "captain.suppliersLoading": { pl: "Ładowanie dostawców…", en: "Loading suppliers…" },
  "captain.itemsEmpty": {
    pl: "Brak produktów do zamówienia dla tego dostawcy.",
    en: "No products to order from this supplier.",
  },
  "captain.stockAtTarget": {
    pl: "Stan magazynowy zgodny z targetem",
    en: "Stock is at target",
  },
  "captain.stockAtTargetSub": {
    pl: "Dzisiaj nie trzeba zamawiać",
    en: "Nothing to order today",
  },
  "captain.draftBannerAriaLabel": {
    pl: "Przywrócony szkic zamówienia",
    en: "Restored order draft",
  },
  "captain.draftBannerTitle": {
    pl: "Przywrócono szkic z godziny {time} — liczby są zapamiętane do wysłania lub wyczyszczenia.",
    en: "Draft from {time} restored — your numbers stay until you submit or clear them.",
  },
  "captain.draftBannerDiscard": { pl: "Wyczyść szkic", en: "Clear draft" },

  // "Who orders" attribution (ordered_by) — required before sending the order.
  "captain.orderedByLabel": { pl: "Kto zamawia", en: "Who orders" },
  "captain.orderedByPlaceholder": { pl: "Imię i nazwisko", en: "Full name" },
  "captain.orderedByRequired": {
    pl: "Wymagane przed wysłaniem",
    en: "Required before sending",
  },

  // Toast / global messages -------------------------------------------------
  "toast.close": { pl: "Zamknij powiadomienie", en: "Close notification" },
  "toast.draftSaved": { pl: "Szkic zapisany", en: "Draft saved" },
  "toast.orderSent": {
    pl: "Zamówienie wysłane pomyślnie",
    en: "Order sent successfully",
  },
  "toast.submitError": { pl: "Błąd wysyłania: {detail}", en: "Send error: {detail}" },
  "toast.suppliersError": {
    pl: "Błąd pobierania dostawców: {detail}",
    en: "Error loading suppliers: {detail}",
  },
  "toast.itemsError": {
    pl: "Błąd pobierania produktów: {detail}",
    en: "Error loading products: {detail}",
  },

  // API validation errors (FastAPI 422) — PL templates keyed by Pydantic `type`,
  // localized in apiClient via i18n/apiErrors.ts (Tier 1: form validations).
  // Business-rule 400s stay English (Tier 2 — needs backend error codes).
  "apiError.required": { pl: "pole wymagane", en: "field required" },
  "apiError.minItems": { pl: "wymagane min. {min}", en: "at least {min} required" },
  "apiError.maxItems": { pl: "maksymalnie {max}", en: "at most {max} allowed" },
  "apiError.gte": { pl: "wartość musi być ≥ {limit}", en: "must be ≥ {limit}" },
  "apiError.gt": { pl: "wartość musi być > {limit}", en: "must be > {limit}" },
  "apiError.lte": { pl: "wartość musi być ≤ {limit}", en: "must be ≤ {limit}" },
  "apiError.lt": { pl: "wartość musi być < {limit}", en: "must be < {limit}" },
  "apiError.invalid": { pl: "nieprawidłowa wartość", en: "invalid value" },
  "apiError.orderEmpty": {
    pl: "Dodaj przynajmniej jedną pozycję do zamówienia.",
    en: "Add at least one item to the order.",
  },
  // "<field>: <message>" — friendly field labels for the few user-facing fields.
  "apiError.withField": { pl: "{field}: {message}", en: "{field}: {message}" },
  "apiError.field.lines": { pl: "Pozycje zamówienia", en: "Order lines" },
  "apiError.field.current_stock_qty_base": { pl: "Obecny stan", en: "Current stock" },
  "apiError.field.captain_final_qty_purchase": { pl: "Zamawiasz", en: "Order qty" },
  "apiError.field.count_user": { pl: "Kto liczył", en: "Counted by" },
  "apiError.field.received_by": { pl: "Kto przyjął", en: "Received by" },
  "apiError.field.ordered_by": { pl: "Kto zamawia", en: "Who orders" },
  "apiError.field.reason_code": { pl: "Powód", en: "Reason" },
  "apiError.field.requested_delivery_date": { pl: "Data dostawy", en: "Delivery date" },

  // ProductCard -------------------------------------------------------------
  "card.targetLine": {
    pl: "target {target} {inventoryUnit} · max {max} · 1 {purchaseUnit} = {unitsPerPurchase} {inventoryUnit}",
    en: "target {target} {inventoryUnit} · max {max} · 1 {purchaseUnit} = {unitsPerPurchase} {inventoryUnit}",
  },
  "card.critical": { pl: "KRYTYCZNY", en: "CRITICAL" },
  "card.currentStock": { pl: "Obecny stan", en: "Current stock" },
  "card.suggestionGroupLabel": { pl: "Sugestia systemu", en: "System suggestion" },
  "card.suggestion": { pl: "Sugestia ↓", en: "Suggestion ↓" },
  "card.suggestionMissing": {
    pl: "Sugestia — najpierw wpisz obecny stan",
    en: "Suggestion — enter current stock first",
  },
  "card.acceptSuggestion": {
    pl: "Zaakceptuj sugestię: {count} {unit}",
    en: "Accept suggestion: {count} {unit}",
  },
  "card.suggestionDetail": {
    pl: "brakuje {base} {inventoryUnit} → {purchase} {purchaseUnit}",
    en: "need {base} {inventoryUnit} → {purchase} {purchaseUnit}",
  },
  "card.order": { pl: "Zamawiasz", en: "Ordering" },
  "card.belowMin": {
    pl: "Poniżej minimum: {min} {unit}",
    en: "Below minimum: {min} {unit}",
  },

  // Row state messages (compute.ts) -----------------------------------------
  "state.empty": { pl: "Wpisz zamówienie", en: "Enter order qty" },
  "state.devNoReason": {
    pl: "{pct} odchylenia — wymagany powód",
    en: "{pct} deviation — reason required",
  },
  "state.devReason": {
    pl: "{pct} odchylenia — powód podany",
    en: "{pct} deviation — reason provided",
  },
  "state.match": { pl: "Zgodnie z sugestią", en: "Matches suggestion" },
  "state.smallAdj": {
    pl: "Drobna korekta ({pct})",
    en: "Minor adjustment ({pct})",
  },
  // Blank-stock variants: stock not counted → no real suggestion (shows "—"), so
  // these carry no "%". A reason is forced only when the order exceeds MAX (the
  // storage ceiling); otherwise the order is neutral and needs no reason.
  "state.overMaxNoStock": {
    pl: "Powyżej MAX — wymagany powód",
    en: "Above MAX — reason required",
  },
  "state.overMaxNoStockReason": {
    pl: "Powyżej MAX — powód podany",
    en: "Above MAX — reason provided",
  },
  "state.smallAdjNoStock": {
    pl: "Zamówienie bez stanu",
    en: "Order without current stock",
  },
  // No-baseline variants: the suggestion is 0 (e.g. bucket SKUs), so a "%
  // deviation" is mathematically meaningless / explodes. Show "brak bazy" copy
  // instead of a huge or ∞ percentage. State + requiresReason stay as the gate
  // dictates; only the wording (no embedded %) changes.
  "state.noBaselineNoReason": {
    pl: "Brak bazy sugestii — wymagany powód",
    en: "No suggestion baseline — reason required",
  },
  "state.noBaselineReason": {
    pl: "Brak bazy sugestii — powód podany",
    en: "No suggestion baseline — reason provided",
  },
  // Short token for the captain order-detail + manager line-table % cells.
  "deviation.noBaseline": { pl: "brak bazy", en: "no baseline" },

  // Reason picker -----------------------------------------------------------
  "reason.label": {
    pl: "Wybierz powód odchylenia",
    en: "Select reason for deviation",
  },
  "reason.placeholder": { pl: "Wybierz powód…", en: "Select reason…" },
  "reason.invalid": {
    pl: "Wybór powodu jest wymagany dla tego odchylenia.",
    en: "A reason is required for this deviation.",
  },
  "reason.commentRequiredLabel": {
    pl: "Komentarz (wymagany)",
    en: "Comment (required)",
  },
  "reason.commentOptionalLabel": {
    pl: "Komentarz (opcjonalny)",
    en: "Comment (optional)",
  },
  "reason.commentPlaceholder": { pl: "Dodaj szczegóły…", en: "Add details…" },
  "reason.codes.EVENT_HIGH_TRAFFIC": {
    pl: "Wydarzenie / Duży ruch",
    en: "Event / High traffic",
  },
  "reason.codes.WEEKEND_HIGH_TRAFFIC": {
    pl: "Weekend / Duży ruch",
    en: "Weekend / High traffic",
  },
  "reason.codes.LOW_STORAGE": {
    pl: "Brak miejsca w magazynie",
    en: "Not enough storage space",
  },
  "reason.codes.PACKAGING_LIMITATION": {
    pl: "Ograniczenia opakowań",
    en: "Packaging limitation",
  },
  "reason.codes.SUPPLIER_UNDERDELIVERS": {
    pl: "Dostawca nie dowozi",
    en: "Supplier short-delivers",
  },
  "reason.codes.SYSTEM_SUGGESTION_WRONG": {
    pl: "Błędna sugestia systemu",
    en: "System suggestion is wrong",
  },
  "reason.codes.OTHER": {
    pl: "Inny powód (wymaga komentarza)",
    en: "Other reason (comment required)",
  },

  // StickyActionBar (Captain) -----------------------------------------------
  "sticky.summary.one.lines": { pl: "{n} pozycja", en: "{n} item" },
  "sticky.summary.few.lines": { pl: "{n} pozycje", en: "{n} items" },
  "sticky.summary.many.lines": { pl: "{n} pozycji", en: "{n} items" },
  "sticky.summary.one.deviations": { pl: "{n} odchylenie", en: "{n} deviation" },
  "sticky.summary.few.deviations": { pl: "{n} odchylenia", en: "{n} deviations" },
  "sticky.summary.many.deviations": { pl: "{n} odchyleń", en: "{n} deviations" },
  "sticky.summary.one.reasons": { pl: "{n} powód", en: "{n} reason" },
  "sticky.summary.few.reasons": { pl: "{n} powody", en: "{n} reasons" },
  "sticky.summary.many.reasons": { pl: "{n} powodów", en: "{n} reasons" },
  "sticky.fixRedCards": { pl: "Popraw czerwone karty", en: "Fix red cards" },
  "sticky.fillStockFirst": {
    pl: "Wpisz zamówienie, by aktywować przycisk Wyślij",
    en: "Enter an order qty to enable the Submit button",
  },
  "sticky.readyToSubmit": { pl: "Gotowe do wysyłki", en: "Ready to submit" },
  "sticky.draftBtn": { pl: "Szkic", en: "Draft" },
  "sticky.submitBtn": { pl: "Wyślij", en: "Submit" },
  "sticky.submittingBtn": { pl: "Wysyłanie…", en: "Sending…" },

  // Pre-submit confirmation dialog (Phase F5) -------------------------------
  "confirm.title": {
    pl: "Czy na pewno chcesz wysłać?",
    en: "Send this order?",
  },
  "confirm.summary": {
    pl: "Wysyłasz zamówienie: {summary}.",
    en: "You are sending: {summary}.",
  },
  "confirm.criticalMissing": {
    pl: "Nie zamówiono produktów krytycznych:",
    en: "Critical items with nothing ordered:",
  },
  "confirm.criticalAsk": {
    pl: "Czy na pewno wysłać mimo to?",
    en: "Are you sure you want to send anyway?",
  },
  "confirm.back": { pl: "Wróć i popraw", en: "Go back and fix" },
  "confirm.send": { pl: "Tak, wyślij", en: "Yes, send" },
  "confirm.sendAnyway": { pl: "Wyślij mimo to", en: "Send anyway" },

  // Dates helpers -----------------------------------------------------------
  "dates.cutoff.value": { pl: "Wyślij do dziś {time}", en: "Send by {time} today" },
  "dates.cutoff.none": { pl: "Brak ustalonego cutoff", en: "No cutoff set" },
  "dates.delivery.unsetText": { pl: "dostawa wg ustaleń", en: "delivery as agreed" },
  "dates.delivery.weekdayPrefix": { pl: "dostawa: {days}", en: "delivery: {days}" },
  "dates.delivery.days.one": { pl: "dostawa: {n} dzień", en: "delivery: {n} day" },
  "dates.delivery.days.few": { pl: "dostawa: {n} dni", en: "delivery: {n} days" },
  "dates.delivery.days.many": { pl: "dostawa: {n} dni", en: "delivery: {n} days" },

  // AuthGate ---------------------------------------------------------------
  "auth.captainLabel": { pl: "Wpisz kod miejsca", en: "Enter location code" },
  "auth.captainHint": {
    pl: "Kod dostępu Twojej restauracji — dostajesz go od menedżera (to nie jest kod menedżera).",
    en: "Your restaurant's access code — given to you by the manager (this is not the manager code).",
  },
  "auth.managerLabel": { pl: "Wpisz kod menedżera", en: "Enter manager code" },
  "auth.managerHint": {
    pl: "Kod dispatchera — biuro/CFO.",
    en: "Dispatcher code — office/CFO.",
  },
  "auth.invalidToken": {
    pl: "Kod nieprawidłowy — spróbuj jeszcze raz.",
    en: "Invalid code — please try again.",
  },
  "auth.invalidTokenBackend": {
    pl: "Kod nieprawidłowy — backend odrzucił. Sprawdź, czy wkleiłeś sam token (bez prefiksu KEY=).",
    en: "Invalid code — rejected by server. Make sure you pasted the token only (no KEY= prefix).",
  },
  "auth.networkError": {
    pl: "Brak połączenia z backendem: {detail}",
    en: "Cannot reach server: {detail}",
  },
  "auth.backendError": {
    pl: "Błąd backendu ({status}): {detail}",
    en: "Server error ({status}): {detail}",
  },
  "auth.emptyCode": { pl: "Kod nie może być pusty.", en: "Code cannot be empty." },
  "auth.submit": { pl: "Wejdź", en: "Enter" },
  "auth.submitting": { pl: "Weryfikacja…", en: "Verifying…" },
  "auth.placeholder": { pl: "••••••••••••••••", en: "••••••••••••••••" },
  "auth.persistence": {
    pl: "Kod zapamiętamy na tym urządzeniu — wpiszesz go tylko raz. Dostajesz go od menedżera.",
    en: "We'll remember your code on this device — you only enter it once. Get it from your manager.",
  },

  // Manager page ------------------------------------------------------------
  "manager.queueTitle": {
    pl: "Kolejka — pending captain submits",
    en: "Queue — pending captain submits",
  },
  "manager.pageTitle": {
    pl: "PITA BROS — Manager Dispatch (placeholder)",
    en: "PITA BROS — Manager Dispatch (placeholder)",
  },
  "manager.placeholderNote": {
    pl: "Tymczasowy widok diagnostyczny. Po wygenerowaniu UI z Magic Patterns, zamień zawartość tego pliku na komponenty z DESIGN_HANDOFF.md.",
    en: "Temporary diagnostic view. Once the UI is generated from Magic Patterns, replace the contents of this file with the components from DESIGN_HANDOFF.md.",
  },
  "manager.error": { pl: "Backend zwrócił błąd:", en: "Backend returned an error:" },
  "manager.tryAgain": { pl: "Spróbuj ponownie", en: "Try again" },
  "manager.refresh": { pl: "Odśwież", en: "Refresh" },
  "manager.logout": { pl: "Wyloguj", en: "Log out" },
  "manager.empty": {
    pl: "Brak zamówień w kolejce. Kapitanowie wysyłają z telefonu — zamówienia pojawią się tu po Submit.",
    en: "No orders in the queue. Captains submit from their phones — orders will show up here after they hit Submit.",
  },
  "manager.loading": { pl: "Ładowanie…", en: "Loading…" },
  "manager.lines.one": { pl: "{n} linia", en: "{n} line" },
  "manager.lines.few": { pl: "{n} linie", en: "{n} lines" },
  "manager.lines.many": { pl: "{n} linii", en: "{n} lines" },
  "manager.deviations.one": { pl: "{n} odchylenie", en: "{n} deviation" },
  "manager.deviations.few": { pl: "{n} odchylenia", en: "{n} deviations" },
  "manager.deviations.many": { pl: "{n} odchyleń", en: "{n} deviations" },
  "manager.reasonsCovered": {
    pl: "{reasonCount}/{deviationCount} z powodem",
    en: "{reasonCount}/{deviationCount} with reason",
  },
  "manager.deviationsTooltip": {
    pl: "Odchylenia od sugerowanej ilości (kapitan zamówił mniej/więcej niż system sugerował)",
    en: "Deviations from suggested qty (captain ordered more/less than the system suggested)",
  },
  "manager.reasonsTooltip": {
    pl: "Liczba odchyleń z podanym powodem przez kapitana",
    en: "Number of deviations where the captain provided a reason",
  },
  "manager.cutoff": { pl: "cutoff: {value}", en: "cutoff: {value}" },
  "manager.submitted": { pl: "submitted: {value}", en: "submitted: {value}" },
  "manager.orderedBy": { pl: "Zamówił: {value}", en: "Ordered by: {value}" },

  // Edited-marker (Phase F4) -------------------------------------------------
  "orders.editedBadge": { pl: "POPRAWIONE", en: "EDITED" },
  "orders.editedAt": { pl: "Edytowane: {value}", en: "Edited: {value}" },

  // Manager action buttons (Phase F3) ---------------------------------------
  "manager.tab.submitted": { pl: "Do przejęcia", en: "To claim" },
  "manager.tab.claimed": { pl: "W realizacji", en: "In progress" },
  "manager.tab.sent": { pl: "Zamówione", en: "Ordered" },
  "manager.tab.closed": { pl: "Zakończone (odebrane)", en: "Closed (received)" },
  "manager.action.openEmail": { pl: "Otwórz email do dostawcy", en: "Open supplier email" },
  "manager.sentEmptyHint": {
    pl: "Brak zamówionych pozycji w tej sesji.",
    en: "No orders dispatched in this session.",
  },
  "manager.action.claim": { pl: "Przejmij", en: "Claim" },
  "manager.action.release": { pl: "Odrzuć do poprawy", en: "Send back" },
  "manager.action.cancel": { pl: "Anuluj zamówienie", en: "Cancel order" },
  "manager.action.dispatch": { pl: "Zamów", en: "Order" },
  "manager.action.working": { pl: "Pracuję…", en: "Working…" },
  "manager.releasePrompt": {
    pl: "Powód odesłania do kapitana (kapitan to zobaczy):",
    en: "Reason to send back to the captain (they will see it):",
  },
  "manager.cancelConfirm": {
    pl: "Anulować to zamówienie? Zniknie z kolejki (zapisujemy powód, kto i kiedy).",
    en: "Cancel this order? It leaves the queue (we store the reason, who and when).",
  },
  "manager.cancelPrompt": {
    pl: "Powód anulowania (zapisany jako trwały ślad):",
    en: "Cancellation reason (stored as a durable trace):",
  },
  "manager.claimedOk": { pl: "Przejęto zamówienie", en: "Order claimed" },
  "manager.releasedOk": { pl: "Odesłano do poprawy", en: "Sent back to captain" },
  "manager.cancelledOk": { pl: "Zamówienie anulowane", en: "Order cancelled" },
  "manager.dispatchedOk": {
    pl: "Zamówione — otwieram email do dostawcy",
    en: "Ordered — opening supplier email",
  },
  "manager.actionError": { pl: "Błąd akcji: {detail}", en: "Action error: {detail}" },

  // Manager v2 two-pane shell (Phase G1) ------------------------------------
  // Queue group headers reuse manager.tab.* above. Selection / empty hints:
  "manager.selectOrder": {
    pl: "Wybierz zamówienie z kolejki",
    en: "Select an order from the queue",
  },
  "manager.queueEmptyGroup": { pl: "Brak zamówień", en: "No orders" },
  // Manager queue filters (S-05) --------------------------------------------
  "manager.filter.locationLabel": { pl: "Lokal", en: "Location" },
  "manager.filter.allLocations": { pl: "Wszystkie lokale", en: "All locations" },
  "manager.filter.supplierLabel": { pl: "Dostawca", en: "Supplier" },
  "manager.filter.allSuppliers": { pl: "Wszyscy dostawcy", en: "All suppliers" },
  "manager.filter.statusLabel": { pl: "Status", en: "Status" },
  "manager.filter.clear": { pl: "Wyczyść filtry", en: "Clear filters" },
  "manager.detailLoading": { pl: "Ładowanie zamówienia…", en: "Loading order…" },
  "manager.groupCount": { pl: "{n}", en: "{n}" },
  // Detail header band labels
  "manager.detail.cutoff": { pl: "Cutoff: {value}", en: "Cutoff: {value}" },
  "manager.detail.cutoffPast": { pl: "po cutoff: {value}", en: "past cutoff: {value}" },
  "manager.detail.submitted": { pl: "Wysłane przez kapitana: {value}", en: "Captain submitted: {value}" },
  "manager.detail.orderedBy": { pl: "Zamówił: {value}", en: "Ordered by: {value}" },
  "manager.detail.delivery": { pl: "Dostawa: {value}", en: "Delivery: {value}" },
  "manager.detail.notesLabel": { pl: "Notatka zamówienia", en: "Order notes" },
  "manager.detail.totalValue": { pl: "Wartość szacunkowa: {value} PLN", en: "Estimated value: {value} PLN" },
  // Per-line table column headers (Phase G1)
  "manager.col.product": { pl: "Produkt", en: "Product" },
  "manager.col.unit": { pl: "Jedn.", en: "Unit" },
  "manager.col.stock": { pl: "Stan", en: "Stock" },
  "manager.col.target": { pl: "Cel", en: "Target" },
  "manager.col.suggestion": { pl: "Sugestia", en: "Suggested" },
  "manager.col.captainWants": { pl: "Punkt chce", en: "Point wants" },
  "manager.col.deltaVsSuggestion": { pl: "Δ vs sug.", en: "Δ vs sugg." },
  "manager.col.managerOrders": { pl: "Manager zamawia", en: "Manager orders" },
  "manager.col.deltaVsCaptain": { pl: "Δ vs punkt", en: "Δ vs point" },
  "manager.col.managerComment": { pl: "Komentarz mgr", en: "Manager note" },
  "manager.col.captainComment": { pl: "Komentarz kpt", en: "Captain note" },
  // Tooltips / inline hints
  "manager.unitTooltip": {
    pl: "1 {purchase} = {ratio} {inventory}",
    en: "1 {purchase} = {ratio} {inventory}",
  },
  "manager.deltaVsCaptain": { pl: "Δ vs punkt", en: "Δ vs point" },
  "manager.cancelledLine": { pl: "Anulowane przez managera", en: "Cancelled by manager" },
  "manager.criticalTooltip": { pl: "Produkt krytyczny", en: "Critical product" },
  // Manager summary strip (computed client-side)
  "manager.managerSummary": {
    pl: "{changes} zmian vs kapitan, {value} zł",
    en: "{changes} changes vs captain, {value} PLN",
  },
  "manager.managerSummaryNone": {
    pl: "Bez zmian vs kapitan",
    en: "No changes vs captain",
  },

  // G2 — editable manager qty + save (without dispatch) ---------------------
  "manager.save": { pl: "Zapisz zmiany", en: "Save changes" },
  "manager.saving": { pl: "Zapisuję…", en: "Saving…" },
  "manager.saved": { pl: "Zapisano zmiany", en: "Changes saved" },
  "manager.unsavedWarning": {
    pl: "Masz niezapisane zmiany. Odrzucić je?",
    en: "You have unsaved changes. Discard them?",
  },
  "manager.qtyInputLabel": { pl: "Ilość zamawiana przez managera", en: "Manager order quantity" },
  "manager.commentInputLabel": { pl: "Komentarz managera", en: "Manager comment" },
  "manager.commentPlaceholder": { pl: "Komentarz…", en: "Comment…" },

  // G3 — channel-aware dispatch panel ---------------------------------------
  "manager.dispatch.title": { pl: "Wysyłka zamówienia", en: "Dispatch order" },
  "manager.dispatch.email": { pl: "Wysyłka: e-mail do dostawcy", en: "Dispatch: supplier e-mail" },
  "manager.dispatch.portal": { pl: "Wysyłka: portal dostawcy (ręcznie)", en: "Dispatch: supplier portal (manual)" },
  "manager.dispatch.phone": { pl: "Wysyłka: telefon", en: "Dispatch: phone" },
  "manager.dispatch.manual": { pl: "Wysyłka: ręcznie", en: "Dispatch: manual" },
  "manager.dispatch.emailTo": { pl: "Do:", en: "To:" },
  "manager.dispatch.emailCc": { pl: "DW:", en: "CC:" },
  "manager.dispatch.emailSubject": { pl: "Temat:", en: "Subject:" },
  "manager.dispatch.emailBody": { pl: "Treść:", en: "Body:" },
  "manager.openGmail": { pl: "Otwórz w Gmail", en: "Open in Gmail" },
  "manager.copyBody": { pl: "Kopiuj treść", en: "Copy body" },
  "manager.copyAddress": { pl: "Kopiuj adres", en: "Copy address" },
  "manager.copyList": { pl: "Kopiuj listę", en: "Copy list" },
  "manager.copied": { pl: "Skopiowano", en: "Copied" },
  "manager.copyFailed": { pl: "Nie udało się skopiować", en: "Copy failed" },
  "manager.openPortal": { pl: "Otwórz portal dostawcy", en: "Open supplier portal" },
  "manager.markOrdered": { pl: "Oznacz jako zamówione ✓", en: "Mark as ordered ✓" },
  "manager.markedOrdered": { pl: "Oznaczono jako zamówione", en: "Marked as ordered" },
  "manager.emptyOrder": {
    pl: "Zamówienie puste — co najmniej jedna pozycja > 0",
    en: "Empty order — at least one line must be > 0",
  },
  "manager.urlTooLong": {
    pl: "Treść za długa dla Gmaila — skopiuj treść i wklej w swoim kliencie.",
    en: "Body too long for Gmail — copy it and paste into your mail client.",
  },
  "manager.noEmail": {
    pl: "Brak adresu e-mail w master data — użyj kopiowania treści.",
    en: "No e-mail in master data — use copy-to-clipboard instead.",
  },
  "manager.portalUrlTbd": {
    pl: "URL do potwierdzenia z operatorem",
    en: "URL to confirm with the operator",
  },
  "manager.portalNote": {
    pl: "{supplier} zamawia się przez portal — system nie wysyła automatycznie.",
    en: "{supplier} orders via portal — the system does not send automatically.",
  },
  "manager.portalConfirmQ": {
    pl: "Czy na pewno złożyłeś już to zamówienie w portalu dostawcy?",
    en: "Are you sure you already placed this order in the supplier portal?",
  },
  "manager.portalConfirmYes": {
    pl: "Tak, zamówienie złożone ✓",
    en: "Yes, order placed ✓",
  },
  "manager.portalConfirmNo": { pl: "Anuluj", en: "Cancel" },
  "manager.phoneNote": { pl: "{supplier} zamawia się telefonicznie.", en: "{supplier} orders by phone." },
  "manager.phoneMissing": {
    pl: "brak numeru — uzupełnij w master data",
    en: "no number — fill it in master data",
  },
  "manager.manualNote": {
    pl: "Zamówienie wewnętrzne / ręczne — brak e-maila i portalu.",
    en: "Internal / manual order — no e-mail or portal.",
  },
  "manager.copyList.header": { pl: "Produkt | Ilość | Kod", en: "Product | Qty | Code" },

  // Captain "My orders" view (Phase E4) -------------------------------------
  "orders.title": { pl: "Moje zamówienia", en: "My orders" },
  "orders.history.navLink": { pl: "Historia zamówień", en: "Order history" },
  "orders.back": { pl: "Wróć do zamówienia", en: "Back to order form" },
  "orders.empty": {
    pl: "Brak zamówień. Wyślij pierwsze z ekranu zamówienia.",
    en: "No orders yet. Submit the first one from the order screen.",
  },
  "orders.loading": { pl: "Ładowanie zamówień…", en: "Loading orders…" },
  "orders.fetchError": {
    pl: "Błąd pobierania zamówień: {detail}",
    en: "Error loading orders: {detail}",
  },
  // Pipeline-stage status labels (Opcja 1). Badge = WHERE the order is in the
  // flow. Editability is shown separately via orders.edit.* below.
  "orders.status.captain_submitted": { pl: "U menedżera", en: "With manager" },
  "orders.status.manager_claimed": { pl: "W realizacji", en: "In progress" },
  "orders.status.manager_sent": { pl: "Zamówione u dostawcy", en: "Ordered" },
  "orders.status.closed": { pl: "Zrealizowane", en: "Completed" },
  "orders.status.draft": { pl: "Szkic", en: "Draft" },
  "orders.status.cancelled": { pl: "Anulowane", en: "Cancelled" },
  // Editability line (separate signal from the stage badge).
  "orders.edit.editable": { pl: "można edytować", en: "editable" },
  "orders.linesShort": { pl: "poz.", en: "items" },
  "orders.edit.locked": { pl: "zablokowane", en: "locked" },
  "orders.editableHint": {
    pl: "Możesz jeszcze edytować — menedżer nie przejął zamówienia",
    en: "You can still edit — manager hasn't taken over yet",
  },
  "orders.lockedHint": {
    pl: "Zablokowane — menedżer prowadzi zamówienie",
    en: "Locked — manager is handling this order",
  },
  // Send-back banner (manager released the order back with a reason).
  "orders.sendBackBanner": {
    pl: "Menedżer odesłał do poprawy: {reason}",
    en: "Manager sent this back for changes: {reason}",
  },
  "orders.detail.editBtn": { pl: "Edytuj zamówienie", en: "Edit order" },
  "orders.detail.lockedBtn": { pl: "Edycja niemożliwa", en: "Editing disabled" },
  "orders.detail.lockedExplain": {
    pl: "Menedżer przejął to zamówienie i nie można go już edytować. Jeśli musisz zmienić ilości, skontaktuj się z menedżerem bezpośrednio.",
    en: "The manager has taken over this order and it can no longer be edited. If you need to change quantities, contact the manager directly.",
  },
  "orders.detail.total": { pl: "Wartość: {value} PLN", en: "Total: {value} PLN" },
  "orders.detail.requestedDelivery": {
    pl: "Dostawa: {value}",
    en: "Delivery: {value}",
  },
  "orders.detail.submittedAt": {
    pl: "Wysłane: {value}",
    en: "Submitted: {value}",
  },
  "orders.detail.orderedBy": { pl: "Zamówił: {value}", en: "Ordered by: {value}" },
  "orders.detail.linesHeader": { pl: "Pozycje zamówienia", en: "Order items" },
  "orders.detail.managerChanged": {
    pl: "zmienione przez menedżera (było {value})",
    en: "changed by manager (was {value})",
  },
  "orders.detail.orderedLabel": { pl: "Zamówiono", en: "Ordered" },
  "orders.detail.receivedLabel": { pl: "Dostarczono", en: "Delivered" },
  "orders.detail.orderedSecondary": {
    pl: "Zamówiono: {value} {unit}",
    en: "Ordered: {value} {unit}",
  },
  "orders.editToast.success": {
    pl: "Zamówienie zaktualizowane",
    en: "Order updated",
  },
  "orders.editToast.locked": {
    pl: "Edycja niemożliwa — menedżer już zaczął procesować zamówienie. Odśwież listę.",
    en: "Cannot edit — manager has already started processing this order. Refresh the list.",
  },
  "orders.editToast.error": {
    pl: "Błąd edycji: {detail}",
    en: "Edit error: {detail}",
  },

  // Inventory count (S-06) --------------------------------------------------
  "hamburger.inventory": { pl: "Inwentaryzacja", en: "Inventory count" },
  "inventory.title": { pl: "Inwentaryzacja lokalizacji", en: "Location inventory" },
  "inventory.subtitle": {
    pl: "Policz cały stan w jednym przejściu, potem zatwierdź.",
    en: "Count all stock in one pass, then approve.",
  },
  "inventory.loading": { pl: "Ładowanie produktów…", en: "Loading products…" },
  "inventory.empty": {
    pl: "Brak produktów skonfigurowanych dla tej lokalizacji.",
    en: "No products configured for this location.",
  },
  "inventory.productsError": {
    pl: "Błąd pobierania produktów: {detail}",
    en: "Error loading products: {detail}",
  },
  "inventory.qtyLabel": { pl: "Stan", en: "Stock" },
  "inventory.commentPlaceholder": {
    pl: "Komentarz (opcjonalnie)",
    en: "Comment (optional)",
  },
  "inventory.counted": {
    pl: "Policzono {counted} z {total}",
    en: "{counted} of {total} counted",
  },
  "inventory.saveDraftBtn": { pl: "Zapisz roboczo", en: "Save draft" },
  "inventory.submitBtn": { pl: "Zatwierdź", en: "Approve" },
  "inventory.submittingBtn": { pl: "Zapisywanie…", en: "Saving…" },
  "inventory.fillFirst": {
    pl: "Wpisz stan, aby zatwierdzić",
    en: "Enter stock to approve",
  },
  "inventory.readyToSubmit": {
    pl: "Gotowe do zatwierdzenia",
    en: "Ready to approve",
  },
  "inventory.confirmTitle": {
    pl: "Zatwierdzić inwentaryzację?",
    en: "Approve inventory count?",
  },
  "inventory.confirmSummary": {
    pl: "Policzono {counted} z {total} produktów. Zapis utworzy datowany snapshot.",
    en: "{counted} of {total} products counted. Approving creates a dated snapshot.",
  },
  "inventory.confirmBack": { pl: "Wróć", en: "Back" },
  "inventory.confirmSend": { pl: "Tak, zatwierdź", en: "Yes, approve" },
  "inventory.draftBannerAriaLabel": {
    pl: "Wznowić niezapisaną inwentaryzację",
    en: "Resume unsaved inventory count",
  },
  "inventory.draftBannerTitle": {
    pl: "Wykryto niezapisaną inwentaryzację z godziny {time}. Wznowić?",
    en: "Unsaved inventory count from {time} found. Resume it?",
  },
  "inventory.draftBannerAccept": { pl: "Wznów", en: "Resume" },
  "inventory.draftBannerDiscard": { pl: "Odrzuć", en: "Discard" },
  "inventory.draftSaved": {
    pl: "Szkic inwentaryzacji zapisany",
    en: "Inventory draft saved",
  },
  "inventory.successToast": {
    pl: "Inwentaryzacja zapisana ({count} poz.)",
    en: "Inventory saved ({count} items)",
  },
  "inventory.submitError": {
    pl: "Błąd zapisu inwentaryzacji: {detail}",
    en: "Inventory save error: {detail}",
  },
  "inventory.notPersistedWarning": {
    pl: "Uwaga: zapis tymczasowy (tryb seed) — dane nie utrwalone.",
    en: "Note: in-memory only (seed mode) — not persisted.",
  },
  "inventory.categoryCount": { pl: "{counted}/{total}", en: "{counted}/{total}" },
  "inventory.uncategorized": { pl: "Bez kategorii", en: "Uncategorized" },
  "inventory.countDateLabel": { pl: "Data remanentu", en: "Count date" },
  "inventory.countedByLabel": { pl: "Kto liczył", en: "Counted by" },
  "inventory.countedByRequired": {
    pl: "Wymagane przed zatwierdzeniem",
    en: "Required before approving",
  },
  "inventory.lastCountBanner": {
    pl: "Ostatni remanent: {who} · {time}",
    en: "Last count: {who} · {time}",
  },
  "inventory.blankVsZeroHint": {
    pl: "Puste = nie policzone · 0 = brak na stanie",
    en: "Blank = not counted · 0 = zero on hand",
  },
  "captain.prefillApplied": {
    pl: "Wypełniono stan z inwentaryzacji ({count} poz.)",
    en: "Stock pre-filled from inventory ({count} items)",
  },
  // Phase 4 — always-available pre-fill control + snapshot picker (FR-022/023/024)
  "captain.prefillControlTitle": {
    pl: "Wypełnij stan z remanentu",
    en: "Fill stock from a count",
  },
  "captain.snapshotPickerLabel": {
    pl: "Remanent (źródło stanu)",
    en: "Count (stock source)",
  },
  "captain.prefillBannerBy": { pl: "liczył: {who}", en: "counted by: {who}" },
  "captain.snapshotOption": {
    pl: "{time} · {who} · {count} poz.",
    en: "{time} · {who} · {count} items",
  },
  "captain.snapshotOptionNoWho": {
    pl: "{time} · {count} poz.",
    en: "{time} · {count} items",
  },
  "captain.prefillFillEmpties": { pl: "Wypełnij puste", en: "Fill empty" },
  "captain.prefillOverwrite": { pl: "Nadpisz wszystko", en: "Overwrite all" },
  "captain.prefillClear": { pl: "Wyczyść", en: "Clear all" },
  "captain.prefillLoading": { pl: "Ładowanie remanentu…", en: "Loading count…" },
  "captain.prefillOverwriteToast": {
    pl: "Nadpisano stan z remanentu ({count} poz.)",
    en: "Stock overwritten from the count ({count} items)",
  },
  "captain.prefillClearedToast": {
    pl: "Wyczyszczono wszystkie pola stanu",
    en: "Cleared all stock fields",
  },
  "captain.prefillOverwriteConfirmTitle": {
    pl: "Nadpisać wszystkie stany?",
    en: "Overwrite all stock?",
  },
  "captain.prefillOverwriteConfirmBody": {
    pl: "Stan z remanentu {time} (liczył: {who}) zastąpi wszystkie pola — także te wpisane ręcznie. Tej operacji nie można cofnąć.",
    en: "Stock from the count {time} (counted by: {who}) will replace every field — including hand-typed values. This cannot be undone.",
  },
  "captain.prefillOverwriteConfirm": { pl: "Nadpisz wszystko", en: "Overwrite all" },
  "captain.prefillOverwriteCancel": { pl: "Anuluj", en: "Cancel" },
  "captain.prefillClearConfirmTitle": {
    pl: "Wyczyścić wszystkie pola?",
    en: "Clear all fields?",
  },
  "captain.prefillClearConfirmBody": {
    pl: "Wszystkie wpisane stany zostaną wyczyszczone (puste = nie policzone). Tej operacji nie można cofnąć.",
    en: "Every entered stock value will be cleared (blank = not counted). This cannot be undone.",
  },
  "captain.prefillClearConfirm": { pl: "Wyczyść wszystko", en: "Clear all" },
  // Phase 5 — permanent Captain tab strip (navigation)
  "tabs.ariaLabel": { pl: "Nawigacja Kapitana", en: "Captain navigation" },
  "tabs.orders": { pl: "Zamówienia", en: "Orders" },
  // Round-1 quick-win: a persistent tab to order history (+ receipts via detail),
  // so it's one tap from every captain screen, not buried in the hamburger.
  "tabs.history": { pl: "Historia", en: "History" },
  "tabs.inventory": { pl: "Remanent", en: "Inventory" },
  // S-08 — Manager inventory view (FR-018)
  "manager.inventory.title": { pl: "Remanenty", en: "Inventory counts" },
  "manager.inventory.navLink": { pl: "Remanenty", en: "Inventory" },
  "manager.inventory.back": { pl: "Powrót do menedżera", en: "Back to manager" },
  "manager.inventory.detailBack": { pl: "Powrót do listy", en: "Back to list" },
  "manager.inventory.detailTitle": { pl: "Remanent — {location}", en: "Count — {location}" },
  "manager.inventory.locationAll": { pl: "Wszystkie lokalizacje", en: "All locations" },
  "manager.inventory.empty": {
    pl: "Brak zatwierdzonych remanentów.",
    en: "No submitted inventory counts.",
  },
  "manager.inventory.loading": { pl: "Ładowanie…", en: "Loading…" },
  "manager.inventory.fetchError": {
    pl: "Nie udało się pobrać remanentów: {detail}",
    en: "Couldn't load inventory counts: {detail}",
  },
  "manager.inventory.countedBy": { pl: "Liczył: {who}", en: "Counted by: {who}" },
  "manager.inventory.lineCount.one.items": { pl: "{n} pozycja", en: "{n} item" },
  "manager.inventory.lineCount.few.items": { pl: "{n} pozycje", en: "{n} items" },
  "manager.inventory.lineCount.many.items": { pl: "{n} pozycji", en: "{n} items" },
  "manager.inventory.productCol": { pl: "Produkt", en: "Product" },
  "manager.inventory.stockCol": { pl: "Stan", en: "Stock" },
  // S-08 — Captain inventory history (FR-019)
  "inventory.history.title": { pl: "Historia remanentów", en: "Inventory history" },
  "inventory.history.navLink": { pl: "Historia remanentów", en: "Inventory history" },
  "inventory.history.back": { pl: "Powrót do remanentu", en: "Back to count" },
  "inventory.history.detailBack": { pl: "Powrót do listy", en: "Back to list" },
  "inventory.history.detailTitle": { pl: "Remanent {date}", en: "Count {date}" },
  "inventory.history.empty": {
    pl: "Brak remanentów dla tej lokalizacji.",
    en: "No inventory counts for this location.",
  },
  "inventory.history.loading": { pl: "Ładowanie…", en: "Loading…" },
  "inventory.history.fetchError": {
    pl: "Nie udało się pobrać historii: {detail}",
    en: "Couldn't load history: {detail}",
  },
  "inventory.history.countedBy": { pl: "Liczył: {who}", en: "Counted by: {who}" },
  "inventory.history.lineCount.one.items": { pl: "{n} pozycja", en: "{n} item" },
  "inventory.history.lineCount.few.items": { pl: "{n} pozycje", en: "{n} items" },
  "inventory.history.lineCount.many.items": { pl: "{n} pozycji", en: "{n} items" },
  "inventory.history.productCol": { pl: "Produkt", en: "Product" },
  "inventory.history.stockCol": { pl: "Stan", en: "Stock" },
  "inventory.history.productRemoved": { pl: "produkt usunięty", en: "removed product" },
  // S-03 — suggestion learning-loop review (FR-012)
  "manager.review.title": { pl: "Sugestie — przegląd", en: "Suggestions review" },
  "manager.review.navLink": { pl: "Sugestie", en: "Suggestions" },
  "manager.review.back": { pl: "Powrót do menedżera", en: "Back to manager" },
  "manager.review.explainer": {
    pl: "Wyższe odchylenie = produkt częściej korygowany ręcznie — kandydat do poprawy danych podstawowych.",
    en: "Higher deviation = a product overridden more often — a master-data correction candidate.",
  },
  "manager.review.loading": { pl: "Ładowanie…", en: "Loading…" },
  "manager.review.empty": {
    pl: "Brak historii zamówień do analizy.",
    en: "No order history to analyze yet.",
  },
  "manager.review.fetchError": {
    pl: "Nie udało się pobrać przeglądu: {detail}",
    en: "Couldn't load the review: {detail}",
  },
  "manager.review.lineOrderCount": {
    pl: "{lines} poz. · {orders} zam.",
    en: "{lines} lines · {orders} orders",
  },
  "manager.review.colDeviation": {
    pl: "Średnie odchylenie od sugestii",
    en: "Average deviation from suggestion",
  },
  "manager.review.flow": {
    // No unit suffix: these are average PURCHASE-unit quantities, and the unit
    // can differ by supplier across an all-lines aggregate (impl-review F1).
    pl: "sugestia {suggested} → kapitan {captain} → menedżer {manager}",
    en: "suggested {suggested} → captain {captain} → manager {manager}",
  },

  // Goods receiving (GR-01) ---------------------------------------------------
  "delivery.confirmBtn": { pl: "Potwierdź dostawę", en: "Confirm delivery" },
  "delivery.pageTitle": { pl: "Potwierdzenie dostawy", en: "Confirm delivery" },
  "delivery.loading": { pl: "Wczytywanie zamówienia…", en: "Loading order…" },
  "delivery.intro": {
    pl: "Wpisz ilości faktycznie dostarczone i dodaj zdjęcie WZ.",
    en: "Enter the quantities actually delivered and attach the WZ photo.",
  },
  "delivery.ordered": { pl: "Zamówiono", en: "Ordered" },
  "delivery.delivered": { pl: "Dostarczono", en: "Delivered" },
  "delivery.variance": { pl: "Różnica: {value}", en: "Variance: {value}" },
  "delivery.receivedByLabel": { pl: "Kto odebrał", en: "Received by" },
  "delivery.receivedByPlaceholder": { pl: "Imię i nazwisko", en: "Full name" },
  "delivery.photosLabel": { pl: "Zdjęcia WZ", en: "WZ photos" },
  "delivery.addPhoto": { pl: "Dodaj zdjęcie", en: "Add photo" },
  "delivery.photoHint": {
    pl: "Zalecane zdjęcie WZ. Możesz dodać kilka.",
    en: "A WZ photo is recommended. You can add several.",
  },
  "delivery.removePhoto": { pl: "Usuń zdjęcie", en: "Remove photo" },
  "delivery.compressing": { pl: "Przetwarzanie zdjęć…", en: "Processing photos…" },
  "delivery.submitBtn": { pl: "Zatwierdź odbiór", en: "Confirm receipt" },
  "delivery.submittingBtn": { pl: "Zapisywanie…", en: "Saving…" },
  "delivery.successToast": { pl: "Dostawa potwierdzona", en: "Delivery confirmed" },
  "delivery.errorToast": { pl: "Błąd zapisu: {detail}", en: "Save error: {detail}" },
  "delivery.photoErrorToast": {
    pl: "Odbiór zapisany, ale nie udało się wgrać zdjęć: {detail}",
    en: "Receipt saved, but photo upload failed: {detail}",
  },
  "delivery.retryPhotos": { pl: "Spróbuj ponownie wgrać zdjęcia", en: "Retry photo upload" },
  "delivery.savedLockNote": {
    pl: "Paragon zapisany — ilości są już zatwierdzone. Pozostało tylko dograć zdjęcia WZ.",
    en: "Receipt saved — quantities are locked. Only the WZ photos remain.",
  },
  "delivery.statusConfirmed": { pl: "Dostawa potwierdzona", en: "Delivery confirmed" },
  "delivery.confirmedAt": { pl: "Potwierdzono: {value}", en: "Confirmed: {value}" },
  "delivery.discrepancies": { pl: "Rozbieżności: {count}", en: "Discrepancies: {count}" },
  "delivery.photoCount": { pl: "Zdjęcia WZ: {count}", en: "WZ photos: {count}" },
  "delivery.photoLoadError": {
    pl: "Nie udało się wczytać zdjęć WZ",
    en: "Could not load WZ photos",
  },
  "delivery.missingWz": { pl: "Brak zdjęcia WZ", en: "Missing WZ photo" },
  // Manager receiving view (manager-receiving-view) — read-only delivery surface.
  "manager.delivery.section": { pl: "Dostawa", en: "Delivery" },
  "manager.delivery.receivedBy": { pl: "Przyjął: {value}", en: "Received by: {value}" },
  "manager.queue.delivered": { pl: "Dostarczono", en: "Delivered" },
  "manager.queue.discrepancy": { pl: "Różnice", en: "Discrepancies" },
  // Recount gate (round-1 quick-win): delivered starts blank — the captain must
  // enter or one-tap-confirm each line; nothing is pre-counted.
  "delivery.deliveredPlaceholder": { pl: "Wpisz ilość", en: "Enter qty" },
  "delivery.useOrderedQty": { pl: "= zamówione", en: "= ordered" },
  "delivery.allLinesRequired": {
    pl: "Wpisz dostarczoną ilość dla każdej pozycji",
    en: "Enter the delivered qty for every line",
  },
  // Add ad-hoc product to an order (add-product-to-order) — the searchable picker
  // shown on the Captain edit screen and the Manager claimed-order pane.
  "addProduct.button": { pl: "+ Dodaj produkt", en: "+ Add product" },
  "addProduct.placeholder": { pl: "Szukaj produktu…", en: "Search product…" },
  "addProduct.empty": { pl: "Brak produktów do dodania", en: "No products to add" },
  "manager.addLineOk": {
    pl: "Dodano produkt do zamówienia",
    en: "Product added to order",
  },
  // Manager Transport (to-ordering-pago) — combine several locations' orders
  // for one supplier into a single Transport ("TO") batch.
  "manager.transport.navLink": { pl: "Transport (TO)", en: "Transport" },
  "manager.transport.title": { pl: "Transport zbiorczy", en: "Combined transport" },
  "manager.transport.back": { pl: "Powrót do menedżera", en: "Back to manager" },
  "manager.transport.supplierLabel": { pl: "Dostawca", en: "Supplier" },
  // v4 feedback — friendly batch naming (feature 1): the primary title shown
  // everywhere a batch never given a `name` is displayed. "Transport Sobota ·
  // Warszawa · 22.08.26" — this key is just the leading word; the weekday /
  // city / date segments are composed in code (transportAutoLabel).
  "manager.transport.displayLabel.fallbackPrefix": { pl: "Transport", en: "Transport" },
  // v4 feedback round 2 (feature 2): "unopened batch" badge on the list row.
  "manager.transport.badge.new": { pl: "NOWY", en: "NEW" },
  "manager.transport.createEmptyButton": {
    pl: "Utwórz pusty transport",
    en: "Start empty transport",
  },
  "manager.transport.unsavedSwitchConfirm": {
    pl: "Masz niezapisane zmiany ilości — porzucić je?",
    en: "You have unsaved quantity changes — discard them?",
  },
  "manager.transport.noSuppliers": {
    pl: "Brak aktywnych dostawców w danych podstawowych.",
    en: "No active suppliers in master data.",
  },
  "manager.transport.eligible.title": { pl: "Do połączenia", en: "To combine" },
  "manager.transport.eligible.loading": { pl: "Ładowanie…", en: "Loading…" },
  "manager.transport.eligible.empty": {
    pl: "Brak zamówień do połączenia dla tego dostawcy.",
    en: "No orders to combine for this supplier.",
  },
  "manager.transport.eligible.fetchError": {
    pl: "Nie udało się pobrać zamówień: {detail}",
    en: "Couldn't load orders: {detail}",
  },
  "manager.transport.eligible.orderedBy": { pl: "Zamówił: {who}", en: "Ordered by: {who}" },
  "manager.transport.eligible.selectedSummary": {
    pl: "{count} zaznaczonych · {total} PLN",
    en: "{count} selected · {total} PLN",
  },
  "manager.transport.createButton": { pl: "Utwórz transport", en: "Create transport" },
  "manager.transport.createBusy": { pl: "Tworzenie…", en: "Creating…" },
  "manager.transport.createError": {
    pl: "Nie udało się utworzyć transportu: {detail}",
    en: "Couldn't create the transport: {detail}",
  },
  "manager.transport.createResult.combined": {
    pl: "Utworzono szkic {id} z {count} zamówień.",
    en: "Created draft {id} from {count} orders.",
  },
  "manager.transport.createResult.skippedHeader": { pl: "Pominięte:", en: "Skipped:" },
  "manager.transport.batches.title": { pl: "Utworzone transporty", en: "Created transports" },
  "manager.transport.batches.loading": { pl: "Ładowanie…", en: "Loading…" },
  "manager.transport.batches.empty": {
    pl: "Brak utworzonych transportów dla tego dostawcy.",
    en: "No transports created for this supplier yet.",
  },
  "manager.transport.batches.fetchError": {
    pl: "Nie udało się pobrać transportów: {detail}",
    en: "Couldn't load transports: {detail}",
  },
  "manager.transport.batches.rowSubtitle": {
    pl: "{count} zamówień · {locations}",
    en: "{count} orders · {locations}",
  },
  "manager.transport.detail.loading": { pl: "Ładowanie…", en: "Loading…" },
  "manager.transport.detail.fetchError": {
    pl: "Nie udało się pobrać szczegółów: {detail}",
    en: "Couldn't load detail: {detail}",
  },
  "manager.transport.detail.totalsTitle": { pl: "Sumy produktów", en: "Product totals" },
  "manager.transport.detail.productCol": { pl: "Produkt", en: "Product" },
  "manager.transport.detail.qtyCol": { pl: "Ilość", en: "Qty" },
  "manager.transport.detail.matrixTitle": {
    pl: "Rozbicie na lokalizacje (tylko dla kierowcy)",
    en: "Per-location breakdown (driver only)",
  },
  "manager.transport.detail.copyButton": {
    pl: "Kopiuj listę dla kierowcy",
    en: "Copy driver list",
  },
  "manager.transport.detail.copyToast": {
    pl: "Skopiowano listę dla kierowcy.",
    en: "Driver list copied.",
  },
  "manager.transport.detail.copyError": { pl: "Nie udało się skopiować.", en: "Couldn't copy." },
  "manager.transport.detail.emailButton": { pl: "Otwórz email", en: "Open email" },
  "manager.transport.detail.emailHint": {
    pl: "uzupełnij email dostawcy w master data",
    en: "add the supplier's email in master data",
  },
  "manager.transport.detail.emailTooLong": {
    pl: "Zbyt długi projekt e-maila — skopiuj listę zamiast tego.",
    en: "Draft too long — copy the list instead.",
  },
  "manager.transport.detail.ordersTitle": { pl: "Zamówienia źródłowe", en: "Source orders" },
  "manager.transport.driverText.header": {
    pl: "Transport {id} — {date}",
    en: "Transport {id} — {date}",
  },
  "manager.transport.driverText.supplierLine": {
    pl: "Dostawca: {supplier}",
    en: "Supplier: {supplier}",
  },
  "manager.transport.email.subject": {
    pl: "Zamówienie zbiorcze {supplier} — {date}",
    en: "Combined order {supplier} — {date}",
  },
  "manager.transport.email.greeting": { pl: "Dzień dobry,", en: "Hello," },
  "manager.transport.email.intro": {
    pl: "Poniżej zbiorcze zamówienie transportowe:",
    en: "Please find below the combined transport order:",
  },
  "manager.transport.email.lineHeader": {
    pl: "Lp. | Produkt | Ilość",
    en: "No. | Product | Qty",
  },
  "manager.transport.email.closing": { pl: "Pozdrawiam,", en: "Best regards," },
  "manager.transport.email.signature": { pl: "Pita Bros", en: "Pita Bros" },

  // Manager Transport v2 (to-ordering-pago ADDENDUM v2) — draft → sent
  // lifecycle workstation: editable status, logistics, weight preview, the
  // editable product x location matrix, add-location/remove-order, finalize.
  "manager.transport.status.draft": { pl: "Szkic", en: "Draft" },
  "manager.transport.status.sent": { pl: "Wysłany", en: "Sent" },

  "manager.transport.logistics.title": { pl: "Logistyka", en: "Logistics" },
  "manager.transport.logistics.nameLabel": { pl: "Nazwa (opcjonalna)", en: "Name (optional)" },
  "manager.transport.logistics.driverLabel": { pl: "Kierowca", en: "Driver" },
  "manager.transport.logistics.vehicleLabel": { pl: "Samochód", en: "Vehicle" },
  "manager.transport.logistics.pickupDateLabel": { pl: "Data odbioru", en: "Pickup date" },
  "manager.transport.logistics.pickupTimeLabel": { pl: "Godzina odbioru", en: "Pickup time" },
  "manager.transport.logistics.limitKgLabel": { pl: "Limit kg", en: "Weight limit (kg)" },
  "manager.transport.logistics.notesLabel": { pl: "Uwagi", en: "Notes" },
  "manager.transport.logistics.saveButton": { pl: "Zapisz logistykę", en: "Save logistics" },
  "manager.transport.logistics.saveBusy": { pl: "Zapisywanie…", en: "Saving…" },
  "manager.transport.logistics.saveOk": { pl: "Zapisano logistykę.", en: "Logistics saved." },
  "manager.transport.logistics.saveError": {
    pl: "Nie udało się zapisać logistyki: {detail}",
    en: "Couldn't save logistics: {detail}",
  },

  "manager.transport.weight.totalLabel": { pl: "Łączna waga", en: "Total weight" },
  "manager.transport.weight.limitLabel": { pl: "Limit", en: "Limit" },
  "manager.transport.weight.noLimit": { pl: "brak limitu", en: "no limit" },
  "manager.transport.weight.remainingLabel": { pl: "Do limitu", en: "Remaining" },
  "manager.transport.weight.overLabel": { pl: "Ponad limit", en: "Over limit" },
  "manager.transport.weight.unknownWarning": {
    pl: "Brak wagi dla {count} pozycji",
    en: "Missing weight for {count} items",
  },

  "manager.transport.matrix.title": {
    pl: "Produkty × lokalizacje (edytowalne)",
    en: "Products × locations (editable)",
  },
  "manager.transport.matrix.emptyCell": { pl: "–", en: "–" },
  "manager.transport.matrix.saveButton": { pl: "Zapisz zmiany", en: "Save changes" },
  "manager.transport.matrix.saveBusy": { pl: "Zapisywanie…", en: "Saving…" },
  "manager.transport.matrix.saveOk": {
    pl: "Zapisano zmiany w {count} zamówieniach.",
    en: "Saved changes in {count} orders.",
  },
  "manager.transport.matrix.saveError": {
    pl: "Nie udało się zapisać zmian: {detail}",
    en: "Couldn't save changes: {detail}",
  },
  "manager.transport.matrix.zeroHint": {
    pl: "0 = pozycja znika z sum, listy kierowcy i e-maila",
    en: "0 = drops the line from totals, the driver list and the email",
  },
  "manager.transport.matrix.removeColumnAria": {
    pl: "Usuń {location} z transportu",
    en: "Remove {location} from the transport",
  },
  "manager.transport.matrix.qtyAria": { pl: "{product} — {location}", en: "{product} — {location}" },
  // v4 feedback round 2 (feature 4): ONE matrix-wide "+ Dodaj produkt" row,
  // replacing the per-location pickers.
  "manager.transport.matrix.addProductAllOk": {
    pl: "Dodano produkt do zamówień.",
    en: "Product added to the orders.",
  },
  "manager.transport.matrix.addProductAllError": {
    pl: "Nie udało się dodać produktu dla: {locations}",
    en: "Couldn't add the product for: {locations}",
  },

  "manager.transport.addLocation.button": { pl: "Dodaj lokalizację", en: "Add location" },
  "manager.transport.addLocation.placeholder": {
    pl: "Szukaj lokalizacji…",
    en: "Search locations…",
  },
  "manager.transport.addLocation.empty": {
    pl: "Brak lokalizacji do dodania.",
    en: "No locations left to add.",
  },
  "manager.transport.addLocation.ok": { pl: "Dodano lokalizację.", en: "Location added." },
  "manager.transport.addLocation.error": {
    pl: "Nie udało się dodać lokalizacji: {detail}",
    en: "Couldn't add the location: {detail}",
  },

  "manager.transport.removeOrder.confirm": {
    pl: "Usunąć {location} z tego transportu?",
    en: "Remove {location} from this transport?",
  },
  "manager.transport.removeOrder.okReleased": {
    pl: "Zamówienie zwolnione — wraca do kolejki kapitana.",
    en: "Order released — back in the captain's queue.",
  },
  "manager.transport.removeOrder.okCancelled": {
    pl: "Puste zamówienie anulowane.",
    en: "Empty order cancelled.",
  },
  "manager.transport.removeOrder.error": {
    pl: "Nie udało się usunąć zamówienia: {detail}",
    en: "Couldn't remove the order: {detail}",
  },

  "manager.transport.finalize.button": { pl: "Zatwierdź transport", en: "Approve transport" },
  "manager.transport.finalize.confirm": {
    pl: "Zatwierdzić transport {id}? Zamówienia zostaną oznaczone jako wysłane do dostawcy.",
    en: "Approve transport {id}? Member orders will be marked as sent to the supplier.",
  },
  "manager.transport.finalize.busy": { pl: "Zatwierdzanie…", en: "Approving…" },
  "manager.transport.finalize.error": {
    pl: "Nie udało się zatwierdzić transportu: {detail}",
    en: "Couldn't approve the transport: {detail}",
  },
  "manager.transport.finalize.result.sent": {
    pl: "Wysłano {count} zamówień.",
    en: "Sent {count} orders.",
  },
  "manager.transport.finalize.result.skippedHeader": { pl: "Pominięte:", en: "Skipped:" },

  // ADDENDUM v3 — finalize UX fix: disabled while dirty + one-click save+send.
  "manager.transport.finalize.disabledHint": {
    pl: "Najpierw zapisz zmiany (Zapisz zmiany)",
    en: "Save changes first (Save changes)",
  },
  "manager.transport.finalize.saveAndSendButton": {
    pl: "Zapisz i zatwierdź",
    en: "Save and approve",
  },
  "manager.transport.finalize.saveAndSendBusy": { pl: "Zapisywanie i zatwierdzanie…", en: "Saving and approving…" },
  "manager.transport.finalize.saveAndSendSaveFailed": {
    pl: "Nie udało się zapisać zmian — transport NIE został wysłany: {detail}",
    en: "Couldn't save changes — the transport was NOT sent: {detail}",
  },

  // ADDENDUM v3 — cancel draft.
  "manager.transport.status.cancelled": { pl: "Anulowany", en: "Cancelled" },
  "manager.transport.cancel.button": { pl: "Anuluj szkic", en: "Cancel draft" },
  "manager.transport.cancel.confirm": {
    pl: "Anulować szkic transportu {id}? Wszystkie zamówienia zostaną zwolnione lub anulowane.",
    en: "Cancel draft transport {id}? Every member order will be released or cancelled.",
  },
  "manager.transport.cancel.busy": { pl: "Anulowanie…", en: "Cancelling…" },
  "manager.transport.cancel.ok": {
    pl: "Anulowano transport: {released} zwolnionych, {cancelled} anulowanych.",
    en: "Transport cancelled: {released} released, {cancelled} cancelled.",
  },
  "manager.transport.cancel.error": {
    pl: "Nie udało się anulować transportu: {detail}",
    en: "Couldn't cancel the transport: {detail}",
  },
  "manager.transport.batches.showCancelled": { pl: "Pokaż anulowane", en: "Show cancelled" },
  "manager.transport.batches.hideCancelled": { pl: "Ukryj anulowane", en: "Hide cancelled" },

  // ADDENDUM v3 — per-order delivery status (Phase 8).
  "manager.transport.delivery.waiting": { pl: "oczekuje", en: "waiting" },
  "manager.transport.delivery.delivered": { pl: "dostarczono", en: "delivered" },
  "manager.transport.delivery.discrepancy": {
    pl: "{count} rozbieżności",
    en: "{count} discrepancies",
  },

  // ADDENDUM v3 — event history (Phase 6).
  "manager.transport.events.title": { pl: "Historia zmian", en: "Change history" },
  "manager.transport.events.empty": { pl: "Brak historii.", en: "No history yet." },
  "manager.transport.events.toggleShow": { pl: "Pokaż historię", en: "Show history" },
  "manager.transport.events.toggleHide": { pl: "Ukryj historię", en: "Hide history" },
  "manager.transport.events.type.orderCombined": { pl: "Zamówienie połączone", en: "Order combined" },
  "manager.transport.events.type.locationAdded": { pl: "Dodano lokalizację", en: "Location added" },
  "manager.transport.events.type.orderRemoved": { pl: "Zamówienie usunięte", en: "Order removed" },
  "manager.transport.events.type.orderSent": { pl: "Zamówienie wysłane", en: "Order sent" },
  "manager.transport.events.type.batchSent": { pl: "Transport wysłany", en: "Transport sent" },
  "manager.transport.events.type.batchCancelled": { pl: "Transport anulowany", en: "Transport cancelled" },
  "manager.transport.events.type.logisticsChanged": { pl: "Zmieniono logistykę", en: "Logistics changed" },
  "manager.transport.events.type.quantitiesChanged": { pl: "Zmieniono ilości", en: "Quantities changed" },
  "manager.transport.events.type.deliveryConfirmed": { pl: "Potwierdzono dostawę", en: "Delivery confirmed" },

  // ADDENDUM v3 — manager-first grid creation (Phase 9).
  "manager.transport.gridCreate.button": {
    pl: "Nowy transport z lokalizacjami",
    en: "New transport with locations",
  },
  "manager.transport.gridCreate.title": {
    pl: "Wybierz lokalizacje do transportu",
    en: "Pick locations for the transport",
  },
  "manager.transport.gridCreate.confirm": { pl: "Utwórz transport", en: "Create transport" },
  "manager.transport.gridCreate.cancel": { pl: "Anuluj", en: "Cancel" },
  "manager.transport.gridCreate.empty": { pl: "Brak aktywnych lokalizacji.", en: "No active locations." },
  "manager.transport.gridCreate.busy": { pl: "Tworzenie transportu…", en: "Creating transport…" },
  "manager.transport.gridCreate.progress": {
    pl: "Dodawanie {location}…",
    en: "Adding {location}…",
  },
  "manager.transport.gridCreate.locationError": {
    pl: "Nie udało się dodać {location}: {detail}",
    en: "Couldn't add {location}: {detail}",
  },
  "manager.transport.gridCreate.done": {
    pl: "Utworzono transport z {count} lokalizacjami.",
    en: "Created transport with {count} locations.",
  },
  "manager.transport.gridCreate.selectedCount": {
    pl: "Wybrano: {count}",
    en: "Selected: {count}",
  },
  // v4 feedback — "all locations, one button": every active location arrives
  // pre-checked; this toggle is for the rare narrow-down case.
  "manager.transport.gridCreate.selectAll": { pl: "Zaznacz wszystkie", en: "Select all" },
  "manager.transport.gridCreate.deselectAll": { pl: "Odznacz wszystkie", en: "Deselect all" },

  // ADDENDUM v3 — print/PDF views (Phase 10). v5 feedback: real .pdf download,
  // not window.print() — button copy no longer says "Drukuj".
  "manager.transport.print.driverButton": {
    pl: "PDF — lista kierowcy",
    en: "PDF — driver list",
  },
  "manager.transport.print.pagoButton": {
    pl: "PDF — zamówienie",
    en: "PDF — order",
  },
  "manager.transport.print.downloadError": {
    pl: "Nie udało się wygenerować PDF. Spróbuj ponownie.",
    en: "Failed to generate the PDF. Please try again.",
  },
  "manager.transport.print.driverTitle": { pl: "Lista dla kierowcy", en: "Driver list" },
  "manager.transport.print.pagoTitle": { pl: "Zamówienie zbiorcze", en: "Combined order" },
  "manager.transport.print.driverLabel": { pl: "Kierowca", en: "Driver" },
  "manager.transport.print.vehicleLabel": { pl: "Samochód", en: "Vehicle" },
  "manager.transport.print.dateLabel": { pl: "Data", en: "Date" },
  "manager.transport.print.supplierLabel": { pl: "Dostawca", en: "Supplier" },
  "manager.transport.print.productCol": { pl: "Produkt", en: "Product" },
  "manager.transport.print.qtyCol": { pl: "Ilość", en: "Qty" },
  "manager.transport.print.locationCol": { pl: "Lokalizacja", en: "Location" },

  // v4 feedback — print docs redesigned to match the legacy PDFs (feature 3).
  "manager.transport.print.driverBarTitle": {
    pl: "PITA BROS — LISTA DLA KIEROWCY",
    en: "PITA BROS — DRIVER LIST",
  },
  "manager.transport.print.locationsRowLabel": { pl: "Miasto/Lokalizacje", en: "City/Locations" },
  "manager.transport.print.timeLabel": { pl: "Godzina", en: "Time" },
  "manager.transport.print.docNumberLabel": { pl: "Nr dokumentu", en: "Document no." },
  "manager.transport.print.lpCol": { pl: "Lp.", en: "No." },
  "manager.transport.print.unitCol": { pl: "Jm.", en: "Unit" },
  "manager.transport.print.totalCol": { pl: "Razem", en: "Total" },
  "manager.transport.print.footerGenerated": { pl: "Wygenerowano: {when}", en: "Generated: {when}" },
  "manager.transport.print.pagoDoc.entityBoxTitle": { pl: "Dane podmiotu", en: "Entity data" },
  "manager.transport.print.pagoDoc.docBoxTitle": { pl: "Dane dokumentu", en: "Document data" },
  "manager.transport.print.pagoDoc.fullNameLabel": { pl: "Pełna nazwa", en: "Full name" },
  "manager.transport.print.pagoDoc.nipLabel": { pl: "NIP", en: "NIP" },
  "manager.transport.print.pagoDoc.address1Label": { pl: "Adres 1", en: "Address 1" },
  "manager.transport.print.pagoDoc.address2Label": { pl: "Adres 2", en: "Address 2" },
  "manager.transport.print.pagoDoc.pickupDateLabel": { pl: "Data odbioru", en: "Pickup date" },
  "manager.transport.print.pagoDoc.locationsLabel": { pl: "Lokalizacje", en: "Locations" },
  "manager.transport.print.pagoDoc.typeLabel": { pl: "Typ", en: "Type" },
  "manager.transport.print.pagoDoc.typeValue": { pl: "Odbiór własny", en: "Self pickup" },
  "manager.transport.print.pagoDoc.pickupTimeLabel": { pl: "Godzina odbioru", en: "Pickup time" },
  "manager.transport.print.pagoDoc.pickupBar": {
    pl: "Odbiór własny z magazynu The Greek Gourmet",
    en: "Self pickup from The Greek Gourmet warehouse",
  },
  "manager.transport.print.pagoDoc.catalogCol": { pl: "Nr katalogowy", en: "Catalog no." },

  "manager.queue.transportChip": { pl: "TO", en: "TO" },
  "manager.queue.transportChipTooltip": {
    pl: "Zamówienie połączone w transport",
    en: "Order combined into a transport batch",
  },
} as const satisfies Record<string, StringEntry>;

export type StringKey = keyof typeof STRINGS;
