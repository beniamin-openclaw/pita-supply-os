"""Unit tests for review.py — no network; the OpenRouter call is monkeypatched."""
import io
import json
import urllib.error

import pytest

import review


def test_parse_review_accepts_fenced_json():
    content = '```json\n{"scores": {"implementation_correctness": 8, "idiomaticity": 7, "complexity": 9, "test_risk_coverage": 6, "documentation": 7, "security_safety": 9}, "summary": "ok", "findings": []}\n```'
    parsed = review.parse_review(content)
    assert parsed["scores"]["complexity"] == 9 and parsed["summary"] == "ok"


def test_parse_review_clamps_and_rejects_missing():
    good = {"scores": {n: 11 for n, _ in review.CRITERIA}, "findings": "nope"}
    parsed = review.parse_review(json.dumps(good))
    assert all(v == 10 for v in parsed["scores"].values()) and parsed["findings"] == []
    with pytest.raises(ValueError):
        review.parse_review('{"scores": {"idiomaticity": 5}}')


def test_verdict_threshold():
    scores = {n: 6 for n, _ in review.CRITERIA}
    assert review.verdict_for(scores, 6) == "pass"
    scores["security_safety"] = 5
    assert review.verdict_for(scores, 6) == "fail"


def test_truncate_diff_marks_tail_drop():
    diff, truncated = review.truncate_diff("x" * 100, 40)
    assert truncated and diff.startswith("x" * 40) and "truncated" in diff
    assert review.truncate_diff("short", 40) == ("short", False)


def test_build_messages_carries_title_body_and_diff():
    msgs = review.build_messages("feat: thing", "why", "+line")
    assert msgs[0]["role"] == "system" and "six criteria" in msgs[0]["content"]
    assert "feat: thing" in msgs[1]["content"] and "+line" in msgs[1]["content"]


def test_main_skips_without_key(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    monkeypatch.setenv("OUTPUT_DIR", str(tmp_path))
    monkeypatch.setenv("GITHUB_OUTPUT", str(tmp_path / "gh_out"))
    assert review.main() == 0
    assert json.loads((tmp_path / "review.json").read_text())["status"] == "skipped"
    assert "status=skipped" in (tmp_path / "gh_out").read_text()
    assert "skipped" in capsys.readouterr().out


def test_main_reports_auth_error_without_failing(tmp_path, monkeypatch):
    diff = tmp_path / "pr.diff"
    diff.write_text("+ hello")
    monkeypatch.setenv("OPENROUTER_API_KEY", "not-a-real-key")
    monkeypatch.setenv("OUTPUT_DIR", str(tmp_path / "out"))
    monkeypatch.setenv("DIFF_PATH", str(diff))
    monkeypatch.delenv("GITHUB_OUTPUT", raising=False)

    def fake_urlopen(req, timeout=0):
        raise urllib.error.HTTPError(review.OPENROUTER_URL, 401, "Unauthorized", {}, io.BytesIO(b'{"error":"bad key"}'))

    monkeypatch.setattr(review.urllib.request, "urlopen", fake_urlopen)
    assert review.main() == 0
    data = json.loads((tmp_path / "out" / "review.json").read_text())
    assert data["status"] == "error" and data["http_status"] == 401


def test_main_happy_path_renders_table(tmp_path, monkeypatch):
    diff = tmp_path / "pr.diff"
    diff.write_text("+ hello")
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    monkeypatch.setenv("OUTPUT_DIR", str(tmp_path / "out"))
    monkeypatch.setenv("DIFF_PATH", str(diff))
    monkeypatch.setenv("PR_TITLE", "feat: x")
    monkeypatch.delenv("GITHUB_OUTPUT", raising=False)
    payload = {"scores": {n: 7 for n, _ in review.CRITERIA}, "summary": "fine",
               "findings": [{"severity": "low", "file": "a.py", "line": 3, "summary": "nit", "fix": "rename"}]}
    monkeypatch.setattr(review, "call_openrouter", lambda *a, **k: json.dumps(payload))
    assert review.main() == 0
    md = (tmp_path / "out" / "review.md").read_text()
    assert "AI code review — PASS" in md and "`a.py:3`" in md and "| complexity | 7/10 |" in md
