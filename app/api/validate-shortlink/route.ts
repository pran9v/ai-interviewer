import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function GET(req: NextRequest) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json(
      { valid: false, reason: "missing_convex_url" },
      { status: 500 }
    );
  }

  const token = req.nextUrl.searchParams.get("token");
  const interviewId = req.nextUrl.searchParams.get("interviewId");

  if (!token || !interviewId) {
    return NextResponse.json(
      { valid: false, reason: "missing_params" },
      { status: 400 }
    );
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const record = await client.query(api.ShortLinks.GetByToken, { token });

    if (!record) {
      return NextResponse.json({ valid: false, reason: "not_found" });
    }

    if (String(record.interviewId) !== interviewId) {
      return NextResponse.json({ valid: false, reason: "mismatch" });
    }

    return NextResponse.json({
      valid: true,
      interviewId: record.interviewId,
      token,
      expiresAt: record.expiresAt,
      maxUses: record.maxUses,
      useCount: record.useCount,
    });
  } catch (error: any) {
    console.error("validate-shortlink failure", error);
    return NextResponse.json(
      { valid: false, reason: "server_error", details: error?.message },
      { status: 500 }
    );
  }
}

