const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const archiver = require("archiver");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { google } = require("googleapis");
const { Readable } = require("stream");
const multer = require("multer");
const { PDFDocument } = require("pdf-lib");
const cron = require("node-cron");

const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 1108;

// Reduce concurrent compression jobs to 1 to save server CPU/RAM
const JOB_CONCURRENCY = 1;
let activeJobs = 0;
const jobQueue = [];

// ... imports remain the same ...

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*", // Allow all or restrict to Frontend Vercel Domain
    methods: ["GET", "POST"],
  })
);
app.use(express.static("public"));
app.use(express.json());

// --- CRON JOB: CLEANUP FILES ---
// Run every 30 minutes
cron.schedule("*/30 * * * *", () => {
  console.log("Running scheduled cleanup...");
  const uploadsDir = path.join(__dirname, "uploads");
  const ONE_HOUR = 60 * 60 * 1000;

  fs.readdir(uploadsDir, (err, files) => {
    if (err) return console.error("Cleanup Error:", err);

    files.forEach((file) => {
      // Keep .gitkeep
      if (file === ".gitkeep") return;

      const filePath = path.join(uploadsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        if (Date.now() - stats.mtimeMs > ONE_HOUR) {
          fs.unlink(filePath, () => console.log(`Deleted stale file: ${file}`));
        }
      });
    });
  });
});

// ... Keep existing helper functions (resolveUrl, getWatermark, processImage)...
const resolveUrl = (base, relative) => {
  try {
    return new URL(relative, base).href;
  } catch (e) {
    return null;
  }
};

// ... Watermark Helper (Keep existing logic) ...
// (Omitting for brevity in Replace, assume existing functions are preserved if not overwritten,
//  but I am replacing the whole block, I must be careful.
//  Wait, "ReplaceContent" replaces the range. I need to keep the functions.
//  I will rewrite the specific parts instead of the whole file to be safe.
//  Let's use specific replacements.)

// CHANGING STRATEGY: Use MULTI_REPLACE to target specific blocks.

// Helper to resolve absolute URLs
const resolveUrl = (base, relative) => {
  try {
    return new URL(relative, base).href;
  } catch (e) {
    return null;
  }
};

// Watermark Helper
let WATERMARK_BUFFER = null;

async function getWatermark() {
  if (WATERMARK_BUFFER) return WATERMARK_BUFFER;
  try {
    const response = await axios.get(
      "https://happybooktravel.com/logo-footer.svg",
      { responseType: "text" }
    );
    let svg = response.data;
    // Inject opacity=0.3 into the SVG root to make it transparent
    if (svg.includes("<svg")) {
      svg = svg.replace(/<svg([^>]*)>/, '<svg$1 opacity="0.3">');
    }
    WATERMARK_BUFFER = Buffer.from(svg);
    return WATERMARK_BUFFER;
  } catch (e) {
    console.error("Could not fetch watermark:", e.message);
    return null;
  }
}

async function processImage(imgUrl) {
  // 1. Download image
  const response = await axios.get(imgUrl, { responseType: "arraybuffer" });

  // 2. Resize Main Image
  // We resize first to determins dimensions
  const imagePipeline = sharp(response.data);
  const { data: resizedBuffer, info } = await imagePipeline
    .resize({ width: 1500, withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });

  // 3. Prepare Watermark
  const watermark = await getWatermark();
  let finalBuffer = resizedBuffer;

  if (watermark) {
    // Resize watermark to 40% of main image width (adjusted for aesthetics)
    const logoWidth = Math.round(info.width * 0.4);

    if (logoWidth > 0) {
      const logoBuffer = await sharp(watermark)
        .resize({ width: logoWidth })
        .toBuffer();

      // 4. Composite
      finalBuffer = await sharp(resizedBuffer)
        .composite([{ input: logoBuffer, gravity: "center" }])
        .toBuffer();
    }
  }

  // 5. Convert to WebP
  return await sharp(finalBuffer).webp({ quality: 75, effort: 6 }).toBuffer();
}

