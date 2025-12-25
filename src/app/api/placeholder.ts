import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Extract ID from URL since params might be async in newer Next.js or just hard to type here for route.ts dynamic routes
  // Actually, for app router, params are passed.
  // But let's check the URL path to be safe/flexible or rely on params.
  // Wait, this is a [...slug] route? No, we need a specific route file for id.
  // Easiest is to use query params or a dynamic route folder.
  // Let's use a dynamic route folder structure: src/app/api/job-status/[id]/route.ts
  return NextResponse.json(
    { error: "Use /api/job-status/[id]" },
    { status: 404 }
  );
}
