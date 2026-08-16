import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

/**
 * Server-side proxy to the real Flipkart API (2.rome.api.flipkart.com).
 *
 * Browsers cannot call Flipkart's API directly (CORS + it requires device
 * headers and session cookies), so the site calls our gateway and this module
 * forwards requests server-side with a device-consistent surface.
 *
 * Two credential surfaces are supported:
 *
 *  1. REAL DEVICE SESSION (web flow — no API key needed):
 *     - `POST /1/action/view` with `LOGIN_IDENTITY_VERIFY_SHOPSY2` sends a real
 *       SMS OTP to any phone number (the flow Flipkart's own web app uses).
 *     - `POST /1/action/view` with `LOGIN_SHOPSY2` verifies the code and
 *       returns real session tokens (at / sn / vid / secureToken / rt).
 *     - Sessions are stored in the `flipkartSessions` table, keyed by phone.
 *     - Every request presents a consistent FKUA device profile
 *       (X-Device-Id, X-Visit-Id, FK-TENANT-ID: SHOPSY, business: reseller).
 *     - Rome DC routing: a 406 `ERROR_CODE 2000` response names the datacenter
 *       to retry on (e.g. 2.rome → 1.rome); we follow it (max 3 hops).
 *
 *  2. STATIC ENV CREDS (captured mobile-app surface):
 *       FLIPKART_ACCESS_TOKEN, FLIPKART_REFRESH_TOKEN,
 *       FLIPKART_X_GOOGLE_API_KEY, FLIPKART_SESSION_COOKIES,
 *       FLIPKART_BASE_URL (defaults to https://2.rome.api.flipkart.com)
 *
 * When nothing is configured the actions return { configured: false } so
 * callers fall back to the in-app mirror.
 */

const DEFAULT_DC = "2";
const NEWRELIC_ID = "VwEHU1dSCxABUVlaAHU1UA";

function fkuaUserAgent(deviceId: string): string {
  return `Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007) FKUA/Retail/2291175/Android/Mobile (samsung/SM-S918B/${deviceId})`;
}

