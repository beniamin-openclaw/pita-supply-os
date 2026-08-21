"""Regression tests for CI tooling versions."""

from pathlib import Path

import tomllib


def test_ruff_is_bounded_below_next_breaking_minor() -> None:
    pyproject = Path(__file__).parents[1] / "pyproject.toml"
    config = tomllib.loads(pyproject.read_text(encoding="utf-8"))

    assert "ruff>=0.15,<0.16" in config["project"]["optional-dependencies"]["dev"]
