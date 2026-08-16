import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { Activity, Loader2, Play, RefreshCw, TerminalSquare } from "lucide-react";
import { api } from "@/convex/_generated/api";
import {
  API_CATEGORIES,
  API_ENDPOINTS,
  API_STATS,
  type ApiEndpoint,
} from "@/lib/api-endpoints";
import { api as apiClient, useApiResource } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-neutral-900 text-white",
  POST: "bg-neutral-200 text-neutral-900",
  DELETE: "border border-neutral-300 text-neutral-600",
};

type CallResult = {
  status: number | null;
  body?: unknown;
  error?: string;
  headers?: Record<string, string>;
};

const INTERESTING_HEADERS = [
  "x-request-id",
  "x-bifrost-request-id",
  "x-ruk-backend",
  "x-payload-length",
  "etag",
  "cache-control",
  "content-security-policy",
  "strict-transport-security",
  "timing-allow-origin",
  "access-control-allow-origin",
];

const CAPTURE_KEYS = [
  { kind: "Token", keys: "x-goog-api-key · x-session-id" },
  { kind: "Auth cookies", keys: "at · rt · ULSN · T · SN · ud · vd · S" },
  { kind: "Browser", keys: "vh · vw · dpr · fonts-loaded · h2NetworkBandwidth" },
  { kind: "Tracking", keys: "K-ACTION · AMCV_… · s_sq · ak_bmsc · bm_sv" },
];

