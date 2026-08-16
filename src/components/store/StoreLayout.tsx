import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  Grid2x2,
  Loader2,
  Package,
  Search,
  ShoppingBag,
  Tag,
  User,
  Wallet,
  Heart,
  Package as PackageIcon,
  Zap,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api as apiClient, type Suggestion } from "@/lib/apiClient";
import { usePageTracking } from "@/lib/telemetry";

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

function SearchBox({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    const timer = setTimeout(() => {
      apiClient
        .suggestions(term)
        .then((result) => {
          if (result.envelope.ok) setSuggestions(result.envelope.data);
          setBusy(false);
        })
        .catch(() => setBusy(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const term = query.trim();
    setOpen(false);
    navigate(term ? `/shop?q=${encodeURIComponent(term)}` : "/shop");
  };

  const pick = (suggestion: Suggestion) => {
    setOpen(false);
    if (suggestion.target) navigate(suggestion.target);
    else navigate(`/shop?q=${encodeURIComponent(query.trim() || suggestion.label)}`);
  };

  const SuggestionIcon =
    suggestions.length > 0
      ? { product: Package, brand: Tag, category: Grid2x2 }
      : null;

  return (
    <div ref={boxRef} className={cn("relative w-full", className)}>
      <form onSubmit={submit} role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search products, brands…"
            className="h-9 rounded-full border-neutral-200 bg-neutral-50 pl-9 pr-4 text-sm focus-visible:bg-white"
            aria-label="Search products"
            autoComplete="off"
          />
          {busy && (
            <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-neutral-400" />
          )}
        </div>
      </form>
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-80 overflow-auto rounded-xl border border-neutral-200 bg-white">
          {suggestions.map((suggestion, index) => {
            const Icon = SuggestionIcon?.[suggestion.type] ?? Search;
            return (
              <button
                key={`${suggestion.type}-${suggestion.label}-${index}`}
                type="button"
                onClick={() => pick(suggestion)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                <span className="truncate text-[13px] text-neutral-800">
                  {suggestion.label}
                </span>
                <span className="ml-auto shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                  {suggestion.type}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Header() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const cart = useQuery(api.cart.getCart);
  const wishlist = useQuery(api.wishlist.getWishlist);
  const categories = useQuery(api.products.listCategories);

  const cartCount = (cart ?? []).reduce((sum, entry) => sum + entry.item.quantity, 0);
  const wishlistCount = wishlist?.length ?? 0;

  const currentCategory = new URLSearchParams(location.search).get("category");

  const navLink = (to: string, active: boolean) =>
    cn(
      "whitespace-nowrap text-[13px] transition-colors",
      active ? "font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-900",
    );

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          <Brand />
          <div className="hidden flex-1 justify-center md:flex">
            <SearchBox className="max-w-md" />
          </div>
          <nav className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
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
              <PackageIcon className="h-5 w-5" />
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
              className="flex items-center gap-2 rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
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
                className="ml-0.5 shrink-0 rounded-full border border-neutral-900 px-3 py-1.5 text-[13px] font-medium text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
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

        <div className="pb-3 md:hidden">
          <SearchBox />
        </div>
      </div>

      <nav className="border-t border-neutral-100">
        <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden">
          <Link
            to="/minutes"
            className={cn(
              "flex shrink-0 items-center gap-1 whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors",
              location.pathname === "/minutes"
                ? "text-neutral-900"
                : "text-neutral-700 hover:text-neutral-900",
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            Minutes
          </Link>
          <span className="h-4 w-px shrink-0 bg-neutral-200" />
          <Link
            to="/shop"
            className={navLink(
              "/shop",
              !currentCategory && location.pathname === "/shop",
            )}
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
  const shopLinks = (categories ?? []).slice(0, 4);

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
                <Link to="/minutes" className={linkClass}>
                  Minutes — fast delivery
                </Link>
              </li>
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

  // fire page_view at the analytics collector on every route change
  usePageTracking();

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
