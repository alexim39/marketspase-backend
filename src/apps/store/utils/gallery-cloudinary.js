import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export async function uploadGalleryMedia(fileBuffer, originalName) {
  const isVideo = /\.(mp4|mov|avi|webm|mkv)$/i.test(originalName);
  const resourceType = isVideo ? 'video' : 'image';

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'store-platform/gallery',
        resource_type: resourceType,
        transformation: isVideo ? [] : [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto:good' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}

export async function deleteGalleryMedia(fileUrl) {
  try {
    const publicId = extractPublicId(fileUrl);
    const isVideo = fileUrl.includes('/video/');
    await cloudinary.uploader.destroy(publicId, {
      resource_type: isVideo ? 'video' : 'image',
      invalidate: true
    });
  } catch (err) {
    console.error('Failed to delete gallery media:', fileUrl, err?.message);
  }
}

function extractPublicId(url) {
  const parts = url.split('/');
  const uploadIdx = parts.findIndex(p => p === 'upload');
  if (uploadIdx === -1) return '';
  const after = parts.slice(uploadIdx + 1);
  if (after[0]?.startsWith('v')) after.shift();
  return after.join('/').replace(/\.[^/.]+$/, '');
}