app.get("/api/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    console.log(`Scraping: ${url}`);
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    const $ = cheerio.load(data);
    const images = [];

    // Logic to find the specific section "CHƯƠNG TRÌNH TOUR"
    // We look for headers containing specific keywords or the structure seen in the analysis.
    // Based on the user request and standard structures, we'll try to find the start and end markers.

    let inTourSection = false;
    let stopSection = false;

    // Iterate through all elements in the main content area if possible, or body
    // A common pattern in these sites is a container div. We'll try to be generic yet specific.

    // Find the "CHƯƠNG TRÌNH TOUR" header.
    // Based on analysis, it might be an h3, h4, or strong tag inside a div.
    // We will traverse the DOM.

    $("body *").each((i, el) => {
      if (stopSection) return;

      const text = $(el).text().trim().toUpperCase();
      const tagName = $(el).prop("tagName").toLowerCase();

      // Check for Start Marker
      if (
        text.includes("CHƯƠNG TRÌNH TOUR") &&
        (tagName.startsWith("h") || tagName === "strong" || tagName === "b")
      ) {
        inTourSection = true;
        // Don't add images from the header itself usually
        return;
      }

      // Check for End Markers
      if (
        inTourSection &&
        (text.includes("GIÁ TOUR") ||
          text.includes("LỊCH KHỞI HÀNH") ||
          text.includes("ĐIỀU KHOẢN") ||
          text.includes("LƯU Ý")) &&
        (tagName.startsWith("h") || tagName === "strong" || tagName === "b")
      ) {
        stopSection = true;
        inTourSection = false;
        return;
      }

      if (inTourSection) {
        // If this element creates an image, or contains an image
        if (tagName === "img") {
          let src = $(el).attr("src") || $(el).attr("data-src");
          if (src) {
            const fullUrl = resolveUrl(url, src);
            if (fullUrl && !images.includes(fullUrl)) {
              images.push(fullUrl);
            }
          }
        }
      }
    });

    // Fallback: if we didn't find "CHƯƠNG TRÌNH TOUR" specifically by traversing linear DOM (which can be tricky with nesting),
    // we might try a more selector-based approach if the above yields 0.
    if (images.length === 0) {
      console.log(
        "Linear traversal failed to find images, trying selector text contains..."
      );
      // Try to find the container that has "CHƯƠNG TRÌNH TOUR"
      // This is harder to implement reliably without a specific selector.
      // Let's stick to the traversal or just grab images that look like tour images if specific section fails?
      // Better to respect user rule: "không lấy ảnh ở các đoạn khác".
      // Let's try to broaden the start match if strict match failed.
    }

    console.log(`Found ${images.length} images.`);
    res.json({ images });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to scrape URL" });
  }
});

app.get("/api/download-zip", async (req, res) => {
  const { images } = req.query; // Expecting a JSON string of array
  if (!images) {
    return res.status(400).send("No images provided");
  }

  let imageUrls;
  try {
    imageUrls = JSON.parse(images);
  } catch (e) {
    return res.status(400).send("Invalid images format");
  }

  const archive = archiver("zip", {
    zlib: { level: 9 }, // Sets the compression level.
  });

  res.attachment("tour-images.zip");
  archive.pipe(res);

  for (let i = 0; i < imageUrls.length; i++) {
    const imgUrl = imageUrls[i];
    try {
      const processedBuffer = await processImage(imgUrl);

      const filename = `image_${i + 1}.webp`;
      archive.append(processedBuffer, { name: filename });
    } catch (e) {
      console.error(`Failed to download or process ${imgUrl}:`, e.message);
    }
  }

  archive.finalize();
});

// Helper to extract Folder ID from URL
function getDriveFolderId(url) {
  // Common patterns:
  // https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
  // https://drive.google.com/drive/u/0/folders/FOLDER_ID
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

app.post("/api/upload-drive", async (req, res) => {
  const { images, driveUrl, accessToken } = req.body;

  if (!images || !driveUrl || !accessToken) {
    return res.status(400).json({
      error: "Missing required fields (images, driveUrl, or accessToken)",
    });
  }

  const folderId = getDriveFolderId(driveUrl);
  if (!folderId) {
    return res.status(400).json({ error: "Invalid Drive Folder URL" });
  }

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: "v3", auth });

    let count = 0;

    // We process sequentially or with some concurrency.
    // For simplicity, let's do sequential to avoid hitting rate limits too hard on a free account.
    for (let i = 0; i < images.length; i++) {
      const imgUrl = images[i];

      // Use shared helper
      const processedBuffer = await processImage(imgUrl);

      // 2. Upload
      const filename = `image_${i + 1}.webp`;

      // Create stream from buffer
      const bufferStream = new Readable();
      bufferStream.push(processedBuffer);
      bufferStream.push(null);

      await drive.files.create({
        requestBody: {
          name: filename,
          parents: [folderId],
        },
        media: {
          mimeType: "image/webp",
          body: bufferStream,
        },
      });
      count++;
    }

    res.json({ success: true, count });
  } catch (error) {
    console.error("Upload error:", error);
    // Be helpful with error messages
    let msg = "Lỗi khi upload lên Drive.";
    if (error.code === 404)
      msg += " Không tìm thấy Folder (hoặc không có quyền truy cập).";
    if (error.code === 403)
      msg +=
        " Lỗi quyền truy cập (Access Denied). Service Account cần được share quyền Editor vào folder này.";
    res.status(500).json({ error: msg, details: error.message });
  }
});

const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

// Configure Multer
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 1024 * 1024 * 1024 }, // Increase limit to 1GB
});

// Job Queue (In-Memory)
const jobs = {};

// Helper to update job
const updateJob = (id, data) => {
  if (jobs[id]) {
    jobs[id] = { ...jobs[id], ...data };
  }
};

