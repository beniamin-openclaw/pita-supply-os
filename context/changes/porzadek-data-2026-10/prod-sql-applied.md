# porzadek-data-2026-10 — prod apply log (2026-10-17)

The SQL files come from PR #67 (Lane D, commit `ba5799c`). Lane D verified every id against prod with read-only queries first.

All files below were applied by the agent of the main lane (path (b): Supabase MCP `execute_sql`) after Ben's OK on 17.10 in chat:
"po weryfikacji id i review wgrywaj … pomijaj bloki czekające na Marka".

Per file:
- STEP 0 was read first and matched the file header.
- Each block's guard passed.
- Each AUDIT matched the expected result.

(The Gdańsk step-3 file earlier the same day was pasted by Ben in the Supabase editor, path (a). See `porzadek-2026-10/plan.md` 1.1.)

| File / block | Prod result (AUDIT) | Notes |
|---|---|---|
| `prod-sql-0-audits.sql` A | A1 = 0, A3 = 0, PG 17 (`server_version_num` 170006), C4 = 0 | `draft-0030` index may go into `migrations/` in a code PR |
| `prod-sql-0-audits.sql` B | SUPERSAM last count 12.10: 8 Coca-Cola products ≈ 20.5 packs in total, all thresholds 0/0/0 | not ~56 crates; thresholds wait for Marek |
| `prod-sql-1-krk-kat.sql` | BUKAT_KRK email/500/16:00 + rule `DR-BUKAT-KRK-ALL` (Mon/Wed/Fri, 16:00); DISPACK_KRK/KAT email/700; KUCHNIE_KRK/KAT and SELGROS_KRK/KAT manual with an address; SUPERSAM e-mail; FORUM P018 0.5/1/1, Bukat P018 without the sack case | Dis-Pack applied to both cities (file assumption). At apply time 1 claimed Bukat KRK order and 1 submitted Dis-Pack KRK order; both take the e-mail path at dispatch |
| `prod-sql-2` 2.1 | BROWARY P019 0.5/2/2 (was 1/5/5) | |
| `prod-sql-2` 2.2 | BROWARY P043/P044 1/2/2 szt (were 3/6/6 and 4/8/8) | |
| `prod-sql-2` 2.3 | WOLA P129 6/30/30 (was 6/60/60) | **P128/P130 skipped**: 57 mm roll pack size needed from Marek |
| `prod-sql-2` 2.4 | P121 5/15/15 at the 7 Warsaw locations | D17 |
| `prod-sql-2` 2.5 | Corfu P136/P137/P138/P157: `karton` ×12, "1 karton = 12 szt" | |
| `prod-sql-2` 2.6 | WOLA P190/P191 (Cappy glass) 12/48/48; PET P064/P065 removed | `v_max` = 48 (default, 2 crates); 24 if Ben prefers one crate |
| `prod-sql-2` 2.7 | KEN P024 (pork, Pago) 30/45/45 (was 30/150/150) | interpretation of Khushi's screenshot; switch to P179 if she meant chicken |
| `prod-sql-2` 2.8 | read only: KEN Mory orders of 27.09, 04.10, 08.10 still `manager_claimed`; the 15.10 one sent 16.10 | D16 backlog |
| `prod-sql-3` 3.1 | WESTFIELD P081 Fuzetea 0/0/0 | thresholds needed from Marek |
| `prod-sql-3` 3.2 | WESTFIELD P190/P191 10/24/24; PET removed | |
| `prod-sql-3` 3.3 | ELEKTROWNIA P081 Fuzetea + P079 Kinley 0/0/0 | thresholds needed from Marek |
| `prod-sql-3` 3.4 | **skipped** | paper-roll product not named yet |
| `prod-sql-4` | P192 "Halloumi cięte" (Produkcja, kg, SUP_INTERNAL); FORUM__P192 0/0/0; WESTFIELD__P176 "Gyros wieprzowy ścięty" 0/0/0 | D8 |

Rollback: every file has a ROLLBACK section. Changed settings rows keep their old values in `notes` ("[2026-10-17 przed a/b/c …]").

## Deferred items

| Item | Owner | Tracking |
|---|---|---|
| `draft-0030` unique index → `supply-os-v1/migrations/0030_…` | main lane (code PR) | `porzadek-2026-10/plan.md` Etap 5, wave B |
| WOLA P128/P130 roll pack sizes (block 2.3) | Marek (Ben sends the question) | `porzadek-2026-10/plan.md` Etap 3; e-mail draft to Marek of 17.10 |
| WESTFIELD paper-roll product (block 3.4) | Marek (Ben sends the question) | `porzadek-2026-10/plan.md` Etap 3; e-mail draft to Marek of 17.10 |
| Burn supplier (WESTFIELD, ELEKTROWNIA) | Marek | `porzadek-2026-10/plan.md` Etap 3 item 8; `contracts.md` Lane D item 3 |
| Drink thresholds SUPERSAM, WESTFIELD P081, ELEKTROWNIA P079/P081 | Marek (Ben sends the question) | `porzadek-2026-10/plan.md` Etap 3; e-mail draft to Marek of 17.10 |
| Other locations that cut halloumi (D8) | Ben | `porzadek-2026-10/plan.md` D8; extend the VALUES list in `prod-sql-4` |

## Live check for Ben (data only, no deploy needed)

- **FORUM:** the Bukat tab shows the 16:00 deadline and a Mon/Wed/Fri delivery date. The count lists "Halloumi cięte".
- **WOLA:** the Coca-Cola tab lists Cappy 0.25 l glass (crate) instead of PET.
- **WESTFIELD:** the count lists Fuzetea and "Gyros wieprzowy ścięty". Cappy is in glass.
- **ELEKTROWNIA:** the count lists Fuzetea and Kinley.
