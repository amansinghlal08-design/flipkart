import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Server-side proxy to the real Flipkart mobile API.
 *
 * Browsers cannot call 2.rome.api.flipkart.com directly (CORS + the API
 * requires Flipkart session cookies and x-goog-api-key). So the site calls
 * our gateway and this action forwards the request server-side with the
 * captured header/cookie surface:
 *
 *   - cookies: at (access JWT), rt (refresh JWT), ULSN, T, SN, ud, vd, S
 *   - headers: x-goog-api-key, x-session-id, x-user-agent
 *
 * Configure these in the Keys tab (env vars):
 *   FLIPKART_ACCESS_TOKEN   — value of the `at` cookie from the capture
 *   FLIPKART_REFRESH_TOKEN  — value of the `rt` cookie
 *   FLIPKART_X_GOOGLE_API_KEY — x-goog-api-key value
 *   FLIPKART_SESSION_COOKIES — raw "k=v; k2=v2" cookie string (optional,
 *                             overrides individual cookie vars)
 *   FLIPKART_BASE_URL       — defaults to https://2.rome.api.flipkart.com
 *
 * When no token/cookie is configured the action returns { configured: false }
 * so callers can fall back to the in-app mirror. This proxy is intended for
 * your own account/session only.
 */

const DEFAULT_BASE = "https://2.rome.api.flipkart.com";

/**
 * Whether Flipkart session creds are configured. Cheap (no network) — lets
 * the UI show "connected to Flipkart" vs "mirror mode" without proxying.
 */
export const flipkartStatus = action({
  args: {},
  handler: async () => {
    const accessToken = (process.env.FLIPKART_ACCESS_TOKEN ?? "").trim();
    const refreshToken = (process.env.FLIPKART_REFRESH_TOKEN ?? "").trim();
    const apiKey = (process.env.FLIPKART_X_GOOGLE_API_KEY ?? "").trim();
    const rawCookies = (process.env.FLIPKART_SESSION_COOKIES ?? "").trim();
    const configured = Boolean(accessToken || refreshToken || apiKey || rawCookies);
    return {
      configured,
      channels: {
        accessToken: Boolean(accessToken),
        refreshToken: Boolean(refreshToken),
        apiKey: Boolean(apiKey),
        rawCookies: Boolean(rawCookies),
      },
    };
  },
});

export const proxyFlipkart = action({
  args: {
    method: v.string(),
    path: v.string(), // e.g. "/api/4/page/fetch?cacheFirst=false"
    body: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))),
  },
  handler: async (_ctx, { method, path, body }) => {
    const base = (process.env.FLIPKART_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, "");
    const accessToken = (process.env.FLIPKART_ACCESS_TOKEN ?? "").trim();
    const refreshToken = (process.env.FLIPKART_REFRESH_TOKEN ?? "").trim();
    const apiKey = (process.env.FLIPKART_X_GOOGLE_API_KEY ?? "").trim();
    const rawCookies = (process.env.FLIPKART_SESSION_COOKIES ?? "").trim();

    if (!accessToken && !refreshToken && !apiKey && !rawCookies) {
      return { configured: false as const };
    }

    const cookies: string[] = [];
    if (rawCookies) {
      cookies.push(rawCookies);
    } else {
      if (accessToken) cookies.push(`at=${accessToken}`);
      if (refreshToken) cookies.push(`rt=${refreshToken}`);
    }

    const headers: Record<string, string> = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-IN,en;q=0.9,hi;q=0.8",
      "content-type": "application/json",
      origin: "https://www.flipkart.com",
      referer: "https://www.flipkart.com/",
      "user-agent":
        "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
      "x-user-agent":
        "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-session-id": `sess_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    };
    if (apiKey) headers["x-goog-api-key"] = apiKey;
    if (cookies.length) headers.cookie = cookies.join("; ");

    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        // Server-side fetch has no CORS; short timeout so the app never hangs
        // when Flipkart is slow/blocking.
        signal: AbortSignal.timeout(12000),
      });
      let data: unknown = null;
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 2000);
      }
      return {
        configured: true as const,
        status: res.status,
        ok: res.ok,
        data,
        endpoint: path,
        method,
      };
    } catch (error) {
      return {
        configured: true as const,
        status: 0,
        ok: false,
        error: error instanceof Error ? error.message : "flipkart_proxy_error",
        endpoint: path,
        method,
      };
    }
  },
});
