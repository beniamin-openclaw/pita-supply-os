# Review list — location rows with thresholds 0/0/0 (prod, read 2026-10-01)

Read-only snapshot of `location_product_settings` on active locations where min = target = max = 0
and the product is active. 128 rows. **Nothing is removed until the operator ticks rows here.**

Columns: `ord` = order lines at this location since 2026-08-01 (not cancelled); `last count > 0` = latest
inventory count at this location with a non-zero quantity (any date).

Suggestion key:
- KEEP — intentional: own production (counted, never ordered — operator 2026-10-01), gas cylinders, grill brush.
- covered by this plan — handled in plan.md (honey sachets P139, uncut gyros P177, rolls).
- IN USE — ordered since 1.08 with no thresholds: set thresholds or keep as order-on-demand.
- COUNTED — counted > 0 but not ordered: keep (it is in stock) or set thresholds.
- REMOVE? — never ordered here since 1.08 and never counted > 0, or no active supplier.

Removing a row only hides the product from that location's order and inventory lists; history stays.

| Location | ID | Product | Category | Supplier | ord | last count > 0 | Suggestion | Decision |
|---|---|---|---|---|---|---|---|---|
| BRACKA | P105 | Płyn do zmywarek 5L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| BRACKA | P110 | Płyn Tytan 5L | Chemia | BLUESERV | 0 | 01.09 | COUNTED | |
| BRACKA | P108 | Rosa Mydło do rąk 5L | Chemia | BLUESERV | 0 | 27.09 | COUNTED | |
| BRACKA | P188 | Szczotka do grilla | Chemia | MORY | 0 | 27.09 | KEEP | |
| BRACKA | P114 | Top Glass Tenzi | Chemia | BLUESERV | 0 | 27.09 | COUNTED | |
| BRACKA | P113 | Top Grill Tenzi 1L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| BRACKA | P115 | Tytan 500g | Chemia | BLUESERV | 0 | — | REMOVE? | |
| BRACKA | P126 | Worki na śmiecie 160 L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| BRACKA | P182 | Butla gazowa 10L otwarta | Gaz | INTERNAL | 0 | 27.09 | KEEP | |
| BRACKA | P181 | Butla gazowa 10L zamknięta | Gaz | KAMINO | 0 | 27.09 | KEEP | |
| BRACKA | P025 | Gyros 25 KG | Mrożonki | PAGO | 2 | — | IN USE | |
| BRACKA | P079 | Kinley | Napoje | COCACOLA | 0 | 27.09 | COUNTED | |
| BRACKA | P078 | Lech Free | Napoje | COCACOLA | 0 | 27.09 | COUNTED | |
| BRACKA | P063 | Monster (wszystkie) | Napoje | COCACOLA | 0 | — | REMOVE? | |
| BRACKA | P099 | Jednorazowe mini łyżeczki | Opakowania | BLUESERV | 0 | 27.09 | COUNTED | |
| BRACKA | P144 | Kubeczki papierowe | Opakowania | BLUESERV | 0 | — | REMOVE? | |
| BRACKA | P139 | AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30 | Spożywcze | INTERMLECZ | 0 | — | covered by this plan | |
| BRACKA | P056 | Cukier w saszetkach 5g | Spożywcze | INTERMLECZ | 0 | 27.09 | COUNTED | |
| BRACKA | P140 | KAWA JACOBS CRONAT GOLD ROZPUSZCZALNA 200g/6 | Spożywcze | INTERMLECZ | 0 | 27.09 | COUNTED | |
| BRACKA | P141 | LIPTON HERBATA YELLOW LABEL 100szt./12 koperta | Spożywcze | INTERMLECZ | 0 | 27.09 | COUNTED | |
| BRACKA | P039 | Ocet spirytusowy | Spożywcze | INTERMLECZ | 0 | 21.09 | COUNTED | |
| BRACKA | P060 | Ionos Wino Białe 2l | Wino | EUROFOOD | 0 | — | REMOVE? | |
| BRACKA | P062 | Ionos Wino Czerwone 2l | Wino | EUROFOOD | 0 | — | REMOVE? | |
| BROWARY | P112 | Fenix degreaser 1L | Chemia | BLUESERV | 0 | 27.09 | COUNTED | |
| BROWARY | P188 | Szczotka do grilla | Chemia | MORY | 0 | 27.09 | KEEP | |
| BROWARY | P113 | Top Grill Tenzi 1L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| BROWARY | P156 | Burn | Napoje | — (no active supplier) | 0 | — | REMOVE? | |
| BROWARY | P081 | Fuzetea | Napoje | COCACOLA | 0 | — | REMOVE? | |
| BROWARY | P079 | Kinley | Napoje | COCACOLA | 0 | — | REMOVE? | |
| BROWARY | P099 | Jednorazowe mini łyżeczki | Opakowania | BLUESERV | 0 | — | REMOVE? | |
| BROWARY | P144 | Kubeczki papierowe | Opakowania | BLUESERV | 2 | 27.09 | IN USE | |
| BROWARY | P088 | Opakowanie Frytki | Opakowania | BLUESERV | 0 | 27.09 | COUNTED | |
| BROWARY | P102 | Słomki 250szt | Opakowania | BLUESERV | 0 | 27.09 | COUNTED | |
| BROWARY | P056 | Cukier w saszetkach 5g | Spożywcze | INTERMLECZ | 0 | — | REMOVE? | |
| BROWARY | P039 | Ocet spirytusowy | Spożywcze | INTERMLECZ | 0 | — | REMOVE? | |
| ELEKTROWNIA | P183 | Rolki do kasy 80 na 20 | Biurowe | MORY | 1 | 27.09 | covered by this plan (rolls) | |
| ELEKTROWNIA | P129 | Rolki do kasy 80 na 80 | Biurowe | MORY | 1 | 27.09 | covered by this plan (rolls) | |
| ELEKTROWNIA | P122 | Druciak do mycia | Chemia | MORY | 1 | 27.09 | IN USE | |
| ELEKTROWNIA | P169 | Płyn do mycia szyb Cif | Chemia | — (no active supplier) | 0 | 27.09 | REMOVE? (counted, but nobody to order from) | |
| ELEKTROWNIA | P114 | Top Glass Tenzi | Chemia | BLUESERV | 0 | — | REMOVE? | |
| ELEKTROWNIA | P024 | Gyros 15 KG | Mrożonki | PAGO | 0 | — | REMOVE? | |
| ELEKTROWNIA | P156 | Burn | Napoje | — (no active supplier) | 0 | 27.09 | REMOVE? (counted, but nobody to order from) | |
| ELEKTROWNIA | P099 | Jednorazowe mini łyżeczki | Opakowania | BLUESERV | 0 | 27.09 | COUNTED | |
| ELEKTROWNIA | P177 | Gyros wieprzowy nieścięty | Produkcja | INTERNAL | 0 | — | covered by this plan | |
| ELEKTROWNIA | P176 | Gyros wieprzowy ścięty | Produkcja | INTERNAL | 0 | 27.09 | KEEP | |
| ELEKTROWNIA | P036 | Kasza Pęczak ugotowana | Produkcja | INTERNAL | 0 | 27.09 | KEEP | |
| ELEKTROWNIA | P032 | Ketchup | Produkcja | INTERNAL | 0 | 27.09 | KEEP | |
| ELEKTROWNIA | P033 | Ladolimono | Produkcja | INTERNAL | 0 | 27.09 | KEEP | |
| ELEKTROWNIA | P035 | Masło czosnkowe | Produkcja | INTERNAL | 0 | 27.09 | KEEP | |
| ELEKTROWNIA | P031 | Musztada | Produkcja | INTERNAL | 0 | 27.09 | KEEP | |
| ELEKTROWNIA | P030 | Musztada Miodowa | Produkcja | INTERNAL | 0 | 27.09 | KEEP | |
| ELEKTROWNIA | P034 | Ogórek + papryka | Produkcja | INTERNAL | 0 | 27.09 | KEEP | |
| ELEKTROWNIA | P029 | Spicy Mayo | Produkcja | INTERNAL | 0 | 27.09 | KEEP | |
| ELEKTROWNIA | P158 | Cukier w saszetkach 5g/200 szt | Spożywcze | — (no active supplier) | 0 | — | REMOVE? | |
| ELEKTROWNIA | P039 | Ocet spirytusowy | Spożywcze | INTERMLECZ | 0 | — | REMOVE? | |
| KEN | P109 | Płyn do mycia szyb Tenzi | Chemia | BLUESERV | 0 | — | REMOVE? | |
| KEN | P105 | Płyn do zmywarek 5L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| KEN | P110 | Płyn Tytan 5L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| KEN | P188 | Szczotka do grilla | Chemia | MORY | 0 | 27.09 | KEEP | |
| KEN | P113 | Top Grill Tenzi 1L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| KEN | P115 | Tytan 500g | Chemia | BLUESERV | 0 | — | REMOVE? | |
| KEN | P182 | Butla gazowa 10L otwarta | Gaz | INTERNAL | 0 | — | KEEP | |
| KEN | P181 | Butla gazowa 10L zamknięta | Gaz | KAMINO | 0 | — | KEEP | |
| KEN | P025 | Gyros 25 KG | Mrożonki | PAGO | 0 | 06.09 | COUNTED | |
| KEN | P156 | Burn | Napoje | — (no active supplier) | 0 | 27.09 | REMOVE? (counted, but nobody to order from) | |
| KEN | P099 | Jednorazowe mini łyżeczki | Opakowania | BLUESERV | 0 | — | REMOVE? | |
| KEN | P039 | Ocet spirytusowy | Spożywcze | INTERMLECZ | 0 | — | REMOVE? | |
| KEN | P060 | Ionos Wino Białe 2l | Wino | EUROFOOD | 0 | — | REMOVE? | |
| KEN | P062 | Ionos Wino Czerwone 2l | Wino | EUROFOOD | 0 | — | REMOVE? | |
| NORBLIN | P120 | Papier Toaletowy 8 rolek | Chemia | BLUESERV | 0 | — | REMOVE? | |
| NORBLIN | P105 | Płyn do zmywarek 5L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| NORBLIN | P110 | Płyn Tytan 5L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| NORBLIN | P108 | Rosa Mydło do rąk 5L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| NORBLIN | P188 | Szczotka do grilla | Chemia | MORY | 0 | 30.09 | KEEP | |
| NORBLIN | P114 | Top Glass Tenzi | Chemia | BLUESERV | 0 | — | REMOVE? | |
| NORBLIN | P115 | Tytan 500g | Chemia | BLUESERV | 0 | — | REMOVE? | |
| NORBLIN | P126 | Worki na śmiecie 160 L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| NORBLIN | P124 | Worki na śmiecie 60 L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| NORBLIN | P024 | Gyros 15 KG | Mrożonki | PAGO | 0 | — | REMOVE? (Norblin sheet: 0/0) | |
| NORBLIN | P138 | Corfu Free | Napoje | FILBER | 0 | — | REMOVE? | |
| NORBLIN | P136 | Corfu Lager | Napoje | FILBER | 0 | — | REMOVE? | |
| NORBLIN | P137 | Corfu Weiss | Napoje | FILBER | 0 | — | REMOVE? | |
| NORBLIN | P074 | Corona | Napoje | COCACOLA | 0 | — | REMOVE? | |
| NORBLIN | P080 | Corona 0% | Napoje | COCACOLA | 0 | — | REMOVE? | |
| NORBLIN | P081 | Fuzetea | Napoje | COCACOLA | 0 | — | REMOVE? | |
| NORBLIN | P079 | Kinley | Napoje | COCACOLA | 0 | — | REMOVE? | |
| NORBLIN | P078 | Lech Free | Napoje | COCACOLA | 0 | — | REMOVE? | |
| NORBLIN | P063 | Monster (wszystkie) | Napoje | COCACOLA | 0 | — | REMOVE? | |
| NORBLIN | P073 | Mythos | Napoje | EUROFOOD | 0 | — | REMOVE? | |
| NORBLIN | P072 | Retsina 500 ml | Napoje | EUROFOOD | 0 | — | REMOVE? | |
| NORBLIN | P099 | Jednorazowe mini łyżeczki | Opakowania | BLUESERV | 0 | 30.09 | COUNTED | |
| NORBLIN | P139 | AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30 | Spożywcze | INTERMLECZ | 0 | — | covered by this plan | |
| NORBLIN | P056 | Cukier w saszetkach 5g | Spożywcze | INTERMLECZ | 0 | — | REMOVE? | |
| NORBLIN | P039 | Ocet spirytusowy | Spożywcze | INTERMLECZ | 0 | — | REMOVE? | |
| NORBLIN | P060 | Ionos Wino Białe 2l | Wino | EUROFOOD | 0 | — | REMOVE? | |
| NORBLIN | P059 | Ionos Wino Białe 750ml | Wino | EUROFOOD | 0 | — | REMOVE? | |
| NORBLIN | P062 | Ionos Wino Czerwone 2l | Wino | EUROFOOD | 0 | — | REMOVE? | |
| NORBLIN | P061 | Ionos Wino Czerwone 750 ml | Wino | EUROFOOD | 0 | — | REMOVE? | |
| WESTFIELD | P183 | Rolki do kasy 80 na 20 | Biurowe | MORY | 0 | — | covered by this plan (rolls) | |
| WESTFIELD | P129 | Rolki do kasy 80 na 80 | Biurowe | MORY | 0 | — | covered by this plan (rolls) | |
| WESTFIELD | P122 | Druciak do mycia | Chemia | MORY | 0 | — | REMOVE? | |
| WESTFIELD | P114 | Top Glass Tenzi | Chemia | BLUESERV | 0 | — | REMOVE? | |
| WESTFIELD | P099 | Jednorazowe mini łyżeczki | Opakowania | BLUESERV | 0 | — | REMOVE? | |
| WESTFIELD | P036 | Kasza Pęczak ugotowana | Produkcja | INTERNAL | 0 | — | KEEP | |
| WESTFIELD | P032 | Ketchup | Produkcja | INTERNAL | 0 | — | KEEP | |
| WESTFIELD | P033 | Ladolimono | Produkcja | INTERNAL | 0 | — | KEEP | |
| WESTFIELD | P035 | Masło czosnkowe | Produkcja | INTERNAL | 0 | — | KEEP | |
| WESTFIELD | P031 | Musztada | Produkcja | INTERNAL | 0 | — | KEEP | |
| WESTFIELD | P030 | Musztada Miodowa | Produkcja | INTERNAL | 0 | — | KEEP | |
| WESTFIELD | P034 | Ogórek + papryka | Produkcja | INTERNAL | 0 | — | KEEP | |
| WESTFIELD | P029 | Spicy Mayo | Produkcja | INTERNAL | 0 | — | KEEP | |
| WESTFIELD | P056 | Cukier w saszetkach 5g | Spożywcze | INTERMLECZ | 0 | — | REMOVE? | |
| WESTFIELD | P039 | Ocet spirytusowy | Spożywcze | INTERMLECZ | 0 | — | REMOVE? | |
| WOLA | P133 | Długopisy | Biurowe | MORY | 0 | 27.09 | COUNTED | |
| WOLA | P131 | Koperty | Biurowe | MORY | 0 | 27.09 | COUNTED | |
| WOLA | P132 | Markery | Biurowe | MORY | 0 | 27.09 | COUNTED | |
| WOLA | P109 | Płyn do mycia szyb Tenzi | Chemia | BLUESERV | 0 | 01.09 | COUNTED | |
| WOLA | P105 | Płyn do zmywarek 5L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| WOLA | P110 | Płyn Tytan 5L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| WOLA | P188 | Szczotka do grilla | Chemia | MORY | 1 | 27.09 | KEEP | |
| WOLA | P113 | Top Grill Tenzi 1L | Chemia | BLUESERV | 0 | — | REMOVE? | |
| WOLA | P115 | Tytan 500g | Chemia | BLUESERV | 0 | — | REMOVE? | |
| WOLA | P182 | Butla gazowa 10L otwarta | Gaz | INTERNAL | 0 | 27.09 | KEEP | |
| WOLA | P181 | Butla gazowa 10L zamknięta | Gaz | KAMINO | 3 | 27.09 | KEEP | |
| WOLA | P025 | Gyros 25 KG | Mrożonki | PAGO | 1 | — | IN USE | |
| WOLA | P099 | Jednorazowe mini łyżeczki | Opakowania | BLUESERV | 0 | 27.09 | COUNTED | |
| WOLA | P060 | Ionos Wino Białe 2l | Wino | EUROFOOD | 0 | 27.09 | COUNTED | |
| WOLA | P062 | Ionos Wino Czerwone 2l | Wino | EUROFOOD | 0 | — | REMOVE? | |

Totals: 128 rows — KEEP 28, covered by this plan 7, IN USE 4, COUNTED 22, REMOVE? 67.
Note: "Ocet spirytusowy" (P039), "Top Glass Tenzi" (P114), "Jednorazowe mini łyżeczki" (P099) and the 2 l wines
are 0/0/0 in almost every location — candidates to remove from the catalogue rather than per location.
