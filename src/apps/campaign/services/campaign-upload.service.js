import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { v2 as cloudinary } from "cloudinary";

// 🔹 Configure Cloudinary (make sure you have these in your .env file)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🔹 Configure storage engine
// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: async (req, file) => {
//     const isVideo = file.mimetype.startsWith("video/");
//     return {
//       folder: "campaigns", // Cloudinary folder name
//       resource_type: isVideo ? "video" : "image", // Auto handle images/videos
//       public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
//       //format: isVideo ? "mp4" : "jpg", // Optional: Cloudinary auto-detects, but this helps
//     };
//   },
// });

// Optional enhancement to campaign-upload.service.js
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    try {
      const isVideo = file.mimetype.startsWith("video/");
      const publicId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      
      console.log(`Uploading ${isVideo ? 'video' : 'image'} to Cloudinary:`, {
        originalName: file.originalname,
        mimeType: file.mimetype,
        publicId: publicId,
        folder: 'campaigns'
      });
      
      return {
        folder: "campaigns",
        resource_type: isVideo ? "video" : "image",
        public_id: publicId,
      };
    } catch (error) {
      console.error('Error in Cloudinary storage params:', error);
      throw error;
    }
  },
});

// 🔹 File filter to restrict upload types
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image and video files are allowed!"), false);
  }
};

// 🔹 Multer middleware using Cloudinary storage
export const campaignUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});
