import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

/**
 * Server-side proxy to the real Flipkart mobile API (2.rome.api.flipkart.com).
 *
 * Browsers cannot call 2.rome.api.flipkart.com directly (CORS + the API
 * requires Flipkart session cookies and x-goog-api-key). So the site calls
 * our gateway and this module forwards requests server-side with a
 * device-consistent header/cookie surface:
 *
 *   - cookies: at (access JWT), rt (refresh JWT), ULSN, T, SN, ud, vd, S
 *   - headers: x-goog-api-key, x-session-id, x-user-agent
 *
 * Credentials come from two places, in priority order:
 *   1. A REAL DEVICE SESSION stored in Convex (`flipkartSessions`) — created
 *      automatically when a user logs in with OTP through this app (see the
 *      gateway's /api/7/user/otp/generate + /api/1/user/login/otp handlers).
 *   2. Static env vars set in the Keys tab:
 *        FLIPKART_ACCESS_TOKEN   — value of the `at` cookie
 *        FLIPKART_REFRESH_TOKEN  — value of the `rt` cookie
 *        FLIPKART_X_GOOGLE_API_KEY — x-goog-api-key value
 *        FLIPKART_SESSION_COOKIES — raw "k=v; k2=v2" cookie string
 *        FLIPKART_BASE_URL       — defaults to https://2.rome.api.flipkart.com
 *
 * When nothing is configured the actions return { configured: false } so
 * callers fall back to the in-app mirror. The proxy is intended for your own
 * Flipkart account/session only.
 */

const DEFAULT_BASE = "https://2.rome.api.flipkart.com";

// The captured device surface the session presents — persistent so Flipkart
// sees one consistent device across generate → verify → data calls.
export const DEVICE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36";

