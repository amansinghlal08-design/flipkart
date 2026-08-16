import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

/**
 * Server-side proxy to the real Flipkart API (2.rome.api.flipkart.com),
 * ported from the working reference client:
 *
 *  - Random device pool (brand/model/Android version/build/app version) so
 *    every session presents a fresh, plausible FKUA device fingerprint.
 *  - Guest-session bootstrap via `POST /api/1/connekt/push/callback`
 *    (TICKLE) which returns a guest `at` token — the same trick the
 *    reference client uses before any authenticated call.
 *  - Cookie capture & replay: every response's Set-Cookie is merged into a
 *    session cookie jar and replayed on the next request.
 *  - Rome DC routing: a 406 `ERROR_CODE 2000` response names the datacenter
 *    to retry on; we follow it (max 3 hops).
 *  - Retry with backoff on 5xx / network errors (like the client's `_request`).
 *
 * Two credential surfaces:
 *  1. REAL DEVICE SESSION (web flow — no API key needed): OTP send/verify via
 *     POST /1/action/view, tokens stored per-phone in `flipkartSessions`.
 *  2. STATIC ENV CREDS: FLIPKART_ACCESS_TOKEN / REFRESH_TOKEN /
 *     X_GOOGLE_API_KEY / SESSION_COOKIES / BASE_URL.
 *
 * When nothing is configured the actions return { configured: false } so
 * callers fall back to the in-app mirror.
 */

const DEFAULT_DC = "2";
const NEWRELIC_ID = "VwEHU1dSCxABUVlaAHU1UA";

// ---------------------------------------------------------------------------
// Device pool (from the reference client)
// ---------------------------------------------------------------------------

const BRANDS_MODELS: Record<string, string[]> = {
  samsung: ["SM-S918B", "SM-S911B", "SM-A546B", "SM-A346B", "SM-A256B", "SM-F946B", "SM-N986B", "SM-G998B", "SM-A736B", "SM-M536B"],
  Google: ["Pixel 8 Pro", "Pixel 8", "Pixel 7 Pro", "Pixel 7", "Pixel 6 Pro", "Pixel 6"],
  OnePlus: ["OnePlus 12", "OnePlus 11", "OnePlus 10 Pro", "OnePlus 9 Pro", "OnePlus 8T", "OnePlus Nord 3"],
  Xiaomi: ["Xiaomi 13 Pro", "Xiaomi 13", "Redmi Note 12 Pro", "Redmi Note 11 Pro", "Poco F5", "Poco X5 Pro"],
  OPPO: ["Find X6 Pro", "Find X5 Pro", "Reno 10 Pro", "Reno 9 Pro", "Reno 8 Pro"],
  Vivo: ["X90 Pro", "X80 Pro", "V27 Pro", "V25 Pro", "V23 Pro"],
  Realme: ["GT Neo 5", "GT Neo 3", "GT 2 Pro", "Realme 10 Pro", "Realme 9 Pro"],
  Motorola: ["Moto Edge 40 Pro", "Moto Edge 30 Pro", "Moto G84", "Moto G73"],
  Nothing: ["Nothing Phone (2)", "Nothing Phone (1)"],
  Asus: ["Zenfone 10", "Zenfone 9", "ROG Phone 7", "ROG Phone 6"],
};
const ANDROID_VERSIONS = ["12", "13", "14", "15"];
const BUILD_BASE: Record<string, string> = {
  "12": "SP1A.210812.016",
  "13": "TP1A.220624.014",
  "14": "UP1A.231005.007",
  "15": "AP4A.240305.003",
};
const BUILD_SUFFIXES = ["", ".A1", ".B1", ".C1", ".D1"];
const APP_VERSIONS = ["2291175", "2291176", "2291177", "2291178", "2291179"];
const SCREEN_WIDTHS = [1080, 1440, 720, 2340, 2400, 1280];
const SCREEN_HEIGHTS = [1920, 2560, 1600, 1080, 2960, 2772];
const LANGUAGES = ["en-IN,en;q=0.9", "en-US,en;q=0.9", "hi-IN,en;q=0.8", "en-GB,en;q=0.9"];

type DeviceProfile = {
  brand: string;
  model: string;
  os_version: string;
  build: string;
  app_version: string;
  screen_width: number;
  screen_height: number;
  language: string;
};

