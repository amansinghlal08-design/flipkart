/**
 * The complete API surface this store is built on — the 70-endpoint master
 * list (30 captured from request logs + 40 missing that are required for a
 * working e-commerce flow). `impl` describes how this build serves each row:
 *  - "live":    served by the in-app REST gateway with real data
 *  - "session": gateway route exists; requires a signed-in session (the web
 *               app performs it through the Convex client)
 *  - "ui":      a page route; `appRoute` maps it to its equivalent in this app
 *  - "none":    out of scope for this build
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiEndpoint = {
  id: number;
  endpoint: string; // display path from the spec
  method: HttpMethod;
  url: string; // spec URL
  category: string;
  purpose: string;
  statusCode: string;
  calls: number;
  priority: "Critical" | "High" | "Medium" | "Low";
  captured: boolean;
  impl: "live" | "session" | "ui" | "none";
  /** Callable path on the in-app gateway (query strings from the spec omitted). */
  livePath?: string;
  /** For "ui" rows: the equivalent route in this app. */
  appRoute?: string;
  sampleBody?: Record<string, unknown>;
  note?: string;
};

type RowDef = {
  id: number;
  method: HttpMethod;
  endpoint: string;
  category: string;
  purpose: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  captured: boolean;
  impl: "live" | "session" | "ui" | "none";
  calls?: number;
  url?: string;
  livePath?: string;
  appRoute?: string;
  sampleBody?: Record<string, unknown>;
  note?: string;
};

const ROME = "https://2.rome.api.flipkart.com";

function def(r: RowDef): ApiEndpoint {
  const path = r.endpoint.split("?")[0];
  return {
    id: r.id,
    endpoint: r.endpoint,
    method: r.method,
    url: r.url ?? (r.endpoint.startsWith("/") ? `${ROME}${r.endpoint}` : r.endpoint),
    category: r.category,
    purpose: r.purpose,
    statusCode: r.captured ? "200" : "N/A",
    calls: r.calls ?? (r.captured ? 1 : 0),
    priority: r.priority,
    captured: r.captured,
    impl: r.impl,
    livePath:
      r.livePath ?? (r.impl === "live" || r.impl === "session" ? path : undefined),
    appRoute: r.appRoute,
    sampleBody: r.sampleBody,
    note: r.note,
  };
}