app.post("/api/compress-video", upload.single("video"), (req, res) => {
  const file = req.file;
  const { targetMB, width: targetWidth } = req.body;

  if (!file) {
    return res.status(400).json({ error: "Please upload a video file" });
  }

  const jobId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  const outputPath = `uploads/compressed_${jobId}.mp4`;

  // Initialize Job
  jobs[jobId] = {
    id: jobId,
    status: "processing",
    progress: 0,
    startTime: Date.now(),
    originalName: file.originalname,
    path: outputPath, // Sent for download later
    tempInput: file.path, // To clean up later
  };

  // Return ID immediately
  res.json({ jobId });

  // Add to Queue
  jobQueue.push({ jobId, file, targetMB, width: targetWidth });
  processQueue();
});

const jobQueue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || jobQueue.length === 0) return;

  isProcessing = true;
  const { jobId, file, targetMB, width } = jobQueue.shift();
  const outputPath = `uploads/compressed_${jobId}.mp4`;

  // Update status to processing (already set initially, but confirming)
  updateJob(jobId, { status: "processing", progress: 0 });

  (async () => {
    try {
      // 1. Probe
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(file.path, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const duration = metadata.format.duration;
      const stream = metadata.streams.find((s) => s.codec_type === "video");
      const originalWidth = stream ? stream.width : null;

      // 2. Options
      let outputOptions = [
        "-vcodec libx264",
        "-movflags +faststart",
        "-preset fast",
      ];

      if (targetMB && duration) {
        const targetSizeInBits = targetMB * 8 * 1024 * 1024;
        const totalBitrate = Math.floor(targetSizeInBits / duration);
        const videoBitrate = Math.max(100000, totalBitrate - 128000);
        outputOptions.push(`-b:v ${videoBitrate}`);
        outputOptions.push(`-maxrate ${videoBitrate * 1.5}`);
        outputOptions.push(`-bufsize ${videoBitrate * 2}`);
      } else {
        outputOptions.push("-crf 26");
      }

      let videoFilter = [];
      if (
        targetWidth &&
        originalWidth &&
        parseInt(targetWidth) < originalWidth
      ) {
        videoFilter.push(`scale=${targetWidth}:-2`);
      }

      // 3. FFMPEG Command
      await new Promise((resolve, reject) => {
        let command = ffmpeg(file.path).outputOptions(outputOptions);

        if (videoFilter.length > 0) {
          command = command.videoFilters(videoFilter);
        }

        command
          .on("progress", (progress) => {
            // Calculate percentage
            if (progress.percent) {
              updateJob(jobId, { progress: Math.round(progress.percent) });
            }
          })
          .save(outputPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err));
      });

      // Completion
      const stat = fs.statSync(outputPath);
      updateJob(jobId, {
        status: "completed",
        progress: 100,
        compressedSize: stat.size,
      });
    } catch (error) {
      console.error("Job Failed:", error);
      updateJob(jobId, { status: "error", error: error.message });
      // Cleanup output if failed
      try {
        fs.unlinkSync(outputPath);
      } catch (e) {}
    } finally {
      // Always cleanup input
      try {
        fs.unlinkSync(file.path);
      } catch (e) {}

      // Process next job
      isProcessing = false;
      processQueue();
    }
  })();
}

app.get("/api/job-status/:id", (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.get("/api/download-video/:id", (req, res) => {
  const job = jobs[req.params.id];
  if (!job || job.status !== "completed") {
    return res.status(400).json({ error: "File not ready or not found" });
  }

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("X-Original-Name", job.originalName); // Helper header
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="compressed_${job.originalName}"`
  );
  res.download(job.path, (err) => {
    if (!err) {
      // Optional: Delete file after download?
      // For now, let's keep it in the session or delete after some time.
      // Better to delete to save space if it's a one-off.
      // let's NOT delete immediately to allow multiple downloads.
      // Cleanup logic should be separate (e.g. cron).
    }
  });
});

app.post("/api/merge-pdf", upload.array("pdfs"), async (req, res) => {
  const files = req.files;
  try {
    if (!files || files.length < 2) {
      return res
        .status(400)
        .json({ error: "Please upload at least 2 PDF files" });
    }

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    for (const file of files) {
      // Load source PDF from disk
      const pdfBytes = fs.readFileSync(file.path);
      const pdf = await PDFDocument.load(pdfBytes);
      // Copy all pages
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      // Add pages to the new document
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    // Serialize the PDFDocument to bytes
    const pdfBytes = await mergedPdf.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="merged.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Merge PDF Error:", error);
    res
      .status(500)
      .json({ error: "Failed to merge PDFs", details: error.message });
  } finally {
    // Cleanup temp files
    if (files) {
      files.forEach((file) => {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {}
      });
    }
  }
});

// Global Error Handler (Must be last)
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  res
    .status(500)
    .json({ error: "Internal Server Error", details: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
