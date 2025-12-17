import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

function friendlyRedirect(path: string) {
  return NextResponse.redirect(path, 302);
}

function isPreviewRequest(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (method === "HEAD") return true;

  const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";
  // WhatsApp (and similar preview bots) include "whatsapp" in the UA when unfurling links.
  if (userAgent.includes("whatsapp")) return true;

  // Common social preview bots; keeping list narrow to avoid false positives.
  if (userAgent.includes("facebookexternalhit") || userAgent.includes("twitterbot")) {
    return true;
  }

  return false;
}

function previewResponse() {
  // Return minimal HTML with og tags so previews render, without consuming the link.
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta property="og:title" content="Matryc interview link" />
    <meta property="og:description" content="Open to start your interview." />
  </head>
  <body>Preview available. Open the link to start the interview.</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
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

  // Ignore preview/unfurl requests so they don't count as a real visit.
  if (isPreviewRequest(request)) {
    return previewResponse();
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const record = await client.query(api.ShortLinks.GetByToken, { token });

    if (!record) {
      return friendlyRedirect("/link-expired");
    }

    const incrementResult = await client.mutation(
      api.ShortLinks.IncrementUse,
      { token }
    );

    if (!incrementResult?.ok) {
      return friendlyRedirect("/link-expired");
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

