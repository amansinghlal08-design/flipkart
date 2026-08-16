import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * In-app REST gateway mirroring the captured API surface. Every route maps to
 * a row in src/lib/api-endpoints.ts and serves live data through Convex
 * queries/mutations. Session-scoped endpoints return a structured
 * `auth_required` envelope — the web app performs those through the signed-in
 * Convex client instead.
 */

type Router = ReturnType<typeof httpRouter>;
type Ref = { endpoint: string; method: string };
type Handler = Parameters<typeof httpAction>[0];

const SORTS = [
  "featured",
  "price-asc",
  "price-desc",
  "rating",
  "newest",
] as const;

function reply(
  ref: Ref,
  status: number,
  payload: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(
    JSON.stringify({
      ...payload,
      endpoint: ref.endpoint,
      method: ref.method,
      status,
      ...extra,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

const ok = (ref: Ref, data: unknown, meta: Record<string, unknown> = {}) =>
  reply(ref, 200, { ok: true, data, meta });

const bad = (ref: Ref, status: number, error: string, note?: string) =>
  reply(ref, status, { ok: false, error, ...(note ? { note } : {}) });

const sessionScoped = (ref: Ref) =>
  bad(ref, 401, "auth_required", [
    "This endpoint is session-scoped. The web app performs it through the",
    "signed-in Convex client — see /account, /cart, /checkout and /wallet.",
  ].join(" "));

function pathSegments(request: Request): string[] {
  return new URL(request.url).pathname.split("/").filter(Boolean);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function addRoute(
  http: Router,
  spec: {
    method: "GET" | "POST" | "DELETE";
    path?: string;
    pathPrefix?: string;
    handler: Handler;
  },
): void {
  http.route({
    ...(spec.path !== undefined
      ? { path: spec.path }
      : { pathPrefix: spec.pathPrefix! }),
    method: spec.method,
    handler: httpAction(spec.handler),
  });
}

const EGV_DENOMINATIONS = [500, 1000, 2000, 5000];
const EGV_LOCATIONS = [
  { name: "Staple Store — MG Road", city: "Bengaluru", pincode: "560001" },
  { name: "Staple Kiosk — Connaught Place", city: "New Delhi", pincode: "110001" },
  { name: "Staple Store — Linking Road", city: "Mumbai", pincode: "400052" },
  { name: "Staple Store — Park Street", city: "Kolkata", pincode: "700016" },
  { name: "Staple Kiosk — Anna Nagar", city: "Chennai", pincode: "600040" },
];

const COUPONS: Record<
  string,
  { discountPct?: number; freeDelivery?: boolean; note: string }
> = {
  STAPLE10: { discountPct: 10, note: "10% off your order" },
  FREESHIP: { freeDelivery: true, note: "Free delivery on this order" },
};

export function registerApiRoutes(http: Router): void {
  // ============ Auth ============
  addRoute(http, {
    path: "/api/6/user/signup/status",
    method: "POST",
    handler: async (ctx, request) => {
      const ref = { endpoint: "/api/6/user/signup/status", method: "POST" };
      const { email } = await readJson(request);
      if (typeof email !== "string" || !email.includes("@")) {
        return bad(ref, 400, "invalid_email", "Send { email } in the request body.");
      }
      const exists = await ctx.runQuery(api.users.emailExists, { email });
      return ok(ref, { email, exists, registered: exists }, { source: "users" });
    },
  });

  addRoute(http, {
    path: "/api/7/user/otp/generate",
    method: "POST",
    handler: async (_ctx, request) => {
      const ref = { endpoint: "/api/7/user/otp/generate", method: "POST" };
      const { email } = await readJson(request);
      if (typeof email !== "string" || !email.includes("@")) {
        return bad(ref, 400, "invalid_email", "Send { email } in the request body.");
      }
      return ok(ref, { sent: true, channel: "email", identifier: email }, {
        note: "OTP delivery is handled by the built-in email OTP provider — enter your email on /auth.",
      });
    },
  });

  addRoute(http, {
    path: "/api/1/user/login/otp",
    method: "POST",
    handler: async (_ctx, request) => {
      const ref = { endpoint: "/api/1/user/login/otp", method: "POST" };
      const { email, otp } = await readJson(request);
      if (typeof email !== "string" || typeof otp !== "string") {
        return bad(ref, 400, "invalid_body", "Send { email, otp } in the request body.");
      }
      return ok(ref, { email, verified: otp.length === 6 }, {
        note: "Enter the code on /auth — the email OTP provider completes sign-in and returns the session token.",
      });
    },
  });

  addRoute(http, {
    path: "/api/1/user/session-identity",
    method: "GET",
    handler: async () =>
      sessionScoped({ endpoint: "/api/1/user/session-identity", method: "GET" }),
  });

  addRoute(http, {
    path: "/4/user/state",
    method: "GET",
    handler: async () =>
      sessionScoped({ endpoint: "/4/user/state", method: "GET" }),
  });

  // ============ Location ============
  addRoute(http, {
    path: "/api/1/location/serviceability",
    method: "POST",
    handler: async () =>
      sessionScoped({ endpoint: "/api/1/location/serviceability", method: "POST" }),
  });

  addRoute(http, {
    path: "/api/4/location/update",
    method: "POST",
    handler: async () =>
      sessionScoped({ endpoint: "/api/4/location/update", method: "POST" }),
  });

  addRoute(http, {
    path: "/api/1/contacts",
    method: "GET",
    handler: async () => sessionScoped({ endpoint: "/api/1/contacts", method: "GET" }),
  });

  addRoute(http, {
    path: "/api/3/user/contact",
    method: "GET",
    handler: async () =>
      sessionScoped({ endpoint: "/api/3/user/contact", method: "GET" }),
  });

  // ============ Cart ============
  addRoute(http, {
    path: "/api/5/cart/browse",
    method: "GET",
    handler: async () => sessionScoped({ endpoint: "/api/5/cart/browse", method: "GET" }),
  });

  addRoute(http, {
    path: "/api/5/cart/add",
    method: "POST",
    handler: async () => sessionScoped({ endpoint: "/api/5/cart/add", method: "POST" }),
  });

  addRoute(http, {
    path: "/api/5/cart/remove",
    method: "DELETE",
    handler: async () =>
      sessionScoped({ endpoint: "/api/5/cart/remove", method: "DELETE" }),
  });

  // ============ Orders ============
  addRoute(http, {
    path: "/api/5/self-serve/orders",
    method: "GET",
    handler: async () =>
      sessionScoped({ endpoint: "/api/5/self-serve/orders", method: "GET" }),
  });

  addRoute(http, {
    path: "/api/1/orders/place",
    method: "POST",
    handler: async () =>
      sessionScoped({ endpoint: "/api/1/orders/place", method: "POST" }),
  });

  addRoute(http, {
    pathPrefix: "/api/1/orders/",
    method: "GET",
    handler: async (ctx, request) => {
      const ref = { endpoint: "/api/1/orders/{id}/tracking", method: "GET" };
      const segs = pathSegments(request); // [api,1,orders,id,tail?]
      const orderId = segs[3];
      const tail = segs[4];
      if (tail !== "tracking") {
        return bad(ref, 404, "not_found", "Unknown orders sub-path.");
      }
      if (!orderId) return bad(ref, 400, "missing_id", "Order id is required.");
      const order = await ctx.runQuery(api.orders.getOrder, {
        orderId: orderId as never,
      });
      if (!order) {
        return bad(ref, 404, "order_not_found", [
          "Tracking requires a signed-in session and a valid order id.",
          "Place an order at /checkout, then open it from /orders.",
        ].join(" "));
      }
      return ok(ref, {
        orderNo: order.orderNo,
        status: order.status,
        timeline: order.timeline,
        deliveryBy: order.deliveryBy,
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
        })),
      });
    },
  });

  addRoute(http, {
    pathPrefix: "/api/1/orders/",
    method: "POST",
    handler: async (ctx, request) => {
      const segs = pathSegments(request); // [api,1,orders,id,tail?]
      const orderId = segs[3];
      const tail = segs[4];

      if (tail === "cancel") {
        const ref = { endpoint: "/api/1/orders/{id}/cancel", method: "POST" };
        if (!orderId) return bad(ref, 400, "missing_id", "Order id is required.");
        try {
          await ctx.runMutation(api.orders.cancelOrder, {
            orderId: orderId as never,
          });
          return ok(ref, { cancelled: true });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Could not cancel order.";
          return bad(ref, 400, "cancel_failed", message);
        }
      }
      if (tail === "return") {
        const ref = { endpoint: "/api/1/orders/{id}/return", method: "POST" };
        return bad(ref, 401, "auth_required", [
          "Returns are session-scoped. Start a return from your order in /orders.",
        ].join(" "));
      }
      return bad(
        { endpoint: "/api/1/orders/place", method: "POST" },
        404,
        "not_found",
        "Unknown orders sub-path.",
      );
    },
  });

  // ============ Payment & wallet ============
  addRoute(http, {
    path: "/api/2/wallet/balance",
    method: "GET",
    handler: async () =>
      sessionScoped({ endpoint: "/api/2/wallet/balance", method: "GET" }),
  });

  addRoute(http, {
    path: "/api/2/wallet/egv/active",
    method: "GET",
    handler: async () =>
      sessionScoped({ endpoint: "/api/2/wallet/egv/active", method: "GET" }),
  });

  addRoute(http, {
    path: "/api/2/payment/initiate",
    method: "POST",
    handler: async () =>
      sessionScoped({ endpoint: "/api/2/payment/initiate", method: "POST" }),
  });

  addRoute(http, {
    path: "/api/1/affordability/bnpl/account",
    method: "POST",
    handler: async () => {
      const ref = { endpoint: "/api/1/affordability/bnpl/account", method: "POST" };
      return ok(
        ref,
        {
          eligible: true,
          creditLimit: 15000,
          apr: 0,
          plans: ["3 months", "6 months", "12 months"],
        },
        { note: "Demo response — BNPL is not enabled at checkout." },
      );
    },
  });

  addRoute(http, {
    path: "/api/1/coupon/validate",
    method: "POST",
    handler: async (_ctx, request) => {
      const ref = { endpoint: "/api/1/coupon/validate", method: "POST" };
      const { code } = await readJson(request);
      if (typeof code !== "string") {
        return bad(ref, 400, "invalid_body", "Send { code } in the request body.");
      }
      const coupon = COUPONS[code.trim().toUpperCase()];
      if (!coupon) return ok(ref, { valid: false, code });
      return ok(ref, { valid: true, code: code.trim().toUpperCase(), ...coupon });
    },
  });

  // ============ Voucher / EGV ============
  addRoute(http, {
    path: "/api/1/egv/denominations",
    method: "GET",
    handler: async () => {
      const ref = { endpoint: "/api/1/egv/denominations", method: "GET" };
      return ok(
        ref,
        EGV_DENOMINATIONS.map((denomination) => ({
          denomination,
          currency: "INR",
        })),
        { supportedCurrencies: ["INR"] },
      );
    },
  });

  addRoute(http, {
    path: "/api/1/egv/locations",
    method: "GET",
    handler: async () => {
      const ref = { endpoint: "/api/1/egv/locations", method: "GET" };
      return ok(ref, EGV_LOCATIONS, { count: EGV_LOCATIONS.length });
    },
  });

  // ============ Content ============
  addRoute(http, {
    path: "/api/4/page/fetch",
    method: "GET",
    handler: async (ctx, request) => {
      const ref = { endpoint: "/api/4/page/fetch", method: "GET" };
      const cacheFirst = new URL(request.url).searchParams.get("cacheFirst");
      const [categories, deals, featured, catalog] = await Promise.all([
        ctx.runQuery(api.products.listCategories, {}),
        ctx.runQuery(api.products.dealProducts, { limit: 8 }),
        ctx.runQuery(api.products.featuredProducts, { limit: 8 }),
        ctx.runQuery(api.products.listProducts, { sort: "featured" }),
      ]);
      return ok(
        ref,
        {
          page: "home",
          cacheFirst: cacheFirst === "true",
          hero: {
            headline: "Considered goods, nothing more.",
            subhead: "Everyday essentials — priced honestly, delivered in days.",
          },
          categories,
          deals,
          featured,
          catalogSize: catalog.length,
        },
        { generatedAt: Date.now() },
      );
    },
  });

  // ============ Analytics & notifications ============
  addRoute(http, {
    path: "/api/1/action/view",
    method: "GET",
    handler: async (_ctx, request) => {
      const ref = { endpoint: "/api/1/action/view", method: "GET" };
      const action = new URL(request.url).searchParams.get("action") ?? "view";
      return ok(ref, { action, tracked: true }, {
        note: "Demo — events are acknowledged, not persisted.",
      });
    },
  });

  addRoute(http, {
    path: "/api/1/connekt/push/callback",
    method: "POST",
    handler: async (_ctx, request) => {
      const ref = { endpoint: "/api/1/connekt/push/callback", method: "POST" };
      const body = await readJson(request);
      return ok(ref, { received: true, event: body.event ?? "unknown" });
    },
  });

  // ============ Wishlist ============
  addRoute(http, {
    path: "/api/1/wishlist",
    method: "GET",
    handler: async () => sessionScoped({ endpoint: "/api/1/wishlist", method: "GET" }),
  });

  addRoute(http, {
    path: "/api/1/wishlist/add",
    method: "POST",
    handler: async () =>
      sessionScoped({ endpoint: "/api/1/wishlist/add", method: "POST" }),
  });

  // ============ Browse & content catalog ============
  addRoute(http, {
    path: "/api/v2/search",
    method: "GET",
    handler: async (ctx, request) => {
      const ref = { endpoint: "/api/v2/search", method: "GET" };
      const url = new URL(request.url);
      const q = url.searchParams.get("q") ?? undefined;
      const category = url.searchParams.get("category") ?? undefined;
      const rawSort = url.searchParams.get("sort") ?? undefined;
      const sort = SORTS.includes(rawSort as (typeof SORTS)[number])
        ? (rawSort as (typeof SORTS)[number])
        : undefined;
      const products = await ctx.runQuery(api.products.listProducts, {
        q,
        category,
        sort,
      });
      return ok(ref, products, {
        count: products.length,
        query: q ?? null,
        category: category ?? null,
        sort: sort ?? "featured",
      });
    },
  });

  addRoute(http, {
    path: "/api/1/categories",
    method: "GET",
    handler: async (ctx) => {
      const ref = { endpoint: "/api/1/categories", method: "GET" };
      const categories = await ctx.runQuery(api.products.listCategories, {});
      return ok(ref, categories, { count: categories.length });
    },
  });

  addRoute(http, {
    path: "/api/1/browse/departments",
    method: "GET",
    handler: async (ctx) => {
      const ref = { endpoint: "/api/1/browse/departments", method: "GET" };
      const categories = await ctx.runQuery(api.products.listCategories, {});
      return ok(ref, categories, {
        count: categories.length,
        aliasOf: "/api/1/categories",
      });
    },
  });

  addRoute(http, {
    path: "/api/1/deals",
    method: "GET",
    handler: async (ctx) => {
      const ref = { endpoint: "/api/1/deals", method: "GET" };
      const deals = await ctx.runQuery(api.products.dealProducts, { limit: 8 });
      return ok(ref, deals, { count: deals.length, label: "Today's best value" });
    },
  });

  addRoute(http, {
    path: "/api/1/offers",
    method: "GET",
    handler: async (ctx) => {
      const ref = { endpoint: "/api/1/offers", method: "GET" };
      const products = await ctx.runQuery(api.products.listProducts, {
        sort: "featured",
      });
      const offers = products
        .filter((p) => p.badges.length > 0)
        .map((p) => ({
          productId: p._id,
          name: p.name,
          badge: p.badges[0],
          price: p.price,
          mrp: p.mrp,
          discountPct: Math.round(((p.mrp - p.price) / p.mrp) * 100),
        }));
      return ok(ref, offers, { count: offers.length });
    },
  });

  // ============ Product surface ============
  addRoute(http, {
    pathPrefix: "/api/1/product/",
    method: "GET",
    handler: async (ctx, request) => {
      const segs = pathSegments(request); // [api,1,product,id,tail?]
      const productId = segs[3];
      const tail = segs[4];
      if (!productId) {
        return bad(
          { endpoint: "/api/1/product/{id}", method: "GET" },
          400,
          "missing_id",
          "Product id is required.",
        );
      }

      if (tail === "reviews") {
        const ref = { endpoint: "/api/1/product/{id}/reviews", method: "GET" };
        const reviews = await ctx.runQuery(api.products.listReviews, {
          productId: productId as never,
        });
        return ok(ref, reviews, { count: reviews.length });
      }

      if (tail === "availability") {
        const ref = { endpoint: "/api/1/product/{id}/availability", method: "GET" };
        const product = await ctx.runQuery(api.products.getProduct, {
          productId: productId as never,
        });
        if (!product) {
          return bad(ref, 404, "product_not_found", "No product with that id.");
        }
        return ok(ref, {
          productId,
          inStock: product.stock > 0,
          stock: product.stock,
          lowStock: product.stock > 0 && product.stock <= 5,
        });
      }

      const ref = { endpoint: "/api/1/product/{id}", method: "GET" };
      const product = await ctx.runQuery(api.products.getProduct, {
        productId: productId as never,
      });
      if (!product) return bad(ref, 404, "product_not_found", "No product with that id.");
      return ok(ref, product, { seller: "Staple Direct" });
    },
  });

  addRoute(http, {
    pathPrefix: "/api/1/product/",
    method: "POST",
    handler: async (ctx, request) => {
      const segs = pathSegments(request); // [api,1,product,id,tail?]
      const productId = segs[3];
      const tail = segs[4];
      if (tail !== "notify-me") {
        return bad(
          { endpoint: "/api/1/product/{id}/notify-me", method: "POST" },
          404,
          "not_found",
          "Only /notify-me is supported on POST /api/1/product/.",
        );
      }
      const ref = { endpoint: "/api/1/product/{id}/notify-me", method: "POST" };
      if (!productId) return bad(ref, 400, "missing_id", "Product id is required.");
      const product = await ctx.runQuery(api.products.getProduct, {
        productId: productId as never,
      });
      if (!product) return bad(ref, 404, "product_not_found", "No product with that id.");
      return ok(ref, { productId, registered: true }, {
        note: "We'll email you when this item is back in stock (demo — emails are stubbed).",
      });
    },
  });
}
