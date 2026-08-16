import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

const WELCOME_CREDIT = 2000;
const EGV_DENOMINATIONS = [500, 1000, 2000, 5000];

type UserId = NonNullable<Awaited<ReturnType<typeof getAuthUserId>>>;

async function ensureWalletRow(ctx: MutationCtx, userId: UserId) {
  const existing = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (existing) return existing;

  const now = Date.now();
  const walletId = await ctx.db.insert("wallets", {
    userId,
    balance: WELCOME_CREDIT,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("walletTransactions", {
    userId,
    type: "credit",
    amount: WELCOME_CREDIT,
    note: "Welcome credit",
    createdAt: now,
  });
  return (await ctx.db.get(walletId))!;
}

/** Returns the wallet, or null before the first welcome credit is claimed. */
export const getWallet = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return wallet;
  },
});

/** Creates the wallet with a small welcome credit on first use. */
export const ensureWallet = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in first.");
    return await ensureWalletRow(ctx, userId);
  },
});

export const listWalletTransactions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const txns = await ctx.db
      .query("walletTransactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return txns.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listGiftCards = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const cards = await ctx.db
      .query("egvCards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return cards.sort((a, b) => b.purchasedAt - a.purchasedAt);
  },
});

export const purchaseGiftCard = mutation({
  args: { denomination: v.number() },
  handler: async (ctx, { denomination }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to buy a gift card.");
    if (!EGV_DENOMINATIONS.includes(denomination)) {
      throw new Error("Choose a valid denomination.");
    }

    const wallet = await ensureWalletRow(ctx, userId);
    if (wallet.balance < denomination) {
      throw new Error("Insufficient wallet balance.");
    }

    const now = Date.now();
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    code = `EGV-${code.slice(0, 4)}-${code.slice(4)}`;

    await ctx.db.patch(wallet._id, {
      balance: wallet.balance - denomination,
      updatedAt: now,
    });
    await ctx.db.insert("walletTransactions", {
      userId,
      type: "gift-card",
      amount: denomination,
      note: `Purchased gift card ${code}`,
      createdAt: now,
    });
    await ctx.db.insert("egvCards", {
      userId,
      code,
      denomination,
      balance: denomination,
      status: "active",
      purchasedAt: now,
    });

    return code;
  },
});

export const redeemGiftCard = mutation({
  args: { cardId: v.id("egvCards") },
  handler: async (ctx, { cardId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to redeem a gift card.");

    const card = await ctx.db.get(cardId);
    if (!card || card.userId !== userId) throw new Error("Gift card not found.");
    if (card.status !== "active") throw new Error("This gift card was already redeemed.");

    const wallet = await ensureWalletRow(ctx, userId);
    const now = Date.now();
    await ctx.db.patch(wallet._id, {
      balance: wallet.balance + card.balance,
      updatedAt: now,
    });
    await ctx.db.patch(cardId, { status: "redeemed", balance: 0 });
    await ctx.db.insert("walletTransactions", {
      userId,
      type: "credit",
      amount: card.denomination,
      note: `Redeemed gift card ${card.code}`,
      createdAt: now,
    });
    return true;
  },
});
