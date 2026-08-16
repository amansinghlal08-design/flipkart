import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Banknote,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  Plus,
  ShoppingBag,
  Wallet as WalletIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductVisual } from "@/components/store/ProductVisual";
import { inr } from "@/lib/format";
import { trackEvent } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

const FREE_DELIVERY_THRESHOLD = 499;
const DELIVERY_FEE = 49;

type PaymentMethod = "wallet" | "cod" | "card";

const PAYMENT_OPTIONS: {
  value: PaymentMethod;
  icon: typeof Banknote;
  title: string;
  detail: string;
}[] = [
  {
    value: "wallet",
    icon: WalletIcon,
    title: "Staple wallet",
    detail: "Instant payment from your wallet balance",
  },
  {
    value: "cod",
    icon: Banknote,
    title: "Cash on delivery",
    detail: "Pay in cash when your order arrives",
  },
  {
    value: "card",
    icon: CreditCard,
    title: "Credit / debit card",
    detail: "Demo checkout — no real payment is processed",
  },
];

export default function Checkout() {
  const navigate = useNavigate();
  const cart = useQuery(api.cart.getCart);
  const addresses = useQuery(api.addresses.listAddresses);
  const wallet = useQuery(api.wallet.getWallet);

  const addAddress = useMutation(api.addresses.addAddress);
  const placeOrder = useMutation(api.orders.placeOrder);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wallet");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [placing, setPlacing] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
  });

  useEffect(() => {
    if (addresses && addresses.length > 0 && !selectedAddressId) {
      const preferred =
        addresses.find((a) => a.isDefault) ?? addresses[0];
      setSelectedAddressId(preferred._id);
    }
  }, [addresses, selectedAddressId]);

  const totals = useMemo(() => {
    const entries = cart ?? [];
    const itemTotal = entries.reduce(
      (sum, entry) => sum + entry.product.price * entry.item.quantity,
      0,
    );
    const discount = entries.reduce(
      (sum, entry) =>
        sum + (entry.product.mrp - entry.product.price) * entry.item.quantity,
      0,
    );
    const deliveryFee = itemTotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
    return { itemTotal, discount, deliveryFee, grandTotal: itemTotal + deliveryFee };
  }, [cart]);

  // fire begin_checkout once the cart has loaded
  const checkoutFired = useRef(false);
  useEffect(() => {
    if (cart && cart.length > 0 && !checkoutFired.current) {
      checkoutFired.current = true;
      trackEvent("begin_checkout", { value: totals.grandTotal, items: cart.length });
    }
  }, [cart, totals.grandTotal]);

  if (cart === undefined || addresses === undefined || wallet === undefined) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-32 sm:px-6 lg:px-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-28 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-neutral-100">
          <ShoppingBag className="h-6 w-6 text-neutral-400" />
        </span>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-neutral-900">
          Nothing to check out
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
          Your cart is empty. Add a few items and come back to complete your
          order.
        </p>
        <Button asChild className="mt-7 rounded-full px-7">
          <Link to="/shop">Browse the catalogue</Link>
        </Button>
      </div>
    );
  }

  const selectedAddress =
    addresses.find((a) => a._id === selectedAddressId) ?? null;

  const walletInsufficient =
    paymentMethod === "wallet" &&
    (wallet === null || wallet.balance < totals.grandTotal);

  const setField = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submitAddress = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      !form.name.trim() ||
      !form.phone.trim() ||
      !form.line1.trim() ||
      !form.city.trim() ||
      !form.state.trim() ||
      !/^\d{6}$/.test(form.pincode)
    ) {
      toast.error("Please fill in all address fields (6-digit PIN).");
      return;
    }
    try {
      const id = await addAddress({
        name: form.name.trim(),
        phone: form.phone.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode,
      });
      setSelectedAddressId(id);
      setShowAddressForm(false);
      setForm({ name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" });
      toast.success("Address added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add address.");
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      toast.error("Choose a delivery address.");
      return;
    }
    if (walletInsufficient) {
      toast.error("Insufficient wallet balance — add funds or pick another method.");
      return;
    }
    setPlacing(true);
    try {
      const orderId = await placeOrder({
        addressId: selectedAddress._id,
        paymentMethod,
      });
      trackEvent(
        "purchase",
        {
          order_id: orderId,
          value: totals.grandTotal,
          payment_method: paymentMethod,
        },
        "/checkout",
      );
      toast.success("Order placed");
      navigate(`/orders/${orderId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not place order.");
      setPlacing(false);
    }
  };

  const inputClass =
    "rounded-xl border-neutral-200 bg-neutral-50 focus-visible:bg-white";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="border-b border-neutral-200 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
          Secure checkout
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          Checkout
        </h1>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-12">
          {/* Step 1 — address */}
          <section>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-3 text-base font-semibold text-neutral-900">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-neutral-900 text-[13px] font-medium text-white">
                  1
                </span>
                Delivery address
              </h2>
              {addresses.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 rounded-full text-[13px]"
                  onClick={() => setShowAddressForm((v) => !v)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {showAddressForm ? "Cancel" : "Add new"}
                </Button>
              )}
            </div>

            {addresses.length === 0 && !showAddressForm && (
              <div className="mt-6 rounded-xl border border-neutral-200 p-6 text-sm text-neutral-500">
                You don't have a saved address yet. Add one to continue.
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {addresses.map((address) => (
                <button
                  key={address._id}
                  type="button"
                  onClick={() => setSelectedAddressId(address._id)}
                  className={cn(
                    "rounded-xl border p-5 text-left transition-colors",
                    selectedAddressId === address._id
                      ? "border-neutral-900"
                      : "border-neutral-200 hover:border-neutral-400",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                      <MapPin className="h-4 w-4 text-neutral-400" />
                      {address.name}
                    </span>
                    {address.isDefault && (
                      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[13px] leading-5 text-neutral-600">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}
                    <br />
                    {address.city}, {address.state} — {address.pincode}
                  </p>
                  <p className="mt-1 text-[13px] text-neutral-500">
                    Phone: {address.phone}
                  </p>
                </button>
              ))}
            </div>

            {showAddressForm && (
              <form
                onSubmit={submitAddress}
                className="mt-5 grid gap-3 rounded-xl border border-neutral-200 p-6 sm:grid-cols-2"
              >
                <Input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Full name"
                  className={inputClass}
                  required
                />
                <Input
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="Phone (10 digits)"
                  inputMode="numeric"
                  className={inputClass}
                  required
                />
                <Input
                  value={form.line1}
                  onChange={(e) => setField("line1", e.target.value)}
                  placeholder="Address line 1 (house, street)"
                  className={cn(inputClass, "sm:col-span-2")}
                  required
                />
                <Input
                  value={form.line2}
                  onChange={(e) => setField("line2", e.target.value)}
                  placeholder="Address line 2 (optional)"
                  className={cn(inputClass, "sm:col-span-2")}
                />
                <Input
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="City"
                  className={inputClass}
                  required
                />
                <Input
                  value={form.state}
                  onChange={(e) => setField("state", e.target.value)}
                  placeholder="State"
                  className={inputClass}
                  required
                />
                <Input
                  value={form.pincode}
                  onChange={(e) => setField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="PIN code"
                  inputMode="numeric"
                  className={inputClass}
                  required
                />
                <div className="flex items-end sm:col-span-2">
                  <Button type="submit" className="rounded-full px-6">
                    Save address
                  </Button>
                </div>
              </form>
            )}
          </section>

          {/* Step 2 — payment */}
          <section>
            <h2 className="flex items-center gap-3 text-base font-semibold text-neutral-900">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-neutral-900 text-[13px] font-medium text-white">
                2
              </span>
              Payment method
            </h2>
            <div className="mt-5 space-y-3">
              {PAYMENT_OPTIONS.map(({ value, icon: Icon, title, detail }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentMethod(value)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-xl border p-5 text-left transition-colors",
                    paymentMethod === value
                      ? "border-neutral-900"
                      : "border-neutral-200 hover:border-neutral-400",
                  )}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-neutral-100">
                    <Icon className="h-5 w-5 text-neutral-600" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-neutral-900">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-5 text-neutral-500">
                      {detail}
                    </span>
                    {value === "wallet" && (
                      <span className="mt-1 block text-[13px] text-neutral-700">
                        Balance:{" "}
                        <span className="font-medium text-neutral-900">
                          {wallet ? inr(wallet.balance) : inr(0)}
                        </span>
                      </span>
                    )}
                  </span>
                </button>
              ))}
              {walletInsufficient && (
                <p className="text-[13px] text-neutral-600">
                  Wallet balance is lower than the order total. Top up by
                  redeeming a gift card in{" "}
                  <Link to="/wallet" className="font-medium text-neutral-900 underline underline-offset-4">
                    Wallet
                  </Link>{" "}
                  or choose another payment method.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-neutral-200 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">
              Order summary
            </h2>
            <ul className="mt-5 space-y-4">
              {cart.map(({ item, product }) => (
                <li key={item._id} className="flex items-center gap-3">
                  <span className="relative shrink-0">
                    <ProductVisual
                      category={product.category}
                      className="h-14 w-14 rounded-lg"
                      iconClassName="h-6 w-6"
                    />
                    <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-neutral-900 text-[10px] font-medium text-white">
                      {item.quantity}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-neutral-900">
                      {product.name}
                    </span>
                    <span className="block text-[13px] text-neutral-500">
                      {inr(product.price)} each
                    </span>
                  </span>
                  <span className="ml-auto text-[13px] font-medium tabular-nums text-neutral-900">
                    {inr(product.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-6 space-y-3 border-t border-neutral-200 pt-5 text-sm">
              <div className="flex justify-between text-neutral-600">
                <dt>Item total</dt>
                <dd className="tabular-nums">{inr(totals.itemTotal)}</dd>
              </div>
              <div className="flex justify-between text-neutral-600">
                <dt>Discount</dt>
                <dd className="tabular-nums">−{inr(totals.discount)}</dd>
              </div>
              <div className="flex justify-between text-neutral-600">
                <dt>Delivery</dt>
                <dd className="tabular-nums">
                  {totals.deliveryFee === 0 ? (
                    <span className="text-neutral-900">Free</span>
                  ) : (
                    inr(totals.deliveryFee)
                  )}
                </dd>
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-3 text-base font-semibold text-neutral-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{inr(totals.grandTotal)}</dd>
              </div>
            </dl>
            <Button
              type="button"
              className="mt-6 h-11 w-full rounded-full"
              disabled={placing || !selectedAddress}
              onClick={handlePlaceOrder}
            >
              {placing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Place order · {inr(totals.grandTotal)}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[13px] text-neutral-500">
              <Lock className="h-3 w-3" />
              {paymentMethod === "card"
                ? "Demo checkout — no payment is processed"
                : "Your payment details are handled securely"}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
