import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Heart,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Star,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductVisual } from "@/components/store/ProductVisual";
import { api as apiClient, useApiResource } from "@/lib/apiClient";
import { deliveryEta, discountPct, inr, pincodeEta } from "@/lib/format";
import { trackEvent, trackProductView } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const productQuery = useQuery(api.products.getProduct, {
    productId: id as never,
  });
  const reviewsQuery = useQuery(api.products.listReviews, {
    productId: id as never,
  });
  const wishlist = useQuery(api.wishlist.getWishlist);

  const productResource = useApiResource(
    useCallback(() => apiClient.product(id as string), [id]),
    productQuery,
  );
  const reviewsResource = useApiResource(
    useCallback(() => apiClient.productReviews(id as string), [id]),
    reviewsQuery,
  );

  const productData = productResource.data;
  const reviewList = reviewsResource.data;

  const addToCart = useMutation(api.cart.addToCart);
  const toggleWishlist = useMutation(api.wishlist.toggleWishlist);

  useEffect(() => {
    if (productData) trackProductView(productData);
  }, [productData]);

  const [quantity, setQuantity] = useState(1);
  const [pincode, setPincode] = useState("");
  const [eta, setEta] = useState<{ days: number; free: boolean } | null>(null);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const saved = useMemo(() => {
    if (!wishlist || !productData) return false;
    return wishlist.some((entry) => entry.product._id === productData._id);
  }, [wishlist, productData]);

  if (productData === undefined) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-2xl bg-neutral-100" />
          <div className="space-y-4">
            <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
            <div className="h-8 w-3/4 animate-pulse rounded bg-neutral-100" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-neutral-100" />
            <div className="h-32 w-full animate-pulse rounded bg-neutral-100" />
          </div>
        </div>
      </div>
    );
  }

  if (productData === null) {
    return (
      <div className="flex flex-col items-center py-28 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">
          Product not found
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          It may have been removed from the catalogue.
        </p>
        <Button asChild variant="outline" className="mt-6 rounded-full">
          <Link to="/shop">Back to the shop</Link>
        </Button>
      </div>
    );
  }

  const product = productData;

  const off = discountPct(product.price, product.mrp);
  const out = product.stock <= 0;

  const checkPincode = () => {
    const clean = pincode.trim();
    if (!/^\d{6}$/.test(clean)) {
      setPincodeError("Enter a valid 6-digit PIN code.");
      setEta(null);
      return;
    }
    setPincodeError(null);
    setEta({
      days: pincodeEta(clean, product._id),
      free: product.price >= 499,
    });
  };

  const requireAuth = () => {
    if (isAuthenticated) return true;
    navigate(`/auth?returnTo=/product/${product._id}`);
    return false;
  };

  const handleAdd = async () => {
    if (!requireAuth()) return;
    setBusy(true);
    try {
      await addToCart({ productId: product._id, quantity });
      trackEvent(
        "add_to_cart",
        { item_id: product._id, item_name: product.name, quantity, price: product.price },
        `/product/${product._id}`,
      );
      toast.success("Added to cart");
      navigate("/cart");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add to cart.");
    } finally {
      setBusy(false);
    }
  };

  const handleBuyNow = async () => {
    if (!requireAuth()) return;
    setBusy(true);
    try {
      await addToCart({ productId: product._id, quantity });
      navigate("/checkout");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add to cart.");
      setBusy(false);
    }
  };

  const handleWishlist = async () => {
    if (!requireAuth()) return;
    try {
      const added = await toggleWishlist({ productId: product._id });
      trackEvent(
        added ? "add_to_wishlist" : "remove_from_wishlist",
        { item_id: product._id },
        `/product/${product._id}`,
      );
      toast.success(added ? "Saved to wishlist" : "Removed from wishlist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-neutral-400">
        <Link to="/shop" className="transition-colors hover:text-neutral-900">
          Shop
        </Link>
        <span>/</span>
        <Link
          to={`/shop?category=${product.category}`}
          className="transition-colors hover:text-neutral-900"
        >
          {product.category}
        </Link>
        <span>/</span>
        <span className="truncate text-neutral-600">{product.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Visual */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="relative overflow-hidden rounded-2xl bg-neutral-100">
            <ProductVisual
              category={product.category}
              className="aspect-square w-full"
              iconClassName="h-32 w-32 sm:h-44 sm:w-44"
            />
            {out && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[2px]">
                <span className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
                  Out of stock
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 flex items-center gap-1.5 text-[13px] text-neutral-500 transition-colors hover:text-neutral-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        </div>

        {/* Info */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
            {product.brand}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            {product.name}
          </h1>
          {productResource.source === "api" && (
            <p className="mt-1 font-mono text-[11px] text-neutral-400">
              GET /api/v2/product/{product._id} · {productResource.latencyMs}ms
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
            <span className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-neutral-900 text-neutral-900" />
              <span className="font-medium text-neutral-900">{product.rating}</span>
            </span>
            <span>{product.ratingCount.toLocaleString("en-IN")} ratings</span>
            {!out && (
              <>
                <span className="text-neutral-300">·</span>
                <span className={product.stock <= 5 ? "text-neutral-900" : ""}>
                  {product.stock <= 5 ? `Only ${product.stock} left` : "In stock"}
                </span>
              </>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-baseline gap-x-3">
            <span className="text-3xl font-semibold tracking-tight text-neutral-900">
              {inr(product.price)}
            </span>
            <span className="text-base text-neutral-400 line-through">
              {inr(product.mrp)}
            </span>
            {off > 0 && (
              <span className="text-sm font-medium text-neutral-500">
                {off}% off
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-neutral-500">
            Inclusive of all taxes
          </p>

          {product.badges.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {product.badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-sm border border-neutral-300 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}

          <p className="mt-6 text-sm leading-7 text-neutral-600">
            {product.description}
          </p>

          <ul className="mt-6 space-y-2.5">
            {product.highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2.5 text-sm text-neutral-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                {highlight}
              </li>
            ))}
          </ul>

          {/* Quantity + actions */}
          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center rounded-full border border-neutral-300">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="grid h-9 w-9 place-items-center rounded-full text-neutral-600 transition-colors hover:text-neutral-900 disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-medium tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={quantity >= 10}
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                className="grid h-9 w-9 place-items-center rounded-full text-neutral-600 transition-colors hover:text-neutral-900 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full border-neutral-300"
              onClick={handleWishlist}
              aria-label="Toggle wishlist"
            >
              <Heart
                className={cn(
                  "h-4 w-4",
                  saved ? "fill-neutral-900 text-neutral-900" : "text-neutral-600",
                )}
              />
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              className="h-11 flex-1 rounded-full"
              disabled={out || busy}
              onClick={handleAdd}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingBag className="h-4 w-4" />
              )}
              Add to cart
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-full border-neutral-300"
              disabled={out || busy}
              onClick={handleBuyNow}
            >
              Buy now
            </Button>
          </div>

          {out && (
            <p className="mt-3 text-[13px] text-neutral-500">
              This item is currently unavailable. Check back soon — or browse
              similar products in{" "}
              <Link
                to={`/shop?category=${product.category}`}
                className="font-medium text-neutral-900 underline underline-offset-4"
              >
                {product.category}
              </Link>
              .
            </p>
          )}

          {/* Delivery check */}
          <div className="mt-8 rounded-xl border border-neutral-200 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-neutral-900">
              <ChevronDown className="h-4 w-4 text-neutral-400" />
              Check delivery
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={pincode}
                onChange={(e) => {
                  setPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setEta(null);
                  setPincodeError(null);
                }}
                placeholder="Enter PIN code"
                inputMode="numeric"
                className="rounded-full border-neutral-200 bg-neutral-50 focus-visible:bg-white"
                aria-label="PIN code"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-neutral-300"
                onClick={checkPincode}
              >
                Check
              </Button>
            </div>
            {pincodeError && (
              <p className="mt-2 text-[13px] text-neutral-600">{pincodeError}</p>
            )}
            {eta && (
              <p className="mt-3 text-[13px] leading-6 text-neutral-700">
                Deliverable — arrives by{" "}
                <span className="font-medium text-neutral-900">
                  {deliveryEta(Date.now() + eta.days * 86400000)}
                </span>
                {eta.free ? " · Free delivery" : " · ₹49 delivery (free over ₹499)"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section className="mt-20 border-t border-neutral-200 pt-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
              Reviews
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {product.rating} average from {product.ratingCount.toLocaleString("en-IN")}{" "}
              ratings
            </p>
            {reviewsResource.source === "api" && (
              <p className="mt-0.5 font-mono text-[11px] text-neutral-400">
                GET /api/v2/product/{product._id}/reviews · {reviewsResource.latencyMs}ms
              </p>
            )}
          </div>
          {isAuthenticated ? (
            <ReviewForm productId={product._id} />
          ) : (
            <Button asChild variant="outline" className="rounded-full border-neutral-300">
              <Link to={`/auth?returnTo=/product/${product._id}`}>
                Sign in to write a review
              </Link>
            </Button>
          )}
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(reviewList ?? []).map((review) => (
            <article
              key={review._id}
              className="rounded-xl border border-neutral-200 p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-900">
                  {review.userName}
                </span>
                <span className="flex items-center gap-1 text-[13px] text-neutral-500">
                  <Star className="h-3.5 w-3.5 fill-neutral-900 text-neutral-900" />
                  {review.rating}
                </span>
              </div>
              {review.title && (
                <p className="mt-2 text-sm font-medium text-neutral-800">
                  {review.title}
                </p>
              )}
              <p className="mt-1 text-sm leading-6 text-neutral-600">
                {review.comment}
              </p>
            </article>
          ))}
          {reviewList !== undefined && reviewList.length === 0 && (
            <p className="text-sm text-neutral-500">
              No reviews yet — be the first.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function ReviewForm({ productId }: { productId: string }) {
  const addReview = useMutation(api.reviews.addReview);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (comment.trim().length < 5) {
      toast.error("Review is too short.");
      return;
    }
    setBusy(true);
    try {
      await addReview({
        productId: productId as never,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
      });
      toast.success("Thanks — review published");
      setTitle("");
      setComment("");
      setRating(5);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post review.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:w-96">
      <div className="flex items-center gap-1">
        <span className="mr-2 text-[13px] text-neutral-500">Your rating</span>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            onClick={() => setRating(value)}
            className="p-0.5"
          >
            <Star
              className={cn(
                "h-5 w-5 transition-colors",
                value <= rating
                  ? "fill-neutral-900 text-neutral-900"
                  : "text-neutral-300",
              )}
            />
          </button>
        ))}
      </div>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Review title (optional)"
        className="rounded-full border-neutral-200 bg-neutral-50 focus-visible:bg-white"
      />
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What did you think?"
        rows={3}
        className="rounded-xl border-neutral-200 bg-neutral-50 focus-visible:bg-white"
      />
      <Button
        type="submit"
        variant="outline"
        className="self-start rounded-full border-neutral-300"
        disabled={busy}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Publish review
      </Button>
    </form>
  );
}
