import { Link } from "react-router";
import { motion } from "framer-motion";
import { ArrowRight, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/store/ProductCard";
import { CategoryIcon } from "@/components/store/ProductVisual";

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
}: {
  title: string;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between border-b border-neutral-200 pb-4">
      <h2 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
        {title}
      </h2>
      {linkTo && (
        <Link
          to={linkTo}
          className="group flex items-center gap-1 text-[13px] font-medium text-neutral-600 transition-colors hover:text-neutral-900"
        >
          {linkLabel ?? "View all"}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

export default function Landing() {
  const categories = useQuery(api.products.listCategories);
  const deals = useQuery(api.products.dealProducts, {});
  const featured = useQuery(api.products.featuredProducts, {});

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
              priced honestly and delivered in days. No flash sales, no noise.
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

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeading title="Shop by category" linkTo="/shop" linkLabel="All products" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(categories ?? []).map((category, index) => (
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
          {categories === undefined &&
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
          />
          {deals ? (
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {deals.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          ) : (
            <SkeletonGrid />
          )}
        </div>
      </section>

      {/* Editorial band */}
      <section className="bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-neutral-500">
            Staple philosophy
          </p>
          <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            Own less, choose better. Buy once, buy well.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-neutral-400">
            Every product in the catalogue is picked for durability, honest
            pricing and daily usefulness. If it doesn't earn a permanent place
            in your life, it doesn't make the shelf.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="h-11 rounded-full bg-white px-7 text-neutral-900 hover:bg-neutral-200"
            >
              <Link to="/shop">
                Start with the essentials
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-11 rounded-full px-7 text-white hover:bg-white/10"
            >
              <Link to="/auth">Sign in</Link>
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
        />
        {featured ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <SkeletonGrid />
        )}
      </section>
    </div>
  );
}
