# Media Tool (Client-side Processing)

Ứng dụng xử lý media (Ảnh/Video/PDF) chạy hoàn toàn trên trình duyệt (**Client-side**), không cần Backend Server.

🔗 **Link truy cập:** [https://tranhoangnhu.website](https://tranhoangnhu.website)

## 🚀 Tính Năng

Đây là phiên bản **Serverless / Client-first**, giúp bảo mật dữ liệu (file không rời khỏi máy bạn) và tiết kiệm chi phí server.

### 1. Nén Video MP4

- Sử dụng **FFmpeg WASM** chạy trực tiếp trên trình duyệt.
- KHÔNG upload video lên server -> Tốc độ xử lý cực nhanh, không giới hạn dung lượng.

### 2. Xử Lý Ảnh Tour

- Quét ảnh từ URL tour (thông qua Proxy API Serverless).
- Resize & Đóng dấu Logo bằng **HTML5 Canvas**.
- Tải file ZIP hoặc Upload thẳng Google Drive (API Client-side).

### 3. Ghép File PDF

- Sử dụng thư viện `pdf-lib` xử lý ngay tại trình duyệt.

## 🛠 Cài Đặt (Local)

Chỉ cần chạy Frontend Next.js:

```bash
cd frontend
npm install
npm run dev
```

Truy cập: `http://localhost:3000`

## 📦 Deploy (Vercel)

Dự án này đã được tối ưu để chạy 100% trên Vercel (bản Free).
Chỉ cần Import repo này vào Vercel là chạy ngay lập tức.
