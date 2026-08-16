import { Link } from "react-router";
import { useQuery } from "convex/react";
import { ArrowRight, Loader2, PackageOpen } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ProductVisual } from "@/components/store/ProductVisual";
import { inr, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  shipped: "Shipped",
  "out-for-delivery": "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em]",
        status === "cancelled"
          ? "border-neutral-300 text-neutral-400"
          : status === "delivered"
            ? "border-neutral-300 text-neutral-500"
            : "border-neutral-900 text-neutral-900",
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function Orders() {
  const orders = useQuery(api.orders.listOrders);

  if (orders === undefined) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-32 sm:px-6 lg:px-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-28 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-neutral-100">
          <PackageOpen className="h-6 w-6 text-neutral-400" />
        </span>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-neutral-900">
          No orders yet
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
          When you place an order it will show up here with live status and
          delivery tracking.
        </p>
        <Button asChild className="mt-7 rounded-full px-7">
          <Link to="/shop">Start shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="border-b border-neutral-200 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
          Your account
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          Orders
        </h1>
      </div>

      <ul className="mt-4">
        {orders.map((order) => (
          <li key={order._id}>
            <Link
              to={`/orders/${order._id}`}
              className="group grid gap-4 border-b border-neutral-200 py-6 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-medium text-neutral-900">
                    {order.orderNo}
                  </span>
                  <StatusBadge status={order.status} />
                  <span className="text-[13px] text-neutral-400">
                    {shortDate(order.createdAt)}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {order.items.slice(0, 4).map((item) => (
                    <span key={item.productId} className="relative shrink-0">
                      <ProductVisual
                        category={item.category}
                        className="h-14 w-14 rounded-lg"
                        iconClassName="h-6 w-6"
                      />
                      {item.quantity > 1 && (
                        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-neutral-900 text-[10px] font-medium text-white">
                          {item.quantity}
                        </span>
                      )}
                    </span>
                  ))}
                  <span className="ml-1 text-[13px] text-neutral-500">
                    {order.items.length} item{order.items.length === 1 ? "" : "s"} ·{" "}
                    {inr(order.grandTotal)}
                  </span>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[13px] font-medium text-neutral-600 transition-colors group-hover:text-neutral-900 sm:justify-end">
                View details
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
