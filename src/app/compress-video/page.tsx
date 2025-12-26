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

  // ---------- GIAO DIỆN WEB (CHƯA CÀI APP) ----------
  if (!isDesktop) {
    return (
      <div className="min-h-screen p-8 bg-[var(--background)] flex flex-col items-center justify-center text-center">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/30 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/30 rounded-full blur-[100px]"></div>
        </div>

        <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
          Nén Video Tốc Độ Cao
        </h1>
        <p className="text-gray-300 mb-10 max-w-xl text-lg leading-relaxed">
          Để đảm bảo hiệu suất xử lý video tốt nhất (không bị giới hạn bởi trình
          duyệt), chúng tôi đã chuyển sang ứng dụng Desktop chuyên dụng.
        </p>

        <div className="p-10 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 mb-10 shadow-2xl max-w-md w-full transform hover:scale-105 transition-all duration-300">
          <div className="text-6xl mb-6">🚀</div>
          <h3 className="text-2xl font-bold mb-2 text-white">
            Media Tool Agent
          </h3>
          <p className="text-gray-400 mb-6">
            Phiên bản Windows (x64) • Native Performance
          </p>

          <a
            href="https://github.com/TranHoangNhu/media-tool/releases/download/v1.0.0/MediaTool-Setup.zip"
            className="w-full block py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl font-bold text-white shadow-lg shadow-purple-900/40 active:translate-y-1 transition-all"
          >
            ⬇️ Tải Ngay (GitHub Release)
          </a>
          <p className="text-xs text-gray-500 mt-4">
            Giải nén và chạy file MediaTool.exe
          </p>
        </div>

        <Link
          href="/"
          className="text-gray-500 hover:text-white transition-colors border-b border-transparent hover:border-gray-500"
        >
          ← Quay lại trang chủ
        </Link>
      </div>
    );
  }

  // ---------- LOGIC NÉN SERVER (APP DESKTOP) ----------
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
              setStatus("Máy tính đang xử lý (0%)...");
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
                    setStatus(`Đang xử lý... ${job.progress}%`);
                  } else if (job.status === "completed") {
                    clearInterval(poll);
                    setProgress(100);
                    setOutputBlobUrl(job.downloadUrl);
                    setStatus("✅ Hoàn thành!");
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
          setStatus("Lỗi kết nối Server Local");
          setIsCompressing(false);
        }
      };

      xhr.onerror = () => {
        setStatus("Không kết nối được 3001");
        setIsCompressing(false);
      };

      xhr.send(formData);
    } catch (e) {
      console.error(e);
      setStatus("Lỗi Exception");
      setIsCompressing(false);
    }
  };

  // ---------- GIAO DIỆN DESKTOP (TỐI GIẢN) ----------
  return (
    <div className="min-h-screen p-8 bg-transparent flex flex-col items-center justify-center select-none">
      <div className="w-full max-w-xl animate-fade-in-up">
        {/* Tiêu đề gọn */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
            Nén Video Siêu Tốc
          </h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest">
            Powered by Local Server
          </p>
        </div>

        {/* Khung Upload */}
        <div className="glass-panel p-12 mb-8 text-center border-dashed border-2 border-white/5 hover:border-purple-500/50 relative transition-all rounded-3xl group bg-black/20 hover:bg-black/30">
          <input
            type="file"
            accept="video/*"
            onChange={(e) =>
              setVideoFile(e.target.files ? e.target.files[0] : null)
            }
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />

          <div className="group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 mb-6 text-6xl filter drop-shadow-xl">
            {videoFile ? "🎬" : "📹"}
          </div>

          <h3 className="text-xl font-bold mb-2 text-white truncate px-4">
            {videoFile ? videoFile.name : "Kéo thả Video vào đây"}
          </h3>
          <p className="text-sm text-gray-400">Hỗ trợ MP4, MOV, AVI, WMV...</p>
        </div>

        {/* Progress Bar Tinh Tế */}
        {isCompressing && (
          <div className="mb-6 bg-gray-800/50 rounded-full p-1 border border-white/5">
            <div className="w-full h-4 rounded-full overflow-hidden relative">
              <div
                className="bg-gradient-to-r from-purple-600 to-pink-600 h-full transition-all duration-300 relative"
                style={{
                  width: `${uploadProgress < 100 ? uploadProgress : progress}%`,
                }}
              >
                <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite] skew-x-12"></div>
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-2 uppercase font-bold tracking-wider">
              <span>
                {uploadProgress < 100 ? "Uploading..." : "Processing..."}
              </span>
              <span>{uploadProgress < 100 ? uploadProgress : progress}%</span>
            </div>
          </div>
        )}

        <div className="text-center text-green-400 font-bold mb-4 h-6 text-sm">
          {status}
        </div>

        {/* Nút chính */}
        {!outputBlobUrl ? (
          <button
            onClick={compressWithServer}
            disabled={!videoFile || isCompressing}
            className={`w-full h-14 rounded-2xl font-bold text-lg shadow-2xl transition-all transform
                    ${
                      !videoFile || isCompressing
                        ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-[1.02] hover:shadow-purple-500/30 active:scale-95"
                    }
                `}
          >
            {isCompressing ? "Đang Xử Lý..." : "BẮT ĐẦU NÉN 🔥"}
          </button>
        ) : (
          <div className="mt-4 p-6 bg-slate-900/80 border border-green-500/30 rounded-2xl animate-fade-in-up backdrop-blur-md">
            <div className="rounded-xl overflow-hidden bg-black mb-4 aspect-video shadow-inner">
              <video
                controls
                src={outputBlobUrl}
                className="w-full h-full object-contain"
              />
            </div>
            <a
              href={outputBlobUrl}
              download={`compressed_${videoFile?.name || "video"}`}
              className="block w-full py-4 text-center bg-green-600 hover:bg-green-500 rounded-xl font-bold text-white shadow-lg shadow-green-900/40 transition-all"
            >
              ⬇️ LƯU VIDEO MỚI
            </a>
            <button
              onClick={() => {
                setOutputBlobUrl(null);
                setVideoFile(null);
                setStatus("");
              }}
              className="mt-3 text-sm text-gray-400 hover:text-white w-full text-center"
            >
              làm video khác
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
