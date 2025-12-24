# Media Processing Application (Hệ Thống Xử Lý Đa Phương Tiện)

Dự án cung cấp bộ công cụ xử lý media chuyên dụng cho vận hành tour và marketing, với kiến trúc tách biệt **Frontend (Next.js)** và **Backend (Node.js/Express)** để tối ưu hiệu suất và khả năng mở rộng.

## 🌐 Kiến Trúc Triển Khai

- **Frontend**: [https://tranhoangnhu.website](https://tranhoangnhu.website)
  - Deploy trên **Vercel**.
  - Giao diện người dùng, kết nối tới Backend thông qua Proxy hoặc API trực tiếp.
- **Backend API**: [https://api-nextjs.tranhoangnhu.website](https://api-nextjs.tranhoangnhu.website)
  - Deploy trên **iNET** (Node.js App).
  - Xử lý các tác vụ nặng: Nén video, Xử lý ảnh (Watermark/Resize), Ghép PDF.
  - Sử dụng **Job Queue** để kiểm soát tài nguyên server.

---

## 🚀 Tính Năng Chính

### 1. Nén Video (`/compress-video`) 🎬

- **Cơ chế Job Queue**: Chỉ xử lý 1 video cùng một lúc để tránh quá tải Server (CPU/RAM).
- **Tuỳ chọn nén**:
  - Giới hạn dung lượng đích (Target Size in MB).
  - Web Optimized (Fast Start).
  - Resize thông minh (Full HD, HD).
- Hỗ trợ tải file ZIP cho nhiều video.

### 2. Tìm & Xử Lý Ảnh Tour (`/find-image`) 🖼️

- Quét ảnh từ URL chương trình tour.
- **Tự động đóng dấu Logo** (Watermark) vào giữa ảnh (độ mờ 30%).
- Chuyển đổi sang **WebP** và Resize (Max width 1500px).
- Upload trực tiếp lên **Google Drive** cá nhân.

### 3. Ghép File PDF (`/merge-pdf`) 📄

- Upload và ghép nhiều file PDF thành một.
- Hỗ trợ file lớn (Stream Processing).

### 4. Hệ Thống Tự Động ⚙️

- **Auto Cleanup**: Server tự động quét và xóa các file tạm (`uploads/`) cũ hơn 1 tiếng sau mỗi 30 phút để giải phóng ổ cứng.
- **CORS Security**: Backend chỉ chấp nhận requests từ Frontend chính chủ.

---

## 🛠 Cài Đặt & Chạy Local

Để phát triển trên máy cá nhân, bạn cần chạy song song cả 2 dịch vụ.

### 1. Backend

Chịu trách nhiệm xử lý logic (Port 1108).

```bash
cd backend
npm install
node server.js
```

_Backend sẽ chạy tại: `http://localhost:1108`_

### 2. Frontend

Giao diện người dùng (Port 3000).

```bash
cd frontend
npm install
npm run dev
```

_Truy cập: `http://localhost:3000`_

---

## 📦 Hướng Dẫn Deploy

### 1. Deploy Frontend (Vercel)

- Kết nối GitHub Repository.
- Cấu hình Environment Variables (nếu cần, hiện tại đã hardcode domain backend cho ổn định).
- Framework Preset: **Next.js**.

### 2. Deploy Backend (iNET / VPS)

- Nén thư mục `backend` thành file `.zip` (**Lưu ý**: Loại bỏ folder `node_modules`).
- Upload lên Server (cấu hình Node.js App trên cPanel/iNET).
- Entry point: `server.js`.
- Bấm **Install NPM Packages** và **Start App**.

---

## 📝 Cấu Trúc Thư Mục

- `backend/`
  - `server.js`: Core logic, Queue, API Routes.
  - `uploads/`: Thư mục lưu trữ tạm (được dọn dẹp tự động).
- `frontend/`
  - `src/app/`: Next.js App Router Pages.
  - `next.config.ts`: Cấu hình Proxy & Routing.
