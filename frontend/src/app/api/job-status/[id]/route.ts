import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const backendUrl = `https://api-nextjs.tranhoangnhu.website/api/job-status/${id}`;

  try {
    const response = await fetch(backendUrl, { cache: "no-store" });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ error: "Proxy Failed" }, { status: 500 });
  }
}
