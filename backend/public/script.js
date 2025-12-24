let currentImages = [];

async function scanImages() {
  const url = document.getElementById("urlInput").value.trim();
  const statusDiv = document.getElementById("status");
  const gallery = document.getElementById("gallery");
  const actionPanel = document.getElementById("actionPanel");
  const scanBtn = document.getElementById("scanBtn");

  if (!url) {
    statusDiv.innerHTML =
      '<span style="color: #ef4444;">Vui lòng nhập đường dẫn URL!</span>';
    return;
  }

  // Reset UI
  statusDiv.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Đang phân tích trang web...';
  gallery.innerHTML = "";
  actionPanel.style.display = "none";
  currentImages = [];
  scanBtn.disabled = true;
  scanBtn.style.opacity = "0.7";

  try {
    const response = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
    const data = await response.json();

    if (data.images && data.images.length > 0) {
      currentImages = data.images;
      statusDiv.innerHTML = "";
      document.getElementById("count").innerText = currentImages.length;
      actionPanel.style.display = "flex";
      renderGallery(currentImages);
    } else {
      statusDiv.innerHTML =
        "Không tìm thấy ảnh nào trong phần chương trình tour.";
    }
  } catch (error) {
    console.error(error);
    statusDiv.innerHTML =
      '<span style="color: #ef4444;">Có lỗi xảy ra khi tải dữ liệu. Hãy thử lại!</span>';
  } finally {
    scanBtn.disabled = false;
    scanBtn.style.opacity = "1";
  }
}

function renderGallery(images) {
  const gallery = document.getElementById("gallery");
  images.forEach((src, index) => {
    const card = document.createElement("div");
    card.className = "image-card";
    card.innerHTML = `
            <img src="${src}" loading="lazy" alt="Image ${index + 1}">
        `;
    // Optional: click to view large? For now simple preview.
    gallery.appendChild(card);
  });
}

function downloadAll() {
  if (currentImages.length === 0) return;

  const btn = document.querySelector(".download-btn");
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang nén...';

  // Trigger download via API
  // We send the list of images to the backend to zip them up
  // Ideally we could just re-scrape or store session, but sending list is stateless and easy.
  const jsonImages = JSON.stringify(currentImages);

  // Create a hidden form or use fetch blob to download
  // Using simple window.location with query params might hit length limits for many images.
  // Better to use fetch blob.

  fetch(`/api/download-zip?images=${encodeURIComponent(jsonImages)}`)
    .then((response) => {
      if (response.ok) return response.blob();
      throw new Error("Download failed");
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tour-photos.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    })
    .catch((err) => {
      alert("Lỗi tải xuống: " + err.message);
    })
    .finally(() => {
      btn.innerHTML = originalText;
    });
}

function uploadToDrive() {
  if (currentImages.length === 0) return;

  const driveUrl = document.getElementById("driveUrlInput").value.trim();
  if (!driveUrl) {
    alert("Vui lòng nhập đường dẫn Google Drive Folder!");
    return;
  }

  const btn = document.querySelector(".drive-btn");
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
  btn.disabled = true;

  fetch("/api/upload-drive", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      images: currentImages,
      driveUrl: driveUrl,
      accessToken: accessToken, // Pass the token to server
    }),
  })
    .then(async (response) => {
      const result = await response.json();
      if (response.ok) {
        alert(`Upload hoàn tất! ${result.count} ảnh đã được tải lên.`);
      } else {
        throw new Error(
          result.error +
            (result.details ? `\n\nChi tiết: ${result.details}` : "")
        );
      }
    })
    .catch((err) => {
      console.error(err);
      alert(
        "Lỗi upload: " +
          err.message +
          "\n\nLưu ý: Bạn cần cấu hình Google Drive API trên server."
      );
    })
    .finally(() => {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    });
}

// OAuth Logic
let tokenClient;
let accessToken = null;

// Restore Client ID if saved
// Restore Client ID if saved or from config
const savedClientId = localStorage.getItem("google_client_id");
if (
  typeof CONFIG !== "undefined" &&
  CONFIG.GOOGLE_CLIENT_ID &&
  CONFIG.GOOGLE_CLIENT_ID.includes("googleusercontent.com")
) {
  document.getElementById("clientIdInput").value = CONFIG.GOOGLE_CLIENT_ID;
} else if (savedClientId) {
  document.getElementById("clientIdInput").value = savedClientId;
}

function handleAuth() {
  let clientId = document.getElementById("clientIdInput").value.trim();

  // Also check config if input is blank
  if (!clientId && typeof CONFIG !== "undefined" && CONFIG.GOOGLE_CLIENT_ID) {
    clientId = CONFIG.GOOGLE_CLIENT_ID;
  }

  if (!clientId) {
    alert("Vui lòng nhập Google Client ID (hoặc thêm vào config.js)!");
    return;
  }

  // Save for later
  localStorage.setItem("google_client_id", clientId);

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: "https://www.googleapis.com/auth/drive.file",
    callback: (tokenResponse) => {
      accessToken = tokenResponse.access_token;
      if (accessToken) {
        document.getElementById("authStatus").innerHTML =
          '<span style="color: green;"><i class="fa-solid fa-check"></i> Đã kết nối! Bạn có thể Upload ngay.</span>';
        document.querySelector(".drive-btn").disabled = false;
        document.getElementById("authBtn").innerText = "Đổi TK";
      }
    },
  });

  tokenClient.requestAccessToken();
}

// Enter key to scan
document.getElementById("urlInput").addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    scanImages();
  }
});
