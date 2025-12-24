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
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static");

// --- SETUP ---
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

const app = express();
const PORT = process.env.PORT || 1108;

// --- CONFIGURATION ---
const JOB_CONCURRENCY = 1;
let activeJobs = 0;
const jobQueue = [];

// Initialize Jobs Store
const jobs = {};

// --- MIDDLEWARE ---
app.use(
  cors({
    origin: [
      "https://tranhoangnhu.website",
      "https://media.tranhoangnhu.website",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST"],
  })
);
app.use(express.static("public"));
app.use(express.json());

// Configure Multer
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
});

// --- HELPER FUNCTIONS ---

const resolveUrl = (base, relative) => {
  try {
    return new URL(relative, base).href;
  } catch (e) {
    return null;
  }
};

let WATERMARK_BUFFER = null;
async function getWatermark() {
  if (WATERMARK_BUFFER) return WATERMARK_BUFFER;
  try {
    const response = await axios.get(
      "https://happybooktravel.com/logo-footer.svg",
      { responseType: "text" }
    );
    let svg = response.data;
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
  // 1. Download
  const response = await axios.get(imgUrl, { responseType: "arraybuffer" });

  // 2. Resize
  const imagePipeline = sharp(response.data);
  const { data: resizedBuffer, info } = await imagePipeline
    .resize({ width: 1500, withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });

  // 3. Watermark
  const watermark = await getWatermark();
  let finalBuffer = resizedBuffer;

  if (watermark) {
    const logoWidth = Math.round(info.width * 0.4);
    if (logoWidth > 0) {
      const logoBuffer = await sharp(watermark)
        .resize({ width: logoWidth })
        .toBuffer();
      finalBuffer = await sharp(resizedBuffer)
        .composite([{ input: logoBuffer, gravity: "center" }])
        .toBuffer();
    }
  }

  // 4. WebP
  return await sharp(finalBuffer).webp({ quality: 75, effort: 6 }).toBuffer();
}

function getDriveFolderId(url) {
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

const updateJob = (id, data) => {
  if (jobs[id]) {
    jobs[id] = { ...jobs[id], ...data };
  }
};

// --- CRON JOB: CLEANUP ---
cron.schedule("*/30 * * * *", () => {
  console.log("Running scheduled cleanup...");
  const uploadsDir = path.join(__dirname, "uploads");
  const ONE_HOUR = 60 * 60 * 1000;

  fs.readdir(uploadsDir, (err, files) => {
    if (err) return console.error("Cleanup Error:", err);
    files.forEach((file) => {
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

// --- API ROUTES ---

// 1. Scrape Images
app.get("/api/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

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
    let inTourSection = false;
    let stopSection = false;

    $("body *").each((i, el) => {
      if (stopSection) return;
      const text = $(el).text().trim().toUpperCase();
      const tagName = $(el).prop("tagName").toLowerCase();

      if (
        text.includes("CHƯƠNG TRÌNH TOUR") &&
        ["h1", "h2", "h3", "h4", "h5", "h6", "strong", "b"].some((t) =>
          tagName.startsWith(t)
        )
      ) {
        inTourSection = true;
        return;
      }

      if (
        inTourSection &&
        ["GIÁ TOUR", "LỊCH KHỞI HÀNH", "ĐIỀU KHOẢN", "LƯU Ý", "THÔNG TIN"].some(
          (k) => text.includes(k)
        ) &&
        ["h1", "h2", "h3", "h4", "h5", "h6", "strong", "b"].some((t) =>
          tagName.startsWith(t)
        )
      ) {
        stopSection = true;
        inTourSection = false;
        return;
      }

      if (inTourSection && tagName === "img") {
        let src = $(el).attr("src") || $(el).attr("data-src");
        if (src) {
          const fullUrl = resolveUrl(url, src);
          if (fullUrl && !images.includes(fullUrl)) {
            images.push(fullUrl);
          }
        }
      }
    });

    console.log(`Found ${images.length} images.`);
    res.json({ images });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to scrape URL" });
  }
});

// 2. Download ZIP
app.get("/api/download-zip", async (req, res) => {
  const { images } = req.query;
  if (!images) return res.status(400).send("No images provided");

  let imageUrls;
  try {
    imageUrls = JSON.parse(images);
  } catch (e) {
    return res.status(400).send("Invalid images format");
  }

  const archive = archiver("zip", { zlib: { level: 9 } });
  res.attachment("tour-images.zip");
  archive.pipe(res);

  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const processedBuffer = await processImage(imageUrls[i]);
      archive.append(processedBuffer, { name: `image_${i + 1}.webp` });
    } catch (e) {
      console.error(`Failed ${imageUrls[i]}:`, e.message);
    }
  }
  archive.finalize();
});

// 3. Upload Drive
app.post("/api/upload-drive", async (req, res) => {
  const { images, driveUrl, accessToken } = req.body;
  if (!images || !driveUrl || !accessToken) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const folderId = getDriveFolderId(driveUrl);
  if (!folderId)
    return res.status(400).json({ error: "Invalid Drive Folder URL" });

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: "v3", auth });
    let count = 0;

    for (let i = 0; i < images.length; i++) {
      const processedBuffer = await processImage(images[i]);
      const bufferStream = new Readable();
      bufferStream.push(processedBuffer);
      bufferStream.push(null);

      await drive.files.create({
        requestBody: {
          name: `image_${i + 1}.webp`,
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
    res.status(500).json({ error: "Failed to upload to Drive" });
  }
});

// 4. Compress Video (Queue Logic)
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue || jobQueue.length === 0) return;

  isProcessingQueue = true;
  const { jobId, file, targetMB, width } = jobQueue.shift();
  const outputPath = `uploads/compressed_${jobId}.mp4`;

  updateJob(jobId, { status: "processing", progress: 0 });

  try {
    // Probe
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(file.path, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    const duration = metadata.format.duration;
    const stream = metadata.streams.find((s) => s.codec_type === "video");
    const originalWidth = stream ? stream.width : null;

    // Options
    let outputOptions = [
      "-vcodec libx264",
      "-movflags +faststart",
      "-preset fast",
    ];

    if (targetMB && duration) {
      const targetSizeInBits = targetMB * 8 * 1024 * 1024;
      const totalBitrate = Math.floor(targetSizeInBits / duration);
      const videoBitrate = Math.max(100000, totalBitrate - 128000); // Leave 128k for audio
      outputOptions.push(`-b:v ${videoBitrate}`);
      outputOptions.push(`-maxrate ${videoBitrate * 1.5}`);
      outputOptions.push(`-bufsize ${videoBitrate * 2}`);
    } else {
      outputOptions.push("-crf 26");
    }

    let videoFilter = [];
    if (width && originalWidth && parseInt(width) < originalWidth) {
      videoFilter.push(`scale=${width}:-2`);
    }

    // Process
    await new Promise((resolve, reject) => {
      let command = ffmpeg(file.path).outputOptions(outputOptions);
      if (videoFilter.length > 0) command = command.videoFilters(videoFilter);

      command
        .on("progress", (p) => {
          if (p.percent) {
            updateJob(jobId, { progress: Math.round(p.percent) });
          }
        })
        .save(outputPath)
        .on("end", resolve)
        .on("error", reject);
    });

    // Complete
    const stat = fs.statSync(outputPath);
    updateJob(jobId, {
      status: "completed",
      progress: 100,
      compressedSize: stat.size,
    });
  } catch (error) {
    console.error("Job Failed:", error);
    updateJob(jobId, { status: "error", error: error.message });
    try {
      fs.unlinkSync(outputPath);
    } catch (e) {}
  } finally {
    // Cleanup Input
    try {
      fs.unlinkSync(file.path);
    } catch (e) {}

    // Next
    isProcessingQueue = false;
    processQueue();
  }
}

app.post("/api/compress-video", upload.single("video"), (req, res) => {
  const file = req.file;
  const { targetMB, width } = req.body;

  if (!file) {
    return res.status(400).json({ error: "Please upload a video file" });
  }

  const jobId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  const outputPath = `uploads/compressed_${jobId}.mp4`;

  jobs[jobId] = {
    id: jobId,
    status: "processing", // Client sees processing immediately
    progress: 0,
    startTime: Date.now(),
    originalName: file.originalname,
    path: outputPath,
    tempInput: file.path,
  };

  res.json({ jobId });

  // Add to Queue
  jobQueue.push({ jobId, file, targetMB, width });
  processQueue();
});

app.get("/api/job-status/:id", (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.get("/api/download-video/:id", (req, res) => {
  const job = jobs[req.params.id];
  if (!job || job.status !== "completed") {
    return res.status(400).json({ error: "File not ready" });
  }
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("X-Original-Name", job.originalName);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="compressed_${job.originalName}"`
  );
  res.download(job.path);
});

// 5. Merge PDF
app.post("/api/merge-pdf", upload.array("pdfs"), async (req, res) => {
  const files = req.files;
  if (!files || files.length < 2) {
    return res.status(400).json({ error: "Please upload at least 2 PDFs" });
  }

  try {
    const mergedPdf = await PDFDocument.create();
    for (const file of files) {
      const pdfBytes = fs.readFileSync(file.path);
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }
    const pdfBytes = await mergedPdf.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="merged.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Merge PDF Error:", error);
    res.status(500).json({ error: "Failed to merge PDFs" });
  } finally {
    files.forEach((file) => {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {}
    });
  }
});

// Error Handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Public URL: https://api-nextjs.tranhoangnhu.website (or http://localhost:${PORT})`
  );
});
