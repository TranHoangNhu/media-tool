// @ts-nocheck
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Disable SSG
export const dynamic = "force-dynamic";

export default function CompressVideoPage() {
  const searchParams = useSearchParams();
  const isDesktop = searchParams.get("app") === "desktop";

  const [videoFile, setVideoFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [outputBlobUrl, setOutputBlobUrl] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ---------- NẾU KHÔNG PHẢI DESKTOP: HIỆN BANNER TẢI APP ----------
  if (!isDesktop) {
    return (
      <div className="min-h-screen p-8 bg-[var(--background)] flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-indigo-500">
          Nén Video Pro (Desktop)
        </h1>
        <p className="text-gray-400 mb-8 max-w-lg">
          Để sử dụng tính năng nén video tốc độ cao, vui lòng tải và cài đặt ứng
          dụng Desktop của chúng tôi. Phiên bản web browser đã ngừng hỗ trợ để
          đảm bảo hiệu suất tốt nhất.
        </p>

        <div className="p-8 bg-white/5 rounded-2xl border border-white/10 mb-8">
          <h3 className="text-xl font-bold mb-2">🚀 Media Tool Agent</h3>
          <p className="text-sm text-gray-500 mb-4">
            Phiên bản Windows (x64) - Tích hợp Server Local
          </p>
          <button
            className="primary-btn bg-purple-600 hover:bg-purple-500"
            onClick={() => alert("Link tải đang được cập nhật!")}
          >
            ⬇️ Tải Ngay (Windows .exe)
          </button>
        </div>

        <Link
          href="/"
          className="text-gray-500 hover:text-white transition-colors"
        >
          ← Quay lại trang chủ
        </Link>
      </div>
    );
  }

  // ---------- LOGIC NÉN SERVER (CHỈ HIỆN KHI Ở TRONG APP) ----------
  const compressWithServer = async () => {
    if (!videoFile) return;

    setStatus("Đang tải video lên Server Local...");
    setIsCompressing(true);
    setProgress(0);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("video", videoFile);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "http://localhost:3001/upload", true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
          setStatus(`Đang tải lên... ${percent}%`);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.success && response.jobId) {
              setStatus("Đang xử lý trên Server (0%)...");
              setUploadProgress(100);

              const jobId = response.jobId;
              const poll = setInterval(async () => {
                try {
                  const res = await fetch(
                    `http://localhost:3001/status/${jobId}`
                  );
                  const job = await res.json();

                  if (job.status === "processing") {
                    setProgress(job.progress);
                    setStatus(`Server đang xử lý... ${job.progress}%`);
                  } else if (job.status === "completed") {
                    clearInterval(poll);
                    setProgress(100);
                    setOutputBlobUrl(job.downloadUrl);
                    setStatus("Nén thành công bằng Server!");
                    setIsCompressing(false);
                  } else if (job.status === "failed") {
                    clearInterval(poll);
                    setStatus(`Lỗi xử lý: ${job.error}`);
                    setIsCompressing(false);
                  }
                } catch (err) {
                  console.error("Polling error:", err);
                }
              }, 1000);
            }
          } catch (e) {
            setStatus("Lỗi phản hồi từ Server");
            setIsCompressing(false);
          }
        } else {
          setStatus("Lỗi từ Server: " + xhr.statusText);
          alert("Lỗi: Server chưa chạy! Hãy khởi động lại App.");
          setIsCompressing(false);
        }
      };

      xhr.onerror = () => {
        setStatus("Không thể kết nối Server Local");
        alert("Lỗi: Server chưa chạy (Port 3001). Hãy khởi động lại App.");
        setIsCompressing(false);
      };

      xhr.send(formData);
    } catch (e) {
      console.error(e);
      setStatus("Lỗi kết nối!");
      setIsCompressing(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-[var(--background)]">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-indigo-500">
          Nén Video Pro (Desktop)
        </h1>

        <div className="glass-panel p-8 mb-8 text-center border-dashed border-2 hover:border-purple-500 relative transition-all">
          <input
            type="file"
            accept="video/*"
            onChange={(e) =>
              setVideoFile(e.target.files ? e.target.files[0] : null)
            }
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <h3 className="text-xl font-semibold mb-2">
            {videoFile ? videoFile.name : "Kéo thả hoặc Chọn Video để nén"}
          </h3>
          <p className="text-sm text-gray-400">
            Hỗ trợ mọi định dạng (MP4, AVI, MOV...) - Tốc độ Server Local
          </p>
        </div>

        {isCompressing && (
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1 text-gray-400">
              <span>
                {uploadProgress < 100
                  ? "Đang tải lên..."
                  : "Server đang xử lý..."}
              </span>
              <span>
                {uploadProgress < 100 ? `${uploadProgress}%` : `${progress}%`}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-purple-600 h-full transition-all duration-300 relative"
                style={{
                  width: `${uploadProgress < 100 ? uploadProgress : progress}%`,
                }}
              >
                <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite] skew-x-12"></div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-green-400 font-bold mb-4 min-h-[24px]">
          {status}
        </div>

        <button
          onClick={compressWithServer}
          disabled={!videoFile || isCompressing}
          className={`primary-btn w-full h-12 font-bold text-lg shadow-lg shadow-purple-900/20 active:scale-95 transition-all
                ${
                  !videoFile || isCompressing
                    ? "opacity-50 cursor-not-allowed grayscale"
                    : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-purple-600/40"
                }
            `}
        >
          {isCompressing ? "Đang xử lý..." : "Nén Tốc Độ Cao (Local)"}
        </button>

        {outputBlobUrl && (
          <div className="mt-8 p-6 bg-slate-900/50 border border-white/10 rounded-2xl animate-fade-in-up">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              ✅ Kết quả thành công
            </h3>
            <div className="rounded-xl overflow-hidden bg-black mb-4 aspect-video">
              <video
                controls
                src={outputBlobUrl}
                className="w-full h-full object-contain"
              />
            </div>
            <a
              href={outputBlobUrl}
              download={`compressed_${videoFile?.name || "video"}`}
              className="primary-btn block text-center bg-green-600 hover:bg-green-500 w-full"
            >
              ⬇️ Tải Video Mới
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
