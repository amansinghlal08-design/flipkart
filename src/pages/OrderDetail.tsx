import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  Check,
  CreditCard,
  Loader2,
  MapPin,
  Wallet as WalletIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ProductVisual } from "@/components/store/ProductVisual";
import { deliveryEta, inr, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, StatusBadge } from "./Orders";

const TIMELINE = ["confirmed", "shipped", "out-for-delivery", "delivered"] as const;

const PAYMENT_ICONS = {
  wallet: WalletIcon,
  cod: Banknote,
  card: CreditCard,
} as const;

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const order = useQuery(api.orders.getOrder, { orderId: id as never });
  const cancelOrder = useMutation(api.orders.cancelOrder);

  if (order === undefined) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-32 sm:px-6 lg:px-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="flex flex-col items-center px-4 py-28 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Order not found</h1>
        <Button asChild variant="outline" className="mt-6 rounded-full">
          <Link to="/orders">Back to orders</Link>
        </Button>
      </div>
    );
  }

  const PaymentIcon = PAYMENT_ICONS[order.paymentMethod];
  const reached = order.status === "cancelled" ? -1 : TIMELINE.indexOf(order.status as (typeof TIMELINE)[number]);
  const timelineEntries = order.status === "cancelled"
    ? [...TIMELINE, "cancelled"]
    : TIMELINE;

  const handleCancel = async () => {
    if (!window.confirm("Cancel this order? Wallet payments will be refunded.")) return;
    try {
      await cancelOrder({ orderId: order._id });
      toast.success("Order cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel order.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-[13px] text-neutral-500 transition-colors hover:text-neutral-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to orders
      </button>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            {order.orderNo}
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Placed {shortDate(order.createdAt)} ·{" "}
            {order.status === "cancelled"
              ? "cancelled"
              : `expected by ${deliveryEta(order.deliveryBy)}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          {order.status === "confirmed" && (
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-neutral-300"
              onClick={handleCancel}
            >
              Cancel order
            </Button>
          )}
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-10">
          {/* Timeline */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">
              Tracking
            </h2>
            <ol className="mt-5">
              {timelineEntries.map((status, index) => {
                const done =
                  order.status === "cancelled"
                    ? status === "cancelled"
                      ? true
                      : false
                    : index <= reached;
                const cancelledStep = status === "cancelled";
                return (
                  <li key={status} className="relative flex gap-4 pb-8 last:pb-0">
                    {index < timelineEntries.length - 1 && (
                      <span
                        className={cn(
                          "absolute left-[11px] top-6 h-full w-px",
                          done && !cancelledStep ? "bg-neutral-900" : "bg-neutral-200",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "relative mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                        done
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-300 bg-white text-transparent",
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <div>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          done ? "text-neutral-900" : "text-neutral-400",
                        )}
                      >
                        {STATUS_LABEL[status] ?? status}
                      </p>
                      {done && order.status === "cancelled" && status === "cancelled" && (
                        <p className="mt-0.5 text-[13px] text-neutral-500">
                          {shortDate(order.timeline.find((t) => t.status === "cancelled")?.at ?? order.createdAt)}
                        </p>
                      )}
                      {done && order.status !== "cancelled" && (
                        <p className="mt-0.5 text-[13px] text-neutral-500">
                          {index === 0 ? shortDate(order.createdAt) : "Estimated"}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Items */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">
              Items
            </h2>
            <ul className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200">
              {order.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-4 py-4">
                  <ProductVisual
                    category={item.category}
                    className="h-16 w-16 shrink-0 rounded-lg"
                    iconClassName="h-7 w-7"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                      {item.brand}
                    </p>
                    <Link
                      to={`/product/${item.productId}`}
                      className="mt-0.5 block truncate text-sm font-medium text-neutral-900 hover:underline hover:underline-offset-4"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-[13px] text-neutral-500">
                      {inr(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-neutral-900">
                    {inr(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-neutral-200 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">
              Payment
            </h2>
            <div className="mt-4 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-neutral-100">
                <PaymentIcon className="h-4 w-4 text-neutral-600" />
              </span>
              <span className="text-sm text-neutral-700">
                {order.paymentMethod === "wallet"
                  ? "Paid from Staple wallet"
                  : order.paymentMethod === "cod"
                    ? "Cash on delivery"
                    : "Card (demo)"}
              </span>
            </div>
            <dl className="mt-5 space-y-2.5 border-t border-neutral-200 pt-4 text-sm">
              <div className="flex justify-between text-neutral-600">
                <dt>Item total</dt>
                <dd className="tabular-nums">{inr(order.itemTotal)}</dd>
              </div>
              <div className="flex justify-between text-neutral-600">
                <dt>Discount</dt>
                <dd className="tabular-nums">−{inr(order.discount)}</dd>
              </div>
              <div className="flex justify-between text-neutral-600">
                <dt>Delivery</dt>
                <dd className="tabular-nums">
                  {order.deliveryFee === 0 ? "Free" : inr(order.deliveryFee)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-3 text-base font-semibold text-neutral-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{inr(order.grandTotal)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">
              <MapPin className="h-4 w-4 text-neutral-400" />
              Delivering to
            </h2>
            <p className="mt-4 text-sm font-medium text-neutral-900">
              {order.address.name}
            </p>
            <p className="mt-1 text-[13px] leading-6 text-neutral-600">
              {order.address.line1}
              {order.address.line2 ? `, ${order.address.line2}` : ""}
              <br />
              {order.address.city}, {order.address.state} — {order.address.pincode}
              <br />
              Phone: {order.address.phone}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
