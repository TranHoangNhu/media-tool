"use client";

import { useState } from "react";
import Script from "next/script";
import Link from "next/link";

export default function FindImagePage() {
  const [url, setUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [driveUrl, setDriveUrl] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [clientId, setClientId] = useState("");

  const BACKEND_URL = ""; // Use relative path for proxy

  const scanImages = async () => {
    if (!url) {
      setStatus("Vui lòng nhập đường dẫn URL!");
      return;
    }

    setLoading(true);
    setStatus("Đang phân tích trang web...");
    setImages([]);

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/scrape?url=${encodeURIComponent(url)}`
      );
      const data = await res.json();

      if (data.images && data.images.length > 0) {
        setImages(data.images);
        setStatus(`Tìm thấy ${data.images.length} ảnh.`);
      } else {
        setStatus("Không tìm thấy ảnh nào trong phần chương trình tour.");
      }
    } catch (error) {
      console.error(error);
      setStatus(
        "Có lỗi xảy ra khi tải dữ liệu. Hãy đảm bảo Server Backend đang chạy (Port 1108)."
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadAll = async () => {
    if (images.length === 0) return;
    setStatus("Đang nén ảnh (xử lý server)...");

    try {
      const jsonImages = JSON.stringify(images);
      const res = await fetch(
        `${BACKEND_URL}/api/download-zip?images=${encodeURIComponent(
          jsonImages
        )}`
      );
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const tempUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = tempUrl;
      a.download = "tour-photos.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(tempUrl);
      a.remove();
      setStatus("Tải xuống thành công!");
    } catch (err: any) {
      setStatus("Lỗi tải xuống: " + err.message);
    }
  };

  const handleAuth = () => {
    if (!clientId) {
      alert("Vui lòng nhập Google Client ID!");
      return;
    }

    if (typeof window !== "undefined" && (window as any).google) {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (tokenResponse: any) => {
          if (tokenResponse.access_token) {
            setAccessToken(tokenResponse.access_token);
            setStatus("Đã kết nối Google Drive! Sẵn sàng upload.");
          }
        },
      });
      setTokenClient(client);
      client.requestAccessToken();
    }
  };

  const uploadToDrive = async () => {
    if (!images.length || !driveUrl || !accessToken) return;
    setStatus("Đang upload lên Drive...");

    try {
      const res = await fetch(`${BACKEND_URL}/api/upload-drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, driveUrl, accessToken }),
      });
      const result = await res.json();
      if (res.ok) {
        setStatus(`Upload thành công ${result.count} ảnh!`);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      setStatus("Lỗi Upload: " + err.message);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-[var(--background)]">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
      />

      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link
            href="/"
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Quay lại Dashboard
          </Link>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-pink-500">
            Tìm & Xử Lý Ảnh Tour
          </h1>
          <div className="w-8"></div>
        </div>

        {/* Input Section */}
        <div className="glass-panel p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <input
              type="text"
              placeholder="Nhập đường dẫn URL tour..."
              className="input-field flex-1"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && scanImages()}
            />
            <button
              onClick={scanImages}
              disabled={loading}
              className="primary-btn whitespace-nowrap min-w-[120px]"
            >
              {loading ? "Đang quét..." : "Tìm Ảnh"}
            </button>
          </div>

          {
            // Show status
            status && (
              <div className="text-blue-300 font-medium animate-pulse">
                {status}
              </div>
            )
          }
        </div>

        {/* Auth & Actions Section */}
        {images.length > 0 && (
          <div className="glass-panel p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left: Actions */}
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold mb-2">Thao tác</h3>
              <div className="flex gap-4">
                <button
                  onClick={downloadAll}
                  className="primary-btn flex-1 bg-gradient-to-r from-green-500 to-emerald-600"
                >
                  Download ZIP
                </button>
                {accessToken && (
                  <button
                    onClick={uploadToDrive}
                    className="primary-btn flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                  >
                    Upload Drive
                  </button>
                )}
              </div>
            </div>

            {/* Right: Drive Config */}
            <div className="flex flex-col gap-3 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
              <h3 className="text-lg font-semibold text-gray-300">
                Cấu hình Google Drive
              </h3>
              {!accessToken ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Google Client ID"
                    className="input-field text-sm"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                  <button
                    onClick={handleAuth}
                    className="primary-btn text-sm py-2"
                  >
                    Kết nối
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-400">
                  <span>● Đã kết nối với Google</span>
                </div>
              )}

              <input
                type="text"
                placeholder="Link Folder Google Drive (để upload)"
                className="input-field text-sm"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Gallery Grid */}
        <div className="grid-gallery">
          {images.map((src, idx) => (
            <div key={idx} className="image-card group">
              <img src={src} alt={`Extracted ${idx}`} loading="lazy" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <span className="text-xs text-white bg-black/60 px-2 py-1 rounded">
                  #{idx + 1}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
