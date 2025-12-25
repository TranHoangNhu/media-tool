"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";

export default function MergePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files as FileList)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const mergeFilesClientSide = async () => {
    if (files.length < 2) {
      setError("Cần ít nhất 2 file.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // Create new PDF
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        // Read file as ArrayBuffer
        const buffer = await file.arrayBuffer();
        // Load
        const pdf = await PDFDocument.load(buffer);
        // Copy pages
        const copiedPages = await mergedPdf.copyPages(
          pdf,
          pdf.getPageIndices()
        );
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      // Save
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedPdfBytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);

      // Download
      const a = document.createElement("a");
      a.href = url;
      a.download = `merged_${new Date().getTime()}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      console.error(err);
      setError("Lỗi khi ghép file (Có thể file bị mã hóa hoặc lỗi).");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-[var(--background)]">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-gray-400 mb-6 inline-block">
          ← Quay lại
        </Link>
        <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
          Ghép PDF (Client-side)
        </h1>

        <div className="glass-panel p-8 mb-8 text-center border-dashed border-2 hover:border-red-500 relative">
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <h3 className="text-xl font-semibold">Kéo thả file PDF vào đây</h3>
          <p className="text-gray-400">Xử lý ngay trên trình duyệt của bạn</p>
        </div>

        {files.length > 0 && (
          <div className="space-y-2 mb-8">
            {files.map((file, i) => (
              <div key={i} className="glass-panel p-3 flex justify-between">
                <span>{file.name}</span>
                <button onClick={() => removeFile(i)} className="text-red-400">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <div className="text-red-500 mb-4">{error}</div>}

        <button
          onClick={mergeFilesClientSide}
          disabled={loading || files.length < 2}
          className="primary-btn w-full bg-gradient-to-r from-red-600 to-orange-600"
        >
          {loading ? "Đang ghép..." : "Ghép PDF Ngay"}
        </button>
      </div>
    </div>
  );
}
