import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  RotateCcw,
  ShieldCheck,
  Truck,
  Zap,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/store/ProductCard";
import { CategoryIcon, ProductVisual } from "@/components/store/ProductVisual";
import {
  api as apiClient,
  useApiResource,
  type FlashSale,
} from "@/lib/apiClient";
import { inr, shortDate } from "@/lib/format";
import { readRecentlyViewed } from "@/lib/recentlyViewed";

function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="aspect-square animate-pulse rounded-lg bg-neutral-100" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-100" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

function SectionHeading({
  title,
  linkTo,
  linkLabel,
  apiNote,
}: {
  title: string;
  linkTo?: string;
  linkLabel?: string;
  apiNote?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between border-b border-neutral-200 pb-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
          {title}
        </h2>
        {apiNote && (
          <p className="mt-1 font-mono text-[11px] text-neutral-400">{apiNote}</p>
        )}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="group flex shrink-0 items-center gap-1 text-[13px] font-medium text-neutral-600 transition-colors hover:text-neutral-900"
        >
          {linkLabel ?? "View all"}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function useCountdown(target: number): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const diff = Math.max(0, target - now);
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor(diff / 60_000) % 60;
  const s = Math.floor(diff / 1_000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function FlashStrip({ flash }: { flash: FlashSale[] | undefined }) {
  const target = flash?.[0]?.endsAt ?? Date.now() + 3 * 3600_000;
  const countdown = useCountdown(target);

  if (!flash || flash.length === 0) return null;

  return (
    <section className="border-b border-neutral-200/80 bg-neutral-50/60">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
              <Clock className="h-3.5 w-3.5" />
              Flash sale · live now
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-neutral-900">
              Up to {Math.max(...flash.map((f) => f.discountPct))}% off essentials
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-neutral-900 bg-neutral-900 px-4 py-2 font-mono text-sm tabular-nums text-white">
            <Clock className="h-4 w-4" />
            {countdown}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {flash.map((sale) => (
            <Link key={sale.productId} to={`/product/${sale.productId}`} className="group block">
              <div className="relative overflow-hidden rounded-lg bg-neutral-100">
                <ProductVisual category={sale.category} className="aspect-square w-full" iconClassName="h-12 w-12 sm:h-16 sm:w-16" />
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
  );
}

export default function Landing() {
  const categoriesQuery = useQuery(api.products.listCategories);
  const dealsQuery = useQuery(api.products.dealProducts, {});
  const featuredQuery = useQuery(api.products.featuredProducts, {});

  const categories = useApiResource(
    useCallback(() => apiClient.categories(), []),
    categoriesQuery,
  );
  const deals = useApiResource(
    useCallback(() => apiClient.deals(), []),
    dealsQuery,
  );
  const featured = useApiResource(
    useCallback(() => apiClient.recommendations(), []),
    featuredQuery,
  );
  const flash = useApiResource(
    useCallback(() => apiClient.flashSales(), []),
    undefined,
  );

  const [recent] = useState(() => readRecentlyViewed());

  const list = categories.data ?? [];
  const dealList = deals.data ?? [];
  const featuredList = featured.data ?? [];

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-neutral-200/80">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mx-auto max-w-3xl text-center"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-400">
              A quiet store for daily life
            </p>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-neutral-900 sm:text-6xl">
              Considered goods,
              <br />
              nothing more.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-neutral-500 sm:text-lg">
              Everyday essentials — phones, audio, home, kitchen and more —
              priced honestly and delivered in days. Out of time?{" "}
              <Link to="/minutes" className="font-medium text-neutral-900 underline underline-offset-4">
                Minutes delivers in ~10
              </Link>
              .
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-11 rounded-full px-7">
                <Link to="/shop">
                  Browse the catalogue
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 rounded-full border-neutral-300 px-7"
              >
                <Link to="/auth">Create an account</Link>
              </Button>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-6 border-t border-neutral-200 pt-8 text-left sm:grid-cols-3">
              {[
                { icon: Truck, label: "Free delivery", detail: "on orders over ₹499" },
                { icon: RotateCcw, label: "7-day returns", detail: "no questions asked" },
                { icon: ShieldCheck, label: "Secure checkout", detail: "wallet, card or COD" },
              ].map(({ icon: Icon, label, detail }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{label}</p>
                    <p className="mt-0.5 text-[13px] text-neutral-500">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Flash sale */}
      <FlashStrip flash={flash.data} />

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeading
          title="Shop by category"
          linkTo="/shop"
          linkLabel="All products"
          apiNote={
            categories.source === "api"
              ? `GET /api/v2/categories · ${categories.latencyMs}ms`
              : "GET /api/v2/categories (Convex fallback)"
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {list.map((category, index) => (
            <motion.div
              key={category.slug}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.03 }}
            >
              <Link
                to={`/shop?category=${category.slug}`}
                className="group flex h-full flex-col gap-5 rounded-xl border border-neutral-200 p-5 transition-colors duration-200 hover:border-neutral-900"
              >
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-neutral-100 transition-colors duration-200 group-hover:bg-neutral-900">
                  <CategoryIcon
                    category={category.slug}
                    className="h-5 w-5 text-neutral-500 transition-colors duration-200 group-hover:text-white"
                  />
                </span>
                <span className="mt-auto text-sm font-medium text-neutral-900">
                  {category.name}
                </span>
              </Link>
            </motion.div>
          ))}
          {categories.data === undefined &&
            categoriesQuery === undefined &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-neutral-100 bg-neutral-50"
              />
            ))}
        </div>
      </section>

      {/* Deals */}
      <section className="border-t border-neutral-200/80">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SectionHeading
            title="Today's best value"
            linkTo="/shop?sort=price-desc"
            linkLabel="Shop the deals"
            apiNote={
              deals.source === "api"
                ? `GET /api/v2/deals · ${deals.latencyMs}ms`
                : "GET /api/v2/deals (Convex fallback)"
            }
          />
          {dealList.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {dealList.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          ) : (
            <SkeletonGrid />
          )}
        </div>
      </section>

      {/* Minutes banner */}
      <section className="bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
            <div className="max-w-xl">
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
                <Zap className="h-3.5 w-3.5" />
                Staple Minutes
              </p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
                Running late? Essentials in ~10 minutes.
              </h2>
              <p className="mt-4 text-sm leading-7 text-neutral-400">
                Grocery, coffee, home and beauty basics from a store near you —
                delivered in minutes, not days.
              </p>
            </div>
            <Button
              asChild
              className="h-11 shrink-0 rounded-full bg-white px-7 text-neutral-900 hover:bg-neutral-200"
            >
              <Link to="/minutes">
                Shop Minutes
                <Zap className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Most loved */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeading
          title="Most loved"
          linkTo="/shop?sort=rating"
          linkLabel="See top rated"
          apiNote={
            featured.source === "api"
              ? `GET /api/v2/recommendations · ${featured.latencyMs}ms`
              : "GET /api/v2/recommendations (Convex fallback)"
          }
        />
        {featuredList.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {featuredList.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <SkeletonGrid />
        )}
      </section>

      {/* Recently viewed */}
      {recent.length > 0 && (
        <section className="border-t border-neutral-200/80">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeading
              title="Recently viewed"
              linkTo="/shop"
              linkLabel="Browse more"
              apiNote="GET /api/v2/user/recently-viewed · on-device"
            />
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-4">
              {recent.map((item) => (
                <Link key={item.id} to={`/product/${item.id}`} className="group block">
                  <div className="overflow-hidden rounded-lg bg-neutral-100">
                    <ProductVisual
                      category={item.category}
                      className="aspect-square w-full"
                      iconClassName="h-14 w-14 sm:h-20 sm:w-20"
                    />
                  </div>
                  <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                    {item.brand}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-sm font-medium text-neutral-900 group-hover:underline group-hover:underline-offset-4">
                    {item.name}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {inr(item.price)}{" "}
                    <span className="text-neutral-400 line-through">{inr(item.mrp)}</span>
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <p className="mx-auto max-w-7xl px-4 pb-10 text-center font-mono text-[11px] text-neutral-400 sm:px-6 lg:px-8">
        {categories.source === "api" || deals.source === "api" || featured.source === "api"
          ? "Homepage content served via the REST gateway (GET /api/4/page/fetch & friends)."
          : "REST gateway unavailable — serving from Convex."}
      </p>
    </div>
  );
}
