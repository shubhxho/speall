import { NextResponse } from "next/server";

import { ingest } from "@/lib/registry";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Re-ingests every archive. Slow by nature (a few minutes) — the CLI equivalent
 * is `npm run ingest`. Protected by REFRESH_TOKEN when one is configured.
 */
export async function POST(request: Request) {
  const expected = process.env.REFRESH_TOKEN;
  if (expected) {
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const registry = await ingest();
    return NextResponse.json({
      fetchedAt: registry.fetchedAt,
      total: registry.datasets.length,
      report: registry.report,
    });
  } catch (error) {
    return NextResponse.json({ error: String((error as Error).message) }, { status: 502 });
  }
}
