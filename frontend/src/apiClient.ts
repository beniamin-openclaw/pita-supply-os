// Thin fetch wrapper. Injects Bearer token + handles 401 by clearing
// stored token. Returns parsed JSON or throws ApiError.
//
// Usage:
//   const items = await apiGet<OrderableItem[]>("/api/captain/orderable?supplier_id=SUP_PAGO", "captain");
//   const resp = await apiPost<CaptainSubmitResponse>("/api/captain/submit", body, "captain");

import { clearToken, getToken, type Role } from "./auth";
import type {
  CaptainEditRequest,
  CaptainEditResponse,
  CaptainOrderDetail,
  CaptainOrderListItem,
  CaptainSubmitRequest,
  CaptainSubmitResponse,
  InventoryCountDetail,
  InventoryCountManagerItem,
  InventoryCountSubmitRequest,
  InventoryCountSubmitResponse,
  InventoryCountSummary,
  InventoryLatestResponse,
  InventoryProduct,
  Location,
  SuggestionReviewItem,
  ManagerClaimResponse,
  ManagerDispatchRequest,
  ManagerDispatchResponse,
  ManagerOrderDetail,
  ManagerQueueItem,
  ManagerReleaseRequest,
  ManagerReleaseResponse,
  ManagerSaveResponse,
  OrderLineManagerFinal,
  OrderableItem,
  Product,
  ReceiptDetail,
  ReceiptPhotoItem,
  ReceiptPhotoUploadResponse,
  ReceiptSubmitRequest,
  ReceiptSubmitResponse,
  ReceiptSummary,
  Supplier,
  OrderStatus,
} from "./types";

