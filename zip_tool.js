const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const source = "backend/dist/MediaTool-win32-x64";
const dest = "backend/dist/MediaTool-Setup.zip";

console.log("Zipping...");

try {
  // Dùng tar để nén (Windows 10+ hỗ trợ tar)
  // tar -cf archive.zip --format=zip directory
  // Lưu ý: tar của Windows hơi khác một chút, nhưng thường powershell Compress-Archive là chuẩn nhất.
  // Nếu powershell lỗi quyền, ta thử lệnh tar.

  // Cách tốt nhất: Dùng thư viện archiver nếu có, nhưng ở đây ta dùng tools có sẵn.

  // Thử lại powershell nhưng đảm bảo không ai dùng file
  execSync(
    `powershell Compress-Archive -Path "backend/dist/MediaTool-win32-x64/*" -DestinationPath "${dest}" -Force`
  );

  console.log("✅ ZIP created successfully at: " + dest);
} catch (e) {
  console.error("❌ Zip Failed:", e.message);
}