function pickDevice(): DeviceProfile {
  const brands = Object.keys(BRANDS_MODELS);
  const brand = brands[Math.floor(Math.random() * brands.length)];
  const models = BRANDS_MODELS[brand];
  const model = models[Math.floor(Math.random() * models.length)];
  const os_version = ANDROID_VERSIONS[Math.floor(Math.random() * ANDROID_VERSIONS.length)];
  const build =
    BUILD_BASE[os_version] +
    BUILD_SUFFIXES[Math.floor(Math.random() * BUILD_SUFFIXES.length)];
  const app_version = APP_VERSIONS[Math.floor(Math.random() * APP_VERSIONS.length)];
  return {
    brand,
    model,
    os_version,
    build,
    app_version,
    screen_width: SCREEN_WIDTHS[Math.floor(Math.random() * SCREEN_WIDTHS.length)],
    screen_height: SCREEN_HEIGHTS[Math.floor(Math.random() * SCREEN_HEIGHTS.length)],
    language: LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)],
  };
}

function fkuaUserAgent(device: DeviceProfile, deviceId: string): string {
  return (
    `Mozilla/5.0 (Linux; Android ${device.os_version}; ${device.model} Build/${device.build}) ` +
    `FKUA/Retail/${device.app_version}/Android/Mobile ` +
    `(${device.brand}/${device.model}/${deviceId})`
  );
}

function parseDeviceProfile(json: string | undefined | null): DeviceProfile | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as DeviceProfile;
    if (d && d.model && d.brand) return d;
    return null;
  } catch {
    return null;
  }
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

/** Merge a Set-Cookie value into a cookie jar (name=value pairs). */
function mergeCookie(jar: string[], setCookie: string): void {
  const first = setCookie.split(";")[0].trim();
  if (!first || !first.includes("=")) return;
  const name = first.split("=")[0].trim();
  const idx = jar.findIndex((c) => c.startsWith(`${name}=`));
  if (idx >= 0) jar[idx] = first;
  else jar.push(first);
}

/**
 * Rome request with cookie jar + DC-change (406 ERROR_CODE 2000) dance.
 * Returns the merged cookie jar so callers can persist new cookies.
 */
async function romeFetch(
  startDc: string,
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: unknown,
  jar: string[] = [],
): Promise<{ dc: string; status: number; data: unknown; jar: string[] }> {
  let dc = startDc || DEFAULT_DC;
  for (let hop = 0; hop < 4; hop++) {
    const url = `https://${dc}.rome.api.flipkart.com${path}`;
    const hdrs: Record<string, string> = { ...headers };
    if (jar.length) hdrs.cookie = jar.join("; ");
    const res = await fetch(url, {
      method,
      headers: hdrs,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12000),
    });
    // Capture cookies from this response.
    try {
      const setCookies = res.headers.getSetCookie?.() ?? [];
      for (const sc of setCookies) mergeCookie(jar, sc);
    } catch {
      // getSetCookie unavailable — ignore
    }
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
    return { dc, status: res.status, data, jar };
  }
  return { dc, status: 0, data: null, jar };
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
    deviceProfile: v.optional(v.string()),
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
      deviceProfile: args.deviceProfile ?? existing?.deviceProfile,
      visitId: args.visitId ?? existing?.visitId ?? newVisitId(),
      dcId: args.dcId ?? existing?.dcId ?? DEFAULT_DC,
      sessionId: args.sessionId ?? existing?.sessionId ?? newSessionId(),
      userAgent: args.userAgent ?? existing?.userAgent,
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
      userAgent: fields.userAgent ?? fkuaUserAgent(
        parseDeviceProfile(fields.deviceProfile) ?? pickDevice(),
        fields.deviceId,
      ),
      createdAt: now,
    });
    return { _id, created: true as const, ...fields };
  },
});

