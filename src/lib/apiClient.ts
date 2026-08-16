import { useEffect, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";

/**
 * Typed client for the in-app REST gateway. HTTP routes are served from the
 * Convex *site* domain, so the base URL is derived from the API URL by
 * swapping `.convex.cloud` → `.convex.site`.
 */

const API_BASE = (import.meta.env.VITE_CONVEX_URL as string).replace(
  ".convex.cloud",
  ".convex.site",
);

export const apiBaseUrl = API_BASE;

export type ApiEnvelope<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | { ok: false; error: string; note?: string };

export type ApiResult<T> = {
  envelope: ApiEnvelope<T>;
  status: number;
  latencyMs: number;
  headers: Record<string, string>;
};

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const started = performance.now();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const latencyMs = Math.round(performance.now() - started);
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key] = value;
  });
  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    envelope = { ok: false, error: `Unexpected response (HTTP ${res.status})` };
  }
  return { envelope, status: res.status, latencyMs, headers };
}

const qs = (params: Record<string, string | undefined>) =>
  new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
    ),
  ).toString();

export type SearchParams = {
  q?: string;
  category?: string;
  sort?: string;
};

export type Suggestion = {
  type: "product" | "brand" | "category";
  label: string;
  target?: string;
};

export type FlashSale = {
  productId: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  mrp: number;
  discountPct: number;
  endsAt: number;
  badge: string;
};

export type PickupPoint = {
  id: string;
  name: string;
  city: string;
  distanceKm: number;
  etaMinutes: number;
  open: boolean;
};

export type PageContent = {
  page: string;
  cacheFirst: boolean;
  hero: { headline: string; subhead: string };
  categories: Doc<"categories">[];
  deals: Doc<"products">[];
  featured: Doc<"products">[];
  catalogSize: number;
};

export const api = {
  pageContent: () => request<PageContent>("/api/4/page/fetch"),
  search: (params: SearchParams) =>
    request<Doc<"products">[]>(`/api/v2/search?${qs(params)}`),
  suggestions: (q: string) =>
    request<Suggestion[]>(`/api/v2/search/suggestions?q=${encodeURIComponent(q)}`),
  categories: () => request<Doc<"categories">[]>("/api/v2/categories"),
  deals: () => request<Doc<"products">[]>("/api/v2/deals"),
  flashSales: () => request<FlashSale[]>("/api/v2/flash-sales"),
  recommendations: (productId?: string) =>
    request<Doc<"products">[]>(
      `/api/v2/recommendations${productId ? `?productId=${productId}` : ""}`,
    ),
  product: (productId: string) => request<Doc<"products">>(`/api/v2/product/${productId}`),
  productReviews: (productId: string) =>
    request<Doc<"reviews">[]>(`/api/v2/product/${productId}/reviews`),
  productAvailability: (productId: string) =>
    request<{ productId: string; inStock: boolean; stock: number; lowStock: boolean }>(
      `/api/v2/product/${productId}/availability`,
    ),
  paymentMethods: () =>
    request<{ id: string; label: string; detail: string; enabled: boolean }[]>(
      "/api/v2/payment/methods",
    ),
  notifications: () =>
    request<{ id: string; type: string; title: string; message: string; time: number; read: boolean }[]>(
      "/api/v2/notifications",
    ),
  pickupPoints: () => request<PickupPoint[]>("/api/v2/locations/pickup-points"),
  validateCoupon: (code: string) =>
    request<{ valid: boolean; code: string; discountPct?: number; freeDelivery?: boolean; note?: string }>(
      "/api/v2/coupon/validate",
      { method: "POST", body: JSON.stringify({ code }) },
    ),
  signupStatus: (email: string) =>
    request<{ email: string; exists: boolean; registered: boolean }>(
      "/api/6/user/signup/status",
      { method: "POST", body: JSON.stringify({ email }) },
    ),
  seller: (sellerId: string) =>
    request<{ id: string; name: string; rating: number; ratingCount: number; yearsActive: number }>(
      `/api/v2/sellers/${sellerId}`,
    ),
  /** Fire a telemetry event at the collector (in-app sonic stand-in). */
  trackEvent: (
    event: string,
    props?: Record<string, string | number | boolean>,
    path?: string,
  ) =>
    request<{ tracked: boolean; event: string }>("/api/v2/analytics/events", {
      method: "POST",
      body: JSON.stringify({ event, path, props }),
    }),
  recentEvents: (limit = 12) =>
    request<Doc<"analyticsEvents">[]>(`/api/v2/analytics/events?limit=${limit}`),
  /** The captured click/view tracking endpoint. */
  trackAction: (action: string, extra?: Record<string, string>) =>
    request<{ action: string; tracked: boolean }>(
      `/api/1/action/view?action=${encodeURIComponent(action)}${extra ? `&${qs(extra)}` : ""}`,
    ),
};

/**
 * Fetch a resource from the REST gateway and prefer it when it succeeds,
 * falling back to the reactive Convex query result (`fallback`) otherwise.
 * `fetcher` must be stable (wrap in useCallback).
 */
export function useApiResource<T>(
  fetcher: () => Promise<ApiResult<T>>,
  fallback: T | undefined,
): { data: T | undefined; source: "api" | "convex"; latencyMs?: number } {
  const [state, setState] = useState<{
    data: T | undefined;
    source: "api" | "convex";
    latencyMs?: number;
  }>({ data: fallback, source: "convex" });

  useEffect(() => {
    let alive = true;
    fetcher()
      .then((result) => {
        if (!alive) return;
        if (result.envelope.ok) {
          setState({ data: result.envelope.data, source: "api", latencyMs: result.latencyMs });
        }
      })
      .catch(() => {
        // gateway unreachable — keep the Convex fallback
      });
    return () => {
      alive = false;
    };
  }, [fetcher]);

  useEffect(() => {
    setState((s) => (s.source === "convex" ? { ...s, data: fallback } : s));
  }, [fallback]);

  return state;
}
