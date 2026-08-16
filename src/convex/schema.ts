import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const orderStatusValidator = v.union(
  v.literal("confirmed"),
  v.literal("shipped"),
  v.literal("out-for-delivery"),
  v.literal("delivered"),
  v.literal("cancelled"),
);

export const paymentMethodValidator = v.union(
  v.literal("wallet"),
  v.literal("cod"),
  v.literal("card"),
);

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ---- catalogue ----
    categories: defineTable({
      slug: v.string(),
      name: v.string(),
      icon: v.string(), // lucide icon key rendered by the UI
      order: v.number(),
    }).index("by_slug", ["slug"]),

    products: defineTable({
      name: v.string(),
      brand: v.string(),
      category: v.string(), // category slug
      description: v.string(),
      highlights: v.array(v.string()),
      price: v.number(), // selling price in INR
      mrp: v.number(), // list price in INR
      rating: v.number(),
      ratingCount: v.number(),
      stock: v.number(),
      badges: v.array(v.string()),
      tags: v.array(v.string()),
      unit: v.optional(v.string()), // quick-commerce pack size, e.g. "1 L", "500 g"
      createdAt: v.number(),
    })
      .index("by_category", ["category"])
      .index("by_created", ["createdAt"]),

    reviews: defineTable({
      productId: v.id("products"),
      userId: v.optional(v.id("users")),
      userName: v.string(),
      rating: v.number(),
      title: v.optional(v.string()),
      comment: v.string(),
      createdAt: v.number(),
    }).index("by_product", ["productId"]),

    // ---- user commerce state ----
    cartItems: defineTable({
      userId: v.id("users"),
      productId: v.id("products"),
      quantity: v.number(),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    wishlistItems: defineTable({
      userId: v.id("users"),
      productId: v.id("products"),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    addresses: defineTable({
      userId: v.id("users"),
      name: v.string(),
      phone: v.string(),
      line1: v.string(),
      line2: v.optional(v.string()),
      city: v.string(),
      state: v.string(),
      pincode: v.string(),
      isDefault: v.boolean(),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    orders: defineTable({
      userId: v.id("users"),
      orderNo: v.string(),
      items: v.array(
        v.object({
          productId: v.id("products"),
          name: v.string(),
          brand: v.string(),
          category: v.string(),
          price: v.number(),
          mrp: v.number(),
          quantity: v.number(),
        }),
      ),
      itemTotal: v.number(),
      discount: v.number(),
      deliveryFee: v.number(),
      grandTotal: v.number(),
      address: v.object({
        name: v.string(),
        phone: v.string(),
        line1: v.string(),
        line2: v.optional(v.string()),
        city: v.string(),
        state: v.string(),
        pincode: v.string(),
      }),
      paymentMethod: paymentMethodValidator,
      status: orderStatusValidator,
      timeline: v.array(v.object({ status: orderStatusValidator, at: v.number() })),
      deliveryBy: v.number(), // epoch ms ETA
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    // ---- money ----
    wallets: defineTable({
      userId: v.id("users"),
      balance: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    walletTransactions: defineTable({
      userId: v.id("users"),
      type: v.string(), // "credit" | "debit" | "gift-card"
      amount: v.number(), // positive number; type decides sign
      note: v.string(),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    egvCards: defineTable({
      userId: v.id("users"),
      code: v.string(),
      denomination: v.number(),
      balance: v.number(),
      status: v.string(), // "active" | "redeemed"
      purchasedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_code", ["code"]),

    // ---- telemetry ----
    analyticsEvents: defineTable({
      event: v.string(), // page_view | view_item | add_to_cart | begin_checkout | purchase | …
      path: v.optional(v.string()),
      props: v.optional(
        v.record(v.string(), v.union(v.string(), v.number(), v.boolean())),
      ),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
