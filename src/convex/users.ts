import { getAuthUserId } from "@convex-dev/auth/server";
import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Public lookup used by POST /api/6/user/signup/status — mirrors the
 * signup-status endpoint from the capture: checks whether an account exists.
 */
export const emailExists = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();
    return user !== null;
  },
});

/**
 * Phone-number lookup used by POST /api/6/user/signup/status — mirrors the
 * signup-status endpoint from the capture. The auth tables don't index phone,
 * so we scan the users table (small demo population); returns whether an
 * account with this phone exists.
 */
export const phoneExists = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) return null;
    const users = await ctx.db.query("users").collect();
    return users.some(
      (u) =>
        typeof u.phone === "string" &&
        (u.phone === digits || u.phone === `+91${digits}`),
    );
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};