function newSessionId(): string {
  return `sess_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function newDeviceId(): string {
  return `dev_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-6)}`;
}

function newVisitId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function tCookie(): string {
  return `TI${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Rome request that follows the DC-change (406 ERROR_CODE 2000) dance. */
async function romeFetch(
  startDc: string,
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<{ dc: string; status: number; data: unknown }> {
  let dc = startDc || DEFAULT_DC;
  for (let hop = 0; hop < 4; hop++) {
    const url = `https://${dc}.rome.api.flipkart.com${path}`;
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
    if (res.status === 406 && data && typeof data === "object") {
      const anyData = data as { ERROR_CODE?: number; META_INFO?: { dcInfo?: { id?: string } } };
      const newDc = anyData?.META_INFO?.dcInfo?.id;
      if (anyData?.ERROR_CODE === 2000 && newDc && String(newDc) !== dc) {
        dc = String(newDc);
        continue;
      }
    }
    return { dc, status: res.status, data };
  }
  return { dc, status: 0, data: null };
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
    accessToken: v.optional(v.string()), // at
    refreshToken: v.optional(v.string()), // rt
    sn: v.optional(v.string()),
    vid: v.optional(v.string()),
    secureToken: v.optional(v.string()),
    cookies: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    visitId: v.optional(v.string()),
    dcId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    requestId: v.optional(v.string()),
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
      sn: args.sn,
      vid: args.vid,
      secureToken: args.secureToken,
      cookies: args.cookies,
      apiKey: args.apiKey,
      deviceId: args.deviceId ?? existing?.deviceId ?? newDeviceId(),
      visitId: args.visitId ?? existing?.visitId ?? newVisitId(),
      dcId: args.dcId ?? existing?.dcId ?? DEFAULT_DC,
      sessionId: args.sessionId ?? existing?.sessionId ?? newSessionId(),
      userAgent: args.userAgent ?? existing?.userAgent ?? fkuaUserAgent(args.deviceId ?? existing?.deviceId ?? newDeviceId()),
      requestId: args.requestId,
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
// Real authentication flow (web surface — no API key required)
// ---------------------------------------------------------------------------

/**
 * Real Flipkart auth via POST /1/action/view:
 *  - step "sendOtp"  → sends a real SMS OTP, returns the requestId
 *  - step "verifyOtp" → verifies the code, returns the real session tokens
 * The caller persists the returned device profile + tokens in flipkartSessions.
 *
 * sendOtp is TWO-PHASE, exactly like the working reference client:
 *  1. First call establishes a guest SESSION (at / sn / vid / secureToken).
 *  2. Retries carry those session headers — Flipkart only dispatches the SMS
 *     (returns a requestId) once the session headers are present.
 */
export const flipkartAuth = action({
  args: {
    step: v.string(), // "sendOtp" | "verifyOtp"
    phone: v.string(),
    otp: v.optional(v.string()),
    requestId: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    visitId: v.optional(v.string()),
    dcId: v.optional(v.string()),
    // guest session captured during sendOtp — required for verifyOtp
    sessionAt: v.optional(v.string()),
    sessionSn: v.optional(v.string()),
    sessionVid: v.optional(v.string()),
    sessionSecureToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const phone = args.phone.replace(/\D/g, "");
    const deviceId = args.deviceId ?? newDeviceId();
    const visitId = args.visitId ?? newVisitId();
    const userAgent = fkuaUserAgent(deviceId);
    const baseHeaders: Record<string, string> = {
      "content-type": "application/json; charset=UTF-8",
      "user-agent": userAgent,
      "x-user-agent": userAgent,
      "x-device-id": deviceId,
      "x-visit-id": visitId,
      "x-platform": "web",
      "fk-tenant-id": "SHOPSY",
      business: "reseller",
      "x-newrelic-id": NEWRELIC_ID,
      "x-device-width": "1080",
      "x-device-height": "1920",
      accept: "*/*",
      "accept-language": "en-IN,en;q=0.9",
      origin: "https://www.flipkart.com",
      referer: "https://www.flipkart.com/",
      cookie: `T=${tCookie()}`,
    };
    let dc = args.dcId ?? DEFAULT_DC;

    if (args.step === "sendOtp") {
      const body = {
        actionRequestContext: {
          type: "LOGIN_IDENTITY_VERIFY_SHOPSY2",
          loginId: phone,
          loginIdPrefix: "+91",
          phoneNumberFormat: "E164",
          addAppHash: true,
          loginType: "MOBILE",
          verificationType: "OTP",
          sourceContext: "DEFAULT",
          clientQueryParamMap: null,
        },
      };
      // Phase 1: establish a guest session; then retry with the session
      // headers until Flipkart dispatches the OTP (returns a requestId).
      // Matches the reference client: it retries with backoff after the
      // first response hands over the guest session, and only then does
      // Flipkart dispatch the SMS.
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let session: Record<string, string> = {};
      let lastStatus = 0;
      let lastData: unknown = null;
      let lastDc = dc;
      for (let attempt = 0; attempt < 4; attempt++) {
        const hdrs = { ...baseHeaders, ...session };
        const res = await romeFetch(lastDc, "POST", "/1/action/view", hdrs, body);
        lastDc = res.dc;
        lastStatus = res.status;
        lastData = res.data;
        const S = (res.data as { SESSION?: Record<string, string | undefined> } | null)?.SESSION;
        if (S) {
          const next: Record<string, string> = {};
          if (S.at) next.at = S.at;
          if (S.sn) next.sn = S.sn;
          if (S.vid) next.vid = S.vid;
          if (S.secureToken) next.secureToken = S.secureToken;
          if (Object.keys(next).length) session = next;
        }
        // Defensive: scan the whole payload for a requestId (some response
        // shapes nest it deeper than actionResponseContext).
        let requestId: string | null = null;
        const walk = (value: unknown, depth: number): void => {
          if (requestId || depth > 8 || !value || typeof value !== "object") return;
          if (Array.isArray(value)) {
            value.forEach((v) => walk(v, depth + 1));
            return;
          }
          for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (k.toLowerCase() === "requestid" && typeof v === "string") {
              requestId = v;
              return;
            }
            if (v && typeof v === "object") walk(v, depth + 1);
          }
        };
        walk(res.data, 0);
        if (requestId) {
          return {
            ok: true,
            status: res.status,
            dc: lastDc,
            deviceId,
            visitId,
            userAgent,
            requestId,
            session,
            data: res.data,
          };
        }
        // No requestId yet — back off before the next attempt (the SMS
        // dispatch only happens once the session from this response is
        // presented on a follow-up call).
        if (attempt < 3) await sleep(700 * (attempt + 1));
      }
      // Exhausted retries — surface the last response so the caller can
      // decide (fall back to the mirror stack or show the real error).
      return {
        ok: false,
        status: lastStatus,
        dc: lastDc,
        deviceId,
        visitId,
        userAgent,
        requestId: null,
        session: Object.keys(session).length ? session : null,
        data: lastData,
      };
    }

    // verifyOtp — same payload as the reference client, with the guest
    // session headers captured during sendOtp.
    const sessionHeaders: Record<string, string> = {};
    if (args.sessionAt) sessionHeaders.at = args.sessionAt;
    if (args.sessionSn) sessionHeaders.sn = args.sessionSn;
    if (args.sessionVid) sessionHeaders.vid = args.sessionVid;
    if (args.sessionSecureToken) sessionHeaders.secureToken = args.sessionSecureToken;
    const headers = { ...baseHeaders, ...sessionHeaders };
    const body = {
      actionRequestContext: {
        type: "LOGIN_SHOPSY2",
        loginId: phone,
        loginIdPrefix: "+91",
        password: null,
        otp: (args.otp ?? "").trim(),
        otpRequestId: args.requestId ?? null,
        remainingAttempts: 5,
        phoneNumberFormat: "E164",
        loginType: "MOBILE",
        verificationType: "OTP",
        sourceContext: "DEFAULT",
        churned: false,
        otpRegex: null,
        data: null,
        clientQueryParamMap: null,
      },
    };
    const { dc: newDc, status, data } = await romeFetch(dc, "POST", "/1/action/view", headers, body);
    dc = newDc;
    const anyData = data as {
      SESSION?: {
        at?: string; sn?: string; vid?: string; secureToken?: string; rt?: string;
        isLoggedIn?: boolean; accountId?: string; firstName?: string; lastName?: string; email?: string;
      };
      RESPONSE?: { actionResponseContext?: { authenticationSuccess?: boolean } };
    } | null;
    const S = anyData?.SESSION ?? {};
    const authSuccess = Boolean(anyData?.RESPONSE?.actionResponseContext?.authenticationSuccess);
    return {
      ok: status < 400 && authSuccess,
      status,
      dc,
      deviceId,
      visitId,
      userAgent,
      session: {
        at: S.at ?? null,
        sn: S.sn ?? null,
        vid: S.vid ?? null,
        secureToken: S.secureToken ?? null,
        rt: S.rt ?? null,
        isLoggedIn: Boolean(S.isLoggedIn),
        accountId: S.accountId ?? null,
        name: S.firstName ? `${S.firstName} ${S.lastName ?? ""}`.trim() : null,
        email: S.email ?? null,
      },
      data,
    };
  },
});

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Whether a Flipkart session is available — from env creds or a stored real
 * session. Cheap (no network) — lets the UI show "connected to Flipkart".
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
// Proxy (data endpoints)
// ---------------------------------------------------------------------------

type StoredSession = {
  phone: string;
  accessToken?: string;
  refreshToken?: string;
  sn?: string;
  vid?: string;
  secureToken?: string;
  cookies?: string;
  apiKey?: string;
  deviceId: string;
  visitId?: string;
  dcId?: string;
  userAgent: string;
};

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
  // Explicit return annotation breaks the module self-reference cycle (this
  // action queries getSessionByPhone/getLatestActiveSession from this module).
  handler: async (
    ctx,
    { method, path, body, phone },
  ): Promise<
    | { configured: false }
    | {
        configured: true;
        status: number;
        ok: boolean;
        data?: unknown;
        error?: string;
        endpoint: string;
        method: string;
        dc?: string;
        session: { phone?: string } | null;
      }
  > => {
    const envAccess = (process.env.FLIPKART_ACCESS_TOKEN ?? "").trim();
    const envRefresh = (process.env.FLIPKART_REFRESH_TOKEN ?? "").trim();
    const envApiKey = (process.env.FLIPKART_X_GOOGLE_API_KEY ?? "").trim();
    const envCookies = (process.env.FLIPKART_SESSION_COOKIES ?? "").trim();

    let sessionPhone: string | undefined;
    let dc = DEFAULT_DC;
    let cookies: string[] = [];
    let apiKey = envApiKey;
    let deviceId: string | undefined;
    let visitId: string | undefined;
    let userAgent = fkuaUserAgent("device");

    // Resolve credentials: stored session (phone arg) → latest stored active
    // session → env vars → none.
    const stored = (phone
      ? ((await ctx.runQuery(api.flipkartProxy.getSessionByPhone, {
          phone: phone.replace(/\D/g, ""),
        })) as StoredSession | null)
      : null) ?? ((await ctx.runQuery(api.flipkartProxy.getLatestActiveSession, {})) as StoredSession | null);

    if (stored) {
      sessionPhone = stored.phone;
      dc = stored.dcId ?? DEFAULT_DC;
      deviceId = stored.deviceId;
      visitId = stored.visitId ?? newVisitId();
      userAgent = stored.userAgent || fkuaUserAgent(stored.deviceId);
      if (stored.cookies) {
        cookies.push(stored.cookies);
      } else {
        if (stored.accessToken) cookies.push(`at=${stored.accessToken}`);
        if (stored.sn) cookies.push(`sn=${stored.sn}`);
        if (stored.vid) cookies.push(`vid=${stored.vid}`);
        if (stored.secureToken) cookies.push(`secureToken=${stored.secureToken}`);
        if (stored.refreshToken) cookies.push(`rt=${stored.refreshToken}`);
      }
      if (stored.apiKey) apiKey = stored.apiKey;
      await ctx
        .runMutation(api.flipkartProxy.touchSession, { phone: sessionPhone })
        .catch(() => undefined);
    }

    if (cookies.length === 0 && envCookies) cookies.push(envCookies);
    if (cookies.length === 0 && !stored) {
      if (envAccess) cookies.push(`at=${envAccess}`);
      if (envRefresh) cookies.push(`rt=${envRefresh}`);
    }

    // Nothing available → mirror mode.
    if (cookies.length === 0 && !apiKey) {
      return { configured: false as const };
    }

    const headers: Record<string, string> = {
      "content-type": "application/json; charset=UTF-8",
      "user-agent": userAgent,
      "x-user-agent": userAgent,
      "x-platform": "web",
      "fk-tenant-id": "SHOPSY",
      business: "reseller",
      "x-newrelic-id": NEWRELIC_ID,
      "x-device-width": "1080",
      "x-device-height": "1920",
      accept: "application/json, text/plain, */*",
      "accept-language": "en-IN,en;q=0.9",
      origin: "https://www.flipkart.com",
      referer: "https://www.flipkart.com/",
    };
    if (deviceId) headers["x-device-id"] = deviceId;
    if (visitId) headers["x-visit-id"] = visitId;
    if (apiKey) headers["x-goog-api-key"] = apiKey;
    if (cookies.length) headers.cookie = cookies.join("; ");

    try {
      const { dc: finalDc, status, data } = await romeFetch(
        dc,
        method,
        path.startsWith("/") ? path : `/${path}`,
        headers,
        body,
      );
      return {
        configured: true as const,
        status,
        ok: status < 400,
        data,
        endpoint: path,
        method,
        dc: finalDc,
        session: { phone: sessionPhone },
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
