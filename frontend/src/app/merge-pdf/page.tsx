"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MergePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const BACKEND_URL = ""; // Use relative path for proxy

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files as FileList)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const mergeFiles = async () => {
    if (files.length < 2) {
      setError("Vui lòng chọn ít nhất 2 file PDF để ghép.");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    files.forEach((file) => formData.append("pdfs", file));

    try {
      const res = await fetch(`${BACKEND_URL}/api/merge-pdf`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMsg = "Lỗi khi ghép file.";
        try {
          const errData = await res.json();
          errorMsg = errData.error || errData.details || errorMsg;
        } catch (e) {
          // Fallback if response is not JSON
          const text = await res.text();
          if (text) errorMsg = `Server Error: ${text.slice(0, 50)}...`;
        }
        throw new Error(errorMsg);
      }

      // Handle download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "merged_document.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-[var(--background)]">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-gray-400 hover:text-white transition-colors mb-6 inline-block"
        >
          ← Quay lại Dashboard
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500 mb-4">
            Ghép File PDF
          </h1>
          <p className="text-gray-400">
            Công cụ ghép nhiều file PDF thành một file duy nhất nhanh chóng.
          </p>
        </div>

        {/* Upload Area */}
        <div className="glass-panel p-8 mb-8 text-center border-dashed border-2 border-slate-600 hover:border-red-500 transition-colors cursor-pointer relative">
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="pointer-events-none">
            <div className="text-4xl mb-4">📄</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Kéo thả hoặc chọn file PDF
            </h3>
            <p className="text-sm text-gray-400">
              Hỗ trợ chọn nhiều file cùng lúc
            </p>
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-3 mb-8">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="glass-panel p-4 flex items-center justify-between text-white"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-bold">
                    PDF
                  </span>
                  <span>{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 text-red-400 rounded-xl mb-6 text-center">
            {error}
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-center">
          <button
            onClick={mergeFiles}
            disabled={loading || files.length < 2}
            className={`primary-btn text-lg px-8 py-4 bg-gradient-to-r from-red-600 to-orange-600 ${
              loading || files.length < 2 ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Đang Xử Lý..." : "Ghép PDF Ngay"}
          </button>
        </div>
      </div>
    </div>
  );
}
