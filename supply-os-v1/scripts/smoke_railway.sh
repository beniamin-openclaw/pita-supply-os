#!/usr/bin/env bash
#
# Read-only smoke test for the Supply OS backend on Railway (or any host URL).
# GET requests ONLY — honors the "never place a real order from a test" hard
# rule: it makes no submit and no dispatch calls, so it can never create or send
# a supplier order.
#
# What it proves:
#   1. /health is up (200)
#   2. /health/internal reports data_backend=sheet — catches a SILENT seed
#      fallback (the credential-misconfig failure mode; plan-review F2)
#   3. /api/products serves the live Sheet (>0 items)
#   4. Captain orderable resolves for the pilot supplier (200)
#   5. Manager queue loads (200)
#
# Usage:
#   BASE_URL=https://xxxx.up.railway.app \
#   MANAGER_TOKEN=... CAPTAIN_TOKEN=... [SUPPLIER_ID=SUP_BUKAT] \
#   bash scripts/smoke_railway.sh
#
# BASE_URL may also be passed as the first positional arg. Exits non-zero on the
# first failed check; token-gated checks are skipped (with a notice) if the
# matching token is unset.
set -euo pipefail

BASE_URL="${BASE_URL:-${1:-}}"
MANAGER_TOKEN="${MANAGER_TOKEN:-}"
CAPTAIN_TOKEN="${CAPTAIN_TOKEN:-}"
SUPPLIER_ID="${SUPPLIER_ID:-SUP_BUKAT}"

if [[ -z "$BASE_URL" ]]; then
  echo "✗ BASE_URL is required (e.g. https://xxxx.up.railway.app)" >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"  # strip a trailing slash

fail() { echo "✗ $1" >&2; exit 1; }
pass() { echo "✓ $1"; }
skip() { echo "… $1"; }

# 1) Public health
code=$(curl -fsS -o /dev/null -w '%{http_code}' "$BASE_URL/health" || true)
[[ "$code" == "200" ]] || fail "/health returned ${code:-no-response} (expected 200)"
pass "/health 200"

# 2) Backend identity — the F2 guard against a silent seed fallback
if [[ -n "$MANAGER_TOKEN" ]]; then
  body=$(curl -fsS -H "Authorization: Bearer $MANAGER_TOKEN" "$BASE_URL/health/internal" || true)
  echo "$body" | grep -q '"data_backend"[[:space:]]*:[[:space:]]*"sheet"' \
    || fail "/health/internal not data_backend=sheet — silent seed fallback? body: $body"
  pass "/health/internal data_backend=sheet"
else
  skip "skipping /health/internal seed-fallback guard (set MANAGER_TOKEN to enable)"
fi

# 3) Master data served via the configured backend (live Sheet, not seed)
if [[ -n "$CAPTAIN_TOKEN" ]]; then
  n=$(curl -fsS -H "Authorization: Bearer $CAPTAIN_TOKEN" "$BASE_URL/api/products" \
        | grep -o '"product_id"' | wc -l | tr -d ' ')
  [[ "${n:-0}" -gt 0 ]] || fail "/api/products returned 0 items (live Sheet expected)"
  pass "/api/products ${n} items"

  # 4) Captain orderable for the pilot supplier
  oc=$(curl -fsS -o /dev/null -w '%{http_code}' \
        -H "Authorization: Bearer $CAPTAIN_TOKEN" \
        "$BASE_URL/api/captain/orderable?supplier_id=$SUPPLIER_ID" || true)
  [[ "$oc" == "200" ]] || fail "/api/captain/orderable?supplier_id=$SUPPLIER_ID returned ${oc:-no-response}"
  pass "/api/captain/orderable ($SUPPLIER_ID) 200"
else
  skip "skipping captain checks (set CAPTAIN_TOKEN to enable)"
fi

# 5) Manager queue loads
if [[ -n "$MANAGER_TOKEN" ]]; then
  qc=$(curl -fsS -o /dev/null -w '%{http_code}' \
        -H "Authorization: Bearer $MANAGER_TOKEN" "$BASE_URL/api/manager/queue" || true)
  [[ "$qc" == "200" ]] || fail "/api/manager/queue returned ${qc:-no-response}"
  pass "/api/manager/queue 200"
fi

echo "✓ smoke OK — read-only, no order created or sent"
