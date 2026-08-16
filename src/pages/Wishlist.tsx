import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Heart, Loader2, ShoppingBag, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ProductVisual } from "@/components/store/ProductVisual";
import { discountPct, inr } from "@/lib/format";

export default function Wishlist() {
  const wishlist = useQuery(api.wishlist.getWishlist);
  const toggleWishlist = useMutation(api.wishlist.toggleWishlist);
  const addToCart = useMutation(api.cart.addToCart);

  if (wishlist === undefined) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-32 sm:px-6 lg:px-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (wishlist.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-28 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-neutral-100">
          <Heart className="h-6 w-6 text-neutral-400" />
        </span>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-neutral-900">
          Your wishlist is empty
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
          Tap the heart on any product to save it here for later.
        </p>
        <Button asChild className="mt-7 rounded-full px-7">
          <Link to="/shop">Browse the catalogue</Link>
        </Button>
      </div>
    );
  }

  const handleRemove = async (productId: string) => {
    try {
      await toggleWishlist({ productId: productId as never });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    }
  };

  const handleAddToCart = async (productId: string) => {
    try {
      await addToCart({ productId: productId as never });
      toast.success("Added to cart");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add to cart.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="border-b border-neutral-200 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
          Saved for later
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          Wishlist
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          {wishlist.length} item{wishlist.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {wishlist.map(({ product }) => {
          const off = discountPct(product.price, product.mrp);
          return (
            <div key={product._id} className="group">
              <Link
                to={`/product/${product._id}`}
                className="relative block overflow-hidden rounded-lg bg-neutral-100"
              >
                <ProductVisual
                  category={product.category}
                  className="aspect-square w-full"
                  iconClassName="h-16 w-16 sm:h-20 sm:w-20"
                />
                <button
                  type="button"
                  aria-label="Remove from wishlist"
                  onClick={(e) => {
                    e.preventDefault();
                    handleRemove(product._id);
                  }}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-neutral-600 transition-colors hover:text-neutral-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </Link>
              <div className="mt-3 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                  {product.brand}
                </p>
                <Link
                  to={`/product/${product._id}`}
                  className="line-clamp-1 text-sm font-medium text-neutral-900 hover:underline hover:underline-offset-4"
                >
                  {product.name}
                </Link>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold text-neutral-900">
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
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full rounded-full border-neutral-300"
                  onClick={() => handleAddToCart(product._id)}
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Move to cart
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
