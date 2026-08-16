import { useEffect } from "react";
import { useLocation } from "react-router";
import { api } from "@/lib/apiClient";

/**
 * Telemetry helpers — silent, fire-and-forget. Mirrors the capture's dual
 * tracking surface: GET /api/1/action/view (click/view tracking) and
 * POST /api/v2/analytics/events (the persisted collector, an in-app stand-in
 * for 1.sonic.fdp.api.flipkart.com/4/data/collector/business).
 */

type EventProps = Record<string, string | number | boolean>;

export function trackAction(action: string, extra?: Record<string, string>): void {
  void api.trackAction(action, extra).catch(() => {
    // telemetry must never block or surface — ignore gateway hiccups
  });
}

export function trackEvent(event: string, props?: EventProps, path?: string): void {
  void api.trackEvent(event, props, path).catch(() => {
    // telemetry must never block or surface — ignore gateway hiccups
  });
}

/** Track a product-view (the capture's most frequent action endpoint). */
export function trackProductView(product: {
  _id: string;
  name: string;
  brand: string;
  price: number;
}): void {
  trackAction("view_item", {
    item_id: product._id,
    item_name: product.name,
  });
  trackEvent(
    "view_item",
    {
      item_id: product._id,
      item_name: product.name,
      item_brand: product.brand,
      price: product.price,
    },
    `/product/${product._id}`,
  );
}

/** Fire a page_view on every route change (from the layout). */
export function usePageTracking(): void {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname + location.search;
    trackAction("page_view", { path });
    trackEvent("page_view", { path }, path);
  }, [location.pathname, location.search]);
}