/** Update the cookie jar for a session (captured from upstream responses). */
export const updateSessionCookies = mutation({
  args: {
    phone: v.string(),
    cookies: v.string(),
    dcId: v.optional(v.string()),
  },
  handler: async (ctx, { phone, cookies, dcId }) => {
    const existing = await ctx.db
      .query("flipkartSessions")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        cookies,
        ...(dcId ? { dcId } : {}),
        lastUsedAt: Date.now(),
      });
    }
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
 * sendOtp is TWO-PHASE, exactly like the working reference client:
 *  1. Guest-session bootstrap via connekt TICKLE (T cookie + TICKLE payload).
 *  2. Action/view retries carry the guest session headers — Flipkart only
 *     dispatches the SMS (returns a requestId) once those are present.
 */
export const flipkartAuth = action({
  args: {
    step: v.string(), // "sendOtp" | "verifyOtp"
    phone: v.string(),
    otp: v.optional(v.string()),
    requestId: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    deviceProfile: v.optional(v.string()),
    visitId: v.optional(v.string()),
    dcId: v.optional(v.string()),
    // guest session captured during sendOtp — required for verifyOtp
    sessionAt: v.optional(v.string()),
    sessionSn: v.optional(v.string()),
    sessionVid: v.optional(v.string()),
    sessionSecureToken: v.optional(v.string()),
    sessionCookies: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const phone = args.phone.replace(/\D/g, "");
    const deviceId = args.deviceId ?? newDeviceId();
    const device = parseDeviceProfile(args.deviceProfile) ?? pickDevice();
    const visitId = args.visitId ?? newVisitId();
    const userAgent = fkuaUserAgent(device, deviceId);
    const deviceProfileJson = JSON.stringify(device);
    const cookieJar: string[] = [];

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
      "x-device-width": String(device.screen_width),
      "x-device-height": String(device.screen_height),
      accept: "*/*",
      "accept-language": device.language,
      origin: "https://www.flipkart.com",
      referer: "https://www.flipkart.com/",
    };
    // T cookie must be present before the first request (reference client).
    cookieJar.push(`T=${tCookie()}`);
    let dc = args.dcId ?? DEFAULT_DC;

    // Phase 0 — guest-session bootstrap (connekt TICKLE). Non-fatal.
    try {
      const tickle = await romeFetch(
        dc,
        "POST",
        "/api/1/connekt/push/callback",
        baseHeaders,
        {
          type: "PN",
          eventType: "TICKLE",
          cargo: JSON.stringify({ permissionStatus: "default" }),
        },
        cookieJar,
      );
      dc = tickle.dc;
      const S = (tickle.data as { SESSION?: Record<string, string | undefined> } | null)?.SESSION;
      if (S?.at) {
        if (S.at) cookieJar.push(`at=${S.at}`);
        if (S.sn) cookieJar.push(`sn=${S.sn}`);
        if (S.vid) cookieJar.push(`vid=${S.vid}`);
        if (S.secureToken) cookieJar.push(`secureToken=${S.secureToken}`);
      }
    } catch {
      // bootstrap failure is non-critical — the action/view loop may still work
    }

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
      // Retry with backoff — each attempt carries the guest session cookies
      // captured from the previous response, exactly like the client.
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let lastStatus = 0;
      let lastData: unknown = null;
      let lastDc = dc;
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await romeFetch(lastDc, "POST", "/1/action/view", baseHeaders, body, cookieJar);
        lastDc = res.dc;
        lastStatus = res.status;
        lastData = res.data;
        const S = (res.data as { SESSION?: Record<string, string | undefined> } | null)?.SESSION;
        if (S) {
          if (S.at) cookieJar.push(`at=${S.at}`);
          if (S.sn) cookieJar.push(`sn=${S.sn}`);
          if (S.vid) cookieJar.push(`vid=${S.vid}`);
          if (S.secureToken) cookieJar.push(`secureToken=${S.secureToken}`);
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
            deviceProfile: deviceProfileJson,
            visitId,
            userAgent,
            requestId,
            cookies: cookieJar.join("; "),
            data: res.data,
          };
        }
        if (attempt < 3) await sleep(700 * (attempt + 1));
      }
      return {
        ok: false,
        status: lastStatus,
        dc: lastDc,
        deviceId,
        deviceProfile: deviceProfileJson,
        visitId,
        userAgent,
        requestId: null,
        cookies: cookieJar.length ? cookieJar.join("; ") : null,
        data: lastData,
      };
    }

    // verifyOtp — same payload as the reference client, with the guest
    // session cookies captured during sendOtp.
    if (args.sessionCookies) {
      for (const c of args.sessionCookies.split(";")) {
        const t = c.trim();
        if (t.includes("=") && !cookieJar.includes(t)) cookieJar.push(t);
      }
    }
    if (args.sessionAt) cookieJar.push(`at=${args.sessionAt}`);
    if (args.sessionSn) cookieJar.push(`sn=${args.sessionSn}`);
    if (args.sessionVid) cookieJar.push(`vid=${args.sessionVid}`);
    if (args.sessionSecureToken) cookieJar.push(`secureToken=${args.sessionSecureToken}`);
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
    const { dc: newDc, status, data } = await romeFetch(dc, "POST", "/1/action/view", baseHeaders, body, cookieJar);
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
      deviceProfile: deviceProfileJson,
      visitId,
      userAgent,
      cookies: cookieJar.length ? cookieJar.join("; ") : null,
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

