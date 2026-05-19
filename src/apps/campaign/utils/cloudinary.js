// utils/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs/promises';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export async function uploadToCloudinary(filePath, folderPath) {
  const removeLocalFile = async () => {
    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      if (unlinkError?.code !== 'ENOENT') {
        console.error('Failed to remove temporary upload file:', unlinkError);
      }
    }
  };

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folderPath, // Use the path passed directly from the controller
      resource_type: 'auto', // Auto-detects if it's a video or image
    });

    // Clean up local file after upload
    await removeLocalFile();

    return result;
  } catch (error) {
    await removeLocalFile();
    throw error;
  }
}
