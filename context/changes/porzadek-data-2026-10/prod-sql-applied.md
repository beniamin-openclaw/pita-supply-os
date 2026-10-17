# porzadek-data-2026-10 — log wgrania na prod (17.10.2026)

The SQL files come from PR #67 (Lane D, commit `ba5799c`). Before writing, Lane D checked every id against prod with read-only queries.
The main lane applied them through the Supabase MCP after Ben's OK on 17.10 ("po weryfikacji id i review wgrywaj … pomijaj bloki
czekające na Marka"). For each file, STEP 0 was read first and matched the file header. Every block's guard passed and every AUDIT matched what the file expects.

| Plik / blok | Wynik na prodzie (AUDIT) | Uwagi |
|---|---|---|
| `prod-sql-0-audits.sql` A | A1 = 0, A3 = 0, PG 17 (`server_version_num` 170006), C4 = 0 | `draft-0030` index can go into `migrations/` in a code PR |
| `prod-sql-0-audits.sql` B | last SUPERSAM count 12.10: 8 Coca-Cola products ≈ 20,5 packs (zgrzewki) in total, all 0/0/0 | not 56 crates; thresholds wait for Marek |
| `prod-sql-1-krk-kat.sql` | BUKAT_KRK email/500/16:00 + rule `DR-BUKAT-KRK-ALL` (pn/śr/pt, 16:00); DISPACK_KRK/KAT email/700; KUCHNIE_KRK/KAT and SELGROS_KRK/KAT manual with an e-mail; SUPERSAM e-mail; FORUM P018 0,5/1/1, Bukat P018 without a sack | Dis-Pack applied to both cities (file assumption). At apply time: 1 claimed order at Bukat KRK and 1 submitted at Dis-Pack KRK; at dispatch they get the e-mail path |
| `prod-sql-2` 2.1 | BROWARY P019 0,5/2/2 (was 1/5/5) | |
| `prod-sql-2` 2.2 | BROWARY P043/P044 1/2/2 szt (were 3/6/6 and 4/8/8) | |
| `prod-sql-2` 2.3 | WOLA P129 6/30/30 (was 6/60/60) | **P128/P130 skipped**: pack size of the 57 mm rolls waits for Marek |
| `prod-sql-2` 2.4 | P121 5/15/15 at 7 Warsaw locations | D17 |
| `prod-sql-2` 2.5 | Corfu P136/P137/P138/P157: karton ×12, „1 karton = 12 szt” | |
| `prod-sql-2` 2.6 | WOLA P190/P191 (Cappy szkło) 12/48/48, PET P064/P065 removed | `v_max` = 48 (default, 2 crates). If Ben wants 24: UPDATE target/max = 24 |
| `prod-sql-2` 2.7 | KEN P024 (pork, Pago) 30/45/45 (was 30/150/150) | interpretation of Khushi's screenshot; if she meant chicken P179, switch |
| `prod-sql-2` 2.8 | read: KEN Mory orders 27.09, 04.10, 08.10 still `manager_claimed`; 15.10 sent on 16.10 | D16, for Marek |
| `prod-sql-3` 3.1 | WESTFIELD P081 Fuzetea 0/0/0 | thresholds from Marek |
| `prod-sql-3` 3.2 | WESTFIELD P190/P191 10/24/24, PET removed | |
| `prod-sql-3` 3.3 | ELEKTROWNIA P081 Fuzetea + P079 Kinley 0/0/0 | thresholds from Marek |
| `prod-sql-3` 3.4 | **skipped** | paper-roll product not named (Marek/Mirsini) |
| `prod-sql-4` | P192 „Halloumi cięte” (Produkcja, kg, SUP_INTERNAL); FORUM__P192 0/0/0; WESTFIELD__P176 „Gyros wieprzowy ścięty” 0/0/0 | D8. Other locations that cut halloumi wait for the list from Ben/Marek |

Not applied: `draft-0030-supplier-products-unique.sql`. It is a migration and belongs in a code PR (`supply-os-v1/migrations/0030_…`). Audit A allows it.

Rollback: each file has a ROLLBACK section, and changed settings rows keep their old values in `notes` („[2026-10-17 przed a/b/c …]”).

Live check for Ben after the next login (no deploy needed, data only):
- FORUM: the Bukat tab shows the 16:00 deadline and the next delivery day (pn/śr/pt); the inventory count has „Halloumi cięte”.
- WOLA: the Coca-Cola tab has Cappy 0,25 l szkło (skrzynka) instead of PET.
- WESTFIELD: the inventory count has Fuzetea and „Gyros wieprzowy ścięty”; Cappy is in glass.
- ELEKTROWNIA: the inventory count has Fuzetea and Kinley.
