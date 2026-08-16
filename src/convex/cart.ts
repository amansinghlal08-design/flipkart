import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getCart = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const items = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await Promise.all(
      productIds.map((id) => ctx.db.get(id)),
    );
    const productById = new Map(
      products.filter((p) => p !== null).map((p) => [p!._id, p!]),
    );

    return items
      .map((item) => ({ item, product: productById.get(item.productId) }))
      .filter(
        (entry): entry is { item: (typeof items)[number]; product: NonNullable<ReturnType<typeof productById.get>> } =>
          entry.product !== null,
      )
      .sort((a, b) => a.item.createdAt - b.item.createdAt);
  },
});

export const addToCart = mutation({
  args: { productId: v.id("products"), quantity: v.optional(v.number()) },
  handler: async (ctx, { productId, quantity = 1 }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to add items to your cart.");

    const existing = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("productId"), productId))
      .first();

    if (existing) {
      const next = Math.min(10, existing.quantity + quantity);
      await ctx.db.patch(existing._id, { quantity: next });
      return existing._id;
    }

    const id = await ctx.db.insert("cartItems", {
      userId,
      productId,
      quantity: Math.min(10, Math.max(1, quantity)),
      createdAt: Date.now(),
    });
    return id;
  },
});

export const updateCartItem = mutation({
  args: { itemId: v.id("cartItems"), quantity: v.number() },
  handler: async (ctx, { itemId, quantity }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in.");

    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Item not found.");

    if (quantity <= 0) {
      await ctx.db.delete(itemId);
      return "removed";
    }
    await ctx.db.patch(itemId, { quantity: Math.min(10, quantity) });
    return "updated";
  },
});

export const removeFromCart = mutation({
  args: { itemId: v.id("cartItems") },
  handler: async (ctx, { itemId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in.");

    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Item not found.");
    await ctx.db.delete(itemId);
    return true;
  },
});
