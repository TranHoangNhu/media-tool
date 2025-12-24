"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import JSZip from "jszip";

interface VideoItem {
  id: string;
  file: File;
  status: "queued" | "processing" | "completed" | "error";
  compressedBlob?: Blob; // Deprecated, but keep for type safety if needed temporarily
  jobId?: string; // New flow
  compressedSize?: number;
  progress?: number; // 0-100
}

export default function CompressVideoPage() {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  // Options State
  const [isTargetSizeEnabled, setIsTargetSizeEnabled] = useState(false);
  const [targetMB, setTargetMB] = useState<number | "">("");
  const [isResizeEnabled, setIsResizeEnabled] = useState(false);
  const [maxRes, setMaxRes] = useState<number | "">("");

  const MAX_TOTAL_SIZE = 1024 * 1024 * 1024; // 1GB
  const API_URL = "/api/compress-video"; // Use proxy route

  // Auto-Process Queue
  useEffect(() => {
    if (isProcessing) return;

    const nextIndex = items.findIndex((item) => item.status === "queued");
    if (nextIndex !== -1) {
      processItem(nextIndex);
    }
  }, [items, isProcessing]);

  const processItem = async (index: number) => {
    setIsProcessing(true);
    setError("");

    // Mark as processing (Phase 1: Uploading)
    setItems((prev) => {
      const newItems = [...prev];
      newItems[index].status = "processing";
      newItems[index].progress = 0; // Uploading phase
      return newItems;
    });

    const item = items[index];

    try {
      const formData = new FormData();
      formData.append("video", item.file);

      if (isTargetSizeEnabled && targetMB)
        formData.append("targetMB", targetMB.toString());
      if (isResizeEnabled && maxRes)
        formData.append("width", maxRes.toString());

      // 1. Upload & Start Job
      const res = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to upload/start");

      const { jobId } = await res.json();

      // 2. Poll for Progress
      let jobStatus = "processing";
      while (jobStatus === "processing" || jobStatus === "pending") {
        await new Promise((r) => setTimeout(r, 1000)); // Poll every 1s

        const statusRes = await fetch(`/api/job-status/${jobId}`);
        if (!statusRes.ok) break;

        const jobData = await statusRes.json();
        jobStatus = jobData.status;

        if (jobStatus === "processing") {
          setItems((prev) => {
            const newItems = [...prev];
            newItems[index].progress = jobData.progress; // 0-100%
            return newItems;
          });
        } else if (jobStatus === "completed") {
          // Done
          setItems((prev) => {
            const newItems = [...prev];
            newItems[index].status = "completed";
            newItems[index].progress = 100;
            newItems[index].compressedSize = jobData.compressedSize;
            newItems[index].jobId = jobId; // Save for download
            return newItems;
          });
        } else if (jobStatus === "error") {
          throw new Error(jobData.error || "Compression failed");
        }
      }
    } catch (err) {
      console.error(err);
      setItems((prev) => {
        const newItems = [...prev];
        newItems[index].status = "error";
        return newItems;
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter((f) =>
        f.type.startsWith("video/")
      );
      if (newFiles.length === 0) {
        alert("Vui lòng chỉ chọn file Video!");
        return;
      }

      // Calculate total size
      const currentSize = items.reduce((acc, i) => acc + i.file.size, 0);
      const newSize = newFiles.reduce((acc, f) => acc + f.size, 0);

      if (currentSize + newSize > MAX_TOTAL_SIZE) {
        setError(`Tổng dung lượng vượt quá 1GB. Vui lòng chọn ít video hơn.`);
        return;
      }

      const newItems: VideoItem[] = newFiles.map((f) => ({
        id: Math.random().toString(36).substr(2, 9),
        file: f,
        status: "queued",
      }));

      setItems((prev) => [...prev, ...newItems]);
      setError("");
    }
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const downloadSingle = (item: VideoItem) => {
    if (!item.compressedBlob) return;
    const url = window.URL.createObjectURL(item.compressedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compressed_${item.file.name}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const downloadAllZip = async () => {
    const zip = new JSZip();

    const completedItems = items.filter(
      (item) => item.status === "completed" && item.jobId
    );
    if (completedItems.length === 0) return;

    // Show temporary loading state if wanted, or just blocking await
    for (const item of completedItems) {
      if (item.jobId) {
        const res = await fetch(`/api/download-video/${item.jobId}`);
        if (res.ok) {
          const blob = await res.blob();
          zip.file(`compressed_${item.file.name}`, blob);
        }
      }
    }

    const zipContent = await zip.generateAsync({ type: "blob" });
    const url = window.URL.createObjectURL(zipContent);
    const a = document.createElement("a");
    a.href = url;
    a.download = `all_compressed_videos_${new Date()
      .toISOString()
      .slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  // Check if all done
  const isAllCompleted =
    items.length > 0 && items.every((i) => i.status === "completed");
  const isAnyProcessing = items.some(
    (i) => i.status === "processing" || i.status === "queued"
  );

  return (
    <div className="min-h-screen p-8 bg-background transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-slate-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-white transition-colors mb-6 inline-block"
        >
          ← Quay lại Dashboard
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-indigo-500 mb-4">
            Nén Video MP4
          </h1>
          <p className="text-slate-600 dark:text-gray-400">
            Tự động nén ngay khi tải lên. Tải ZIP khi hoàn tất.
          </p>
        </div>

        {/* Options Area */}
        <div className="glass-panel p-6 mb-8">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Cấu hình Nén
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Target Size Option */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="targetSizeCheck"
                className="mt-1 w-5 h-5 accent-purple-500 rounded border-slate-300 dark:border-slate-600"
                checked={isTargetSizeEnabled}
                onChange={(e) => setIsTargetSizeEnabled(e.target.checked)}
              />
              <div className="flex-1">
                <label
                  htmlFor="targetSizeCheck"
                  className="text-slate-800 dark:text-gray-200 font-medium cursor-pointer"
                >
                  Giới hạn dung lượng (Target Size)
                </label>
                <p className="text-xs text-slate-500 dark:text-gray-400 mb-2">
                  Hệ thống sẽ giảm bitrate để đạt dung lượng này.
                </p>

                {isTargetSizeEnabled && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <input
                      type="number"
                      placeholder="Ví dụ: 50"
                      className="input-field py-2 px-3 text-sm w-32"
                      value={targetMB}
                      onChange={(e) => setTargetMB(Number(e.target.value))}
                    />
                    <span className="text-slate-600 dark:text-gray-300">
                      MB (mỗi video)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Resize Option */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="resizeCheck"
                className="mt-1 w-5 h-5 accent-purple-500 rounded border-slate-300 dark:border-slate-600"
                checked={isResizeEnabled}
                onChange={(e) => setIsResizeEnabled(e.target.checked)}
              />
              <div className="flex-1">
                <label
                  htmlFor="resizeCheck"
                  className="text-slate-800 dark:text-gray-200 font-medium cursor-pointer"
                >
                  Thay đổi kích thước (Resize)
                </label>
                <p className="text-xs text-slate-500 dark:text-gray-400 mb-2">
                  Giảm độ phân giải để giảm dung lượng (Giữ nguyên tỷ lệ).
                </p>

                {isResizeEnabled && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <select
                      className="input-field py-2 px-3 text-sm w-full"
                      value={maxRes}
                      onChange={(e) => setMaxRes(Number(e.target.value))}
                    >
                      <option value="">Chọn độ rộng tối đa...</option>
                      <option value="1920">Full HD (1920px)</option>
                      <option value="1280">HD (1280px)</option>
                      <option value="854">480p (854px)</option>
                      <option value="640">360p (640px)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div className="glass-panel p-8 mb-8 text-center border-dashed border-2 border-slate-300 dark:border-slate-600 hover:border-purple-500 transition-colors cursor-pointer relative">
          <input
            type="file"
            multiple
            accept="video/mp4,video/mov,video/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="pointer-events-none">
            <div className="text-4xl mb-4">🎬</div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
              {isAnyProcessing
                ? "Đang xử lý... Bạn có thể thêm file khác"
                : "Kéo thả hoặc chọn Video để bắt đầu"}
            </h3>
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Hỗ trợ MP4, MOV. Tổng Max 1GB. Tự động chạy ngay.
            </p>
          </div>
        </div>

        {/* Helper Message */}
        {isAnyProcessing && (
          <div className="text-center mb-6 animate-pulse text-purple-500 dark:text-purple-400 font-medium">
            ⏳ Hệ thống đang tự động xử lý các video trong hàng đợi...
          </div>
        )}

        {/* File List */}
        {items.length > 0 && (
          <div className="space-y-3 mb-8">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="glass-panel p-4 flex items-center justify-between text-slate-800 dark:text-white border border-slate-200 dark:border-white/5 hover:border-indigo-300/50 dark:hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex-shrink-0 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xl">
                    {item.status === "completed" ? "✅" : "🎬"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-base text-slate-900 dark:text-white">
                      {item.file.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                      <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                        Original: {(item.file.size / 1024 / 1024).toFixed(2)} MB
                      </span>

                      {item.status === "queued" && (
                        <span className="text-slate-400 dark:text-gray-500">
                          Waiting...
                        </span>
                      )}

                      {item.status === "processing" && (
                        <div className="w-full max-w-[200px]">
                          <div className="flex justify-between text-[10px] text-blue-500 dark:text-blue-300 mb-1">
                            <span>Processing...</span>
                            <span>{item.progress || 0}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
                              style={{ width: `${item.progress || 0}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {item.status === "error" && (
                        <span className="text-red-500 dark:text-red-400">
                          Failed
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status / Download Action */}
                <div className="flex items-center gap-4 ml-4">
                  {item.status === "completed" &&
                  item.compressedSize &&
                  item.jobId ? (
                    <>
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          -{" "}
                          {Math.round(
                            (1 - item.compressedSize / item.file.size) * 100
                          )}
                          %
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">
                          {(item.compressedSize / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                      <a
                        href={`/api/download-video/${item.jobId}`}
                        download
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold py-2 px-3 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-purple-500/20"
                      >
                        <span>⬇ MP4</span>
                      </a>
                    </>
                  ) : (
                    // Show delete button only if not processing
                    item.status !== "processing" && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-slate-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 p-2"
                      >
                        ✕
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 rounded-xl mb-6 text-center">
            {error}
          </div>
        )}

        {/* Download All Button (Only appears when all done) */}
        {isAllCompleted && (
          <div className="flex justify-center animate-in fade-in slide-in-from-bottom-4">
            <button
              onClick={downloadAllZip}
              className="primary-btn text-lg px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 shadow-xl shadow-green-500/20 hover:scale-105 transition-transform"
            >
              📦 Tải Tất Cả (ZIP)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
