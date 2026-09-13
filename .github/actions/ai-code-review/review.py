#!/usr/bin/env python3
"""AI code review for a pull request via OpenRouter (stdlib only, no third-party deps).

Inputs come from the environment (set by the composite action):
  OPENROUTER_API_KEY          required to run; when empty the review is *skipped*, not failed
  AI_REVIEW_MODEL             default deepseek/deepseek-v4.1-flash
  AI_REVIEW_REASONING_EFFORT  default high  (OpenRouter `reasoning.effort`)
  AI_REVIEW_PASS_THRESHOLD    default 6     (every criterion must score >= threshold)
  AI_REVIEW_MAX_DIFF_CHARS    default 60000 (the diff tail is dropped beyond this)
  PR_TITLE, PR_BODY, DIFF_PATH, OUTPUT_DIR

Outputs: <OUTPUT_DIR>/review.json, <OUTPUT_DIR>/review.md and, when GITHUB_OUTPUT is
set, the step outputs `status` (ok | skipped | error) and `verdict` (pass | fail | none).
The key is never printed. Exit code is 0 for ok/skipped/error-from-the-API so the job
stays non-blocking; only a programming error exits non-zero.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash"

CRITERIA: list[tuple[str, str]] = [
    ("implementation_correctness",
     "does the code do what it claims, handling edge cases and error paths without regressions?"),
    ("idiomaticity",
     "does the code follow the language, framework and project conventions a fluent reader expects?"),
    ("complexity",
     "is the solution as simple as the problem allows, without needless abstraction?"),
    ("test_risk_coverage",
     "are the meaningful behaviours and risky paths exercised by tests proportional to their risk?"),
    ("documentation",
     "are non-obvious decisions, public surfaces and tricky code explained where a reader needs it?"),
    ("security_safety",
     "does the change avoid vulnerabilities, secret leaks and unsafe handling of untrusted input?"),
]

SYSTEM_PROMPT = """You are a senior code reviewer for Pita Supply OS — a FastAPI + Pydantic backend
(`supply-os-v1/`) and a React + Vite + TypeScript frontend (`frontend/`). Repository rules that
matter for review: all persistence goes through `_choose_backend()`; frontend API calls only via
`src/apiClient.ts`; user-facing copy only via `src/i18n/`; no secrets in git; tests must never place
a real supplier order; skill-managed artifacts under `context/` are in English.

Score the pull request on six criteria, each 1-10 (1 = worst, 10 = best):
{criteria}

Return ONLY a JSON object with this exact shape and nothing else:
{{
  "scores": {{"implementation_correctness": int, "idiomaticity": int, "complexity": int,
             "test_risk_coverage": int, "documentation": int, "security_safety": int}},
  "summary": "two or three sentences on what the change does and the main risk",
  "findings": [
    {{"severity": "high|medium|low", "file": "path or empty", "line": int or null,
      "summary": "one sentence: what is wrong and why it matters", "fix": "one sentence"}}
  ]
}}
Rules: be concrete, cite paths from the diff, do not invent files, prefer fewer high-signal
findings over many nits, and never restate the diff."""


def criteria_text() -> str:
    return "\n".join(f"{i}. {name} — {desc}" for i, (name, desc) in enumerate(CRITERIA, 1))


def truncate_diff(diff: str, max_chars: int) -> tuple[str, bool]:
    if len(diff) <= max_chars:
        return diff, False
    return diff[:max_chars] + f"\n\n[... diff truncated after {max_chars} characters ...]\n", True


def build_messages(title: str, body: str, diff: str) -> list[dict]:
    user = (
        f"## Pull request title\n{title.strip() or '(none)'}\n\n"
        f"## Pull request description\n{body.strip() or '(none)'}\n\n"
        f"## Unified diff\n```diff\n{diff}\n```"
    )
    return [
        {"role": "system", "content": SYSTEM_PROMPT.format(criteria=criteria_text())},
        {"role": "user", "content": user},
    ]


def parse_review(content: str) -> dict:
    """Parse the model's JSON, tolerating ```json fences and leading prose."""
    text = content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rsplit("```", 1)[0]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in model output")
    data = json.loads(text[start:end + 1])
    scores = data.get("scores")
    if not isinstance(scores, dict):
        raise ValueError("missing scores")
    clean: dict[str, int] = {}
    for name, _ in CRITERIA:
        value = scores.get(name)
        if not isinstance(value, (int, float)):
            raise ValueError(f"score {name} missing or not numeric")
        clean[name] = max(1, min(10, int(round(value))))
    findings = data.get("findings") or []
    if not isinstance(findings, list):
        findings = []
    return {"scores": clean, "summary": str(data.get("summary", "")).strip(), "findings": findings}


def verdict_for(scores: dict[str, int], threshold: int) -> str:
    return "pass" if all(v >= threshold for v in scores.values()) else "fail"