export const flipkartStatus = action({
  args: {},
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
  deviceProfile?: string;
  visitId?: string;
  dcId?: string;
  userAgent: string;
};

/**
 * Resolve credentials: stored session (phone arg) → latest stored active
 * session → env vars. Builds the device-consistent header surface (FKUA UA,
 * device dims, at/sn/vid/secureToken as headers AND cookies).
 */
// Internal helper — ctx is the Convex action ctx (runQuery/runMutation).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveSession(
  ctx: any,
  phone?: string,
): Promise<{
  configured: boolean;
  sessionPhone?: string;
  dc: string;
  jar: string[];
  apiKey: string;
  deviceId?: string;
  visitId?: string;
  userAgent: string;
  stored?: StoredSession;
}> {
  const envAccess = (process.env.FLIPKART_ACCESS_TOKEN ?? "").trim();
  const envRefresh = (process.env.FLIPKART_REFRESH_TOKEN ?? "").trim();
  const envApiKey = (process.env.FLIPKART_X_GOOGLE_API_KEY ?? "").trim();
  const envCookies = (process.env.FLIPKART_SESSION_COOKIES ?? "").trim();

  const jar: string[] = [];
  let apiKey = envApiKey;
  let stored: StoredSession | null = null;

  const storedRow = (phone
    ? ((await ctx.runQuery(api.flipkartProxy.getSessionByPhone, {
        phone: phone.replace(/\D/g, ""),
      })) as StoredSession | null)
    : null) ?? ((await ctx.runQuery(api.flipkartProxy.getLatestActiveSession, {})) as StoredSession | null);
  if (storedRow) stored = storedRow;

  const device = parseDeviceProfile(stored?.deviceProfile) ?? pickDevice();
  const deviceId = stored?.deviceId ?? newDeviceId();
  const visitId = stored?.visitId ?? newVisitId();
  const userAgent = stored?.userAgent || fkuaUserAgent(device, deviceId);

  if (stored) {
    if (stored.cookies) {
      for (const c of stored.cookies.split(";")) {
        const t = c.trim();
        if (t.includes("=")) jar.push(t);
      }
    }
    if (stored.accessToken && !jar.some((c) => c.startsWith("at="))) jar.push(`at=${stored.accessToken}`);
    if (stored.sn && !jar.some((c) => c.startsWith("sn="))) jar.push(`sn=${stored.sn}`);
    if (stored.vid && !jar.some((c) => c.startsWith("vid="))) jar.push(`vid=${stored.vid}`);
    if (stored.secureToken && !jar.some((c) => c.startsWith("secureToken="))) jar.push(`secureToken=${stored.secureToken}`);
    if (stored.refreshToken && !jar.some((c) => c.startsWith("rt="))) jar.push(`rt=${stored.refreshToken}`);
    if (stored.apiKey) apiKey = stored.apiKey;
  }

  if (jar.length === 0 && envCookies) {
    for (const c of envCookies.split(";")) {
      const t = c.trim();
      if (t.includes("=")) jar.push(t);
    }
  }
  if (jar.length === 0 && !stored) {
    if (envAccess) jar.push(`at=${envAccess}`);
    if (envRefresh) jar.push(`rt=${envRefresh}`);
  }
  if (jar.length === 0 && !apiKey && !stored) {
    return { configured: false, dc: DEFAULT_DC, jar, apiKey, userAgent };
  }

  return {
    configured: true,
    sessionPhone: stored?.phone,
    dc: stored?.dcId ?? DEFAULT_DC,
    jar,
    apiKey,
    deviceId,
    visitId,
    userAgent,
    stored: stored ?? undefined,
  };
}

