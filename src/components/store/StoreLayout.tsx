import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { Search, ShoppingBag, User, Wallet, Heart, Package } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

let seedRequested = false;

function Brand({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn("flex shrink-0 items-center gap-2.5", className)}
      aria-label="Staple home"
    >
      <span className="grid h-6 w-6 place-items-center bg-neutral-900">
        <span className="h-2 w-2 bg-white" />
      </span>
      <span className="text-[13px] font-semibold uppercase tracking-[0.24em] text-neutral-900">
        Staple
      </span>
    </Link>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-medium leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function Header() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [queryMobile, setQueryMobile] = useState("");
  const cart = useQuery(api.cart.getCart);
  const wishlist = useQuery(api.wishlist.getWishlist);
  const categories = useQuery(api.products.listCategories);

  const cartCount = (cart ?? []).reduce((sum, entry) => sum + entry.item.quantity, 0);
  const wishlistCount = wishlist?.length ?? 0;

  const submit = (e: React.FormEvent<HTMLFormElement>, value: string) => {
    e.preventDefault();
    const q = value.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
  };

  const currentCategory = new URLSearchParams(location.search).get("category");

  const navLink = (to: string, active: boolean) =>
    cn(
      "whitespace-nowrap text-[13px] transition-colors",
      active
        ? "font-medium text-neutral-900"
        : "text-neutral-500 hover:text-neutral-900",
    );

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          <Brand />
          <form
            onSubmit={(e) => submit(e, query)}
            className="hidden flex-1 justify-center md:flex"
            role="search"
          >
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, brands…"
                className="h-9 rounded-full border-neutral-200 bg-neutral-50 pl-9 pr-4 text-sm focus-visible:bg-white"
                aria-label="Search products"
              />
            </div>
          </form>
          <nav className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              to="/wishlist"
              className="relative rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" />
              <CountBadge count={wishlistCount} />
            </Link>
            <Link
              to="/orders"
              className="hidden rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 sm:block"
              aria-label="Orders"
            >
              <Package className="h-5 w-5" />
            </Link>
            <Link
              to="/wallet"
              className="hidden rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 sm:block"
              aria-label="Wallet"
            >
              <Wallet className="h-5 w-5" />
            </Link>
            <Link
              to="/account"
              className={cn(
                "flex items-center gap-2 rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900",
                !isAuthenticated && "hidden sm:flex",
              )}
              aria-label="Account"
            >
              {isAuthenticated && user?.name ? (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-neutral-900 text-[11px] font-medium text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <User className="h-5 w-5" />
              )}
            </Link>
            {!isAuthenticated && (
              <Link
                to="/auth"
                className="ml-1 hidden rounded-full border border-neutral-300 px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-100 sm:block"
              >
                Sign in
              </Link>
            )}
            <Link
              to="/cart"
              className="relative rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Cart"
            >
              <ShoppingBag className="h-5 w-5" />
              <CountBadge count={cartCount} />
            </Link>
          </nav>
        </div>

        <form
          onSubmit={(e) => submit(e, queryMobile)}
          className="pb-3 md:hidden"
          role="search"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={queryMobile}
              onChange={(e) => setQueryMobile(e.target.value)}
              placeholder="Search products, brands…"
              className="h-9 rounded-full border-neutral-200 bg-neutral-50 pl-9 pr-4 text-sm focus-visible:bg-white"
              aria-label="Search products"
            />
          </div>
        </form>
      </div>

      <nav className="border-t border-neutral-100">
        <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden">
          <Link
            to="/shop"
            className={navLink("/shop", !currentCategory && location.pathname === "/shop")}
          >
            All products
          </Link>
          {(categories ?? []).map((category) => (
            <Link
              key={category.slug}
              to={`/shop?category=${category.slug}`}
              className={navLink(
                `/shop?category=${category.slug}`,
                currentCategory === category.slug,
              )}
            >
              {category.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  const categories = useQuery(api.products.listCategories);
  const shopLinks = (categories ?? []).slice(0, 5);

  const linkClass =
    "text-[13px] text-neutral-500 transition-colors hover:text-neutral-900";

  return (
    <footer className="border-t border-neutral-200/80 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Brand />
            <p className="max-w-xs text-sm leading-6 text-neutral-500">
              Considered goods for everyday life. A quiet store with honest
              prices, fast delivery and nothing you don't need.
            </p>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
              Shop
            </h4>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link to="/shop" className={linkClass}>
                  All products
                </Link>
              </li>
              {shopLinks.map((category) => (
                <li key={category.slug}>
                  <Link to={`/shop?category=${category.slug}`} className={linkClass}>
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
              Account
            </h4>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link to="/account" className={linkClass}>
                  Profile
                </Link>
              </li>
              <li>
                <Link to="/orders" className={linkClass}>
                  Orders
                </Link>
              </li>
              <li>
                <Link to="/cart" className={linkClass}>
                  Cart
                </Link>
              </li>
              <li>
                <Link to="/wishlist" className={linkClass}>
                  Wishlist
                </Link>
              </li>
              <li>
                <Link to="/wallet" className={linkClass}>
                  Wallet & gift cards
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
              Platform
            </h4>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link to="/api" className={linkClass}>
                  API reference
                </Link>
              </li>
              <li className="text-[13px] text-neutral-500">Free delivery over ₹499</li>
              <li className="text-[13px] text-neutral-500">7-day no-questions returns</li>
              <li className="text-[13px] text-neutral-500">Pay with wallet, card or COD</li>
            </ul>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-neutral-100 pt-6 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Staple. A minimal commerce demo.</p>
          <p>Prices in INR · GST included</p>
        </div>
      </div>
    </footer>
  );
}

export function StoreLayout() {
  const location = useLocation();
  const ensureSeed = useMutation(api.seed.ensureSeed);

  useEffect(() => {
    if (!seedRequested) {
      seedRequested = true;
      ensureSeed().catch(() => {
        seedRequested = false;
      });
    }
  }, [ensureSeed]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900 antialiased">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
