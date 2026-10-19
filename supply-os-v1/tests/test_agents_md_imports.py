"""Guard: AGENTS.md files (CLAUDE.md is a symlink to the root one) stay light.

In Claude Code an `@path` inside CLAUDE.md is an import, not a link: the whole
file is loaded into every session's context at startup, recursively. Until
2026-10-05 the three AGENTS.md files imported ~650 KB (app/main.py, models.py,
roadmap.md, ...) and every session started with a full context window.

Reference paths in backticks instead. Only small markdown guides may be imported.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ENTRY_POINTS = [
    REPO_ROOT / "AGENTS.md",
    REPO_ROOT / "supply-os-v1" / "AGENTS.md",
    REPO_ROOT / "frontend" / "AGENTS.md",
]
# Everything loaded at session start (entry file + its transitive imports).
EAGER_LOAD_BUDGET_BYTES = 25_000

_FENCED_BLOCK = re.compile(r"```.*?```", re.DOTALL)
_CODE_SPAN = re.compile(r"`[^`\n]*`")
# `@` at a word boundary (so `user@host` is not an import), then a relative,
# absolute (`@/...`) or home (`@~/...`) path.
_IMPORT = re.compile(r"(?<![\w@])@((?:~/|/|\.{1,2}/)?[\w][\w./-]*)")


def _imports(md_file: Path) -> list[Path]:
    """Paths that Claude Code would import from `md_file` (code is not parsed).

    Includes targets that do not exist here: a `~` import may exist only on a
    developer's machine.
    """
    text = _CODE_SPAN.sub("", _FENCED_BLOCK.sub("", md_file.read_text(encoding="utf-8")))
    found = []
    for match in _IMPORT.finditer(text):
        raw = Path(match.group(1).rstrip(".,;:)")).expanduser()
        found.append((md_file.parent / raw).resolve())
    return found


def _eager_closure(entry: Path) -> set[Path]:
    seen: set[Path] = set()
    stack = [entry.resolve()]
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        stack.extend(target for target in _imports(current) if target.is_file())
    return seen


def _rel(path: Path) -> str:
    return str(path.relative_to(REPO_ROOT)) if path.is_relative_to(REPO_ROOT) else str(path)


def test_agents_md_imports_only_markdown() -> None:
    offenders = sorted(
        f"{_rel(entry)} -> {_rel(target)}"
        for entry in ENTRY_POINTS
        for target in _eager_closure(entry)
        if target.suffix != ".md"
    )
    assert not offenders, (
        "AGENTS.md eagerly imports non-markdown files via `@`; "
        f"put the path in backticks instead: {offenders}"
    )


def test_agents_md_eager_load_within_budget() -> None:
    for entry in ENTRY_POINTS:
        closure = _eager_closure(entry)
        total = sum(path.stat().st_size for path in closure)
        assert total <= EAGER_LOAD_BUDGET_BYTES, (
            f"{_rel(entry)} loads {total} bytes at session start "
            f"(budget {EAGER_LOAD_BUDGET_BYTES}): "
            f"{sorted(_rel(path) for path in closure)}"
        )


def test_parser_detects_absolute_and_home_imports(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("HOME", str(tmp_path / "home"))
    guide = tmp_path / "AGENTS.md"
    guide.write_text(
        "See @/etc/hosts, @~/notes.md and @./local.md; mail a@b.pl; `@in-code.md`\n",
        encoding="utf-8",
    )
    assert _imports(guide) == [
        Path("/etc/hosts").resolve(),
        (tmp_path / "home" / "notes.md").resolve(),
        (tmp_path / "local.md").resolve(),
    ]


def test_rel_reports_paths_outside_the_repo() -> None:
    assert _rel(Path("/elsewhere/notes.md")) == "/elsewhere/notes.md"


def test_agents_md_imports_stay_inside_repo() -> None:
    offenders = sorted(
        f"{_rel(source)} -> {_rel(target)}"
        for entry in ENTRY_POINTS
        for source in _eager_closure(entry)
        for target in _imports(source)
        if not target.is_relative_to(REPO_ROOT)
    )
    assert not offenders, (
        "AGENTS.md imports a file outside the repo (absolute or `~` path), "
        f"which other machines and CI cannot see: {offenders}"
    )