export default function ApiExplorer() {
  const products = useQuery(api.products.listProducts, {});
  const orders = useQuery(api.orders.listOrders);

  const sampleProductId = products?.[0]?._id;
  const sampleOrderId = orders?.[0]?._id;

  const [category, setCategory] = useState<string | null>(null);
  const [capturedFilter, setCapturedFilter] = useState<"all" | "captured" | "missing">(
    "all",
  );
  const [openId, setOpenId] = useState<number | null>(null);
  const [callingId, setCallingId] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, CallResult>>({});
  const [feedTick, setFeedTick] = useState(0);

  const feed = useApiResource(
    useCallback(() => apiClient.recentEvents(10), [feedTick]),
    undefined,
  );

  const endpoints = useMemo(
    () =>
      API_ENDPOINTS.filter(
        (e) =>
          (category === null || e.category === category) &&
          (capturedFilter === "all" ||
            (capturedFilter === "captured" ? e.captured : !e.captured)),
      ).sort((a, b) => a.id - b.id),
    [category, capturedFilter],
  );

  const resolveId = (ep: ApiEndpoint): string | null => {
    if (!ep.livePath?.includes("{id}")) return null;
    if (ep.category === "Tracking" || ep.category === "Returns" || ep.category === "Cancellation") {
      return sampleOrderId ?? null;
    }
    return sampleProductId ?? null;
  };

  const tryEndpoint = async (ep: ApiEndpoint) => {
    const sample = resolveId(ep);
    if (ep.livePath?.includes("{id}") && !sample) {
      setResults((r) => ({
        ...r,
        [ep.id]: {
          status: null,
          error:
            "No sample id available. Sign in and place an order, then retry.",
        },
      }));
      setOpenId(ep.id);
      return;
    }

    setCallingId(ep.id);
    setOpenId(ep.id);
    try {
      let path = ep.livePath!;
      if (sample) {
        path = path.replace("{id}", sample);
      }
      const bodyObj = ep.sampleBody
        ? Object.fromEntries(
            Object.entries(ep.sampleBody).map(([key, value]) => [
              key,
              typeof value === "string" ? value.replace("{id}", sample ?? "") : value,
            ]),
          )
        : undefined;
      const res = await fetch(`${CONVEX_URL}${path}`, {
        method: ep.method,
        headers: bodyObj ? { "Content-Type": "application/json" } : undefined,
        body: ep.method === "GET" ? undefined : JSON.stringify(bodyObj ?? {}),
      });
      const body = await res.json().catch(() => ({}));
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });
      setResults((r) => ({ ...r, [ep.id]: { status: res.status, body, headers } }));
    } catch (error) {
      setResults((r) => ({
        ...r,
        [ep.id]: {
          status: null,
          error: error instanceof Error ? error.message : "Request failed.",
        },
      }));
    } finally {
      setCallingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="border-b border-neutral-200 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
          Developer
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          API reference
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">
          The complete endpoint surface this store is built on — every row from
          the request capture. Live endpoints are served by the in-app REST
          gateway at{" "}
          <span className="break-all font-mono text-[12px] text-neutral-700">
            {CONVEX_URL}
          </span>{" "}
          and return real data. Session-scoped rows are performed by the
          signed-in web app; UI rows map to their equivalent app routes.
        </p>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Endpoints", value: API_STATS.total },
          { label: "Captured", value: API_STATS.captured },
          { label: "Missing (now built)", value: API_STATS.missing },
          { label: "Recorded calls", value: API_STATS.calls },
          { label: "Live in this build", value: API_STATS.live },
          { label: "Session-scoped", value: API_STATS.session },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-neutral-200 p-4">
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-900">
              {value}
            </p>
            <p className="mt-1 text-[12px] leading-4 text-neutral-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Live telemetry feed */}
      <section className="mt-10 overflow-hidden rounded-2xl border border-neutral-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Activity className="h-4 w-4 text-neutral-400" />
              Live event feed
            </h2>
            <p className="mt-0.5 text-[12px] leading-5 text-neutral-500">
              Events persisted by the collector (POST /api/v2/analytics/events) —
              the web app fires these as you browse, add to cart and buy.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFeedTick((t) => t + 1)}
            className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-3.5 py-1.5 text-[13px] font-medium text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", feed.source === "api" && feedTick > 0 && "animate-spin")}
            />
            Refresh
          </button>
        </div>
        <div className="max-h-80 overflow-auto">
          {(feed.data ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-neutral-500">
              No events yet — browse the storefront and they'll appear here.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {(feed.data ?? []).map((event) => (
                <li key={event._id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 shrink-0 rounded bg-neutral-900 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                    {event.event}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12px] text-neutral-700">
                      {event.path ?? "—"}
                    </p>
                    {event.props && (
                      <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-400">
                        {JSON.stringify(event.props)}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-neutral-400">
                    {new Date(event.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Capture surface — tokens, cookies, headers */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        {CAPTURE_KEYS.map(({ kind, keys }) => (
          <div key={kind} className="rounded-xl border border-neutral-200 p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
              {kind}
            </p>
            <p className="mt-2 font-mono text-[12px] leading-6 text-neutral-700">{keys}</p>
          </div>
        ))}
      </section>
      <p className="mt-3 text-[12px] leading-5 text-neutral-500">
        Keys captured in the request capture (values scrubbed). Sessions here are
        handled by Convex Auth instead of client cookies; the gateway emits the
        security headers listed on every response.
      </p>

      {/* Filters */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
              category === null
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400",
            )}
          >
            All categories
          </button>
          {API_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? null : c)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                category === c
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 gap-2 sm:ml-auto">
          {(
            [
              ["all", "All"],
              ["captured", "Captured"],
              ["missing", "Missing"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCapturedFilter(value)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                capturedFilter === value
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoint list */}
      <ul className="mt-6 border-t border-neutral-200">
        {endpoints.map((ep) => {
          const result = results[ep.id];
          const open = openId === ep.id;
          const needsId = ep.livePath?.includes("{id}") ?? false;
          const sampleReady =
            !needsId || (needsId && resolveId(ep) !== null);
          const canTry = ep.impl !== "ui" && ep.impl !== "none" && !!ep.livePath;
          const isCalling = callingId === ep.id;
          return (
            <li key={ep.id} className="border-b border-neutral-200">
              <div className="grid gap-4 py-5 sm:grid-cols-[64px_1fr_auto] sm:items-start">
                <span className="hidden font-mono text-[13px] tabular-nums text-neutral-400 sm:block">
                  #{ep.id}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 font-mono text-[11px] font-semibold",
                        METHOD_STYLES[ep.method] ?? "bg-neutral-100 text-neutral-500",
                      )}
                    >
                      {ep.method}
                    </span>
                    <span className="break-all font-mono text-[13px] font-medium text-neutral-900">
                      {ep.endpoint}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                        ep.captured
                          ? "border-neutral-300 text-neutral-600"
                          : "border-neutral-900 text-neutral-900",
                      )}
                    >
                      {ep.captured ? "Captured" : "Now built"}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-neutral-600">{ep.purpose}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-neutral-400">
                    <span>{ep.category}</span>
                    <span>Priority: {ep.priority}</span>
                    <span>Status: {ep.statusCode}</span>
                    <span>Calls: {ep.calls}</span>
                    {ep.impl === "live" && <span>· live via gateway</span>}
                    {ep.impl === "session" && <span>· needs sign-in</span>}
                    {ep.impl === "ui" && ep.appRoute && (
                      <span>
                        · app route{" "}
                        <Link
                          to={ep.appRoute}
                          className="text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
                        >
                          {ep.appRoute}
                        </Link>
                      </span>
                    )}
                    {ep.impl === "none" && <span>· out of scope</span>}
                  </div>
                  {ep.note && (
                    <p className="mt-1.5 text-[12px] leading-5 text-neutral-500">
                      {ep.note}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  {canTry && (
                    <button
                      type="button"
                      disabled={!sampleReady || isCalling}
                      onClick={() => tryEndpoint(ep)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                        sampleReady
                          ? "border-neutral-300 text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
                          : "cursor-not-allowed border-neutral-200 text-neutral-300",
                      )}
                      title={
                        sampleReady
                          ? "Call this endpoint"
                          : "Sign in and place an order to get a sample id"
                      }
                    >
                      {isCalling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      Try it
                    </button>
                  )}
                  {(ep.impl === "ui" || ep.impl === "none") && (
                    <span className="text-[12px] text-neutral-400">
                      {ep.impl === "ui" ? "Page" : "—"}
                    </span>
                  )}
                </div>
              </div>

              {open && result && (
                <div className="mb-5 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                  <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2.5">
                    <span className="flex items-center gap-2 text-[12px] font-medium text-neutral-600">
                      <TerminalSquare className="h-3.5 w-3.5 text-neutral-400" />
                      {ep.method} {CONVEX_URL}
                      {ep.livePath}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold",
                        result.status !== null && result.status < 300
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-200 text-neutral-700",
                      )}
                    >
                      {result.status ?? "ERR"}
                    </span>
                  </div>
                  {result.headers && (
                    <div className="border-b border-neutral-200 px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                        Response headers
                      </p>
                      <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                        {INTERESTING_HEADERS.filter((h) => result.headers?.[h]).map(
                          (h) => (
                            <div
                              key={h}
                              className="flex items-baseline justify-between gap-3"
                            >
                              <dt className="shrink-0 font-mono text-[11px] text-neutral-500">
                                {h}
                              </dt>
                              <dd className="truncate text-right font-mono text-[11px] text-neutral-700">
                                {result.headers![h]}
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </div>
                  )}
                  <pre className="max-h-72 overflow-auto p-4 text-[12px] leading-5 text-neutral-700">
                    {result.error ??
                      JSON.stringify(result.body, null, 2)}
                  </pre>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
