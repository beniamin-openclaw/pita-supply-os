import runpy
import subprocess
import sys
from decimal import Decimal
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "context/changes/waste-report/calibrate-sample.py"
minimum_taps = runpy.run_path(str(SCRIPT))["minimum_taps"]


def test_large_reachable_quantity_needs_no_quantity_sized_allocation():
    code = f'''
import runpy
from decimal import Decimal
minimum_taps = runpy.run_path({str(SCRIPT)!r})["minimum_taps"]
print(minimum_taps(Decimal("1000000000000000000000000"), [Decimal("50"), Decimal("100"), Decimal("250")]))
'''
    result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=3)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "4000000000000000000000"


@pytest.mark.parametrize("value,additions,expected", [
    ("450", ["50", "100", "250"], 3),
    ("60", ["50", "100", "250"], None),
    ("0.75", ["0.25", "0.5", "1"], 2),
    ("0.333", ["0.25", "0.5", "1"], None),
    ("3.5", ["0.5", "1", "2"], 3),
    ("8", ["1", "2", "5"], 3),
])
def test_calibration_keeps_exact_tap_counts(value, additions, expected):
    assert minimum_taps(Decimal(value), [Decimal(x) for x in additions]) == expected


def test_unreviewed_coin_system_is_not_silently_assumed_greedy():
    with pytest.raises(ValueError, match="Unreviewed"):
        minimum_taps(Decimal("6"), [Decimal("1"), Decimal("3"), Decimal("4")])
