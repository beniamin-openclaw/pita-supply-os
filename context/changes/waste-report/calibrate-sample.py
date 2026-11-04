#!/usr/bin/env python3
"""Recompute sanitized aggregates: python calibrate-sample.py EVIDENCE_DIRECTORY."""

import hashlib
import json
import sys
from collections import Counter
from decimal import Decimal
from pathlib import Path


def minimum_taps(value: Decimal, additions: list[Decimal]) -> int | None:
    # All current additions are whole hundredths; never round source quantities.
    if value != value.quantize(Decimal("0.01")):
        return None
    target = int(value * 100)
    coins = [int(value * 100) for value in additions]
    distances = [0] + [target + 1] * target
    for amount in range(1, target + 1):
        for coin in coins:
            if coin <= amount:
                distances[amount] = min(distances[amount], distances[amount - coin] + 1)
    return distances[target] if distances[target] <= target else None


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python calibrate-sample.py EVIDENCE_DIRECTORY")
    evidence = Path(sys.argv[1])
    manifest = json.loads((evidence / "manifest.json").read_text())["reports"]
    data = json.loads((evidence / "observations.json").read_text(), parse_float=Decimal)
    catalog = json.loads(Path(__file__).with_name("calibrated-catalog.json").read_text())["items"]
    report_ids = [report["report_id"] for report in manifest]
    sources = [(r["source"]["provider"], r["source"]["chat_id"], r["source"]["message_id"]) for r in manifest]
    hashes = [r["sha256"] for r in manifest]
    if not (len(manifest) == len(set(report_ids)) == len(set(sources)) == len(set(hashes))):
        raise SystemExit("Manifest contains duplicate report identities, sources or hashes")
    if set(report_ids) != {r["report_id"] for r in data["reports"]}:
        raise SystemExit("Manifest and observation report lists differ")
    for report in manifest:
        if hashlib.sha256(Path(report["image_path"]).read_bytes()).hexdigest() != report["sha256"]:
            raise SystemExit("An image hash does not match the manifest")

    observations = data["observations"]
    keys = [(x["report_id"], x["product_id"], x["column"], x["kind"]) for x in observations]
    if len(set(keys)) != len(keys):
        raise SystemExit("Duplicate cell keys in observations")
    if set(x["report_id"] for x in observations) - set(report_ids):
        raise SystemExit("An observation references an unknown report")
    if set(x["product_id"] for x in observations) - {x["product_id"] for x in catalog}:
        raise SystemExit("An observation references an unknown catalog product")

    rows = []
    for item in catalog:
        product = item["product_id"]
        additions = [Decimal(x) for x in item["quick_additions"]]
        eligible = []
        excluded = Counter()
        for cell in observations:
            if cell["product_id"] != product or cell["kind"] != "daily":
                continue
            value, unit = cell["value"], cell["unit"]
            if value is None:
                excluded["unreadable"] += 1
            elif value <= 0:
                excluded["nonpositive"] += 1
            elif (item["display_unit"] == "szt" and unit != "szt") or (
                item["display_unit"] == "g" and unit not in ("g", "kg")
            ):
                excluded["unknown_or_incompatible_unit"] += 1
            elif product == "falafel_1kg" and unit == "kg" and value >= 1:
                excluded["ambiguous_bare_unit"] += 1
            elif product == "halloumi_reha" and value < Decimal("0.2"):
                excluded["ambiguous_small_piece_quantity"] += 1
            else:
                converted = Decimal(value) * (1000 if unit == "kg" else 1)
                eligible.append((cell["report_id"], converted))
        counts = Counter(minimum_taps(value, additions) for _, value in eligible)
        report_count = len({report_id for report_id, _ in eligible})
        rows.append({
            "product_id": product,
            "display_unit": item["display_unit"],
            "quick_additions": item["quick_additions"],
            "calibration": "supported" if report_count >= 5 else "provisional",
            "independent_reports": report_count,
            "daily_observations": len(eligible),
            "single_tap": counts[1],
            "within_two_taps": sum(count for taps, count in counts.items() if taps is not None and taps <= 2),
            "within_three_taps": sum(count for taps, count in counts.items() if taps is not None and taps <= 3),
            "reachable": sum(count for taps, count in counts.items() if taps is not None),
            "max_taps": max((taps for taps in counts if taps is not None), default=None),
            "excluded": dict(excluded),
        })
    print(json.dumps({
        "verified_reports": len(manifest),
        "daily_cells": sum(x["kind"] == "daily" for x in observations),
        "sum_cells_excluded": sum(x["kind"] == "sum" for x in observations),
        "eligible_daily": sum(x["daily_observations"] for x in rows),
        "excluded_daily": sum(sum(x["excluded"].values()) for x in rows),
        "products": rows,
    }, indent=2))


if __name__ == "__main__":
    main()
