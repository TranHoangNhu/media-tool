// @ts-nocheck
"use client";

import { useState } from "react";
import Script from "next/script";
import Link from "next/link";
import JSZip from "jszip";

// --- CLIENT-SIDE PROCESSING LOGIC ---
async function processImageClientSide(imageUrl, watermarkUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const TARGET_WIDTH = 1500;
      const scale = TARGET_WIDTH / img.width;
      canvas.width = TARGET_WIDTH;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const logo = new Image();
      logo.crossOrigin = "anonymous";
      logo.src = watermarkUrl;

      logo.onload = () => {
        const logoWidth = canvas.width * 0.4;
        const logoScale = logoWidth / logo.width;
        const logoHeight = logo.height * logoScale;

        const x = (canvas.width - logoWidth) / 2;
        const y = (canvas.height - logoHeight) / 2;

        ctx.globalAlpha = 0.3;
        ctx.drawImage(logo, x, y, logoWidth, logoHeight);
        ctx.globalAlpha = 1.0;

        canvas.toBlob((blob) => resolve(blob), "image/webp", 0.75);
      };

      logo.onerror = () => {
        canvas.toBlob((blob) => resolve(blob), "image/webp", 0.75);
      };
    };

    img.onerror = () => resolve(null);
  });
}

export default function FindImagePage() {
  const [url, setUrl] = useState("");
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedBlobs, setProcessedBlobs] = useState([]);

  // Drive State
  const [driveUrl, setDriveUrl] = useState("");
  const [accessToken, setAccessToken] = useState(null);
  const [clientId, setClientId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [gsiLoaded, setGsiLoaded] = useState(false);

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
        setStatus("Không tìm thấy ảnh nào trong phần chương trình tour.");
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
    setStatus("Đang xử lý ảnh (Resize & Watermark)...");

    const blobs = [];
    const LOGO_URL = "https://happybooktravel.com/logo-footer.svg";
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
    setStatus(`Xử lý xong ${blobs.length} ảnh!`);
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
    setStatus("Đã tải xuống ZIP!");
  };

  // --- GOOGLE DRIVE UPLOAD (CLIENT-SIDE) ---
  const handleAuth = () => {
    if (!clientId) return alert("Vui lòng nhập Client ID");
    if (!gsiLoaded)
      return alert("Google Sign-In chưa tải xong, vui lòng thử lại");

    setIsConnecting(true);
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (resp) => {
          setIsConnecting(false);
          if (resp.access_token) {
            setAccessToken(resp.access_token);
            setStatus("✅ Đã kết nối Google Drive!");
          } else {
            setStatus("❌ Kết nối thất bại");
          }
        },
      });
      client.requestAccessToken();
    } catch (e) {
      setIsConnecting(false);
      setStatus("❌ Lỗi kết nối: " + e.message);
    }
  };

  const uploadToDrive = async () => {
    if (!driveUrl) return alert("Vui lòng nhập Link Folder Drive");
    if (!accessToken) return alert("Vui lòng kết nối Google Drive trước");

    let blobs = processedBlobs;
    if (blobs.length === 0) {
      blobs = (await processAllImagesHelper()) || [];
    }
    if (blobs.length === 0) return;

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
    setStatus(`✅ Upload hoàn tất ${count}/${blobs.length} ảnh!`);
  };

  return (
    <div className="min-h-screen p-8 bg-[var(--background)]">
      <Script
        src="https://accounts.google.com/gsi/client"
        onLoad={() => setGsiLoaded(true)}
      />
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="text-gray-400">
          ← Quay lại
        </Link>
        <h1 className="text-3xl font-bold my-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
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
              <h3 className="text-xl mb-4 font-semibold">Thao tác</h3>
              <button
                onClick={downloadZip}
                disabled={isProcessing}
                className="primary-btn w-full mb-4 bg-gradient-to-r from-green-500 to-teal-500"
              >
                {isProcessing ? "Đang xử lý..." : "📦 Tải ZIP (Xử lý ngay)"}
              </button>

              <button
                onClick={uploadToDrive}
                disabled={isProcessing || !accessToken}
                className={`primary-btn w-full ${
                  accessToken
                    ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                    : "bg-gray-600 cursor-not-allowed"
                }`}
              >
                {isProcessing
                  ? "Đang xử lý..."
                  : accessToken
                  ? "☁️ Upload lên Google Drive"
                  : "☁️ Upload (Kết nối Drive trước)"}
              </button>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <h3 className="mb-3 font-semibold">Google Drive Connect</h3>

              <input
                className="input-field w-full mb-2 text-sm"
                placeholder="Client ID (từ Google Cloud Console)"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />

              <button
                onClick={handleAuth}
                disabled={isConnecting || accessToken}
                className={`primary-btn text-sm mb-3 ${
                  accessToken
                    ? "bg-green-600"
                    : isConnecting
                    ? "bg-yellow-600"
                    : ""
                }`}
              >
                {accessToken
                  ? "✅ Đã kết nối"
                  : isConnecting
                  ? "Đang kết nối..."
                  : "🔗 Kết nối"}
              </button>

              <input
                className="input-field w-full text-sm"
                placeholder="Link Folder Drive"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((src, i) => (
            <div
              key={i}
              className="aspect-video relative bg-gray-800 rounded-lg overflow-hidden"
            >
              <img
                src={`/api/proxy-image?url=${encodeURIComponent(src)}`}
                className="w-full h-full object-cover"
                loading="lazy"
                alt={`Image ${i + 1}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
