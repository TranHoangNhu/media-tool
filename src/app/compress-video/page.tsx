// @ts-nocheck
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

// Disable SSG for this page (FFmpeg only works in browser)
export const dynamic = "force-dynamic";

export default function CompressVideoPage() {
  const [loaded, setLoaded] = useState(false);
  const [isLoadingCore, setIsLoadingCore] = useState(false);
  const ffmpegRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [outputBlobUrl, setOutputBlobUrl] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Silent audio to keep browser tab active in background
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = async () => {
    setIsLoadingCore(true);

    try {
      // Dynamic import to avoid SSR issues
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");

      // Revert to Single-threaded for stability (Multithread causes crashes on some envs)
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      ffmpeg.on("log", ({ message }) => {
        // console.log(message);
      });

      ffmpeg.on("progress", ({ progress }) => {
        const p =
          typeof progress === "number"
            ? progress
            : (progress as any).ratio || 0;
        setProgress(Math.round(p * 100));
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });
      setLoaded(true);
      setStatus("Sẵn sàng! (Chế độ ổn định - Client Side)");
    } catch (e) {
      console.error(e);
      setStatus(
        "Lỗi tải FFmpeg (Trình duyệt không hỗ trợ SharedArrayBuffer?)."
      );
    } finally {
      setIsLoadingCore(false);
    }
  };

  useEffect(() => {
    load();
    // Create silent audio element
    const audio = new Audio(
      "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQAAAAA="
    );
    audio.loop = true;
    audioRef.current = audio;

    return () => {
      audio.pause();
    };
  }, []);

  const compress = async () => {
    if (!videoFile || !loaded || !ffmpegRef.current) return;

    setIsCompressing(true);

    // 1. Play silent audio to trick browser into keeping tab active
    if (audioRef.current) {
      audioRef.current
        .play()
        .catch((e) => console.log("Audio autoplay failed", e));
    }

    setStatus("Đang nén video... Đừng đóng tab (Tab có thể chạy ẩn).");
    setProgress(0);

    const { fetchFile } = await import("@ffmpeg/util");
    const ffmpeg = ffmpegRef.current;

    const inputName = "input.mp4";
    const outputName = "output.mp4";

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

      // Command Optimization
      // -crf 30: Higher compression (default ~23). Range 0-51. 30 is good for web.
      // -preset veryfast: Good balance of speed vs size (ultrafast is too big)
      // -an: Remove audio? No, let's keep it.
      await ffmpeg.exec([
        "-i",
        inputName,
        "-vcodec",
        "libx264",
        "-crf",
        "32", // Aggressive compression
        "-preset",
        "superfast", // Faster than veryfast, better than ultrafast
        "-movflags",
        "+faststart", // Combine for web optimization
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName);
      const url = URL.createObjectURL(
        new Blob([data.buffer], { type: "video/mp4" })
      );
      setOutputBlobUrl(url);
      setStatus("Nén thành công!");
    } catch (e) {
      console.error(e);
      setStatus("Lỗi trong quá trình nén video.");
    } finally {
      setIsCompressing(false);
      // Stop audio
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  };

  const [processingMode, setProcessingMode] = useState<"wasm" | "server">(
    "server"
  ); // Default to Server for speed
  const [uploadProgress, setUploadProgress] = useState(0);

  // ... (giữ nguyên code cũ của WASM load/useEffect) ...

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

              // Start Polling Loop
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
          alert("Đảm bảo bạn đã chạy 'node server.js' ở thư mục backend!");
          setIsCompressing(false);
        }
      };

      xhr.onerror = () => {
        setStatus("Không thể kết nối Server Local (http://localhost:3001)");
        alert("Hãy chạy lệnh 'npm start' trong thư mục backend trước!");
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
        <Link href="/" className="text-gray-400 mb-6 inline-block">
          ← Quay lại
        </Link>
        <h1 className="text-4xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-indigo-500">
          Nén Video Pro
        </h1>

        {/* Mode Selection */}
        <div className="flex gap-4 mb-8 bg-white/5 p-1 rounded-xl w-fit mx-auto">
          <button
            onClick={() => setProcessingMode("server")}
            className={`px-6 py-2 rounded-lg transition-all ${
              processingMode === "server"
                ? "bg-purple-600 text-white shadow-lg"
                : "hover:bg-white/10 text-gray-400"
            }`}
          >
            🚀 Server Local (Siêu Tốc)
          </button>
          <button
            onClick={() => setProcessingMode("wasm")}
            className={`px-6 py-2 rounded-lg transition-all ${
              processingMode === "wasm"
                ? "bg-purple-600 text-white shadow-lg"
                : "hover:bg-white/10 text-gray-400"
            }`}
          >
            🌐 Browser (Không cài đặt)
          </button>
        </div>

        <div className="glass-panel p-8 mb-8 text-center border-dashed border-2 hover:border-purple-500 relative transition-all">
          <input
            type="file"
            accept="video/mp4,video/mov,video/avi"
            onChange={(e) =>
              setVideoFile(e.target.files ? e.target.files[0] : null)
            }
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <h3 className="text-xl font-semibold mb-2">
            {videoFile ? videoFile.name : "Chọn Video để nén"}
          </h3>
          <p className="text-sm text-gray-400">
            {processingMode === "server"
              ? "Hỗ trợ mọi định dạng (MP4, AVI, MOV...)"
              : "Hỗ trợ tốt nhất MP4"}
          </p>
        </div>

        {/* Progress UI */}
        {isCompressing && (
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1 text-gray-400">
              <span>
                {processingMode === "server"
                  ? uploadProgress < 100
                    ? "Đang tải lên..."
                    : "Server đang xử lý..."
                  : "Đang nén trên Browser..."}
              </span>
              <span>
                {processingMode === "server" && uploadProgress < 100
                  ? `${uploadProgress}%`
                  : `${progress}%`}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-purple-600 h-full transition-all duration-300 relative"
                style={{
                  width: `${
                    processingMode === "server" && uploadProgress < 100
                      ? uploadProgress
                      : progress
                  }%`,
                }}
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite] skew-x-12"></div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-green-400 font-bold mb-4 min-h-[24px]">
          {status}
        </div>

        <button
          onClick={processingMode === "server" ? compressWithServer : compress}
          disabled={
            !videoFile ||
            isCompressing ||
            (processingMode === "wasm" && !loaded)
          }
          className={`primary-btn w-full h-12 font-bold text-lg shadow-lg shadow-purple-900/20 active:scale-95 transition-all
                ${
                  !videoFile || isCompressing
                    ? "opacity-50 cursor-not-allowed grayscale"
                    : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-purple-600/40"
                }
            `}
        >
          {isCompressing
            ? "Đang xử lý..."
            : processingMode === "server"
            ? "Nén Tốc Độ Cao (Local)"
            : "Nén Bằng JS (Browser)"}
        </button>

        {/* Output Section */}
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

        {/* WASM Status Footer */}
        {processingMode === "wasm" && (
          <div className="mt-8 text-center text-xs text-gray-500">
            {!loaded
              ? isLoadingCore
                ? "Đang tải Core..."
                : "Chưa tải xong FFmpeg"
              : "FFmpeg WASM sẵn sàng"}
          </div>
        )}
      </div>
    </div>
  );
}
