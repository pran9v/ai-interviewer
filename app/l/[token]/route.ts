import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

function friendlyRedirect(path: string) {
  return NextResponse.redirect(path, 302);
}

type TokenParams = { token: string };

export async function GET(
  request: NextRequest,
  context: { params: Promise<TokenParams> }
): Promise<NextResponse> {
  const { token } = await context.params;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    return friendlyRedirect("/link-expired");
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const record = await client.query(api.ShortLinks.GetByToken, { token });

    if (!record) {
      return friendlyRedirect("/link-expired");
    }

    const now = Date.now();
    if (record.expiresAt && record.expiresAt < now) {
      return friendlyRedirect("/link-expired");
    }

    if (
      typeof record.maxUses === "number" &&
      record.maxUses >= 0 &&
      record.useCount >= record.maxUses
    ) {
      return friendlyRedirect("/link-used");
    }

    const incrementResult = await client.mutation(
      api.ShortLinks.IncrementUse,
      { token }
    );

    if (!incrementResult?.ok) {
      const destination =
        incrementResult?.reason === "max_used" ? "/link-used" : "/link-expired";
      return friendlyRedirect(destination);
    }

    const url = new URL(request.url);
    url.pathname = `/interview/${record.interviewId}/start`;
    url.searchParams.set("token", token);
    url.searchParams.set("autostart", "1");

    return NextResponse.redirect(url.toString(), 302);
  } catch (error) {
    console.error("Short link redirect failed", error);
    return friendlyRedirect("/link-expired");
  }
}

