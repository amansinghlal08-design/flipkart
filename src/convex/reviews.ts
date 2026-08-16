import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const addReview = mutation({
  args: {
    productId: v.id("products"),
    rating: v.number(),
    title: v.optional(v.string()),
    comment: v.string(),
  },
  handler: async (ctx, { productId, rating, title, comment }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to write a review.");
    if (rating < 1 || rating > 5) throw new Error("Rating must be 1–5.");
    if (comment.trim().length < 5) throw new Error("Review is too short.");

    const user = await ctx.db.get(userId);
    const userName = user?.name ?? user?.email?.split("@")[0] ?? "Guest";

    await ctx.db.insert("reviews", {
      productId,
      userId,
      userName,
      rating,
      title: title?.trim() || undefined,
      comment: comment.trim(),
      createdAt: Date.now(),
    });
    return true;
  },
});
