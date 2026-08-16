import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getWishlist = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const items = await ctx.db
      .query("wishlistItems")
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
      .sort((a, b) => b.item.createdAt - a.item.createdAt);
  },
});

export const toggleWishlist = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to save items.");

    const existing = await ctx.db
      .query("wishlistItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("productId"), productId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }

    await ctx.db.insert("wishlistItems", {
      userId,
      productId,
      createdAt: Date.now(),
    });
    return true;
  },
});