export const proxyFlipkart = action({
  args: {
    method: v.string(),
    path: v.string(), // e.g. "/api/4/page/fetch?cacheFirst=false"
    body: v.optional(v.any()),
    phone: v.optional(v.string()), // prefer this account's stored real session
  },
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
    const resolved = await resolveSession(ctx, phone);
    if (!resolved.configured) return { configured: false as const };

    const headers: Record<string, string> = {
      "content-type": "application/json; charset=UTF-8",
      "user-agent": resolved.userAgent,
      "x-user-agent": resolved.userAgent,
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
    if (resolved.deviceId) headers["x-device-id"] = resolved.deviceId;
    if (resolved.visitId) headers["x-visit-id"] = resolved.visitId;
    if (resolved.apiKey) headers["x-goog-api-key"] = resolved.apiKey;
    // Session tokens as headers (reference client sends them both ways).
    for (const c of resolved.jar) {
      const [k, v] = c.split("=") as [string, string];
      if (["at", "sn", "vid", "secureToken", "rt"].includes(k) && v) {
        headers[k] = v;
      }
    }

    // Retry with backoff on 5xx / network errors (reference client behavior).
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let last: { dc: string; status: number; data: unknown; jar: string[] } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await romeFetch(
          resolved.dc,
          method,
          path.startsWith("/") ? path : `/${path}`,
          headers,
          body,
          [...resolved.jar],
        );
        last = res;
        if (res.status < 500) break;
      } catch {
        // network error — retry
      }
      if (attempt < 2) await sleep(600 * (attempt + 1));
    }
    if (!last) {
      return {
        configured: true as const,
        status: 0,
        ok: false,
        error: "flipkart_unreachable",
        endpoint: path,
        method,
        session: null,
      };
    }

    // Persist any new cookies captured from upstream.
    const newCookies = last.jar.filter((c) => !resolved.jar.includes(c));
    if (newCookies.length && resolved.sessionPhone && resolved.stored) {
      await ctx
        .runMutation(api.flipkartProxy.updateSessionCookies, {
          phone: resolved.sessionPhone,
          cookies: last.jar.join("; "),
          dcId: last.dc,
        })
        .catch(() => undefined);
    }

    return {
      configured: true as const,
      status: last.status,
      ok: last.status < 400,
      data: last.data,
      endpoint: path,
      method,
      dc: last.dc,
      session: { phone: resolved.sessionPhone },
    };
  },
});

// ---------------------------------------------------------------------------
// Working commerce methods (page/fetch based — reference client)
// ---------------------------------------------------------------------------

function pageFetchBody(pageUri: string, pincode: string, marketplace = "HYPERLOCAL") {
  return {
    pageUri,
    pageContext: {
      pageHashKey: null,
      slotContextMap: null,
      paginationContextMap: null,
      stateInfoMap: null,
      slotIdInfoMap: null,
      paginatedFetch: false,
      pageNumber: 1,
      fetchAllPages: false,
      networkSpeed: 3000,
      trackingContext: null,
      fetchSeoData: false,
    },
    partnerContext: null,
    locationContext: { pincode, marketplace },
    requestContext: null,
  };
}

/**
 * Extract product cards from a page/fetch RESPONSE and normalize them into
 * the app's product shape ({ id, name, brand, unit, price, mrp, rating,
 * image, badges }). Tolerant of the many widget shapes Flipkart returns.
 */
