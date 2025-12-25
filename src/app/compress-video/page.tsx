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

  const load = async () => {
    setIsLoadingCore(true);

    try {
      // Dynamic import to avoid SSR issues
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");

      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      ffmpeg.on("log", ({ message }) => {
        // console.log(message);
      });

      ffmpeg.on("progress", ({ progress }) => {
        setProgress(Math.round(progress * 100));
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
      setStatus("FFmpeg đã sẵn sàng!");
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
  }, []);

  const compress = async () => {
    if (!videoFile || !loaded || !ffmpegRef.current) return;
    setStatus("Đang nén video... Vui lòng chờ");
    setProgress(0);

    const { fetchFile } = await import("@ffmpeg/util");
    const ffmpeg = ffmpegRef.current;

    const inputName = "input.mp4";
    const outputName = "output.mp4";

    await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

    await ffmpeg.exec([
      "-i",
      inputName,
      "-vcodec",
      "libx264",
      "-crf",
      "28",
      "-preset",
      "ultrafast",
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    const url = URL.createObjectURL(
      new Blob([data.buffer], { type: "video/mp4" })
    );
    setOutputBlobUrl(url);
    setStatus("Nén thành công!");
  };

  return (
    <div className="min-h-screen p-8 bg-[var(--background)]">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-gray-400 mb-6 inline-block">
          ← Quay lại
        </Link>
        <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-indigo-500">
          Nén Video (Client-side WASM)
        </h1>

        {!loaded ? (
          <div className="text-center p-8 glass-panel animate-pulse">
            {isLoadingCore
              ? "Đang tải bộ xử lý FFmpeg (Lần đầu sẽ mất ~20s)..."
              : status || "Đang khởi tạo..."}
          </div>
        ) : (
          <>
            <div className="glass-panel p-8 mb-8 text-center border-dashed border-2 hover:border-purple-500 relative">
              <input
                type="file"
                accept="video/mp4,video/mov"
                onChange={(e) =>
                  setVideoFile(e.target.files ? e.target.files[0] : null)
                }
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <h3 className="text-xl font-semibold">
                {videoFile ? videoFile.name : "Chọn Video MP4"}
              </h3>
            </div>

            {progress > 0 && progress < 100 && (
              <div className="w-full bg-gray-700 rounded-full h-2.5 mb-4">
                <div
                  className="bg-purple-600 h-2.5 rounded-full"
                  style={{ width: `${progress}%` }}
                ></div>
                <p className="text-right text-xs mt-1">{progress}%</p>
              </div>
            )}

            <div className="text-center text-green-400 font-bold mb-4">
              {status}
            </div>

            <button
              onClick={compress}
              disabled={!videoFile || (progress > 0 && progress < 100)}
              className="primary-btn w-full bg-gradient-to-r from-purple-600 to-indigo-600"
            >
              Nén Ngay
            </button>

            {outputBlobUrl && (
              <div className="mt-8 p-4 bg-slate-900 rounded-xl">
                <h3 className="text-lg mb-2">Kết quả:</h3>
                <video controls src={outputBlobUrl} className="w-full mb-4" />
                <a
                  href={outputBlobUrl}
                  download={`compressed_${videoFile?.name}`}
                  className="primary-btn block text-center bg-green-600"
                >
                  Tải Xuống
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
