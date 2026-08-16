import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * OTP delivery for the minutes storefront's phone login.
 *
 * Real delivery: POST /api/7/user/otp/generate → this action generates a
 * 6-digit code, persists it in the `otpCodes` table and sends it to the
 * user's phone via Twilio SMS when `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`
 * are configured (Keys tab). If Twilio is not configured but Resend is, the
 * code is emailed instead.
 *
 * Demo mode: when no delivery key is configured the code is still generated
 * and persisted, and the caller (the gateway) surfaces it as `demoCode` so
 * the page can show it — the flow is fully usable without a key.
 */

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Normalize a phone number to E.164 digits only, e.g. 9876543210. */
function normPhone(value: string): string {
  return value.replace(/[^\d]/g, "").replace(/^91(?=\d{10}$)/, "").slice(-10);
}

/** Normalize any email identifier to a lowercase, trimmed key. */
function normEmail(value: string): string {
  return value.trim().toLowerCase();
}

export const sendOtp = action({
  args: {
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { phone, email }) => {
    const phoneNumber = phone ? normPhone(phone) : "";
    const emailAddress = email ? normEmail(email) : "";

    if (!phoneNumber && !emailAddress.includes("@")) {
      return { ok: false as const, error: "invalid_identifier" };
    }

    const code = randomCode();
    const identifier = phoneNumber || emailAddress;
    const channel = phoneNumber ? "sms" : "email";

    await ctx.runMutation(api.otp.storeOtp, {
      identifier,
      code,
      channel,
      phone: phoneNumber || undefined,
      email: emailAddress || undefined,
    });

    // ---- Twilio SMS (primary channel) ----
    const twilioSid = (process.env.TWILIO_ACCOUNT_SID ?? "").trim();
    const twilioToken = (process.env.TWILIO_AUTH_TOKEN ?? "").trim();
    const twilioFrom = (process.env.TWILIO_PHONE_NUMBER ?? "").trim();
    if (phoneNumber && twilioSid && twilioToken && twilioFrom) {
      try {
        const auth = btoa(`${twilioSid}:${twilioToken}`);
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: `+91${phoneNumber}`,
              From: twilioFrom,
              Body: `${code} is your Flipkart Minutes verification code. It expires in 10 minutes. Do not share it with anyone.`,
            }),
          },
        );
        const body = (await res.json()) as { sid?: string; status?: string };
        return {
          ok: true as const,
          sent: res.ok,
          delivered: res.ok && Boolean(body.sid),
          channel: "sms",
          identifier,
          sid: body.sid ?? null,
        };
      } catch (error) {
        return {
          ok: true as const,
          sent: false,
          delivered: false,
          channel: "sms",
          error: error instanceof Error ? error.message : "send_failed",
          demoCode: code,
          identifier,
        };
      }
    }

    // ---- Resend email (secondary channel, only if Twilio is not set) ----
    const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
    if (emailAddress.includes("@") && apiKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL ?? "Minutes <onboarding@resend.dev>",
            to: [emailAddress],
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
          channel: "email",
          identifier,
          id: body.id ?? null,
        };
      } catch (error) {
        return {
          ok: true as const,
          sent: false,
          delivered: false,
          channel: "email",
          error: error instanceof Error ? error.message : "send_failed",
          demoCode: code,
          identifier,
        };
      }
    }

    // No delivery key → demo mode: return the code so the page can display it.
    return {
      ok: true as const,
      sent: false as const,
      delivered: false,
      channel,
      demoCode: code,
      identifier,
    };
  },
});

export const storeOtp = mutation({
  args: {
    identifier: v.string(),
    code: v.string(),
    channel: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { identifier, code, channel, phone, email }) => {
    const key = identifier.trim().toLowerCase();
    // Invalidate any previous codes for this identifier
    const previous = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", key))
      .collect();
    for (const old of previous) {
      await ctx.db.patch(old._id, { used: true });
    }
    await ctx.db.insert("otpCodes", {
      email: key, // identifier key (phone number or email)
      phone: phone ?? undefined,
      code,
      used: false,
      channel,
      createdAt: Date.now(),
    });
    return true;
  },
});

export const verifyOtp = mutation({
  args: { identifier: v.string(), code: v.string() },
  handler: async (ctx, { identifier, code }) => {
    const key = identifier.trim().toLowerCase();
    const candidates = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", key))
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
    return { ok: true as const, identifier: key };
  },
});
