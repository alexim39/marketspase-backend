// middleware/upload.middleware.js
import multer from 'multer';

// Configure multer to use memory storage for Cloudinary uploads
const storage = multer.memoryStorage(); // Changed from diskStorage to memoryStorage

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extname = allowedTypes.test(file.originalname.toLowerCase().match(/\.[0-9a-z]+$/i)?.[0] || '');
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, PNG, WebP, GIF)'));
  }
};

// Limits
const limits = {
  fileSize: 5 * 1024 * 1024, // 5MB max
  files: 1 // Single file
};

export const upload = multer({
  storage,
  fileFilter,
  limits
});