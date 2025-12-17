import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import crypto from "crypto";

type ShortenRequestBody = {
  interviewId: string;
  expiresInSeconds?: number;
  maxUses?: number;
  startAutomatically?: boolean;
};

const DEFAULT_EXPIRY_SECONDS = 48 * 60 * 60; // 48 hours

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function generateToken(length = 10) {
  const bytes = crypto.randomBytes(length);
  let token = "";
  for (let i = 0; i < length; i += 1) {
    token += alphabet[bytes[i] % alphabet.length];
  }
  return token;
}

function buildBaseUrl(req: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  const host = req.headers.get("host");
  const protocol = req.nextUrl.protocol || "https:";
  return `${protocol}//${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: "Convex URL not configured" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as ShortenRequestBody;
    const { interviewId, expiresInSeconds, maxUses, startAutomatically } = body;

    if (!interviewId) {
      return NextResponse.json(
        { error: "interviewId is required" },
        { status: 400 }
      );
    }

    const token = generateToken(8 + Math.floor(Math.random() * 3)); // 8-10 chars
    const expiresAt =
      Date.now() +
      1000 *
        (typeof expiresInSeconds === "number"
          ? expiresInSeconds
          : DEFAULT_EXPIRY_SECONDS);
    const safeMaxUses =
      typeof maxUses === "number" && maxUses > 0 ? maxUses : 2;

    const client = new ConvexHttpClient(convexUrl);
    await client.mutation(api.ShortLinks.Create, {
      token,
      interviewId: interviewId as Id<"InterviewSessionTable">,
      expiresAt,
      maxUses: safeMaxUses,
      meta: { startAutomatically: !!startAutomatically },
    });

    const shortUrl = `${buildBaseUrl(req)}/l/${token}`;
    return NextResponse.json(
      {
        token,
        shortUrl,
        expiresAt,
        maxUses: safeMaxUses,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Failed to create short link", err);
    const message = err?.message || "Unknown error";
    return NextResponse.json(
      { error: "Failed to create short link", details: message },
      { status: 500 }
    );
  }
}

