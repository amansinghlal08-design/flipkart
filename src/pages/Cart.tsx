import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ProductVisual } from "@/components/store/ProductVisual";
import { inr } from "@/lib/format";
import { trackEvent } from "@/lib/telemetry";

const FREE_DELIVERY_THRESHOLD = 499;
const DELIVERY_FEE = 49;

export default function Cart() {
  const cart = useQuery(api.cart.getCart);
  const updateCartItem = useMutation(api.cart.updateCartItem);
  const removeFromCart = useMutation(api.cart.removeFromCart);

  if (cart === undefined) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-32 sm:px-6 lg:px-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const itemTotal = (cart ?? []).reduce(
    (sum, entry) => sum + entry.product.price * entry.item.quantity,
    0,
  );
  const discount = (cart ?? []).reduce(
    (sum, entry) => sum + (entry.product.mrp - entry.product.price) * entry.item.quantity,
    0,
  );
  const deliveryFee = itemTotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const grandTotal = itemTotal + deliveryFee;
  const count = (cart ?? []).reduce((sum, entry) => sum + entry.item.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-28 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-neutral-100">
          <ShoppingBag className="h-6 w-6 text-neutral-400" />
        </span>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-neutral-900">
          Your cart is empty
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
          Nothing here yet. Browse the catalogue and add a few everyday
          essentials.
        </p>
        <Button asChild className="mt-7 rounded-full px-7">
          <Link to="/shop">Browse the catalogue</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="border-b border-neutral-200 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
          Your cart
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          {count} item{count === 1 ? "" : "s"}
        </h1>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Items */}
        <ul>
          {cart.map(({ item, product }) => (
            <li
              key={item._id}
              className="flex gap-5 border-b border-neutral-200 py-6 first:pt-0"
            >
              <Link
                to={`/product/${product._id}`}
                className="shrink-0 overflow-hidden rounded-lg bg-neutral-100"
              >
                <ProductVisual
                  category={product.category}
                  className="h-24 w-24 sm:h-28 sm:w-28"
                  iconClassName="h-10 w-10"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                      {product.brand}
                    </p>
                    <Link
                      to={`/product/${product._id}`}
                      className="mt-0.5 line-clamp-2 text-sm font-medium text-neutral-900 hover:underline hover:underline-offset-4"
                    >
                      {product.name}
                    </Link>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove item"
                    onClick={() => {
                      removeFromCart({ itemId: item._id });
                      trackEvent("remove_from_cart", {
                        item_id: product._id,
                        item_name: product.name,
                      });
                    }}
                    className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center rounded-full border border-neutral-300">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={item.quantity <= 1}
                      onClick={() =>
                        updateCartItem({ itemId: item._id, quantity: item.quantity - 1 })
                      }
                      className="grid h-7 w-7 place-items-center rounded-full text-neutral-600 hover:text-neutral-900 disabled:opacity-40"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-7 text-center text-[13px] font-medium tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={item.quantity >= 10}
                      onClick={() =>
                        updateCartItem({ itemId: item._id, quantity: item.quantity + 1 })
                      }
                      className="grid h-7 w-7 place-items-center rounded-full text-neutral-600 hover:text-neutral-900 disabled:opacity-40"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-neutral-400 line-through">
                    {inr(product.mrp)}
                  </span>
                  <span className="font-medium text-neutral-900">
                    {inr(product.price)}
                  </span>
                  <span className="text-neutral-500">
                    Total:{" "}
                    <span className="font-medium text-neutral-900">
                      {inr(product.price * item.quantity)}
                    </span>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Summary */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-neutral-200 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">
              Order summary
            </h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between text-neutral-600">
                <dt>
                  Item total{" "}
                  <span className="text-neutral-400">({count})</span>
                </dt>
                <dd className="tabular-nums">{inr(itemTotal)}</dd>
              </div>
              <div className="flex justify-between text-neutral-600">
                <dt>Discount</dt>
                <dd className="tabular-nums">−{inr(discount)}</dd>
              </div>
              <div className="flex justify-between text-neutral-600">
                <dt>Delivery</dt>
                <dd className="tabular-nums">
                  {deliveryFee === 0 ? (
                    <span className="text-neutral-900">Free</span>
                  ) : (
                    inr(deliveryFee)
                  )}
                </dd>
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-3 text-base font-semibold text-neutral-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{inr(grandTotal)}</dd>
              </div>
            </dl>
            <Button asChild className="mt-6 h-11 w-full rounded-full">
              <Link to="/checkout">Proceed to checkout</Link>
            </Button>
            <p className="mt-3 text-center text-[13px] text-neutral-500">
              Free delivery on orders over {inr(FREE_DELIVERY_THRESHOLD)}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
