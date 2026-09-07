"""Pull Symfonia eBiuro purchase documents into the finance mirror — CLI twin of
``POST /api/manager/finance/sync`` for one-off seeding from a workstation.

Two output modes:

- default: upsert straight into the configured Supabase backend
  (``SUPPLY_OS_DATABASE_URL`` + ``SUPPLY_OS_DATA_BACKEND=supabase``);
- ``--emit-sql PATH``: write idempotent ``INSERT … ON CONFLICT`` statements to
  PATH instead (no DSN needed; run them via the Supabase MCP/SQL editor). The
  file holds REAL financial data (contractor names, KSeF numbers, amounts):
  write it to a scratch directory only and never commit it.

Creds: ``SUPPLY_OS_EBIURO_EMAIL`` / ``SUPPLY_OS_EBIURO_APIKEY`` (or a JARVIS-CODEX
style ``--env-file`` carrying SYMFONIA_EBIURO_EMAIL / SYMFONIA_EBIURO_APIKEY_PBG).
Read-only against eBiuro; the key is the accountant's connector key.

    python -m scripts.ebiuro_sync --company 7189181 --emit-sql /tmp/x.sql
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def _load_env_file(path: Path) -> None:
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        v = v.strip().strip('"').strip("'")
        k = k.strip()
        if k == "SYMFONIA_EBIURO_EMAIL":
            os.environ.setdefault("SUPPLY_OS_EBIURO_EMAIL", v)
        elif k in ("SYMFONIA_EBIURO_APIKEY_PBG", "SYMFONIA_EBIURO_APIKEY"):
            os.environ.setdefault("SUPPLY_OS_EBIURO_APIKEY", v)
        elif k.startswith("SUPPLY_OS_"):
            os.environ.setdefault(k, v)


def _sql_literal(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, datetime):
        return f"'{v.isoformat()}'::timestamptz"
    if hasattr(v, "isoformat"):
        return f"'{v.isoformat()}'::date"
    return "'" + str(v).replace("'", "''") + "'"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--company", type=int, action="append", required=True, help="eBiuro company id")
    ap.add_argument("--env-file", type=Path, default=None)
    ap.add_argument("--emit-sql", type=Path, default=None, help="write SQL instead of upserting")
    ap.add_argument("--max-fetch", type=int, default=500)
    args = ap.parse_args(argv)

    if args.env_file:
        _load_env_file(args.env_file)
    os.environ["SUPPLY_OS_EBIURO_COMPANY_IDS"] = ",".join(str(c) for c in args.company)

    from app import ebiuro  # after env is set (pydantic settings load once)
    from app.supabase_backend import _FINANCE_DOC_COLUMNS, _FINANCE_LINE_COLUMNS

    if not (os.environ.get("SUPPLY_OS_EBIURO_EMAIL") and os.environ.get("SUPPLY_OS_EBIURO_APIKEY")):
        print("missing SUPPLY_OS_EBIURO_EMAIL / SUPPLY_OS_EBIURO_APIKEY", file=sys.stderr)
        return 2
    client = ebiuro.EbiuroClient(
        os.environ["SUPPLY_OS_EBIURO_EMAIL"], os.environ["SUPPLY_OS_EBIURO_APIKEY"]
    )
    companies = {int(c["id"]): ebiuro.normalize_nip(c.get("nip")) for c in client.get_companies()}

    all_docs = []
    summary = {}
    for cid in args.company:
        known: dict[int, str] = {}
        if not args.emit_sql:
            from app import supabase_backend
            known = supabase_backend.load_finance_fingerprints(cid)
        docs, counts = ebiuro.sync_company(client, cid, companies.get(cid), known, max_fetch=args.max_fetch)
        all_docs.extend(docs)
        summary[cid] = {k: v for k, v in counts.items() if k != "seen_ids"}

    if args.emit_sql:
        now = datetime.now(timezone.utc)
        out = ["BEGIN;"]
        set_cols = [c for c in _FINANCE_DOC_COLUMNS if c != "doc_id"]
        for d in all_docs:
            data = d.model_dump()
            data["last_seen_at"] = data.get("last_seen_at") or now
            vals = ", ".join(_sql_literal(data.get(c)) for c in _FINANCE_DOC_COLUMNS)
            upd = ", ".join(f"{c} = EXCLUDED.{c}" for c in set_cols)
            out.append(
                f"INSERT INTO finance_documents ({', '.join(_FINANCE_DOC_COLUMNS)}) VALUES ({vals}) "
                f"ON CONFLICT (doc_id) DO UPDATE SET {upd};"
            )
            out.append(f"DELETE FROM finance_document_lines WHERE doc_id = {d.doc_id};")
            for ln in d.lines:
                ld = ln.model_dump()
                lv = ", ".join(_sql_literal(ld.get(c)) for c in _FINANCE_LINE_COLUMNS)
                out.append(
                    f"INSERT INTO finance_document_lines ({', '.join(_FINANCE_LINE_COLUMNS)}) VALUES ({lv});"
                )
        out.append("COMMIT;")
        args.emit_sql.write_text("\n".join(out) + "\n", encoding="utf-8")
        print(json.dumps({"status": "ok", "mode": "sql", "documents": len(all_docs),
                          "file": str(args.emit_sql), "companies": summary}, ensure_ascii=False))
        return 0

    from app import supabase_backend
    n = supabase_backend.upsert_finance_documents(all_docs)
    print(json.dumps({"status": "ok", "mode": "db", "upserted": n, "companies": summary}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
