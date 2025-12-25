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
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://www.google.com/",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Ch-Ua":
          '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 15000,
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
