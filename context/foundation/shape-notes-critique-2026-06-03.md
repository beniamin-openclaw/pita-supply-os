# Raport krytyczny — shape-notes.md (Pita Supply OS)

**Data:** 2026-06-03
**Rola:** konstruktywny krytyk
**Zakres:** tylko ocena — żaden istniejący plik nie został zmieniony. To jest jedyny utworzony plik.
**Oceniany artefakt:** `context/foundation/shape-notes.md` (brownfield, checkpoint Phase 8, `quality_check_status: accepted`).

---

## Werdykt ogólny

Dokument jest **spójny, kompletny względem schematu brownfield (11 sekcji) i gotowy do `/10x-prd`.** Rdzeń jest mocny: jasna reguła domenowa B, dobre rozgraniczenie Tier 1/2/3, świadome Non-Goals i bramki rollouts. Uwagi poniżej to **dopracowania, nie blokery** — większość to „warto, gdy będzie chwila", a kilka to rzeczy, które mogą uderzyć dopiero przy starcie pilota (master data, ownerzy Open Questions). Część słabszych miejsc była **świadomie zaakceptowana przez operatora** (miękkie NFR, krótka forma Access Control) — te oznaczam jako „już zdecydowane", nie naciskam.

---

## Co jest mocne (żeby nie poprawiać tego, co działa)

- **Reguła domenowa B** jest realna i jednozdaniowa: „single path from location stock to supplier dispatch". To nie jest puste CRUD — jest decyzja koordynacyjna.
- **Constraints Tier 1/2/3** — bardzo dobre, jawnie nazywa co nie może się zepsuć (prod routes, Sheets schema, two-token auth, TesterArmy back-out).
- **Non-Goals** są load-bearing, nie kosmetyczne (Pago, auto-order, GoStock, per-manager identity). Świadome pominięcie „queue filters jako non-goal" jest spójne z FR-014.
- **Bramki rollouts** (week 2 → +2 lokacje → firma) chronią przed przedwczesnym skalowaniem.

---

## Ustalenia — priorytetowo

### 🔴 Wysoki priorytet (rozważ przed `/10x-prd` lub przed startem pilota)

