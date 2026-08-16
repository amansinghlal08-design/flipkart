import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

const FREE_DELIVERY_THRESHOLD = 499;
const DELIVERY_FEE = 49;

type UserId = NonNullable<Awaited<ReturnType<typeof getAuthUserId>>>;

function makeOrderNo() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FB${stamp}${rand}`;
}

async function getWalletForUser(ctx: MutationCtx, userId: UserId) {
  const wallet = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return wallet;
}

export const listOrders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return orders.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const order = await ctx.db.get(orderId);
    if (!order || order.userId !== userId) return null;
    return order;
  },
});

export const placeOrder = mutation({
  args: {
    addressId: v.id("addresses"),
    paymentMethod: v.union(
      v.literal("wallet"),
      v.literal("cod"),
      v.literal("card"),
    ),
  },
  handler: async (ctx, { addressId, paymentMethod }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to place an order.");

    const address = await ctx.db.get(addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Choose a valid delivery address.");
    }

    const cart = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (cart.length === 0) throw new Error("Your cart is empty.");

    const productIds = [...new Set(cart.map((c) => c.productId))];
    const products = await Promise.all(productIds.map((id) => ctx.db.get(id)));
    const productById = new Map(
      products.filter((p) => p !== null).map((p) => [p!._id, p!]),
    );

    const items = cart
      .map((cartItem) => {
        const product = productById.get(cartItem.productId);
        if (!product) return null;
        return {
          productId: product._id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          price: product.price,
          mrp: product.mrp,
          quantity: cartItem.quantity,
        };
      })
      .filter((entry) => entry !== null);

    const itemTotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const discount = items.reduce(
      (sum, item) => sum + (item.mrp - item.price) * item.quantity,
      0,
    );
    const deliveryFee = itemTotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
    const grandTotal = itemTotal + deliveryFee;

    // wallet payment is settled before the order is created
    if (paymentMethod === "wallet") {
      const wallet = await getWalletForUser(ctx, userId);
      if (!wallet || wallet.balance < grandTotal) {
        throw new Error(
          `Insufficient wallet balance — you need ₹${grandTotal.toLocaleString("en-IN")}.`,
        );
      }
    }

    const now = Date.now();
    const orderNo = makeOrderNo();
    const orderId = await ctx.db.insert("orders", {
      userId,
      orderNo,
      items,
      itemTotal,
      discount,
      deliveryFee,
      grandTotal,
      address: {
        name: address.name,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      },
      paymentMethod,
      status: "confirmed",
      timeline: [{ status: "confirmed", at: now }],
      deliveryBy: now + 4 * 86400000,
      createdAt: now,
    });

    // settle wallet, decrement stock, clear cart
    if (paymentMethod === "wallet") {
      const wallet = await getWalletForUser(ctx, userId);
      if (wallet) {
        await ctx.db.patch(wallet._id, {
          balance: wallet.balance - grandTotal,
          updatedAt: now,
        });
        await ctx.db.insert("walletTransactions", {
          userId,
          type: "debit",
          amount: grandTotal,
          note: `Order ${orderNo} paid from wallet`,
          createdAt: now,
        });
      }
    }

    for (const item of items) {
      const product = await ctx.db.get(item.productId);
      if (product && product.stock > 0) {
        await ctx.db.patch(product._id, {
          stock: Math.max(0, product.stock - item.quantity),
        });
      }
    }

    for (const cartItem of cart) {
      await ctx.db.delete(cartItem._id);
    }

    return orderId;
  },
});

export const cancelOrder = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in.");

    const order = await ctx.db.get(orderId);
    if (!order || order.userId !== userId) throw new Error("Order not found.");
    if (order.status !== "confirmed") {
      throw new Error("This order can no longer be cancelled.");
    }

    const now = Date.now();
    await ctx.db.patch(orderId, {
      status: "cancelled",
      timeline: [...order.timeline, { status: "cancelled", at: now }],
    });

    if (order.paymentMethod === "wallet") {
      const wallet = await getWalletForUser(ctx, userId);
      if (wallet) {
        await ctx.db.patch(wallet._id, {
          balance: wallet.balance + order.grandTotal,
          updatedAt: now,
        });
        await ctx.db.insert("walletTransactions", {
          userId,
          type: "credit",
          amount: order.grandTotal,
          note: `Refund for order ${order.orderNo}`,
          createdAt: now,
        });
      }
    }

    return true;
  },
});
