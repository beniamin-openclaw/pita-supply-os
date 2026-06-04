// Diagnostic page — bypasses AuthGate. Paste a token, click "Test", see what
// the backend returns for each endpoint. No DevTools required.
//
// Route: /debug
// Not linked from anywhere; you must navigate manually.

import { useState } from "react";
import { BASE_URL } from "../apiClient";

interface TestResult {
  endpoint: string;
  status: number | "network-error";
  ok: boolean;
  body: string;
  duration_ms: number;
}

const CAPTAIN_ENDPOINTS = [
  "/api/locations",
  "/api/products",
  "/api/suppliers",
  "/api/captain/orderable?supplier_id=SUP_PAGO",
];

const MANAGER_ENDPOINTS = [
  "/api/locations",
  "/api/products",
  "/api/suppliers",
  "/api/manager/queue?status=captain_submitted&location_id=WOLA",
];

async function call(path: string, token: string): Promise<TestResult> {
  const start = performance.now();
  try {
    const resp = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await resp.text();
    return {
      endpoint: path,
      status: resp.status,
      ok: resp.ok,
      body: body.slice(0, 1200),
      duration_ms: Math.round(performance.now() - start),
    };
  } catch (e) {
    return {
      endpoint: path,
      status: "network-error",
      ok: false,
      body: (e as Error).message || "(no message)",
      duration_ms: Math.round(performance.now() - start),
    };
  }
}

export function DebugPage() {
  const [token, setToken] = useState("");
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  async function runTests(endpoints: string[]) {
    setRunning(true);
    setResults([]);
    const out: TestResult[] = [];
    for (const ep of endpoints) {
      const r = await call(ep, token.trim());
      out.push(r);
      setResults([...out]);
    }
    setRunning(false);
  }

  function statusColor(r: TestResult): string {
    if (r.status === "network-error") return "bg-red-100 text-red-900 border-red-300";
    if (r.ok) return "bg-green-100 text-green-900 border-green-300";
    if (r.status === 401 || r.status === 403) return "bg-orange-100 text-orange-900 border-orange-300";
    return "bg-slate-200 text-slate-800 border-slate-400";
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-bold text-slate-900">Supply OS — Debug</h1>
        <p className="mt-2 text-sm text-slate-600">
          Wklej token (kapitana w formacie <code className="font-mono">WOLA:abc…</code>{" "}
          lub menedżera <code className="font-mono">abc…</code>) i kliknij przycisk
          poniżej. Strona pokaże, co backend odpowiada na każdy endpoint.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Backend: <code className="font-mono">{BASE_URL}</code>
        </p>

        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Wklej tu token…"
          rows={2}
          className="mt-4 w-full rounded border border-slate-300 p-3 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <p className="mt-1 text-xs text-slate-500">
          Długość po trim: <strong>{token.trim().length}</strong> znaków · pierwsze 8:{" "}
          <code className="font-mono">{token.trim().slice(0, 8)}…</code>
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={running || !token.trim()}
            onClick={() => runTests(CAPTAIN_ENDPOINTS)}
            className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {running ? "Testuję…" : "Test jako Captain"}
          </button>
          <button
            type="button"
            disabled={running || !token.trim()}
            onClick={() => runTests(MANAGER_ENDPOINTS)}
            className="rounded bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {running ? "Testuję…" : "Test jako Manager"}
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {results.map((r, i) => (
            <div key={i} className={`rounded border-2 p-3 ${statusColor(r)}`}>
              <div className="flex items-center justify-between gap-3">
                <code className="break-all text-xs sm:text-sm">{r.endpoint}</code>
                <span className="whitespace-nowrap rounded bg-white/60 px-2 py-1 text-xs font-bold">
                  {r.status} · {r.duration_ms}ms
                </span>
              </div>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-white/70 p-2 font-mono text-[11px]">
                {r.body || "(empty body)"}
              </pre>
            </div>
          ))}
        </div>

        {results.length > 0 && !running && (
          <div className="mt-6 rounded border border-slate-300 bg-white p-3 text-xs text-slate-600">
            <strong>Jak to czytać:</strong>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><span className="text-green-700 font-semibold">200 (zielony)</span> — token działa dla tego endpointa</li>
              <li><span className="text-orange-700 font-semibold">401/403 (pomarańczowy)</span> — token jest odrzucony</li>
              <li><span className="text-red-700 font-semibold">network-error (czerwony)</span> — request nie dotarł do backendu (CORS, sieć, DNS)</li>
              <li><span className="text-slate-700 font-semibold">500 / inne (szary)</span> — backend ma błąd wewnętrzny</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
