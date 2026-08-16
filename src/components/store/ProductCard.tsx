import { Link } from "react-router";
import { Star } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { ProductVisual } from "./ProductVisual";
import { discountPct, inr } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProductCard({
  product,
  className,
}: {
  product: Doc<"products">;
  className?: string;
}) {
  const out = product.stock <= 0;
  const off = discountPct(product.price, product.mrp);

  return (
    <Link
      to={`/product/${product._id}`}
      className={cn("group block outline-none", className)}
      aria-label={product.name}
    >
      <div className="relative overflow-hidden rounded-lg bg-neutral-100 transition-colors">
        <ProductVisual category={product.category} className="aspect-square w-full" iconClassName="h-16 w-16 sm:h-20 sm:w-20" />
        {product.badges.length > 0 && !out && (
          <span className="absolute left-2 top-2 rounded-sm bg-white/90 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-700">
            {product.badges[0]}
          </span>
        )}
        {out && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              Out of stock
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          {product.brand}
        </p>
        <h3 className="line-clamp-1 text-sm font-medium text-neutral-900 group-hover:underline group-hover:underline-offset-4">
          {product.name}
        </h3>
        <div className="flex items-center gap-1 text-xs text-neutral-500">
          <Star className="h-3 w-3 fill-neutral-900 text-neutral-900" />
          <span className="font-medium text-neutral-700">{product.rating}</span>
          <span>({product.ratingCount.toLocaleString("en-IN")})</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 pt-0.5">
          <span className="text-sm font-semibold tracking-tight text-neutral-900">
            {inr(product.price)}
          </span>
          <span className="text-xs text-neutral-400 line-through">
            {inr(product.mrp)}
          </span>
          {off > 0 && (
            <span className="text-xs font-medium text-neutral-500">
              {off}% off
            </span>
          )}
        </div>
        {!out && product.stock <= 5 && (
          <p className="text-[11px] text-neutral-500">
            Only {product.stock} left
          </p>
        )}
      </div>
    </Link>
  );
}
