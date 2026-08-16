import { useCallback } from "react";
import { Link, useSearchParams } from "react-router";
import { SearchX, SlidersHorizontal } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductCard } from "@/components/store/ProductCard";
import { api as apiClient, useApiResource } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
] as const;

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const sort = searchParams.get("sort") ?? "featured";

  const categoriesQuery = useQuery(api.products.listCategories);
  const productsQuery = useQuery(api.products.listProducts, {
    q: q || undefined,
    category: category || undefined,
    sort: (SORTS.some((s) => s.value === sort) ? sort : "featured") as
      | "featured"
      | "price-asc"
      | "price-desc"
      | "rating"
      | "newest",
  });

  const categories = useApiResource(
    useCallback(() => apiClient.categories(), []),
    categoriesQuery,
  );
  const products = useApiResource(
    useCallback(
      () => apiClient.search({ q: q || undefined, category: category || undefined, sort }),
      [q, category, sort],
    ),
    productsQuery,
  );

  const list = categories.data ?? [];
  const productList = products.data;

  const categoryName = list.find((c) => c.slug === category)?.name;

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const title = categoryName ?? (q ? `Results for “${q}”` : "All products");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex flex-col gap-6 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
            {categoryName ? "Category" : q ? "Search" : "Catalogue"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {productList
              ? `${productList.length} product${productList.length === 1 ? "" : "s"}`
              : "Loading…"}
            {products.source === "api" && (
              <span className="ml-2 font-mono text-[11px] text-neutral-400">
                GET /api/v2/search · {products.latencyMs}ms
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-neutral-400" />
          <Select value={sort} onValueChange={(value) => update({ sort: value })}>
            <SelectTrigger className="w-44 rounded-full border-neutral-200 bg-white text-[13px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-[13px]">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category chips */}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => update({ category: null })}
          className={cn(
            "shrink-0 rounded-full border px-4 py-1.5 text-[13px] transition-colors",
            !category
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400",
          )}
        >
          All
        </button>
        {list.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => update({ category: c.slug })}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-[13px] transition-colors",
              category === c.slug
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {productList === undefined ? (
        <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-square animate-pulse rounded-lg bg-neutral-100" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : productList.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-neutral-100">
            <SearchX className="h-6 w-6 text-neutral-400" />
          </span>
          <h2 className="mt-6 text-lg font-medium text-neutral-900">
            Nothing found
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
            We couldn't find anything matching your filters. Try a different
            search or clear the filters to browse the full catalogue.
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-6 rounded-full border-neutral-300"
          >
            <Link to="/shop">Clear filters</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {productList.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
