import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// General Proxy Handler
async function proxyRequest(req: NextRequest, endpoint: string) {
  const backendUrl = `http://localhost:1108/api/${endpoint}`;

  try {
    const contentType = req.headers.get("content-type");

    const headers: Record<string, string> = {};
    if (contentType) headers["Content-Type"] = contentType;

    const response = await fetch(backendUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== "GET" ? req.body : undefined,
      // @ts-ignore
      duplex: "half",
    });

    // Copy backend response headers (important for content-disposition and content-type)
    const resHeaders = new Headers();
    response.headers.forEach((val, key) => resHeaders.set(key, val));

    return new NextResponse(response.body, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Proxy Failed: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return proxyRequest(req, "compress-video");
}
