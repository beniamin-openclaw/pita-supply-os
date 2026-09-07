# Mac mini — Supply OS finance sync trigger

Daily `POST /api/manager/finance/sync` at 08:10 (Europe/Warsaw) via launchd. The
endpoint pulls Symfonia eBiuro purchase documents into `finance_documents` (KEN
pilot). It is a plain curl: no Python, no repo checkout on the mini.

## Prerequisites (one-time, Ben)
1. Railway service `pita-supply-os` gets three variables (no CLI here — Railway UI):
   `SUPPLY_OS_EBIURO_EMAIL`, `SUPPLY_OS_EBIURO_APIKEY` (values from JARVIS-CODEX
   `.env`: `SYMFONIA_EBIURO_EMAIL` / `SYMFONIA_EBIURO_APIKEY_PBG`), and
   `SUPPLY_OS_EBIURO_COMPANY_IDS=7189181` (KEN only — the blast-radius control).
   Redeploy. Until then the endpoint answers 503 and the plist is a harmless no-op.
2. On the mini as `agent`:
   ```sh
   mkdir -p ~/.config/supplyos && umask 077 && cat > ~/.config/supplyos/env <<'EOT'
   SUPPLY_OS_API=https://pita-supply-os-production.up.railway.app
   SUPPLY_OS_MANAGER_TOKEN=<manager token>
   EOT
   cp deploy/mini/com.pitabros.supplyos-finance-sync.plist ~/Library/LaunchAgents/
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.pitabros.supplyos-finance-sync.plist
   launchctl kickstart -k gui/$(id -u)/com.pitabros.supplyos-finance-sync   # run once now
   tail -2 ~/Library/Logs/supplyos-finance-sync.log; cat ~/Library/Logs/supplyos-finance-sync.last.json
   ```
3. Rollback: `launchctl bootout gui/$(id -u)/com.pitabros.supplyos-finance-sync` and remove the plist.

The Manager token at rest on the mini is the accepted pilot trade-off (the mini
already holds Hermes/Gmail credentials); a dedicated Finance token is the follow-up.
