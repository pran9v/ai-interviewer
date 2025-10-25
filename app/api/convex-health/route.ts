import { NextRequest, NextResponse } from 'next/server';

async function fetchWithTimeout(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return { ok: res.ok, status: res.status, statusText: res.statusText };
  } catch (err: any) {
    clearTimeout(id);
    return { ok: false, error: err.message || String(err) };
  }
}

export async function GET(req: NextRequest) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || null;

  if (!convexUrl) {
    return NextResponse.json({ ok: false, message: 'NEXT_PUBLIC_CONVEX_URL not configured' }, { status: 500 });
  }

  // Basic reachability check
  const result = await fetchWithTimeout(convexUrl, 8000);

  const body: any = {
    ok: !!(result && result.ok),
    convexUrl,
    reachable: result?.ok || false,
    status: result?.status ?? null,
    statusText: result?.statusText ?? null,
  };

  if ((result as any).error) {
    body.error = (result as any).error;
  }

  // Provide guidance when unreachable
  if (!body.reachable) {
    body.guidance = 'If unreachable, ensure you deployed Convex with `npx convex deploy` and set NEXT_PUBLIC_CONVEX_URL in Vercel environment variables.';
  }

  return NextResponse.json(body);
}
