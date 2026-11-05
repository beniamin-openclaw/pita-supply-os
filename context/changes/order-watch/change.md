---
change_id: order-watch
title: Order status watchdog — diagnosis, cleanup SQL, notifications (Ben + location group)
status: implemented
created: 2026-11-03
updated: 2026-11-03
archived_at: null
---

## Notes

Kontrakt E2E z 2026-11-03 (P0 1-5 ze sweep report /tmp/supply-os-raport-2026-11-03.md):

1. Diagnoza backlogu statusów "kto/gdzie zawinił" (47 claimed-not-sent, ~70 sent-unreceived) — skrypty read-only dla operatora.
2. Watcher powiadomień: zamówienie złożone → Ben (Hermes/Telegram); wysłane + dostawa dziś → propozycja wysyłki na grupę punktu (e-mail lokalu, np. pitabrosslony@gmail.com). Utrzymane, proste, testowane.
3. Cleanup SQL backlogu z progiem >7 dni + trwałe obejście dla Pago/Mory (auto-sent lub flagowany odbiór claimed).
4. Prod-SQL diff zaległych limitów (souvlaki KEN, gyros KEN, cola 72/96→48/72, Kamino, gąbki).
5. Docs: sesja wsadowa Marka (Gdańsk/Katowice → Wrocław) + decyzja supplier-per-location.

Bloker zewnętrzny: brak self-service prod DB — artefakty SQL do zastosowania przez operatora. Reviewerzy: grok-4.7 (grok CLI), docelowo claude-opus-5-5-high (agy).