def render_markdown(review: dict, verdict: str, model: str, effort: str, truncated: bool,
                    threshold: int) -> str:
    icon = "PASS" if verdict == "pass" else "FAIL"
    lines = [
        "<!-- ai-code-review -->",
        f"## AI code review — {icon}",
        "",
        f"Model `{model}` (reasoning effort `{effort}`) via OpenRouter · pass threshold: every "
        f"criterion ≥ {threshold} · non-blocking advisory, the product CI is the merge gate.",
        "",
        "| Criterion | Score |",
        "|---|---|",
    ]
    for name, _ in CRITERIA:
        lines.append(f"| {name.replace('_', ' ')} | {review['scores'][name]}/10 |")
    if review["summary"]:
        lines += ["", review["summary"]]
    if review["findings"]:
        lines += ["", "### Findings", ""]
        for f in review["findings"][:12]:
            sev = str(f.get("severity", "")).lower() or "info"
            loc = f.get("file") or ""
            if f.get("line"):
                loc = f"{loc}:{f['line']}"
            fix = f" Fix: {f['fix']}" if f.get("fix") else ""
            lines.append(f"- **{sev}** {('`' + loc + '` — ') if loc else ''}{f.get('summary', '')}{fix}")
    else:
        lines += ["", "No findings above the noise floor."]
    if truncated:
        lines += ["", "_The diff exceeded the size cap; only its head was reviewed._"]
    return "\n".join(lines) + "\n"


def call_openrouter(api_key: str, model: str, effort: str, messages: list[dict],
                    timeout: int = 180) -> str:
    payload = {
        "model": model,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "reasoning": {"effort": effort},
        "max_tokens": 4000,
        "temperature": 0.2,
    }
    req = urllib.request.Request(
        OPENROUTER_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/beniamin-openclaw/pita-supply-os",
            "X-Title": "pita-supply-os ai-code-review",
        },
        method="POST",
    )
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            return body["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as exc:
            if exc.code >= 500 and attempt == 0:
                last_error = exc
                time.sleep(5)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == 0:
                last_error = exc
                time.sleep(5)
                continue
            raise
    raise RuntimeError(f"OpenRouter unreachable: {last_error}")


def write_outputs(out_dir: Path, review_json: dict, review_md: str, status: str, verdict: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "review.json").write_text(json.dumps(review_json, indent=2, ensure_ascii=False) + "\n")
    (out_dir / "review.md").write_text(review_md)
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as fh:
            fh.write(f"status={status}\nverdict={verdict}\n")


def main() -> int:
    env = os.environ.get
    out_dir = Path(env("OUTPUT_DIR", "ai-review-out"))
    api_key = env("OPENROUTER_API_KEY", "").strip()
    model = env("AI_REVIEW_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    effort = env("AI_REVIEW_REASONING_EFFORT", "high").strip() or "high"
    threshold = int(env("AI_REVIEW_PASS_THRESHOLD", "6"))
    max_chars = int(env("AI_REVIEW_MAX_DIFF_CHARS", "60000"))

    if not api_key:
        msg = "<!-- ai-code-review -->\nAI review skipped: `OPENROUTER_API_KEY` is not set on this repository.\n"
        write_outputs(out_dir, {"status": "skipped", "reason": "no OPENROUTER_API_KEY"}, msg, "skipped", "none")
        print("AI review skipped: OPENROUTER_API_KEY not set")
        return 0

    diff_path = Path(env("DIFF_PATH", "pr.diff"))
    diff = diff_path.read_text(errors="replace") if diff_path.exists() else ""
    if not diff.strip():
        msg = "<!-- ai-code-review -->\nAI review skipped: empty diff.\n"
        write_outputs(out_dir, {"status": "skipped", "reason": "empty diff"}, msg, "skipped", "none")
        print("AI review skipped: empty diff")
        return 0
    diff, truncated = truncate_diff(diff, max_chars)
    messages = build_messages(env("PR_TITLE", ""), env("PR_BODY", ""), diff)

    try:
        content = call_openrouter(api_key, model, effort, messages)
        review = parse_review(content)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:300]
        msg = f"<!-- ai-code-review -->\nAI review error: OpenRouter returned HTTP {exc.code}.\n"
        write_outputs(out_dir, {"status": "error", "http_status": exc.code, "detail": detail}, msg, "error", "none")
        print(f"AI review error: HTTP {exc.code} {detail}")
        return 0
    except (RuntimeError, ValueError, KeyError, json.JSONDecodeError) as exc:
        msg = f"<!-- ai-code-review -->\nAI review error: {type(exc).__name__}: {exc}\n"
        write_outputs(out_dir, {"status": "error", "detail": str(exc)}, msg, "error", "none")
        print(f"AI review error: {type(exc).__name__}: {exc}")
        return 0

    verdict = verdict_for(review["scores"], threshold)
    md = render_markdown(review, verdict, model, effort, truncated, threshold)
    write_outputs(out_dir, {"status": "ok", "verdict": verdict, "model": model, "reasoning_effort": effort,
                            "truncated": truncated, **review}, md, "ok", verdict)
    print(md)
    return 0


if __name__ == "__main__":
    sys.exit(main())
