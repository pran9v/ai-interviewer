import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const Create = mutation({
  args: {
    token: v.string(),
    interviewId: v.id("InterviewSessionTable"),
    expiresAt: v.optional(v.number()),
    maxUses: v.optional(v.number()),
    meta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ShortLinkTable")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (existing) {
      throw new Error("Token already exists");
    }

    const docId = await ctx.db.insert("ShortLinkTable", {
      token: args.token,
      interviewId: args.interviewId,
      createdAt: Date.now(),
      expiresAt: args.expiresAt,
      maxUses: args.maxUses,
      useCount: 0,
      meta: args.meta,
    });

    return docId;
  },
});

export const GetByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("ShortLinkTable")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    return record;
  },
});

export const IncrementUse = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("ShortLinkTable")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!record) {
      return { ok: false as const, reason: "not_found" as const };
    }

    const now = Date.now();
    if (record.expiresAt && record.expiresAt < now) {
      return { ok: false as const, reason: "expired" as const };
    }

    if (
      typeof record.maxUses === "number" &&
      record.maxUses >= 0 &&
      record.useCount >= record.maxUses
    ) {
      return { ok: false as const, reason: "max_used" as const };
    }

    await ctx.db.patch(record._id, {
      useCount: record.useCount + 1,
    });

    return {
      ok: true as const,
      useCount: record.useCount + 1,
      expiresAt: record.expiresAt,
      maxUses: record.maxUses,
    };
  },
});

