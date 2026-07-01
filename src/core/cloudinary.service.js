import multer from "multer";
import path from 'path';
import fs from 'fs';

// 1. Ensure the upload directory exists
const uploadDir = 'uploads/products';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Configure Disk Storage (Required for file.path and large videos)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Configure multer for file uploads
export const cloudinaryMediaUpload = multer({
  storage: storage, // CHANGED: switched from memoryStorage to storage
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10, 
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "application/pdf",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Images, GIFs, Videos, and PDFs are allowed."));
    }
  },
});