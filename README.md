# Google Declaration Portal (Hệ Thống Khai Báo & Xử Lý Ảnh)

Dự án website hỗ trợ vận hành, xử lý hình ảnh tour và tài liệu PDF, được xây dựng với kiến trúc hiện đại **Frontend (Next.js)** và **Backend (Express)**.

## 🚀 Tính Năng Chính

### 1. Tìm & Xử Lý Ảnh Tour (`/find-image`)

- Quét ảnh tự động từ URL bài viết tour (website du lịch).
- **Tự động đóng dấu Logo** (Watermark) vào giữa ảnh.
- Chuyển đổi định dạng sang **WebP** để tối ưu dung lượng.
- Tải về trọn bộ (file ZIP) hoặc **Upload trực tiếp lên Google Drive**.
- Hỗ trợ xác thực OAuth2 với Google Drive cá nhân.

### 2. Ghép File PDF (`/merge-pdf`)

- Cho phép upload và ghép nhiều file PDF thành một văn bản duy nhất.
- **Hỗ trợ file lớn**: Đã cấu hình lên tới **100MB**.
- Xử lý thông minh: Dùng cơ chế **Streaming Proxy** giúp upload file lớn mượt mà qua mạng LAN mà không bị lỗi bộ nhớ.
- Tự động dọn dẹp file tạm sau khi xử lý.

---

## 🛠 Cài Đặt & Khởi Chạy

Bạn cần mở 2 cửa sổ Terminal (dòng lệnh) để chạy song song cả Backend và Frontend.

### Bước 1: Khởi động Backend (Server Xử Lý)

Backend chạy tại port `1108`, chịu trách nhiệm xử lý logic nặng (Resize ảnh, Merge PDF).

```bash
cd backend
npm install       # Cài đặt thư viện (chỉ làm lần đầu)
node server.js    # Khởi động server
```

_Màn hình hiện: `Server running at http://localhost:1108` là thành công._

### Bước 2: Khởi động Frontend (Giao Diện Web)

Frontend chạy tại port `3000`, cung cấp giao diện người dùng.

```bash
cd frontend
npm install       # Cài đặt thư viện (chỉ làm lần đầu)
npm run dev       # Khởi động chế độ Development
```

_Truy cập website tại:_ `http://localhost:3000`

---

## ⚙️ Cấu Hình Nâng Cao

### 1. Truy cập qua mạng LAN (Cho kế toán/nhân viên khác)

Hệ thống đã được cấu hình để cho phép truy cập từ các máy khác trong cùng mạng LAN.

- **Backend**: Đã mở CORS cho mọi nguồn.
- **Frontend**: Người dùng khác truy cập bằng IP của máy chủ, ví dụ: `http://192.168.1.165:3000`.

### 2. Xử Lý File Lớn (PDF Merge)

- Hệ thống sử dụng cơ chế **Disk Storage** (lưu tạm vào ổ cứng) thay vì RAM để tránh tràn bộ nhớ khi ghép nhiều file.
- Giới hạn upload hiện tại: **100MB**.
- Nếu gặp lỗi kết nối, hãy đảm bảo Backend đang chạy.

### 3. Cấu Trúc Dự Án

- `backend/`: Chứa code Express Server.
  - `uploads/`: Thư mục tạm chứa file PDF khi merge (tự động xóa sau khi xong).
  - `server.js`: File chính.
- `frontend/`: Chứa code Next.js 15.
  - `src/app/api/merge-pdf/route.ts`: Proxy đặc biệt để stream file lớn sang backend.
  - `next.config.ts`: Cấu hình bảo mật và IP cho phép.

## 📝 Ghi Chú

- Khi cần cập nhật giao diện, chỉ cần sửa trong `frontend`.
- Khi cần sửa logic xử lý ảnh/pdf, sửa trong `backend`.
- **Luôn đảm bảo Backend chạy trước Frontend.**