// Production: API calls go same-origin to /api/* and are proxied to the droplet
// backend by vercel.json rewrites. This routes traffic through the Vercel domain
// (which carriers trust) instead of the raw nip.io host — some networks (e.g.
// T-Mobile PL) block nip.io as suspected phishing, which surfaced as
// "Brak połączenia z backendem: Failed to fetch". Dev: hit the API directly.
const BASE_URL: string = import.meta.env.PROD
  ? ""
  : ((import.meta.env.VITE_API_URL as string) || "http://localhost:8901");

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`API ${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

// Event signal that the auth modal should re-open. Used by router-level UI.
export const AUTH_INVALID_EVENT = "supply_os_auth_invalid";

function fireAuthInvalid(role: Role) {
  clearToken(role);
  window.dispatchEvent(new CustomEvent(AUTH_INVALID_EVENT, { detail: { role } }));
}

async function request<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  role: Role,
  body?: unknown,
): Promise<T> {
  // Snapshot the token used for THIS request. Used below to ignore a 401
  // from a stale racing response if the user has already re-authenticated
  // in the meantime (was an issue on flaky cellular: a late 401 from an
  // earlier request would wipe a freshly-valid token).
  const tokenAtRequest = getToken(role);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (tokenAtRequest) headers["Authorization"] = `Bearer ${tokenAtRequest}`;

  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // Network error
    throw new ApiError(0, (err as Error).message || "Network error");
  }

  if (resp.status === 401) {
    // Only invalidate if the token we used is still the one in storage.
    // Otherwise the user has already re-authed and we shouldn't kick them.
    const currentToken = getToken(role);
    if (currentToken === tokenAtRequest) {
      fireAuthInvalid(role);
    }
    throw new ApiError(401, "Bearer token invalid — please re-enter the code");
  }

  let payload: unknown = null;
  try {
    payload = await resp.json();
  } catch {
    // non-JSON response (e.g. 500 Internal Server Error from Caddy)
    if (!resp.ok) throw new ApiError(resp.status, resp.statusText);
    return payload as T;
  }

  if (!resp.ok) {
    const detail =
      (payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : null) || resp.statusText;
    throw new ApiError(resp.status, detail);
  }

  return payload as T;
}

export function apiGet<T>(path: string, role: Role): Promise<T> {
  return request<T>("GET", path, role);
}

/**
 * Verify a candidate token against the backend by calling a low-cost endpoint
 * that accepts either Captain or Manager auth. Returns:
 *   - { ok: true } on 200
 *   - { ok: false, status, detail } on auth/error
 *
 * Does NOT touch localStorage and does NOT fire AUTH_INVALID_EVENT.
 * Used by AuthGate before storing a freshly-typed token.
 */
export async function validateToken(
  token: string,
): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  try {
    const resp = await fetch(`${BASE_URL}/api/locations`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (resp.ok) return { ok: true };
    let detail = resp.statusText || "Unknown error";
    try {
      const body = (await resp.json()) as { detail?: unknown };
      if (body && typeof body.detail === "string") detail = body.detail;
    } catch {
      // non-JSON response
    }
    return { ok: false, status: resp.status, detail };
  } catch (err) {
    return { ok: false, status: 0, detail: (err as Error).message || "Network error" };
  }
}

export function apiPost<T>(path: string, body: unknown, role: Role): Promise<T> {
  return request<T>("POST", path, role, body);
}

export function apiPatch<T>(path: string, body: unknown, role: Role): Promise<T> {
  return request<T>("PATCH", path, role, body);
}

/**
 * Multipart POST (e.g. WZ photo upload). Parallel to request() but bypasses
 * JSON: we deliberately do NOT set Content-Type — the browser sets
 * multipart/form-data + boundary itself. Same Bearer + 401 handling as request().
 */
export async function apiPostFormData<T>(
  path: string,
  form: FormData,
  role: Role,
): Promise<T> {
  const tokenAtRequest = getToken(role);
  const headers: Record<string, string> = {};
  if (tokenAtRequest) headers["Authorization"] = `Bearer ${tokenAtRequest}`;

  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body: form });
  } catch (err) {
    throw new ApiError(0, (err as Error).message || "Network error");
  }

  if (resp.status === 401) {
    const currentToken = getToken(role);
    if (currentToken === tokenAtRequest) fireAuthInvalid(role);
    throw new ApiError(401, "Bearer token invalid — please re-enter the code");
  }

  let payload: unknown = null;
  try {
    payload = await resp.json();
  } catch {
    if (!resp.ok) throw new ApiError(resp.status, resp.statusText);
    return payload as T;
  }
  if (!resp.ok) {
    const detail =
      (payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : null) || resp.statusText;
    throw new ApiError(resp.status, detail);
  }
  return payload as T;
}

// Typed shortcuts ------------------------------------------------------------

export const api = {
  // Master data (any auth)
  products: () => apiGet<Product[]>("/api/products", "captain"),
  suppliers: () => apiGet<Supplier[]>("/api/suppliers", "captain"),
  locations: () => apiGet<Location[]>("/api/locations", "captain"),
  // Captain
  orderable: (supplier_id: string) =>
    apiGet<OrderableItem[]>(`/api/captain/orderable?supplier_id=${encodeURIComponent(supplier_id)}`, "captain"),
  captainSubmit: (req: CaptainSubmitRequest) =>
    apiPost<CaptainSubmitResponse>("/api/captain/submit", req, "captain"),
  captainOrders: (params?: { status?: OrderStatus; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiGet<CaptainOrderListItem[]>(`/api/captain/orders${suffix}`, "captain");
  },
  captainOrder: (order_id: string) =>
    apiGet<CaptainOrderDetail>(`/api/captain/order/${encodeURIComponent(order_id)}`, "captain"),
  captainOrderEdit: (order_id: string, req: CaptainEditRequest) =>
    apiPatch<CaptainEditResponse>(
      `/api/captain/order/${encodeURIComponent(order_id)}`,
      req,
      "captain",
    ),
  // Captain inventory count (S-06)
  inventoryProducts: () =>
    apiGet<InventoryProduct[]>("/api/captain/inventory/products", "captain"),
  inventorySubmit: (req: InventoryCountSubmitRequest) =>
    apiPost<InventoryCountSubmitResponse>("/api/captain/inventory/submit", req, "captain"),
  // Latest snapshot for the token's location (opt-in order prefill, S-07). Null
  // when there is no snapshot / seed mode — the caller treats null as "no offer".
  inventoryLatest: () =>
    apiGet<InventoryLatestResponse | null>("/api/captain/inventory/latest", "captain"),
  // Recent snapshots for the token's location (FR-024 picker). Up to 10, newest
  // count_date first; [] in seed mode. Compact rows (no lines).
  inventoryCounts: () =>
    apiGet<InventoryCountSummary[]>("/api/captain/inventory/counts", "captain"),
  // One snapshot with lines, for pre-fill from a chosen count (FR-024). Reuses
  // the latest-response shape (carries count_user).
  inventoryCount: (count_id: string) =>
    apiGet<InventoryLatestResponse>(
      `/api/captain/inventory/count/${encodeURIComponent(count_id)}`,
      "captain",
    ),
  // Captain goods receiving (GR-01)
  receiptSubmit: (req: ReceiptSubmitRequest) =>
    apiPost<ReceiptSubmitResponse>("/api/captain/receipt/submit", req, "captain"),
  captainReceipts: (order_id?: string) => {
    const qs = order_id ? `?order_id=${encodeURIComponent(order_id)}` : "";
    return apiGet<ReceiptSummary[]>(`/api/captain/receipts${qs}`, "captain");
  },
  receipt: (receipt_id: string) =>
    apiGet<ReceiptDetail>(`/api/captain/receipt/${encodeURIComponent(receipt_id)}`, "captain"),
  receiptUploadPhotos: (receipt_id: string, files: File[]) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    return apiPostFormData<ReceiptPhotoUploadResponse>(
      `/api/captain/receipt/${encodeURIComponent(receipt_id)}/photos`,
      form,
      "captain",
    );
  },
  // Signed URLs for a receipt's WZ photos (GR-01), minted on demand (1h TTL).
  // [] when the receipt has no photos; never cached — re-fetch to re-sign.
  receiptPhotoUrls: (receipt_id: string) =>
    apiGet<ReceiptPhotoItem[]>(
      `/api/captain/receipt/${encodeURIComponent(receipt_id)}/photos`,
      "captain",
    ),
  // Manager
  managerQueue: (location_id?: string, status: OrderStatus = "captain_submitted") => {
    const params = new URLSearchParams({ status });
    if (location_id) params.set("location_id", location_id);
    return apiGet<ManagerQueueItem[]>(`/api/manager/queue?${params}`, "manager");
  },
  managerOrder: (order_id: string) =>
    apiGet<ManagerOrderDetail>(`/api/manager/order/${encodeURIComponent(order_id)}`, "manager"),
  // Save manager edits WITHOUT dispatch (Phase G2). Stays manager_claimed.
  // Pass the full read-modify-write line set (qty + comment) for every dirty line.
  managerSave: (order_id: string, manager_finals: OrderLineManagerFinal[]) =>
    apiPatch<ManagerSaveResponse>(
      `/api/manager/order/${encodeURIComponent(order_id)}`,
      { manager_finals },
      "manager",
    ),
  managerDispatch: (req: ManagerDispatchRequest) =>
    apiPost<ManagerDispatchResponse>("/api/manager/dispatch", req, "manager"),
  managerClaim: (order_id: string) =>
    apiPost<ManagerClaimResponse>(`/api/manager/claim/${encodeURIComponent(order_id)}`, {}, "manager"),
  managerRelease: (order_id: string, reason: string) =>
    apiPost<ManagerReleaseResponse>(
      `/api/manager/release/${encodeURIComponent(order_id)}`,
      { reason } as ManagerReleaseRequest,
      "manager",
    ),
  // Manager inventory view (S-08 / FR-018). Cross-location; [] in seed mode.
  managerInventoryCounts: (location_id?: string) => {
    const qs = location_id ? `?location_id=${encodeURIComponent(location_id)}` : "";
    return apiGet<InventoryCountManagerItem[]>(`/api/manager/inventory/counts${qs}`, "manager");
  },
  managerInventoryCount: (count_id: string) =>
    apiGet<InventoryCountDetail>(
      `/api/manager/inventory/count/${encodeURIComponent(count_id)}`,
      "manager",
    ),
  // Suggestion learning-loop review (S-03 / FR-012). Per-product roll-up sorted
  // worst-deviation first; [] in seed mode.
  managerSuggestionReview: () =>
    apiGet<SuggestionReviewItem[]>("/api/manager/suggestion-review", "manager"),
};

export { BASE_URL };