**A. „Unit pain" nie ma własnego FR ani kryterium — a to najgroźniejszy ból.**
Cztery bóle to: send / decision / memory / **unit** („kg vs cartons/pieces; silent conversion errors"). Trzy pierwsze mają jawne pokrycie (flow / FR-004 / FR-011). **Unit** jest pokryty tylko pośrednio — przez „purchase units + visible math" (FR-003) i AC US-01 („quantities in purchase units"). To paradoks: błąd jednostki = realne złe zamówienie u dostawcy, a jest najsłabiej zaadresowany.
→ *Sugestia:* albo jawny FR („Captain/System sees quantity in the supplier's purchase unit, with the kg↔unit conversion shown"), albo jedno zdanie w Business Logic/Success Criteria wskazujące, że widoczna konwersja jednostek JEST mechanizmem przeciw temu bólowi. Nie wymyślam liczby — tylko sygnalizuję lukę.

**B. Success Criteria → Primary nie są mierzalne (schemat wymaga „measurable").**
Obecne Primary to checklista przepływu („token → Bukat → stock → submit"), nie wynik. Problem jest skwantyfikowany (30–60 min/cykl), ale żaden cel sukcesu nie wraca do tej liczby.
→ *Sugestia (do uzupełnienia liczbami przez Ciebie):* np. „jeden pełny cykl Wola×Bukat domknięty w jednym narzędziu w < X min", „100% linii Bukat ma suggested + captain-final + reason", „0 realnych zamówień podczas testów prod". To zamienia checklistę w mierzalny wynik bez zmiany zakresu.

**C. Open Questions bez właściciela i terminu — a dwa z nich blokują pilot.**
Schemat prosi o „who resolves + by when". OQ#1 (kto trzyma Manager token w Wola) i OQ#2 (gotowość master data Bukat) są na ścieżce krytycznej tygodnia 1, ale nie mają „resolve-by".
→ *Sugestia:* dodać owner + „przed startem pilota" przynajmniej do #1 i #2. To czysto organizacyjne, zero zmiany produktu.

**D. Brak definicji „ready/trustworthy" dla master data Bukat (FR-012 + OQ#2).**
FR-012 mówi „so the engine is trustworthy for pilot products", ale nigdzie nie ma progu, kiedy dane są wystarczająco dobre, by ruszyć. Przy 1-tygodniowym oknie to ryzyko poślizgu.
→ *Sugestia:* krótka definicja gotowości, np. „każde SKU Bukat ma target + jednostkę zakupu + współczynnik konwersji zweryfikowany przez ownera". (Łączy się z A i C.)

### 🟡 Średni priorytet (spójność / czytelność)

**E. FR-011 i NFR-3 częściowo się pokrywają.** Oba mówią o inspekcji historii linii (FR = zdolność zapisu, NFR = trwałość/wgląd później). Obrona tego podziału istnieje, ale warto to świadomie zaznaczyć, żeby `/10x-prd` nie policzył tego podwójnie ani nie potraktował jako sprzeczności.

**F. Niewypowiedziane założenie adopcyjne.** Reguła B zakłada, że Kapitanowie **faktycznie przestaną używać WhatsAppa**. To fundament całej wartości, a nie jest zapisany jako założenie/ryzyko. → Jedna linijka w Open Questions lub jako ryzyko: „adoption: czy Captain użyje aplikacji zamiast WhatsApp w pilocie".

**G. Tylko jedna User Story (US-01 = happy path).** Brak historii dla pętli **send-back / korekty** (FR-009 „Odrzuć do poprawy" + FR-004 reason + FR-012 korekta master data) — a to ma najmniej oczywiste AC (co widzi Captain, gdy zamówienie wraca?). → Rozważ US-02 dla pętli zwrotnej. Schemat to „opcjonalne, ale zalecane".

**H. Persona bez „momentu sięgnięcia po produkt".** Schemat User & Persona prosi o context + „the moment they reach for this product". Obecnie persony to listy zdolności. Drobne wzbogacenie (np. Captain = poranny przegląd stanu przed cyklem zamówień; Manager = gdy w kolejce pojawia się submit).

### 🟢 Niski priorytet / już świadomie zdecydowane (nie naciskam)

**I. Miękkie NFR — operator już wybrał „keep as written".** „connectivity is normal for the pilot", „same business day", „inspectable later" (brak okna retencji) są nieostre. Świadoma decyzja z Phase 5 — zostawiam, tylko notuję jako opcjonalne doostrzenie na później.

**J. Płytka runda Socratesa.** 8 z 14 FR ma „No counter-argument; stands as written". Realne wyzwania dostały tylko FR-006/011/012. Fazy zamknięte — informacyjnie.

**K. Realizm 1 tygodnia.** `delivery_weeks: 1`, mixed after-hours, a zakres = MVP Wola×Bukat **+ test + walidacja/prep master data**. Master data (OQ#2) jest na ścieżce krytycznej i nieoszacowane. Cross-check to przepuścił (≤3, bez ack). Tylko flaga ryzyka harmonogramu — nie zmieniam.

**L. Kosmetyka.** FR-011 „System can record…" odbiega od wzorca „[Actor] can…" (dopuszczalne). `qps`/`data_volume` nie mają noty end-state jak `users`. Bez znaczenia dla PRD.

---

## Jeśli zrobisz tylko 3 rzeczy

1. **A** — domknij „unit pain" (jawny FR albo jedno zdanie, że widoczna konwersja jednostek to mechanizm przeciw temu bólowi).
2. **B** — dodaj 1–2 mierzalne Primary Success Criteria powiązane z bólem 30–60 min.
3. **C** — dopisz ownera + „przed startem pilota" do Open Questions #1 i #2 (i przy okazji próg „ready" z D).

To są ~30 minut pracy, czysto facylitacyjnej (Ty podajesz liczby/progi), zero rozszerzania zakresu.

---

## Czego świadomie NIE rekomenduję (anty-over-engineering)

- Nie dodawać twardych SLA/metryk infrastrukturalnych — to nie należy do PRD (idzie do tech-stack/stack-assess).
- Nie rozbudowywać Access Control z powrotem do macierzy — operator wybrał „go easy, harden later".
- Nie mnożyć User Stories ponad pętlę zwrotną — jedna dodatkowa wystarczy.
- Nie ruszać bramek rollouts ani Non-Goals — są dobre.
