import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Loader2,
  Ticket,
  Wallet as WalletIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { inr, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const DENOMINATIONS = [500, 1000, 2000, 5000];

export default function WalletPage() {
  const wallet = useQuery(api.wallet.getWallet);
  const transactions = useQuery(api.wallet.listWalletTransactions);
  const giftCards = useQuery(api.wallet.listGiftCards);

  const ensureWallet = useMutation(api.wallet.ensureWallet);
  const purchaseGiftCard = useMutation(api.wallet.purchaseGiftCard);
  const redeemGiftCard = useMutation(api.wallet.redeemGiftCard);

  const [buying, setBuying] = useState<number | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  if (wallet === undefined || transactions === undefined || giftCards === undefined) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-32 sm:px-6 lg:px-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const handleClaim = async () => {
    try {
      await ensureWallet();
      toast.success("Welcome credit added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    }
  };

  const handleBuy = async (denomination: number) => {
    setBuying(denomination);
    try {
      const code = await purchaseGiftCard({ denomination });
      toast.success(`Gift card ${code} purchased`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not purchase gift card.");
    } finally {
      setBuying(null);
    }
  };

  const handleRedeem = async (cardId: string) => {
    setRedeeming(cardId);
    try {
      await redeemGiftCard({ cardId: cardId as never });
      toast.success("Gift card redeemed to wallet");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not redeem gift card.");
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="border-b border-neutral-200 pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
          Payments
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          Wallet & gift cards
        </h1>
      </div>

      {/* Balance */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-neutral-900 p-7 text-white">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
            <WalletIcon className="h-4 w-4" />
            Wallet balance
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight">
            {wallet ? inr(wallet.balance) : inr(0)}
          </p>
          <p className="mt-2 text-[13px] text-neutral-400">
            Usable at checkout, topped up via gift cards.
          </p>
          {!wallet && (
            <Button
              type="button"
              className="mt-6 rounded-full bg-white text-neutral-900 hover:bg-neutral-200"
              onClick={handleClaim}
            >
              <Gift className="h-4 w-4" />
              Claim ₹2,000 welcome credit
            </Button>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 p-7">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
            <Ticket className="h-4 w-4" />
            Gift cards (EGV)
          </p>
          <p className="mt-4 text-sm leading-6 text-neutral-600">
            Buy a card with your wallet balance and redeem it any time — or keep
            it as a gift for someone.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {DENOMINATIONS.map((denomination) => (
              <Button
                key={denomination}
                type="button"
                variant="outline"
                className="rounded-full border-neutral-300"
                disabled={buying !== null || wallet === null}
                onClick={() => handleBuy(denomination)}
              >
                {buying === denomination ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {inr(denomination)}
              </Button>
            ))}
          </div>
          {wallet === null && (
            <p className="mt-3 text-[13px] text-neutral-500">
              Claim your welcome credit first to fund purchases.
            </p>
          )}
        </div>
      </section>

      {/* Gift cards */}
      {giftCards.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">
            Your gift cards
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {giftCards.map((card) => (
              <li
                key={card._id}
                className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 p-5"
              >
                <div>
                  <p className="font-mono text-sm font-medium tracking-wide text-neutral-900">
                    {card.code}
                  </p>
                  <p className="mt-1 text-[13px] text-neutral-500">
                    {inr(card.denomination)} · purchased {shortDate(card.purchasedAt)}
                  </p>
                </div>
                {card.status === "active" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-neutral-300"
                    disabled={redeeming === card._id}
                    onClick={() => handleRedeem(card._id)}
                  >
                    {redeeming === card._id && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Redeem
                  </Button>
                ) : (
                  <span
                    className={cn(
                      "rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em]",
                      "border-neutral-300 text-neutral-400",
                    )}
                  >
                    Redeemed
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Transactions */}
      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-900">
          Activity
        </h2>
        {transactions.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">
            No transactions yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200">
            {transactions.map((txn) => {
              const credit = txn.type === "credit";
              const Icon = credit ? ArrowDownLeft : ArrowUpRight;
              return (
                <li key={txn._id} className="flex items-center gap-4 py-4">
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                      credit ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {txn.note}
                    </p>
                    <p className="text-[13px] text-neutral-500">
                      {shortDate(txn.createdAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      credit ? "text-neutral-900" : "text-neutral-600",
                    )}
                  >
                    {credit ? "+" : "−"}
                    {inr(txn.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
