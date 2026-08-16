import { query } from "./_generated/server";
import { v } from "convex/values";

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").collect();
    return categories.sort((a, b) => a.order - b.order);
  },
});

export const listProducts = query({
  args: {
    q: v.optional(v.string()),
    category: v.optional(v.string()),
    sort: v.optional(
      v.union(
        v.literal("featured"),
        v.literal("price-asc"),
        v.literal("price-desc"),
        v.literal("rating"),
        v.literal("newest"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let products;
    if (args.category) {
      products = await ctx.db
        .query("products")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .collect();
    } else {
      products = await ctx.db.query("products").collect();
    }

    const needle = (args.q ?? "").trim().toLowerCase();
    if (needle) {
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.brand.toLowerCase().includes(needle) ||
          p.description.toLowerCase().includes(needle) ||
          p.tags.some((tag) => tag.toLowerCase().includes(needle)),
      );
    }

    switch (args.sort ?? "featured") {
      case "price-asc":
        products.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        products.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        products.sort((a, b) => b.rating - a.rating);
        break;
      case "newest":
        products.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "featured":
      default:
        products.sort((a, b) => {
          const aBoost = a.badges.length > 0 ? 1 : 0;
          const bBoost = b.badges.length > 0 ? 1 : 0;
          return bBoost - aBoost || b.rating - a.rating;
        });
        break;
    }

    return products;
  },
});

export const getProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    return await ctx.db.get(productId);
  },
});

export const listReviews = query({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .collect();
    return reviews.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** A handful of highly rated products for landing sections. */
export const featuredProducts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 8 }) => {
    const products = await ctx.db.query("products").collect();
    return products
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  },
});

/** Biggest discounts first — powers the deals rail on the landing page. */
export const dealProducts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 8 }) => {
    const products = await ctx.db.query("products").collect();
    const discount = (p: { price: number; mrp: number }) =>
      (p.mrp - p.price) / p.mrp;
    return products
      .filter((p) => p.mrp > p.price)
      .sort((a, b) => discount(b) - discount(a))
      .slice(0, limit);
  },
});