function extractProducts(payload: unknown): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  const deep = (v: unknown, key: string): unknown => {
    if (Array.isArray(v)) return v.find((x) => deep(x, key) !== undefined) ?? undefined;
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (k.toLowerCase().replace(/[^a-z]/g, "") === key) return val;
        const r = deep(val, key);
        if (r !== undefined) return r;
      }
    }
    return undefined;
  };

  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const num = (v: unknown): number | undefined => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/[^\d.]/g, ""));
      return Number.isFinite(n) ? n : undefined;
    }
    if (v && typeof v === "object") {
      const rec = v as Record<string, unknown>;
      return num(rec.value ?? rec.defaultValue ?? rec.amount ?? rec.raw ?? rec.display);
    }
    return undefined;
  };

  const normalize = (raw: Record<string, unknown>): void => {
    const title = str(raw.title ?? raw.name ?? raw.productName ?? deep(raw, "title"));
    const price = num(raw.price ?? raw.offerPrice ?? deep(raw, "price"));
    const mrp =
      num(raw.mrp ?? deep(raw, "mrp")) ??
      num((raw as Record<string, unknown>).priceInfo ? deep(raw, "mrp") : undefined) ??
      price;
    const id = str(raw.productId ?? raw.listingId ?? raw.id ?? raw.pid ?? deep(raw, "productid")) ||
      String(Math.random()).slice(2);
    if (!title || price === undefined) return;
    if (seen.has(id)) return;
    seen.add(id);
    const image =
      str(raw.image ?? raw.imageUrl ?? deep(raw, "imageurl")) ||
      str(raw.imageInfo ? deep(raw, "url") : "") ||
      "";
    out.push({
      id,
      name: title.replace(/\s*[—–-]\s*.*$/, "").trim() || title,
      brand: str(raw.brand ?? raw.sellerName ?? ""),
      unit: str(raw.unit ?? raw.weight ?? raw.packSize ?? ""),
      price,
      mrp: mrp ?? price,
      rating: num(raw.rating ?? deep(raw, "rating")) ?? 0,
      ratingCount: num(raw.ratingCount ?? deep(raw, "ratingcount")) ?? 0,
      image,
      badges: Array.isArray(raw.badges) ? raw.badges : [],
      listingId: str(raw.listingId ?? deep(raw, "listingid")) || undefined,
    });
  };

  const walk = (value: unknown, depth: number): void => {
    if (depth > 12 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((v) => walk(v, depth + 1));
      return;
    }
    const rec = value as Record<string, unknown>;
    if (
      (typeof rec.title === "string" || typeof rec.name === "string" || typeof rec.productName === "string") &&
      (rec.price !== undefined || rec.offerPrice !== undefined || rec.priceInfo !== undefined)
    ) {
      normalize(rec);
      return;
    }
    for (const v of Object.values(rec)) {
      if (v && typeof v === "object") walk(v, depth + 1);
    }
  };

  const slots = (payload as { RESPONSE?: { pageResponse?: { slots?: unknown[] } } })
    ?.RESPONSE?.pageResponse?.slots;
  if (Array.isArray(slots)) {
    for (const slot of slots) {
      const w = (slot as { widget?: { data?: unknown } })?.widget?.data;
      if (w) walk(w, 0);
    }
  }
  // Fallback: some responses nest products directly under RESPONSE.
  if (out.length === 0) walk(payload, 0);
  return out;
}

/** Real search via POST /4/page/fetch (the reference client's working path). */
export const flipkartSearch = action({
  args: {
    query: v.string(),
    pincode: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { query, pincode, phone },
  ): Promise<
    | { configured: false }
    | { configured: true; ok: boolean; status: number; products: unknown[]; raw?: unknown }
  > => {
    const resolved = await resolveSession(ctx, phone);
    if (!resolved.configured) return { configured: false as const };
    const body = pageFetchBody(
      `/search?q=${encodeURIComponent(query)}&marketplace=HYPERLOCAL`,
      pincode || "226001",
    );
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=UTF-8",
      "user-agent": resolved.userAgent,
      "x-user-agent": resolved.userAgent,
      "x-platform": "web",
      "fk-tenant-id": "SHOPSY",
      business: "reseller",
      "x-newrelic-id": NEWRELIC_ID,
      accept: "*/*",
      origin: "https://www.flipkart.com",
      referer: "https://www.flipkart.com/",
    };
    if (resolved.deviceId) headers["x-device-id"] = resolved.deviceId;
    if (resolved.visitId) headers["x-visit-id"] = resolved.visitId;
    for (const c of resolved.jar) {
      const [k, v] = c.split("=") as [string, string];
      if (["at", "sn", "vid", "secureToken", "rt"].includes(k) && v) headers[k] = v;
    }
    const res = await romeFetch(resolved.dc, "POST", "/4/page/fetch", headers, body, [...resolved.jar]);
    return {
      configured: true as const,
      ok: res.status < 400,
      status: res.status,
      products: res.status < 400 ? extractProducts(res.data) : [],
      raw: res.data,
    };
  },
});

