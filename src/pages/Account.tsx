import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Heart,
  Loader2,
  LogOut,
  MapPin,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
  Wallet as WalletIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

const EMPTY_FORM = {
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

export default function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const orders = useQuery(api.orders.listOrders);
  const wallet = useQuery(api.wallet.getWallet);
  const wishlist = useQuery(api.wishlist.getWishlist);
  const cart = useQuery(api.cart.getCart);
  const addresses = useQuery(api.addresses.listAddresses);

  const addAddress = useMutation(api.addresses.addAddress);
  const deleteAddress = useMutation(api.addresses.deleteAddress);
  const setDefaultAddress = useMutation(api.addresses.setDefaultAddress);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loading = addresses === undefined;
  const displayName =
    user?.name ?? user?.email?.split("@")[0] ?? (user?.isAnonymous ? "Guest" : "You");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

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
    setSaving(true);
    try {
      await addAddress({
        name: form.name.trim(),
        phone: form.phone.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode,
      });
      toast.success("Address added");
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add address.");
    } finally {
      setSaving(false);
    }
  };

  const links = [
    {
      to: "/orders",
      icon: Package,
      label: "Orders",
      detail: orders ? `${orders.length} placed` : "—",
    },
    {
      to: "/wallet",
      icon: WalletIcon,
      label: "Wallet",
      detail: wallet ? inr(wallet.balance) : "Claim credit",
    },
    {
      to: "/wishlist",
      icon: Heart,
      label: "Wishlist",
      detail: wishlist ? `${wishlist.length} saved` : "—",
    },
    {
      to: "/cart",
      icon: ShoppingBag,
      label: "Cart",
      detail: cart
        ? `${cart.reduce((sum, entry) => sum + entry.item.quantity, 0)} items`
        : "—",
    },
  ];

  if (loading || user === undefined) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-32 sm:px-6 lg:px-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-6">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-900 text-base font-medium text-white">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              {displayName}
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              {user?.email ?? (user?.isAnonymous ? "Guest account" : "Signed in")}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-neutral-300"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>

      {/* Quick links */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {links.map(({ to, icon: Icon, label, detail }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-xl border border-neutral-200 p-5 transition-colors hover:border-neutral-900"
          >
            <Icon className="h-5 w-5 text-neutral-400 transition-colors group-hover:text-neutral-900" />
            <p className="mt-4 text-sm font-medium text-neutral-900">{label}</p>
            <p className="mt-0.5 text-[13px] text-neutral-500">{detail}</p>
          </Link>
        ))}
      </div>

      {/* Addresses */}
      <section className="mt-12">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">
            <MapPin className="h-4 w-4 text-neutral-400" />
            Saved addresses
          </h2>
          <Button
            type="button"
            variant="ghost"
            className="h-8 rounded-full text-[13px]"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            {showForm ? "Cancel" : "Add address"}
          </Button>
        </div>

        {addresses.length === 0 && !showForm && (
          <p className="mt-5 text-sm text-neutral-500">
            No saved addresses. Add one to speed up checkout.
          </p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <div key={address._id} className="rounded-xl border border-neutral-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                    {address.name}
                    {address.isDefault && (
                      <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="mt-2 text-[13px] leading-5 text-neutral-600">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}
                    <br />
                    {address.city}, {address.state} — {address.pincode}
                  </p>
                  <p className="mt-1 text-[13px] text-neutral-500">
                    Phone: {address.phone}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                {!address.isDefault && (
                  <button
                    type="button"
                    onClick={async () => {
                      await setDefaultAddress({ addressId: address._id });
                      toast.success("Default address updated");
                    }}
                    className="text-[13px] font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
                  >
                    Set as default
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Delete address"
                  onClick={async () => {
                    await deleteAddress({ addressId: address._id });
                    toast.success("Address removed");
                  }}
                  className="ml-auto rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {showForm && (
          <form
            onSubmit={submitAddress}
            className="mt-5 grid gap-3 rounded-xl border border-neutral-200 p-6 sm:grid-cols-2"
          >
            <Input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Full name"
              className="rounded-xl border-neutral-200 bg-neutral-50 focus-visible:bg-white"
              required
            />
            <Input
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="Phone (10 digits)"
              inputMode="numeric"
              className="rounded-xl border-neutral-200 bg-neutral-50 focus-visible:bg-white"
              required
            />
            <Input
              value={form.line1}
              onChange={(e) => setField("line1", e.target.value)}
              placeholder="Address line 1 (house, street)"
              className={cn("rounded-xl border-neutral-200 bg-neutral-50 focus-visible:bg-white sm:col-span-2")}
              required
            />
            <Input
              value={form.line2}
              onChange={(e) => setField("line2", e.target.value)}
              placeholder="Address line 2 (optional)"
              className={cn("rounded-xl border-neutral-200 bg-neutral-50 focus-visible:bg-white sm:col-span-2")}
            />
            <Input
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              placeholder="City"
              className="rounded-xl border-neutral-200 bg-neutral-50 focus-visible:bg-white"
              required
            />
            <Input
              value={form.state}
              onChange={(e) => setField("state", e.target.value)}
              placeholder="State"
              className="rounded-xl border-neutral-200 bg-neutral-50 focus-visible:bg-white"
              required
            />
            <Input
              value={form.pincode}
              onChange={(e) => setField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="PIN code"
              inputMode="numeric"
              className="rounded-xl border-neutral-200 bg-neutral-50 focus-visible:bg-white"
              required
            />
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" className="rounded-full px-6" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save address
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
