import { NextRequest, NextResponse } from "next/server";

const BACKEND_DOMAIN = "https://api-nextjs.tranhoangnhu.website";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const backendUrl = `${BACKEND_DOMAIN}/api/download-video/${id}`;

  try {
    const response = await fetch(backendUrl);

    // Forward headers
    const resHeaders = new Headers();
    response.headers.forEach((val, key) => resHeaders.set(key, val));

    return new NextResponse(response.body, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Download Failed" }, { status: 500 });
  }
}
