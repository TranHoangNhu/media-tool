import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 relative bg-background transition-colors duration-300">
      <div className="z-10 max-w-4xl w-full text-center">
        <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 pb-2 drop-shadow-sm">
          Bộ Công Cụ Xử Lý Đa Phương Tiện
        </h1>
        <p className="text-xl text-slate-600 dark:text-gray-300 mb-12 font-medium">
          Hệ thống tích hợp xử lý Ảnh, PDF và Video nhanh chóng, hiệu quả
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl mx-auto">
          {/* Card 1: Find Image */}
          <Link href="/find-image" className="group">
            <div className="glass-panel p-8 h-full transition-all duration-300 hover:bg-white/80 dark:hover:bg-slate-800/80 cursor-pointer flex flex-col items-center justify-center text-center gap-4 hover:-translate-y-2 hover:shadow-2xl border border-slate-200 dark:border-white/10">
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-sm">
                🔍
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                Tìm & Xử Lý Ảnh
              </h2>
              <p className="text-slate-500 dark:text-gray-400 text-sm">
                Quét ảnh tour, tự động đóng dấu logo và tối ưu hóa định dạng
                WebP.
              </p>
            </div>
          </Link>

          {/* Card 2: Merge PDF */}
          <Link href="/merge-pdf" className="group">
            <div className="glass-panel p-8 h-full transition-all duration-300 hover:bg-white/80 dark:hover:bg-slate-800/80 cursor-pointer flex flex-col items-center justify-center text-center gap-4 hover:-translate-y-2 hover:shadow-2xl border border-slate-200 dark:border-white/10">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-sm">
                📄
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                Ghép File PDF
              </h2>
              <p className="text-slate-500 dark:text-gray-400 text-sm">
                Gộp nhiều tài liệu PDF thành một file duy nhất nhanh chóng.
              </p>
            </div>
          </Link>

          {/* Card 3: Compress Video */}
          <Link href="/compress-video" className="group">
            <div className="glass-panel p-8 h-full transition-all duration-300 hover:bg-white/80 dark:hover:bg-slate-800/80 cursor-pointer flex flex-col items-center justify-center text-center gap-4 hover:-translate-y-2 hover:shadow-2xl border border-slate-200 dark:border-white/10">
              <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-sm">
                🎬
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                Nén Video Online
              </h2>
              <p className="text-slate-500 dark:text-gray-400 text-sm">
                Giảm dung lượng Video MP4 thông minh, giữ nguyên chất lượng hiển
                thị.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
