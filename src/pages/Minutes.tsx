import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bike,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Zap,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProductVisual } from "@/components/store/ProductVisual";
import { api as apiClient, useApiResource, type PickupPoint } from "@/lib/apiClient";
import { inr, unitLabel } from "@/lib/format";
import { trackEvent } from "@/lib/telemetry";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";

const MINUTES_FREE_DELIVERY_THRESHOLD = 99;
const MINUTES_DELIVERY_FEE = 20;

const CHIPS = [
  { slug: "all", label: "All" },
  { slug: "grocery", label: "Groceries" },
  { slug: "vegetables", label: "Vegetables" },
  { slug: "fruits", label: "Fruits" },
  { slug: "dairy", label: "Dairy & Eggs" },
  { slug: "beverages", label: "Beverages" },
  { slug: "snacks", label: "Snacks" },
];

function SectionHeading({
  title,
  apiNote,
}: {
  title: string;
  apiNote?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-2 border-b border-neutral-200 pb-4">
      <h2 className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl">
        {title}
      </h2>
      {apiNote && <p className="font-mono text-[11px] text-neutral-400">{apiNote}</p>}
    </div>
  );
}

function QuickCard({
  product,
  cartQty,
  busy,
  onAdd,
  onIncrement,
  onDecrement,
}: {
  product: Doc<"products">;
  cartQty: number;
  busy: boolean;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const off = Math.round(((product.mrp - product.price) / product.mrp) * 100);
  const unit = unitLabel(product.name, product.unit);
  return (
    <div className="group rounded-xl border border-neutral-200 bg-white transition-colors hover:border-neutral-400">
      <Link to={`/product/${product._id}`} className="block p-3 pb-1">
        <div className="relative overflow-hidden rounded-lg bg-neutral-100">
          <ProductVisual
            category={product.category}
            className="aspect-square w-full"
            iconClassName="h-12 w-12 sm:h-16 sm:w-16"
          />
          {off > 0 && (
            <span className="absolute left-1.5 top-1.5 rounded-sm bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-white">
              {off}% off
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-5 text-neutral-900 group-hover:underline group-hover:underline-offset-4">
          {product.name.replace(/ — .*$/, "")}
        </p>
        {unit && <p className="mt-0.5 text-[12px] text-neutral-500">{unit}</p>}
        <p className="mt-1 text-sm font-semibold tracking-tight text-neutral-900">
          {inr(product.price)}{" "}
          <span className="text-xs font-normal text-neutral-400 line-through">
            {inr(product.mrp)}
          </span>
        </p>
      </Link>
      <div className="p-3 pt-1">
        {cartQty > 0 ? (
          <div className="flex items-center justify-between rounded-full border border-neutral-900">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={busy}
              onClick={onDecrement}
              className="grid h-9 w-9 place-items-center rounded-full text-neutral-900 transition-colors hover:bg-neutral-100 disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-semibold tabular-nums text-neutral-900">
              {cartQty}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={busy}
              onClick={onIncrement}
              className="grid h-9 w-9 place-items-center rounded-full text-neutral-900 transition-colors hover:bg-neutral-100 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full border-neutral-300 text-[13px]"
            disabled={product.stock <= 0 || busy}
            onClick={onAdd}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : product.stock <= 0 ? (
              "Out of stock"
            ) : (
              <>
                <ShoppingBag className="h-3.5 w-3.5" />
                Add in a tap
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function PickupRow({ point }: { point: PickupPoint }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 p-4">
      <span
        className={cn(
          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full",
          point.open ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-400",
        )}
      >
        <MapPin className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="truncate text-sm font-medium text-neutral-900">{point.name}</p>
          <span
            className={cn(
              "rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
              point.open
                ? "bg-neutral-100 text-neutral-700"
                : "bg-neutral-50 text-neutral-400",
            )}
          >
            {point.open ? "Open now" : "Closed"}
          </span>
        </div>
        <p className="mt-0.5 text-[13px] text-neutral-500">
          {point.city} · {point.distanceKm} km away
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-neutral-800">
          <Clock className="h-3.5 w-3.5 text-neutral-400" />
          Delivery in ~{point.etaMinutes} min
        </p>
      </div>
    </div>
  );
}

type CartEntry = { item: Doc<"cartItems">; product: Doc<"products"> };

/**
 * The signature quick-commerce pattern: a sticky bar floats above the bottom
 * edge as soon as the cart has items, showing the running count + total.
 * Tapping it slides the mini-cart up from the bottom.
 */
function MinutesCartBar({
  count,
  total,
  onOpen,
}: {
  count: number;
  total: number;
  onOpen: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-30 px-4 md:bottom-6">
      <div className="mx-auto max-w-md">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center justify-between gap-3 rounded-full bg-neutral-900 py-2.5 pl-3 pr-2 text-white shadow-2xl shadow-neutral-900/30 transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15">
              <ShoppingBag className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] font-bold leading-none text-neutral-900">
                {count > 99 ? "99+" : count}
              </span>
            </span>
            <span className="min-w-0 text-left">
              <span className="block truncate text-[13px] font-semibold leading-tight">
                {count} item{count === 1 ? "" : "s"} · {inr(total)}
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-neutral-400">
                Delivery in ~10 min
              </span>
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-neutral-900">
            View cart
          </span>
        </button>
      </div>
    </div>
  );
}

function MiniCartSheet({
  open,
  onOpenChange,
  entries,
  onIncrement,
  onDecrement,
  onRemove,
  onCheckout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: CartEntry[];
  onIncrement: (product: Doc<"products">) => void;
  onDecrement: (product: Doc<"products">) => void;
  onRemove: (itemId: string) => void;
  onCheckout: () => void;
}) {
  const count = entries.reduce((sum, entry) => sum + entry.item.quantity, 0);
  const itemTotal = entries.reduce(
    (sum, entry) => sum + entry.product.price * entry.item.quantity,
    0,
  );
  const discount = entries.reduce(
    (sum, entry) => sum + (entry.product.mrp - entry.product.price) * entry.item.quantity,
    0,
  );
  const deliveryFee =
    itemTotal >= MINUTES_FREE_DELIVERY_THRESHOLD ? 0 : MINUTES_DELIVERY_FEE;
  const grandTotal = itemTotal + deliveryFee;
  const remaining = Math.max(0, MINUTES_FREE_DELIVERY_THRESHOLD - itemTotal);
  const progress = Math.min(100, (itemTotal / MINUTES_FREE_DELIVERY_THRESHOLD) * 100);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md rounded-t-3xl border-neutral-200 px-0 pb-0"
      >
        <SheetHeader className="border-b border-neutral-100 px-5 pb-4">
          <SheetTitle className="text-base text-neutral-900">
            Your cart · {count} item{count === 1 ? "" : "s"}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 text-[13px]">
            <Zap className="h-3.5 w-3.5 text-neutral-400" />
            Delivering in ~10 min — no minimum order
          </SheetDescription>
        </SheetHeader>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100">
              <ShoppingBag className="h-5 w-5 text-neutral-400" />
            </span>
            <p className="mt-4 text-sm font-medium text-neutral-900">Your cart is empty</p>
            <p className="mt-1 text-[13px] text-neutral-500">
              Add a few essentials and they'll show up here.
            </p>
          </div>
        ) : (
          <>
            {/* Free-delivery progress */}
            <div className="px-5 pt-4">
              {remaining > 0 ? (
                <p className="text-[12px] text-neutral-600">
                  Add <span className="font-semibold text-neutral-900">{inr(remaining)}</span>{" "}
                  more for free delivery
                </p>
              ) : (
                <p className="text-[12px] font-medium text-neutral-900">
                  Free delivery unlocked 🎉
                </p>
              )}
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-neutral-900 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Items */}
            <ul className="max-h-[38vh] flex-1 space-y-1 overflow-y-auto px-3 py-3">
              {entries.map(({ item, product }) => (
                <li
                  key={item._id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-neutral-50"
                >
                  <span className="shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                    <ProductVisual
                      category={product.category}
                      className="h-14 w-14"
                      iconClassName="h-6 w-6"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium leading-5 text-neutral-900">
                      {product.name.replace(/ — .*$/, "")}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-neutral-500">
                      {unitLabel(product.name, product.unit) ?? product.brand}
                    </span>
                    <span className="mt-0.5 block text-[13px] font-semibold tabular-nums text-neutral-900">
                      {inr(product.price)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Decrease ${product.name} quantity`}
                      onClick={() => onDecrement(product)}
                      className="grid h-8 w-8 place-items-center rounded-full border border-neutral-300 text-neutral-700 transition-colors hover:bg-neutral-100"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-[13px] font-semibold tabular-nums text-neutral-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase ${product.name} quantity`}
                      onClick={() => onIncrement(product)}
                      className="grid h-8 w-8 place-items-center rounded-full border border-neutral-900 text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${product.name}`}
                      onClick={() => onRemove(item._id)}
                      className="ml-1 grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>

            {/* Totals + checkout */}
            <SheetFooter className="border-t border-neutral-100 bg-white px-5 pb-5 pt-4">
              <dl className="w-full space-y-1.5 text-[13px]">
                <div className="flex justify-between text-neutral-600">
                  <dt>Item total</dt>
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
                <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-[15px] font-semibold text-neutral-900">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{inr(grandTotal)}</dd>
                </div>
              </dl>
              <Button
                type="button"
                className="h-12 w-full rounded-full"
                onClick={onCheckout}
              >
                <Zap className="h-4 w-4" />
                Checkout in ~10 min · {inr(grandTotal)}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function Minutes() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [chip, setChip] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const addToCart = useMutation(api.cart.addToCart);
  const updateCartItem = useMutation(api.cart.updateCartItem);
  const removeFromCart = useMutation(api.cart.removeFromCart);
  const cart = useQuery(api.cart.getCart);

  const cartEntries: CartEntry[] = cart ?? [];
  const cartCount = cartEntries.reduce((sum, entry) => sum + entry.item.quantity, 0);
  const cartTotal = cartEntries.reduce(
    (sum, entry) => sum + entry.product.price * entry.item.quantity,
    0,
  );

  const goToCheckout = () => {
    setCartOpen(false);
    navigate(isAuthenticated ? "/checkout" : "/auth?returnTo=/checkout");
  };

  const handleRemove = async (itemId: string) => {
    try {
      await removeFromCart({ itemId: itemId as never });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove item.");
    }
  };

  const catalog = useApiResource(
    useCallback(() => apiClient.minutesCatalog(), []),
    undefined,
  );
  const flash = useApiResource(
    useCallback(() => apiClient.flashSales(), []),
    undefined,
  );
  const pickup = useApiResource(
    useCallback(() => apiClient.pickupPoints(), []),
    undefined,
  );

  const items = catalog.data?.items ?? [];
  const trending = catalog.data?.trending ?? [];
  const points = pickup.data ?? [];

  const filtered = useMemo(
    () => (chip === "all" ? items : items.filter((p) => p.category === chip)),
    [items, chip],
  );

  const cartQty = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of cart ?? []) {
      map.set(entry.product._id, entry.item.quantity);
    }
    return map;
  }, [cart]);

  const requireAuth = () => {
    if (isAuthenticated) return true;
    navigate(`/auth?returnTo=/minutes`);
    return false;
  };

  const handleAdd = async (product: Doc<"products">) => {
    if (!requireAuth()) return;
    setBusyId(product._id);
    try {
      await addToCart({ productId: product._id, quantity: 1 });
      trackEvent(
        "add_to_cart",
        {
          item_id: product._id,
          item_name: product.name,
          quantity: 1,
          price: product.price,
          source: "minutes",
        },
        "/minutes",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add to cart.");
    } finally {
      setBusyId(null);
    }
  };

  const handleIncrement = async (product: Doc<"products">) => {
    const entry = (cart ?? []).find((e) => e.product._id === product._id);
    if (!entry) {
      await handleAdd(product);
      return;
    }
    setBusyId(product._id);
    try {
      await updateCartItem({ itemId: entry.item._id, quantity: entry.item.quantity + 1 });
      trackEvent("update_cart", {
        item_id: product._id,
        quantity: entry.item.quantity + 1,
        source: "minutes",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update cart.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDecrement = async (product: Doc<"products">) => {
    const entry = (cart ?? []).find((e) => e.product._id === product._id);
    if (!entry) return;
    setBusyId(product._id);
    try {
      if (entry.item.quantity <= 1) {
        await removeFromCart({ itemId: entry.item._id });
        trackEvent("remove_from_cart", { item_id: product._id, source: "minutes" });
      } else {
        await updateCartItem({ itemId: entry.item._id, quantity: entry.item.quantity - 1 });
        trackEvent("update_cart", {
          item_id: product._id,
          quantity: entry.item.quantity - 1,
          source: "minutes",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update cart.");
    } finally {
      setBusyId(null);
    }
  };

  const grid = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5";

  return (
    <div>
      {/* Hero */}
      <section className="bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
                <Zap className="h-3.5 w-3.5" />
                Staple Minutes · marketplace=HYPERLOCAL
              </p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-800/60 px-3 py-1.5 text-[12px] font-medium text-neutral-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Stores live now · delivering in ~10 min
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
                Out of everything,
                <br />
                in about ten minutes.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-neutral-400">
                Grocery, dairy, fruit and snacks picked from a store near you
                and delivered by bike — no minimum order, no waiting.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  className="h-11 rounded-full bg-white px-6 text-neutral-900 hover:bg-neutral-200"
                >
                  <Link to="#essentials">
                    Shop essentials
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Link
                  to="#stores"
                  className="flex items-center gap-2 text-sm font-medium text-neutral-300 transition-colors hover:text-white"
                >
                  <MapPin className="h-4 w-4" />
                  Find a store near you
                </Link>
              </div>
            </div>

            <div className="grid w-full max-w-md grid-cols-3 gap-px overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-800">
              {[
                { value: "~10", label: "min delivery" },
                { value: "₹0", label: "delivery fee" },
                { value: "24/7", label: "stores open" },
              ].map((stat) => (
                <div key={stat.label} className="bg-neutral-900 px-4 py-6 text-center">
                  <p className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Essentials — chips + grid */}
      <section id="essentials" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <SectionHeading
          title="Everything, in minutes"
          apiNote={
            catalog.source === "api"
              ? `GET /api/v2/minutes/catalog · ${catalog.latencyMs}ms`
              : "GET /api/v2/minutes/catalog"
          }
        />

        {/* Category chips */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CHIPS.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setChip(c.slug)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-[13px] transition-colors",
                chip === c.slug
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {filtered.length > 0 ? (
          <div className={grid}>
            {filtered.map((product) => (
              <QuickCard
                key={product._id}
                product={product}
                cartQty={cartQty.get(product._id) ?? 0}
                busy={busyId === product._id}
                onAdd={() => handleAdd(product)}
                onIncrement={() => handleIncrement(product)}
                onDecrement={() => handleDecrement(product)}
              />
            ))}
          </div>
        ) : (
          <div className={grid}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl bg-neutral-100" />
            ))}
          </div>
        )}
      </section>

      {/* Trending rail */}
      {trending.length > 0 && (
        <section className="border-y border-neutral-200/80 bg-neutral-50/60">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
            <SectionHeading
              title="Trending now"
              apiNote={
                catalog.source === "api"
                  ? "GET /api/v2/minutes/catalog (trending)"
                  : "GET /api/v2/minutes/catalog"
              }
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {trending.map((product) => (
                <QuickCard
                  key={product._id}
                  product={product}
                  cartQty={cartQty.get(product._id) ?? 0}
                  busy={busyId === product._id}
                  onAdd={() => handleAdd(product)}
                  onIncrement={() => handleIncrement(product)}
                  onDecrement={() => handleDecrement(product)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Flash rail */}
      {flash.data && flash.data.length > 0 && (
        <section className="border-b border-neutral-200/80">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
            <SectionHeading
              title="Flying off the shelves"
              apiNote={
                flash.source === "api"
                  ? `GET /api/v2/flash-sales · ${flash.latencyMs}ms`
                  : "GET /api/v2/flash-sales"
              }
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {flash.data.map((sale) => (
                <Link
                  key={sale.productId}
                  to={`/product/${sale.productId}`}
                  className="group block"
                >
                  <div className="relative overflow-hidden rounded-lg bg-neutral-100">
                    <ProductVisual
                      category={sale.category}
                      className="aspect-square w-full"
                      iconClassName="h-10 w-10 sm:h-14 sm:w-14"
                    />
                    <span className="absolute left-2 top-2 rounded-sm bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white">
                      {sale.discountPct}% off
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-1 text-[13px] font-medium text-neutral-900 group-hover:underline group-hover:underline-offset-4">
                    {sale.name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-neutral-500">
                    {inr(sale.price)}{" "}
                    <span className="text-neutral-400 line-through">{inr(sale.mrp)}</span>
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pickup points */}
      <section id="stores" className="border-b border-neutral-200/80">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <SectionHeading
            title="Stores near you"
            apiNote={
              pickup.source === "api"
                ? `GET /api/v2/locations/pickup-points · ${pickup.latencyMs}ms`
                : "GET /api/v2/locations/pickup-points"
            }
          />
          {points.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {points.map((point) => (
                <PickupRow key={point.id} point={point} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-neutral-100" />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-neutral-50/60">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { icon: Bike, title: "Ridden, not shipped", detail: "Local riders deliver every order in under 20 minutes." },
              { icon: Check, title: "Fresh, guaranteed", detail: "Unsatisfied? Replace or refund on the spot — no forms." },
              { icon: Zap, title: "One tap checkout", detail: "Wallet balance settles instantly at checkout." },
            ].map(({ icon: Icon, title, detail }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-neutral-900">{title}</p>
                  <p className="mt-1 text-[13px] leading-6 text-neutral-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center font-mono text-[11px] text-neutral-400">
            {catalog.source === "api" || pickup.source === "api" || flash.source === "api"
              ? "Minutes storefront served via the REST gateway — minutes/catalog, flash-sales & pickup-points endpoints."
              : "REST gateway unavailable — serving from Convex."}
          </p>
        </div>
      </section>

      {/* Floating cart + slide-up mini-cart */}
      <MinutesCartBar
        count={cartCount}
        total={cartTotal}
        onOpen={() => setCartOpen(true)}
      />
      <MiniCartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        entries={cartEntries}
        onIncrement={(product) => handleIncrement(product)}
        onDecrement={(product) => handleDecrement(product)}
        onRemove={(itemId) => handleRemove(itemId)}
        onCheckout={goToCheckout}
      />
    </div>
  );
}
