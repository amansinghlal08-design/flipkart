import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listAddresses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const addresses = await ctx.db
      .query("addresses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return addresses.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  },
});

export const addAddress = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    line1: v.string(),
    line2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    pincode: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in.");

    const existing = await ctx.db
      .query("addresses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const isDefault = existing.length === 0;
    const id = await ctx.db.insert("addresses", {
      userId,
      ...args,
      isDefault,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const updateAddress = mutation({
  args: {
    addressId: v.id("addresses"),
    name: v.string(),
    phone: v.string(),
    line1: v.string(),
    line2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    pincode: v.string(),
  },
  handler: async (ctx, { addressId, ...fields }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in.");
    const address = await ctx.db.get(addressId);
    if (!address || address.userId !== userId) throw new Error("Address not found.");
    await ctx.db.patch(addressId, { ...fields });
    return addressId;
  },
});

export const deleteAddress = mutation({
  args: { addressId: v.id("addresses") },
  handler: async (ctx, { addressId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in.");
    const address = await ctx.db.get(addressId);
    if (!address || address.userId !== userId) throw new Error("Address not found.");
    await ctx.db.delete(addressId);
    return true;
  },
});

export const setDefaultAddress = mutation({
  args: { addressId: v.id("addresses") },
  handler: async (ctx, { addressId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in.");
    const address = await ctx.db.get(addressId);
    if (!address || address.userId !== userId) throw new Error("Address not found.");

    const all = await ctx.db
      .query("addresses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const a of all) {
      await ctx.db.patch(a._id, { isDefault: a._id === addressId });
    }
    return true;
  },
});