function newSessionId(): string {
  return `sess_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function newDeviceId(): string {
  return `dev_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-6)}`;
}

// ---------------------------------------------------------------------------
// Stored sessions (Convex tables)
// ---------------------------------------------------------------------------

export const getSessionByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const row = await ctx.db
      .query("flipkartSessions")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    return row ?? null;
  },
});

export const getLatestActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("flipkartSessions")
      .withIndex("by_updated")
      .order("desc")
      .first();
    return row && row.status === "active" ? row : null;
  },
});

/** Create (pending) or update (active) a session for a phone. */
export const upsertFlipkartSession = mutation({
  args: {
    phone: v.string(),
    status: v.string(), // "pending" | "active"
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    cookies: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("flipkartSessions")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
    const now = Date.now();
    const fields = {
      phone: args.phone,
      status: args.status,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      cookies: args.cookies,
      apiKey: args.apiKey,
      deviceId: args.deviceId ?? existing?.deviceId ?? newDeviceId(),
      sessionId: args.sessionId ?? existing?.sessionId ?? newSessionId(),
      userAgent: args.userAgent ?? existing?.userAgent ?? DEVICE_USER_AGENT,
      updatedAt: now,
      lastUsedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return { _id: existing._id, created: false as const, ...fields };
    }
    const _id = await ctx.db.insert("flipkartSessions", {
      ...fields,
      createdAt: now,
    });
    return { _id, created: true as const, ...fields };
  },
});

/** Mark a session as used (keeps it the preferred one for later calls). */
export const touchSession = mutation({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const existing = await ctx.db
      .query("flipkartSessions")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastUsedAt: Date.now() });
    }
  },
});

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Whether a Flipkart session is available — from env creds or a stored real
 * session. Cheap (no network) — lets the UI show "connected to Flipkart"
 * without proxying.
 */
export const flipkartStatus = action({
  args: {},
  // Explicit return annotation breaks the module self-reference cycle (this
  // action queries getLatestActiveSession from the same module).
  handler: async (ctx): Promise<{
    configured: boolean;
    sessionPhone: string | null;
    channels: {
      accessToken: boolean;
      refreshToken: boolean;
      apiKey: boolean;
      rawCookies: boolean;
      storedSession: boolean;
    };
  }> => {
    const envConfigured = Boolean(
      (process.env.FLIPKART_ACCESS_TOKEN ?? "").trim() ||
        (process.env.FLIPKART_REFRESH_TOKEN ?? "").trim() ||
        (process.env.FLIPKART_X_GOOGLE_API_KEY ?? "").trim() ||
        (process.env.FLIPKART_SESSION_COOKIES ?? "").trim(),
    );
    let sessionPhone: string | null = null;
    let sessionActive = false;
    try {
      const latest = (await ctx.runQuery(api.flipkartProxy.getLatestActiveSession, {})) as {
        phone: string;
        status: string;
      } | null;
      if (latest && latest.status === "active") {
        sessionPhone = latest.phone;
        sessionActive = true;
      }
    } catch {
      // query failed — env-only status is still useful
    }
    return {
      configured: envConfigured || sessionActive,
      sessionPhone,
      channels: {
        accessToken: Boolean((process.env.FLIPKART_ACCESS_TOKEN ?? "").trim()),
        refreshToken: Boolean((process.env.FLIPKART_REFRESH_TOKEN ?? "").trim()),
        apiKey: Boolean((process.env.FLIPKART_X_GOOGLE_API_KEY ?? "").trim()),
        rawCookies: Boolean((process.env.FLIPKART_SESSION_COOKIES ?? "").trim()),
        storedSession: sessionActive,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

function extractTokens(payload: unknown): { accessToken?: string; refreshToken?: string } {
  const out: { accessToken?: string; refreshToken?: string } = {};
  const walk = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const k = key.toLowerCase().replace(/[^a-z]/g, "");
      if (typeof val === "string") {
        if (!out.accessToken && (k === "accesstoken" || k === "at" || k === "authtoken")) {
          out.accessToken = val;
        }
        if (!out.refreshToken && (k === "refreshtoken" || k === "rt")) {
          out.refreshToken = val;
        }
      } else if (val && typeof val === "object") {
        walk(val);
      }
    }
  };
  walk(payload);
  return out;
}

export const proxyFlipkart = action({
  args: {
    method: v.string(),
    path: v.string(), // e.g. "/api/4/page/fetch?cacheFirst=false"
    body: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))),
    phone: v.optional(v.string()), // prefer this account's stored real session
  },
  handler: async (ctx, { method, path, body, phone }) => {
    const base = (process.env.FLIPKART_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, "");
    const envAccess = (process.env.FLIPKART_ACCESS_TOKEN ?? "").trim();
    const envRefresh = (process.env.FLIPKART_REFRESH_TOKEN ?? "").trim();
    const envApiKey = (process.env.FLIPKART_X_GOOGLE_API_KEY ?? "").trim();
    const envCookies = (process.env.FLIPKART_SESSION_COOKIES ?? "").trim();

    // Resolve credentials: stored session (phone arg) → env vars → latest
    // stored active session → none.
    let cookies: string[] = [];
    let apiKey = envApiKey;
    let sessionId = newSessionId();
    let userAgent = DEVICE_USER_AGENT;
    let sessionPhone: string | undefined;

    const fromStored = (row: {
      phone: string;
      accessToken?: string;
      refreshToken?: string;
      cookies?: string;
      apiKey?: string;
      sessionId: string;
      userAgent: string;
    }): void => {
      sessionPhone = row.phone;
      if (row.cookies) cookies.push(row.cookies);
      else {
        if (row.accessToken) cookies.push(`at=${row.accessToken}`);
        if (row.refreshToken) cookies.push(`rt=${row.refreshToken}`);
      }
      if (row.apiKey) apiKey = row.apiKey;
      sessionId = row.sessionId;
      userAgent = row.userAgent;
    };

    if (phone) {
      const stored = await ctx.runQuery(api.flipkartProxy.getSessionByPhone, {
        phone: phone.replace(/\D/g, ""),
      });
      if (stored) {
        fromStored(stored);
        if (sessionPhone) {
          await ctx
            .runMutation(api.flipkartProxy.touchSession, { phone: sessionPhone })
            .catch(() => undefined);
        }
      }
    }

    if (cookies.length === 0 && envCookies) cookies.push(envCookies);
    if (cookies.length === 0 && !phone) {
      if (envAccess) cookies.push(`at=${envAccess}`);
      if (envRefresh) cookies.push(`rt=${envRefresh}`);
    }

    // No stored session and no env creds → mirror mode.
    if (cookies.length === 0 && !apiKey) {
      return { configured: false as const };
    }

    const headers: Record<string, string> = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-IN,en;q=0.9,hi;q=0.8",
      "content-type": "application/json",
      origin: "https://www.flipkart.com",
      referer: "https://www.flipkart.com/",
      "user-agent": userAgent,
      "x-user-agent": userAgent,
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-session-id": sessionId,
    };
    if (apiKey) headers["x-goog-api-key"] = apiKey;
    if (cookies.length) headers.cookie = cookies.join("; ");

    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(12000),
      });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 2000);
      }
      // Capture session cookies Flipkart sets (real login) for storage.
      let setCookies: string[] = [];
      try {
        setCookies = res.headers.getSetCookie?.() ?? [];
      } catch {
        setCookies = [];
      }
      const tokenHints = extractTokens(data);
      const atCookie = setCookies.find((c) => /(^|;\s*)at=/i.test(c));
      const rtCookie = setCookies.find((c) => /(^|;\s*)rt=/i.test(c));
      return {
        configured: true as const,
        status: res.status,
        ok: res.ok,
        data,
        endpoint: path,
        method,
        session: {
          phone: sessionPhone,
          accessToken:
            tokenHints.accessToken ??
            (atCookie ? atCookie.split(";")[0].split("=").slice(1).join("=") : undefined),
          refreshToken:
            tokenHints.refreshToken ??
            (rtCookie ? rtCookie.split(";")[0].split("=").slice(1).join("=") : undefined),
          cookies: setCookies.length ? setCookies.map((c) => c.split(";")[0]).join("; ") : undefined,
        },
      };
    } catch (error) {
      return {
        configured: true as const,
        status: 0,
        ok: false,
        error: error instanceof Error ? error.message : "flipkart_proxy_error",
        endpoint: path,
        method,
        session: null,
      };
    }
  },
});
