# order-watch — runbook

## Co to robi
`supply-os-v1/scripts/order_watch.py` — zewnętrzny skrypt (zero zmian w backendzie, zero nowych deps). Co skan pobiera 3 lane'y `/api/manager/queue` (status=captain_submitted|manager_claimed|manager_sent, limit=200) i wysyła Telegram do Bena:
- NOWE ZAMÓWIENIE (submit), WYSŁANE (+draft dla grupy lokalu), DOSTAWA DZIŚ (w godzinie digestu, domyślnie 8:00 Warszawa), ZATOR claimed>24h / sent>3d bez odbioru.
- „Dostawa dziś" i „wysłane" zawierają gotowy draft wiadomości dla grupy punktu — Ben akceptuje/przekazuje; realny send do Connecteam = osobna decyzja (brak write-API).

## Uruchomienie
```sh
export SUPPLY_OS_WATCH_API_URL=https://pita-supply-os-production.up.railway.app
export SUPPLY_OS_MANAGER_TOKEN=<manager token>   # na Mini: ~/.config/supplyos/env (umask 077)
export WATCH_TELEGRAM_BOT_TOKEN=<bot>  WATCH_TELEGRAM_CHAT_ID=<ben>
python3 supply-os-v1/scripts/order_watch.py --baseline   # PIERWSZY RUN — zapis stanu, zero wysyłki
python3 supply-os-v1/scripts/order_watch.py --dry-run    # test bez wysyłki
```
Cron (jeden host — Mini, trwały dysk; Railway ma efemeryczny fs!):
`*/15 * * * *` dla alertów bieżących + digest wpadnie o 8:xx Warszawa.

## Zasady
- Host = 1 (dwa crony = podwójne Telegramy). Stan: `~/.config/supplyos/order_watch_state.json` (poza repo).
- Lane przy 200 wierszach → WARN na stderr (najstarsze niewidoczne, bez paginacji w API).
- `TRN-*` drafty transportu celowo wiszą w claimed — wykluczone z alertów.
- Sekrety tylko w env; stan i env nigdy do repo.

## Rollback
Usunąć wpis crona / nie uruchamiać. Skrypt additive — zero ryzyka dla prod.

## Znane ograniczenia (po review grok-4.7)
- Brak `manager_claimed_at`/`manager_user` w modelu — „claimed Xh" liczone od submit, bez atrybucji osoby.
- Cleanup przez SQL omija ślad UI „Zamknij bez przyjęcia" — decyzja Bena.
- Endpoint bez paginacji — jeśli lane>200 trwa, potrzebny osobny endpoint wyjątków (backlog).