/** Real product details via POST /4/page/fetch. */
export const flipkartProduct = action({
  args: {
    productId: v.string(),
    pincode: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { productId, pincode, phone },
  ): Promise<
    | { configured: false }
    | { configured: true; ok: boolean; status: number; products: unknown[]; raw?: unknown }
  > => {
    const resolved = await resolveSession(ctx, phone);
    if (!resolved.configured) return { configured: false as const };
    const body = pageFetchBody(
      `/product/${productId}?marketplace=HYPERLOCAL`,
      pincode || "226001",
    );
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=UTF-8",
      "user-agent": resolved.userAgent,
      "x-user-agent": resolved.userAgent,
      "x-platform": "web",
      "fk-tenant-id": "SHOPSY",
      business: "reseller",
      "x-newrelic-id": NEWRELIC_ID,
      accept: "*/*",
      origin: "https://www.flipkart.com",
      referer: "https://www.flipkart.com/",
    };
    if (resolved.deviceId) headers["x-device-id"] = resolved.deviceId;
    if (resolved.visitId) headers["x-visit-id"] = resolved.visitId;
    for (const c of resolved.jar) {
      const [k, v] = c.split("=") as [string, string];
      if (["at", "sn", "vid", "secureToken", "rt"].includes(k) && v) headers[k] = v;
    }
    const res = await romeFetch(resolved.dc, "POST", "/4/page/fetch", headers, body, [...resolved.jar]);
    return {
      configured: true as const,
      ok: res.status < 400,
      status: res.status,
      products: res.status < 400 ? extractProducts(res.data) : [],
      raw: res.data,
    };
  },
});

/**
 * Real add-to-cart via PUT /api/5/cart/browse with listingId (most reliable)
 * then productId fallback — the reference client's order of operations.
 */
export const flipkartCartAdd = action({
  args: {
    productId: v.optional(v.string()),
    listingId: v.optional(v.string()),
    quantity: v.optional(v.number()),
    pincode: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { productId, listingId, quantity, pincode, phone },
  ): Promise<
    | { configured: false }
    | { configured: true; ok: boolean; status: number; data?: unknown; error?: string }
  > => {
    const resolved = await resolveSession(ctx, phone);
    if (!resolved.configured) return { configured: false as const };
    const qty = quantity ?? 1;
    const loc = { pincode: pincode || "226001", marketplace: "HYPERLOCAL" };
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=UTF-8",
      "user-agent": resolved.userAgent,
      "x-user-agent": resolved.userAgent,
      "x-platform": "web",
      "fk-tenant-id": "SHOPSY",
      business: "reseller",
      "x-newrelic-id": NEWRELIC_ID,
      accept: "*/*",
      origin: "https://www.flipkart.com",
      referer: "https://www.flipkart.com/",
    };
    if (resolved.deviceId) headers["x-device-id"] = resolved.deviceId;
    if (resolved.visitId) headers["x-visit-id"] = resolved.visitId;
    for (const c of resolved.jar) {
      const [k, v] = c.split("=") as [string, string];
      if (["at", "sn", "vid", "secureToken", "rt"].includes(k) && v) headers[k] = v;
    }

    // 1. listingId (most reliable)
    if (listingId) {
      const res = await romeFetch(
        resolved.dc,
        "PUT",
        "/api/5/cart/browse",
        headers,
        { listingId, quantity: qty, locationContext: loc },
        [...resolved.jar],
      );
      if (res.status < 400) return { configured: true as const, ok: true, status: res.status, data: res.data };
    }
    // 2. productId fallback
    if (productId) {
      const res = await romeFetch(
        resolved.dc,
        "PUT",
        "/api/5/cart/browse",
        headers,
        { productId, quantity: qty, locationContext: loc },
        [...resolved.jar],
      );
      if (res.status < 400) return { configured: true as const, ok: true, status: res.status, data: res.data };
    }
    return {
      configured: true as const,
      ok: false,
      status: 0,
      error: "add_to_cart_failed",
    };
  },
});
