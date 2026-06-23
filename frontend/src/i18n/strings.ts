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
    pl: "Wznowić niezapisany szkic",
    en: "Resume unsaved draft",
  },
  "captain.draftBannerTitle": {
    pl: "Wykryto szkic z godziny {time}. Wznowić?",
    en: "Draft from {time} found. Resume it?",
  },
  "captain.draftBannerAccept": { pl: "Wznów", en: "Resume" },
  "captain.draftBannerDiscard": { pl: "Odrzuć", en: "Discard" },

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

  // Edited-marker (Phase F4) -------------------------------------------------
  "orders.editedBadge": { pl: "POPRAWIONE", en: "EDITED" },
  "orders.editedAt": { pl: "Edytowane: {value}", en: "Edited: {value}" },

  // Manager action buttons (Phase F3) ---------------------------------------
  "manager.tab.submitted": { pl: "Do przejęcia", en: "To claim" },
  "manager.tab.claimed": { pl: "W realizacji", en: "In progress" },
  "manager.tab.sent": { pl: "Zamówione", en: "Ordered" },
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
} as const satisfies Record<string, StringEntry>;

export type StringKey = keyof typeof STRINGS;
