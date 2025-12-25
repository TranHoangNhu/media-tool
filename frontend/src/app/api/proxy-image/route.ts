import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      timeout: 10000,
    });

    const headers = new Headers();
    headers.set(
      "Content-Type",
      response.headers["content-type"] || "image/jpeg"
    );
    headers.set("Cache-Control", "public, max-age=3600"); // Cache nicely

    return new NextResponse(response.data, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}
