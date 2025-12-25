import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // Prevent caching
export const maxDuration = 60; // Increase timeout to 60 seconds (if supported by platform)

export async function POST(req: NextRequest) {
  const backendUrl = "http://localhost:1108/api/merge-pdf";

  try {
    // 1. Validate Content-Type
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Invalid Content-Type" },
        { status: 400 }
      );
    }

    // 2. Proxy to Backend
    // We pass the raw body stream directly to avoid buffering in Next.js memory
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
      },
      body: req.body,
      // @ts-ignore: 'duplex' is a Node.js fetch extension required for streaming bodies
      duplex: "half",
    });

    if (!response.ok) {
      // If backend returns error (e.g., 400 or 500)
      let errorMessage = "Backend Error";
      try {
        const text = await response.text();
        // Try to parse JSON error if possible
        try {
          const json = JSON.parse(text);
          errorMessage = json.error || json.details || text;
        } catch {
          errorMessage = text;
        }
      } catch (e) {}

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    // 3. Stream Response Back
    // Backend returns a PDF stream, we pipe it to the client
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="merged.pdf"',
      },
    });
  } catch (error: any) {
    console.error("Proxy Error:", error);
    return NextResponse.json(
      { error: "Proxy Failed: " + error.message },
      { status: 500 }
    );
  }
}
