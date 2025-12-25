import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import axios from "axios";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(data);
    const images: string[] = [];
    let inTourSection = false;
    let stopSection = false;

    // Helper to resolve absolute URL
    const resolveUrl = (relative: string) => {
      try {
        return new URL(relative, url).href;
      } catch (e) {
        return null; // Invalid URL
      }
    };

    $("body *").each((i, el) => {
      if (stopSection) return;

      const text = $(el).text().trim().toUpperCase();
      const tagName = $(el).prop("tagName").toLowerCase();

      // Start Marker
      if (
        text.includes("CHƯƠNG TRÌNH TOUR") &&
        ["h1", "h2", "h3", "h4", "h5", "h6", "strong", "b"].some((t) =>
          tagName.startsWith(t)
        )
      ) {
        inTourSection = true;
        return;
      }

      // End Markers
      if (
        inTourSection &&
        ["GIÁ TOUR", "LỊCH KHỞI HÀNH", "ĐIỀU KHOẢN", "LƯU Ý", "THÔNG TIN"].some(
          (k) => text.includes(k)
        ) &&
        ["h1", "h2", "h3", "h4", "h5", "h6", "strong", "b"].some((t) =>
          tagName.startsWith(t)
        )
      ) {
        stopSection = true;
        inTourSection = false;
        return;
      }

      // Collect Images
      if (inTourSection && tagName === "img") {
        let src = $(el).attr("src") || $(el).attr("data-src");
        if (src) {
          const fullUrl = resolveUrl(src);
          if (fullUrl && !images.includes(fullUrl)) {
            images.push(fullUrl);
          }
        }
      }
    });

    return NextResponse.json({ images });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to scrape", details: error.message },
      { status: 500 }
    );
  }
}