export const API_ENDPOINTS: ApiEndpoint[] = [
  // ---------- AUTH & USER ----------
  def({ id: 1, method: "POST", endpoint: "/api/6/user/signup/status", category: "Auth", purpose: "Check if account already exists", priority: "Critical", captured: true, impl: "live", sampleBody: { email: "buyer@example.com" } }),
  def({ id: 2, method: "POST", endpoint: "/api/7/user/otp/generate", category: "Auth", purpose: "Send OTP to phone/email", priority: "Critical", captured: true, impl: "live", sampleBody: { email: "buyer@example.com" }, note: "OTP delivery handled by the built-in email OTP provider — see /auth." }),
  def({ id: 3, method: "POST", endpoint: "/api/1/user/login/otp", category: "Auth", purpose: "Verify OTP, log user in", priority: "Critical", captured: true, impl: "live", sampleBody: { email: "buyer@example.com", otp: "000000" }, note: "Complete sign-in on /auth — the email OTP provider issues the session." }),
  def({ id: 4, method: "GET", endpoint: "/api/1/user/session-identity", category: "Auth", purpose: "Validate active session", priority: "Critical", captured: true, impl: "session" }),
  def({ id: 5, method: "GET", endpoint: "/4/user/state", category: "User", purpose: "Get full user profile/state", priority: "Critical", captured: true, impl: "session", calls: 4 }),

  // ---------- LOCATION & DELIVERY ----------
  def({ id: 6, method: "POST", endpoint: "/api/1/location/serviceability", category: "Location", purpose: "Check delivery availability", priority: "Critical", captured: true, impl: "session", calls: 4 }),
  def({ id: 7, method: "POST", endpoint: "/api/4/location/update", category: "Location", purpose: "Update delivery location", priority: "Critical", captured: true, impl: "session", calls: 2 }),
  def({ id: 8, method: "GET", endpoint: "/api/1/contacts?source=entry", category: "Location", purpose: "Get saved addresses", priority: "Critical", captured: true, impl: "session", livePath: "/api/1/contacts" }),
  def({ id: 9, method: "GET", endpoint: "/api/3/user/contact?marketplace=HYPERLOCAL", category: "Location", purpose: "Get contact for quick-commerce orders", priority: "Medium", captured: true, impl: "session", livePath: "/api/3/user/contact" }),
  def({ id: 10, method: "GET", endpoint: "/api/v2/addresses", category: "Location", purpose: "Full address CRUD (add/edit/delete)", priority: "High", captured: false, impl: "session", note: "Multi-method — GET/POST/PUT/DELETE. Managed from /account." }),
  def({ id: 11, method: "GET", endpoint: "/api/v2/locations/pickup-points", category: "Location", purpose: "Find nearby pickup/store locations", priority: "Low", captured: false, impl: "live", note: "Powers the Minutes store selector." }),

  // ---------- SEARCH & DISCOVERY ----------
  def({ id: 12, method: "GET", endpoint: "/api/v2/search", category: "Search", purpose: "Product search with filters/sort", priority: "Critical", captured: false, impl: "live", note: "Supports ?q=, ?category=, ?sort=price-asc|price-desc|rating|newest|featured." }),
  def({ id: 13, method: "GET", endpoint: "/api/v2/search/suggestions", category: "Search", purpose: "Search autocomplete", priority: "High", captured: false, impl: "live", note: "Powers the header search suggestions." }),
  def({ id: 14, method: "GET", endpoint: "/api/v2/categories", category: "Search", purpose: "Category/department hierarchy", priority: "High", captured: false, impl: "live" }),
  def({ id: 15, method: "GET", endpoint: "/api/v2/deals", category: "Search", purpose: "Active deals/offers", priority: "High", captured: false, impl: "live" }),
  def({ id: 16, method: "GET", endpoint: "/api/v2/flash-sales", category: "Search", purpose: "Time-bound flash sales", priority: "Medium", captured: false, impl: "live", note: "Powers the Minutes flash-sale strip." }),
  def({ id: 17, method: "GET", endpoint: "/api/v2/recommendations", category: "Search", purpose: "Personalized suggestions", priority: "Medium", captured: false, impl: "live", note: "?productId= returns related items." }),
  def({ id: 18, method: "GET", endpoint: "/api/v2/user/recently-viewed", category: "Search", purpose: "Browsing history", priority: "Medium", captured: false, impl: "live", note: "Stored on-device in this build (localStorage)." }),

  // ---------- PRODUCT ----------
  def({ id: 19, method: "GET", endpoint: "/api/v2/product/{productId}", category: "Product", purpose: "Full product details, specs, images", priority: "Critical", captured: false, impl: "live", livePath: "/api/v2/product/{productId}" }),
  def({ id: 20, method: "GET", endpoint: "/api/v2/product/{productId}/availability", category: "Product", purpose: "Real-time stock check", priority: "Critical", captured: false, impl: "live", livePath: "/api/v2/product/{productId}/availability" }),
  def({ id: 21, method: "GET", endpoint: "/api/v2/product/{productId}/reviews", category: "Product", purpose: "Get customer reviews/ratings", priority: "High", captured: false, impl: "live", livePath: "/api/v2/product/{productId}/reviews" }),
  def({ id: 22, method: "POST", endpoint: "/api/v2/product/{productId}/reviews", category: "Product", purpose: "Submit a review", priority: "Medium", captured: false, impl: "session", livePath: "/api/v2/product/{productId}/reviews", note: "The web app submits reviews from the product page." }),
  def({ id: 23, method: "POST", endpoint: "/api/v2/compare", category: "Product", purpose: "Compare multiple products", priority: "Medium", captured: false, impl: "live", sampleBody: { ids: ["{id}", "{id}"] } }),
  def({ id: 24, method: "GET", endpoint: "/api/v2/sellers/{sellerId}", category: "Product", purpose: "Seller profile & ratings", priority: "Medium", captured: false, impl: "live", livePath: "/api/v2/sellers/{sellerId}", note: "All products ship from Staple Direct." }),

  // ---------- CART ----------
  def({ id: 25, method: "GET", endpoint: "/api/5/cart/browse", category: "Cart", purpose: "Fetch cart contents (read-only)", priority: "Critical", captured: true, impl: "session" }),
  def({ id: 26, method: "POST", endpoint: "/api/v2/cart/add", category: "Cart", purpose: "Add item to cart", priority: "Critical", captured: false, impl: "session", sampleBody: { productId: "{id}", quantity: 1 } }),
  def({ id: 27, method: "PUT", endpoint: "/api/v2/cart/items/{cartItemId}", category: "Cart", purpose: "Update item quantity", priority: "Critical", captured: false, impl: "session", livePath: "/api/v2/cart/items/{cartItemId}", sampleBody: { quantity: 2 } }),
  def({ id: 28, method: "DELETE", endpoint: "/api/v2/cart/items/{cartItemId}", category: "Cart", purpose: "Remove item from cart", priority: "Critical", captured: false, impl: "session", livePath: "/api/v2/cart/items/{cartItemId}" }),
  def({ id: 29, method: "DELETE", endpoint: "/api/v2/cart/clear", category: "Cart", purpose: "Empty entire cart", priority: "High", captured: false, impl: "session" }),

  // ---------- ORDERS & CHECKOUT ----------
  def({ id: 30, method: "GET", endpoint: "/api/5/self-serve/orders/?page=1&filterType=PREORDER_UNITS", category: "Orders", purpose: "Order history (read-only)", priority: "Critical", captured: true, impl: "session", livePath: "/api/5/self-serve/orders" }),
  def({ id: 31, method: "POST", endpoint: "/api/v2/orders/create", category: "Orders", purpose: "Place order from cart", priority: "Critical", captured: false, impl: "session", sampleBody: { addressId: "", paymentMethod: "wallet" } }),
  def({ id: 32, method: "GET", endpoint: "/api/v2/orders/{orderId}", category: "Orders", purpose: "Get single order details", priority: "High", captured: false, impl: "session", livePath: "/api/v2/orders/{orderId}" }),
  def({ id: 33, method: "GET", endpoint: "/api/v2/orders/{orderId}/tracking", category: "Orders", purpose: "Real-time delivery tracking", priority: "Critical", captured: false, impl: "session", livePath: "/api/v2/orders/{orderId}/tracking" }),
  def({ id: 34, method: "POST", endpoint: "/api/v2/orders/{orderId}/cancel", category: "Orders", purpose: "Cancel an order", priority: "High", captured: false, impl: "session", livePath: "/api/v2/orders/{orderId}/cancel" }),
  def({ id: 35, method: "POST", endpoint: "/api/v2/orders/{orderId}/return", category: "Orders", purpose: "Initiate a return", priority: "High", captured: false, impl: "session", livePath: "/api/v2/orders/{orderId}/return" }),
  def({ id: 36, method: "GET", endpoint: "/api/v2/returns/{returnId}", category: "Orders", purpose: "Track return/refund status", priority: "High", captured: false, impl: "session", livePath: "/api/v2/returns/{returnId}" }),
  def({ id: 37, method: "POST", endpoint: "/api/v2/orders/{orderId}/exchange", category: "Orders", purpose: "Exchange an item", priority: "Medium", captured: false, impl: "session", livePath: "/api/v2/orders/{orderId}/exchange" }),

  // ---------- PAYMENTS & WALLET ----------
  def({ id: 38, method: "GET", endpoint: "/api/2/wallet/balance", category: "Payment", purpose: "Get wallet/cashback balance", priority: "High", captured: true, impl: "session", calls: 2 }),
  def({ id: 39, method: "GET", endpoint: "/api/2/wallet/egv/active", category: "Payment", purpose: "Get active gift voucher balance", priority: "High", captured: true, impl: "session" }),
  def({ id: 40, method: "POST", endpoint: "/api/1/affordability/bnpl/account", category: "Payment", purpose: "Check Buy Now Pay Later eligibility", priority: "High", captured: true, impl: "live", sampleBody: {}, note: "Demo response — BNPL is not enabled at checkout." }),
  def({ id: 41, method: "POST", endpoint: "/api/v2/payment/initiate", category: "Payment", purpose: "Start payment before gateway redirect", priority: "Critical", captured: false, impl: "session", sampleBody: { orderId: "", method: "wallet" } }),
  def({ id: 42, method: "POST", endpoint: "/api/v2/payment/verify", category: "Payment", purpose: "Confirm payment success", priority: "Critical", captured: false, impl: "live", sampleBody: { paymentId: "demo_pay_123" }, note: "Demo — checkout settles payments itself." }),
  def({ id: 43, method: "GET", endpoint: "/api/v2/payment/methods", category: "Payment", purpose: "List available payment options", priority: "High", captured: false, impl: "live" }),
  def({ id: 44, method: "GET", endpoint: "/api/v2/payment-methods", category: "Payment", purpose: "Manage saved cards", priority: "Medium", captured: false, impl: "session" }),
  def({ id: 45, method: "GET", endpoint: "/api/v2/gift-cards", category: "Payment", purpose: "Gift card balance/management", priority: "Medium", captured: false, impl: "session", note: "See /wallet for the EGV flow." }),

  // ---------- GIFT CARDS / VOUCHERS ----------
  def({ id: 46, method: "GET", endpoint: "/api/1/egv/denominations", category: "Voucher", purpose: "Available e-gift card amounts", priority: "Low", captured: true, impl: "live", calls: 2 }),
  def({ id: 47, method: "GET", endpoint: "/api/1/egv/locations", category: "Voucher", purpose: "Redemption locations for vouchers", priority: "Low", captured: true, impl: "live", calls: 2 }),

  // ---------- DISCOUNTS ----------
  def({ id: 48, method: "POST", endpoint: "/api/v2/coupon/validate", category: "Discount", purpose: "Validate & apply discount codes", priority: "Critical", captured: false, impl: "live", sampleBody: { code: "STAPLE10" }, note: "Demo codes: STAPLE10 (10% off), FREESHIP (free delivery)." }),

  // ---------- WISHLIST ----------
  def({ id: 49, method: "GET", endpoint: "/api/v2/wishlist", category: "Wishlist", purpose: "Get saved items", priority: "High", captured: false, impl: "session" }),
  def({ id: 50, method: "POST", endpoint: "/api/v2/wishlist/add", category: "Wishlist", purpose: "Add product to wishlist", priority: "High", captured: false, impl: "session", sampleBody: { productId: "{id}" } }),
  def({ id: 51, method: "DELETE", endpoint: "/api/v2/wishlist/items/{wishlistItemId}", category: "Wishlist", purpose: "Remove from wishlist", priority: "High", captured: false, impl: "session", livePath: "/api/v2/wishlist/items/{wishlistItemId}" }),
  def({ id: 52, method: "POST", endpoint: "/api/v2/wishlist/items/{wishlistItemId}/move-to-cart", category: "Wishlist", purpose: "Move wishlist item to cart", priority: "Medium", captured: false, impl: "session", livePath: "/api/v2/wishlist/items/{wishlistItemId}/move-to-cart" }),

  // ---------- CONTENT / PAGES ----------
  def({ id: 53, method: "GET", endpoint: "/api/4/page/fetch?cacheFirst=false", category: "Content", purpose: "Dynamic content (banners, homepage)", priority: "Critical", captured: true, impl: "live", calls: 16, livePath: "/api/4/page/fetch" }),
  def({ id: 54, method: "GET", endpoint: "/api/1/action/view", category: "Analytics", purpose: "User action/analytics tracking", priority: "Medium", captured: true, impl: "live", calls: 9, note: "Demo — events acknowledged, not persisted." }),

  // ---------- NOTIFICATIONS ----------
  def({ id: 55, method: "POST", endpoint: "/api/1/connekt/push/callback", category: "Notifications", purpose: "Push notification delivery callback", priority: "Low", captured: true, impl: "live", sampleBody: { event: "delivered" } }),
  def({ id: 56, method: "GET", endpoint: "/api/v2/notifications", category: "Notifications", purpose: "Get notification history", priority: "Medium", captured: false, impl: "live" }),
  def({ id: 57, method: "PATCH", endpoint: "/api/v2/notifications/{notificationId}/read", category: "Notifications", purpose: "Mark notification read", priority: "Low", captured: false, impl: "live", livePath: "/api/v2/notifications/{notificationId}/read", note: "Demo — acknowledged, not persisted." }),

  // ---------- SUPPORT & MISC ----------
  def({ id: 58, method: "GET", endpoint: "/api/v2/support/chat", category: "Support", purpose: "Live chat with support", priority: "Medium", captured: false, impl: "live", note: "Demo envelope — chat UI is out of scope." }),
  def({ id: 59, method: "POST", endpoint: "/api/v2/subscriptions", category: "Support", purpose: "Recurring/subscription orders", priority: "Low", captured: false, impl: "session", sampleBody: { productId: "{id}", frequency: "monthly" } }),

  // ---------- WEB PAGES (UI) ----------
  def({ id: 60, method: "GET", endpoint: "/", category: "UI", purpose: "Homepage", priority: "Critical", captured: true, impl: "ui", appRoute: "/" }),
  def({ id: 61, method: "GET", endpoint: "/account/login", category: "UI", purpose: "Login page", priority: "Critical", captured: true, impl: "ui", appRoute: "/auth", url: "https://www.flipkart.com/account/login?ret=/" }),
  def({ id: 62, method: "GET", endpoint: "/account", category: "UI", purpose: "My Account page", priority: "Critical", captured: true, impl: "ui", appRoute: "/account", url: "https://www.flipkart.com/account/?rd=0&link=home_account" }),
  def({ id: 63, method: "GET", endpoint: "/chat", category: "UI", purpose: "Customer support chat UI", priority: "Low", captured: true, impl: "ui", note: "Not built — support chat is out of scope." }),
  def({ id: 64, method: "GET", endpoint: "/flipkart-minutes-store", category: "UI", purpose: "Quick commerce store", priority: "Medium", captured: true, impl: "ui", appRoute: "/minutes", note: "Built as Staple Minutes." }),
  def({ id: 65, method: "GET", endpoint: "/payments/preload", category: "UI", purpose: "Payment preload", priority: "High", captured: true, impl: "ui", appRoute: "/checkout", note: "Handled inside checkout." }),
  def({ id: 66, method: "GET", endpoint: "/payments", category: "UI", purpose: "Payment gateway page", priority: "High", captured: true, impl: "ui", appRoute: "/checkout" }),
  def({ id: 67, method: "GET", endpoint: "/viewcheckout", category: "UI", purpose: "Checkout page", priority: "High", captured: true, impl: "ui", appRoute: "/checkout" }),

  // ---------- 3RD-PARTY TRACKING ----------
  def({ id: 68, method: "GET", endpoint: "Google Ads Tracking", category: "Tracking", purpose: "Google Ads conversion tracking", priority: "Low", captured: true, impl: "none", url: "https://googleads.g.doubleclick.net/pagead/viewthroughconversion/...", note: "External third-party tag — not part of this build." }),
  def({ id: 69, method: "GET", endpoint: "Google Ads Tracking", category: "Tracking", purpose: "Google Ads conversion tracking", priority: "Low", captured: true, impl: "none", url: "https://googleads.g.doubleclick.net/pagead/viewthroughconversion/...", note: "External third-party tag — not part of this build." }),
];

export const API_CATEGORIES = [
  ...new Set(API_ENDPOINTS.map((e) => e.category)),
].sort();

export const API_STATS = API_ENDPOINTS.reduce(
  (acc, e) => {
    acc.total += 1;
    if (e.captured) acc.captured += 1;
    else acc.missing += 1;
    acc.calls += e.calls;
    if (e.impl === "live") acc.live += 1;
    if (e.impl === "session") acc.session += 1;
    return acc;
  },
  { total: 0, captured: 0, missing: 0, calls: 0, live: 0, session: 0 },
);
