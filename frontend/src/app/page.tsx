import Link from "next/link";
import FluidBackground from "@/components/FluidBackground";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden text-white">
      {/* Dynamic Background */}
      <FluidBackground />

      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none -z-0"></div>

      <div className="z-10 max-w-4xl w-full text-center relative">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 pb-2 drop-shadow-lg animate-fade-in-up">
          Media Processing Toolkit
        </h1>
        <p className="text-xl md:text-2xl text-gray-200 mb-12 font-medium drop-shadow-md">
          Hệ thống tích hợp xử lý Ảnh, PDF và Video siêu tốc
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl mx-auto">
          {/* Card 1: Find Image */}
          <Link href="/find-image" className="group">
            <div className="glass-panel backdrop-blur-md bg-white/10 p-8 h-full rounded-2xl border border-white/20 transition-all duration-300 hover:bg-white/20 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-blue-500/30 flex items-center justify-center text-4xl mb-2 group-hover:scale-110 transition-transform">
                🔍
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Tìm & Xử Lý Ảnh
              </h2>
              <p className="text-gray-300 text-sm">
                Quét ảnh tour, đóng dấu logo & tối ưu WebP tự động.
              </p>
            </div>
          </Link>

          {/* Card 2: Merge PDF */}
          <Link href="/merge-pdf" className="group">
            <div className="glass-panel backdrop-blur-md bg-white/10 p-8 h-full rounded-2xl border border-white/20 transition-all duration-300 hover:bg-white/20 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-red-500/30 flex items-center justify-center text-4xl mb-2 group-hover:scale-110 transition-transform">
                📄
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Ghép File PDF
              </h2>
              <p className="text-gray-300 text-sm">
                Gộp nhiều tài liệu PDF thành một file duy nhất ngay tức thì.
              </p>
            </div>
          </Link>

          {/* Card 3: Compress Video */}
          <Link href="/compress-video" className="group">
            <div className="glass-panel backdrop-blur-md bg-white/10 p-8 h-full rounded-2xl border border-white/20 transition-all duration-300 hover:bg-white/20 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-purple-500/30 flex items-center justify-center text-4xl mb-2 group-hover:scale-110 transition-transform">
                🎬
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Nén Video WASM
              </h2>
              <p className="text-gray-300 text-sm">
                Nén video MP4 trực tiếp trên trình duyệt, không giới hạn.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
