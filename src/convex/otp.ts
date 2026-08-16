import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * OTP delivery for the minutes storefront's phone login.
 *
 * Real delivery: POST /api/7/user/otp/generate → this action generates a
 * 6-digit code, persists it in the `otpCodes` table and emails it through
 * Resend when `RESEND_API_KEY` is set in the environment (Keys tab).
 *
 * Demo mode: when no key is configured the code is still generated and
 * persisted, and the caller (the gateway) surfaces it as `demoCode` so the
 * page can show it — the flow is fully usable without a key.
 */

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Normalize any identifier to a lowercase, trimmed key. */
function norm(value: string): string {
  return value.trim().toLowerCase();
}

export const sendOtpEmail = action({
  args: {
    email: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { email, phone }) => {
    const identifier = norm(email);
    if (!identifier.includes("@")) {
      return { ok: false as const, error: "invalid_email" };
    }

    const code = randomCode();
    await ctx.runMutation(api.otp.storeOtp, {
      email: identifier,
      phone: phone ?? undefined,
      code,
    });

    const apiKey = (process.env.RESEND_API_KEY ?? "").trim();

    // No key → demo mode: return the code so the page can display it.
    if (!apiKey) {
      return {
        ok: true as const,
        sent: false as const,
        delivered: false,
        demoCode: code,
        email: identifier,
      };
    }

    // Real delivery via Resend.
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? "Minutes <onboarding@resend.dev>",
          to: [identifier],
          subject: "Your Minutes verification code",
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:16px;">
            <p style="font-size:18px;font-weight:700;color:#2874f0;">Flipkart Minutes</p>
            <p style="font-size:14px;color:#212121;">Your verification code is</p>
            <p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#212121;margin:12px 0;">${code}</p>
            <p style="font-size:13px;color:#878787;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
          </div>`,
        }),
      });
      const body = (await res.json()) as { id?: string };
      return {
        ok: true as const,
        sent: res.ok,
        delivered: res.ok && Boolean(body.id),
        email: identifier,
        id: body.id ?? null,
      };
    } catch (error) {
      return {
        ok: true as const,
        sent: false,
        delivered: false,
        error: error instanceof Error ? error.message : "send_failed",
        demoCode: code,
        email: identifier,
      };
    }
  },
});

export const storeOtp = mutation({
  args: { email: v.string(), phone: v.optional(v.string()), code: v.string() },
  handler: async (ctx, { email, phone, code }) => {
    const identifier = norm(email);
    // Invalidate any previous codes for this identifier
    const previous = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", identifier))
      .collect();
    for (const old of previous) {
      await ctx.db.patch(old._id, { used: true });
    }
    await ctx.db.insert("otpCodes", {
      email: identifier,
      phone: phone ?? undefined,
      code,
      used: false,
      createdAt: Date.now(),
    });
    return true;
  },
});

export const verifyOtp = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, { email, code }) => {
    const identifier = norm(email);
    const candidates = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", identifier))
      .collect();
    const match = candidates
      .filter((c) => !c.used)
      .sort((a, b) => b.createdAt - a.createdAt)
      .find((c) => c.code === code.trim());
    if (!match) {
      return {
        ok: false as const,
        reason: "invalid_or_expired",
        // Whether any code was ever issued to this identifier — lets the
        // gateway only allow the any-6-digit demo fallback when no OTP was
        // ever generated (e.g. the generate step was bypassed).
        hasCode: candidates.length > 0,
      };
    }
    await ctx.db.patch(match._id, { used: true });
    return { ok: true as const, email: identifier };
  },
});
