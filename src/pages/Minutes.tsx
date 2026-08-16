import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bike,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  ShoppingBag,
  Zap,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProductVisual } from "@/components/store/ProductVisual";
import { api as apiClient, useApiResource, type PickupPoint } from "@/lib/apiClient";
import { inr } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";

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
  onAdd,
  busyId,
}: {
  product: Doc<"products">;
  onAdd: (product: Doc<"products">) => void;
  busyId: string | null;
}) {
  const off = Math.round(((product.mrp - product.price) / product.mrp) * 100);
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
          {product.name}
        </p>
        <p className="mt-1 text-sm font-semibold tracking-tight text-neutral-900">
          {inr(product.price)}{" "}
          <span className="text-xs font-normal text-neutral-400 line-through">
            {inr(product.mrp)}
          </span>
        </p>
      </Link>
      <div className="p-3 pt-1">
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-full border-neutral-300 text-[13px]"
          disabled={product.stock <= 0 || busyId === product._id}
          onClick={() => onAdd(product)}
        >
          {busyId === product._id ? (
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

export default function Minutes() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const addToCart = useMutation(api.cart.addToCart);
  const [busyId, setBusyId] = useState<string | null>(null);

  const grocery = useApiResource(
    useCallback(() => apiClient.search({ category: "grocery" }), []),
    undefined,
  );
  const beauty = useApiResource(
    useCallback(() => apiClient.search({ category: "beauty" }), []),
    undefined,
  );
  const kitchen = useApiResource(
    useCallback(() => apiClient.search({ category: "kitchen" }), []),
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

  const groceryList = grocery.data ?? [];
  const beautyList = beauty.data ?? [];
  const kitchenList = kitchen.data ?? [];
  const points = pickup.data ?? [];

  const handleAdd = async (product: Doc<"products">) => {
    if (!isAuthenticated) {
      navigate(`/auth?returnTo=/minutes`);
      return;
    }
    setBusyId(product._id);
    try {
      await addToCart({ productId: product._id, quantity: 1 });
      toast.success("Added to cart");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add to cart.");
    } finally {
      setBusyId(null);
    }
  };

  const grid = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

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
              <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
                Out of everything,
                <br />
                in about ten minutes.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-neutral-400">
                Grocery, home and beauty essentials picked from a store near you
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

      {/* Flash rail */}
      {flash.data && flash.data.length > 0 && (
        <section className="border-b border-neutral-200/80 bg-neutral-50/60">
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

      {/* Essentials */}
      <section id="essentials" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <SectionHeading
          title="Grocery & pantry"
          apiNote={
            grocery.source === "api"
              ? `GET /api/v2/search?category=grocery · ${grocery.latencyMs}ms`
              : "GET /api/v2/search?category=grocery"
          }
        />
        {groceryList.length > 0 ? (
          <div className={grid}>
            {groceryList.map((product) => (
              <QuickCard
                key={product._id}
                product={product}
                onAdd={handleAdd}
                busyId={busyId}
              />
            ))}
          </div>
        ) : (
          <div className={grid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl bg-neutral-100" />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-neutral-200/80">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <SectionHeading
            title="Beauty & self-care"
            apiNote={
              beauty.source === "api"
                ? `GET /api/v2/search?category=beauty · ${beauty.latencyMs}ms`
                : "GET /api/v2/search?category=beauty"
            }
          />
          {beautyList.length > 0 ? (
            <div className={grid}>
              {beautyList.map((product) => (
                <QuickCard
                  key={product._id}
                  product={product}
                  onAdd={handleAdd}
                  busyId={busyId}
                />
              ))}
            </div>
          ) : (
            <div className={grid}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-xl bg-neutral-100" />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-neutral-200/80">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <SectionHeading
            title="Kitchen essentials"
            apiNote={
              kitchen.source === "api"
                ? `GET /api/v2/search?category=kitchen · ${kitchen.latencyMs}ms`
                : "GET /api/v2/search?category=kitchen"
            }
          />
          {kitchenList.length > 0 ? (
            <div className={grid}>
              {kitchenList.map((product) => (
                <QuickCard
                  key={product._id}
                  product={product}
                  onAdd={handleAdd}
                  busyId={busyId}
                />
              ))}
            </div>
          ) : (
            <div className={grid}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-xl bg-neutral-100" />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-t border-neutral-200/80 bg-neutral-50/60">
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
            {flash.source === "api" || pickup.source === "api" || grocery.source === "api"
              ? "Minutes storefront served via the REST gateway — search, flash-sales & pickup-points endpoints."
              : "REST gateway unavailable — serving from Convex."}
          </p>
        </div>
      </section>
    </div>
  );
}
