"use client";

import { useState } from "react";
import Script from "next/script";
import Link from "next/link";
import JSZip from "jszip";

// --- CLIENT-SIDE PROCESSING LOGIC ---
async function processImageClientSide(
  imageUrl: string,
  watermarkUrl: string
): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Important for Canvas
    // Use our proxy to avoid CORS issues
    img.src = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Target Width
      const TARGET_WIDTH = 1500;
      const scale = TARGET_WIDTH / img.width;
      canvas.width = TARGET_WIDTH;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      // Draw Resized Image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw Watermark
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      logo.src = watermarkUrl; // Assuming this allows CORS or served from same domain

      logo.onload = () => {
        const logoWidth = canvas.width * 0.4; // 40% width
        const logoScale = logoWidth / logo.width;
        const logoHeight = logo.height * logoScale;

        // Center
        const x = (canvas.width - logoWidth) / 2;
        const y = (canvas.height - logoHeight) / 2;

        ctx.globalAlpha = 0.3; // 30% Opacity
        ctx.drawImage(logo, x, y, logoWidth, logoHeight);
        ctx.globalAlpha = 1.0;

        // Export WebP
        canvas.toBlob(
          (blob) => {
            resolve(blob);
          },
          "image/webp",
          0.75
        );
      };

      logo.onerror = () => {
        // If logo fails, just resolve image
        canvas.toBlob((blob) => resolve(blob), "image/webp", 0.75);
      };
    };

    img.onerror = () => resolve(null); // Skip error images
  });
}

export default function FindImagePage() {
  const [url, setUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedBlobs, setProcessedBlobs] = useState<Blob[]>([]);

  // Drive State
  const [driveUrl, setDriveUrl] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");

  const scanImages = async () => {
    if (!url) return setStatus("Vui lòng nhập URL!");
    setLoading(true);
    setStatus("Đang quét...");
    setImages([]);
    setProcessedBlobs([]);

    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.images?.length > 0) {
        setImages(data.images);
        setStatus(`Tìm thấy ${data.images.length} ảnh. Sẵn sàng xử lý.`);
      } else {
        setStatus("Không tìm thấy ảnh.");
      }
    } catch (e) {
      setStatus("Lỗi khi quét ảnh.");
    } finally {
      setLoading(false);
    }
  };

  const processAllImagesHelper = async () => {
    if (images.length === 0) return null;
    setIsProcessing(true);
    setStatus("Đang xử lý ảnh (Resize & Watermark)... vui lòng không tắt tab.");

    const blobs: Blob[] = [];
    // Watermark URL (hardcoded for now, or fetch via proxy if needed)
    // We use a direct link if it allows CORS, or proxy it.
    // Ideally put logo in public folder.
    const LOGO_URL = "https://happybooktravel.com/logo-footer.svg";
    // Proxy the logo too just in case
    const PROXY_LOGO = `/api/proxy-image?url=${encodeURIComponent(LOGO_URL)}`;

    for (let i = 0; i < images.length; i++) {
      setStatus(
        `Đang xử lý ảnh ${i + 1}/${images.length} (${Math.round(
          ((i + 1) / images.length) * 100
        )}%)`
      );
      const blob = await processImageClientSide(images[i], PROXY_LOGO);
      if (blob) blobs.push(blob);
    }
    setProcessedBlobs(blobs);
    setIsProcessing(false);
    setStatus(`Xử lý xong ${blobs.length} ảnh! Đã lưu vào bộ nhớ trình duyệt.`);
    return blobs;
  };

  const downloadZip = async () => {
    let blobs = processedBlobs;
    if (blobs.length === 0) {
      blobs = (await processAllImagesHelper()) || [];
    }
    if (blobs.length === 0) return;

    setStatus("Đang tạo file ZIP...");
    const zip = new JSZip();
    blobs.forEach((blob, i) => {
      zip.file(`image_${i + 1}.webp`, blob);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "images_processed.zip";
    a.click();
    setStatus("Đã tải xuống!");
  };

  // --- GOOGLE DRIVE UPLOAD (CLIENT-SIDE) ---
  const handleAuth = () => {
    if (!clientId) return alert("Nhập Client ID");
    // @ts-ignore
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (resp: any) => {
        if (resp.access_token) {
          setAccessToken(resp.access_token);
          setStatus("Đã kết nối Drive!");
        }
      },
    });
    client.requestAccessToken();
  };

  const uploadToDrive = async () => {
    if (!driveUrl || !accessToken) return alert("Thiếu thông tin Drive");
    let blobs = processedBlobs;
    if (blobs.length === 0) {
      blobs = (await processAllImagesHelper()) || [];
    }
    if (blobs.length === 0) return;

    // Extract Folder ID
    const match = driveUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
    const folderId = match ? match[1] : null;

    if (!folderId) return alert("Link Folder không hợp lệ");

    setStatus("Đang upload lên Drive...");
    let count = 0;

    for (let i = 0; i < blobs.length; i++) {
      setStatus(`Uploading ${i + 1}/${blobs.length}...`);
      const blob = blobs[i];
      const metadata = {
        name: `image_${i + 1}.webp`,
        parents: [folderId],
      };

      const form = new FormData();
      form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      form.append("file", blob);

      try {
        await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
          }
        );
        count++;
      } catch (e) {
        console.error(e);
      }
    }
    setStatus(`Upload hoàn tất ${count}/${blobs.length} ảnh!`);
  };

  return (
    <div className="min-h-screen p-8 bg-[var(--background)]">
      <Script src="https://accounts.google.com/gsi/client" />
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="text-gray-400">
          ← Quay lại
        </Link>
        <h1 className="text-3xl font-bold my-4">
          Tìm & Xử Lý Ảnh (Client-side)
        </h1>

        <div className="glass-panel p-6 mb-8">
          <input
            className="input-field w-full mb-4"
            placeholder="URL Tour..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            onClick={scanImages}
            disabled={loading}
            className="primary-btn"
          >
            {loading ? "Đang quét..." : "Tìm Ảnh"}
          </button>
          <div className="mt-2 text-blue-400">{status}</div>
        </div>

        {images.length > 0 && (
          <div className="glass-panel p-6 mb-8 grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl mb-4">Thao tác</h3>
              <button
                onClick={downloadZip}
                disabled={isProcessing}
                className="primary-btn w-full mb-2 bg-green-600"
              >
                {isProcessing ? "Đang xử lý..." : "Tải ZIP (Xử lý ngay)"}
              </button>

              {accessToken && (
                <button
                  onClick={uploadToDrive}
                  disabled={isProcessing}
                  className="primary-btn w-full bg-blue-600"
                >
                  Upload lên Drive
                </button>
              )}
            </div>

            <div className="p-4 bg-slate-900 rounded">
              <h3 className="mb-2">Google Drive Connect</h3>
              {!accessToken ? (
                <>
                  <input
                    className="input-field w-full mb-2 text-sm"
                    placeholder="Client ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                  <button onClick={handleAuth} className="primary-btn text-xs">
                    Kết nối
                  </button>
                </>
              ) : (
                <div className="text-green-400">● Đã kết nối</div>
              )}
              <input
                className="input-field w-full mt-2 text-sm"
                placeholder="Link Folder Drive"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((src, i) => (
            <div key={i} className="aspect-video relative bg-gray-800">
              {/* Proxy image for display too, to avoid broken images if strict CORS */}
              <img
                src={`/api/proxy-image?url=${encodeURIComponent(src)}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
