// utils/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export async function uploadToCloudinary(filePath, folderPath) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folderPath, // Use the path passed directly from the controller
      resource_type: 'auto', // Auto-detects if it's a video or image
    });

    // Clean up local file after upload
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return result;
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw error;
  }
}
