import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a file from a local path to Cloudinary.
 * @param {string} filePath - The local path provided by multer (req.file.path)
 * @param {string} folder - The destination folder name
 */
export async function uploadToCloudinary(filePath, folder) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `store-platform/${folder}`,
      resource_type: 'auto', // CRITICAL: Automatically detects image, video, or raw (PDF)
      // Transformations only apply to images. Cloudinary ignores them for videos/PDFs unless specified.
      transformation: [
        { width: 500, height: 500, crop: 'limit' },
        { quality: 'auto:good' }
      ]
    });

    // Optional: Delete the file from your local server after successful upload
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return result;
  } catch (error) {
    // Also delete local file if upload fails to prevent disk clogging
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
}


/**
 * Deletes a file from Cloudinary using its URL or public ID
 * @param {string} fileUrlOrPublicId - The Cloudinary URL or public ID of the file to delete
 * @param {string} resourceType - The type of resource ('image', 'video', or 'raw')
 */
export async function deleteFromCloudinary(fileUrlOrPublicId, resourceType = 'image') {
  try {
    if (!fileUrlOrPublicId) {
      console.log('No file URL or public ID provided for deletion');
      return null;
    }

    // Extract public ID from URL if a full URL is provided
    let publicId = fileUrlOrPublicId;
    
    // Check if it's a URL (contains cloudinary.com)
    if (fileUrlOrPublicId.includes('cloudinary.com')) {
      // Extract public ID from Cloudinary URL
      // Format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.ext
      const urlParts = fileUrlOrPublicId.split('/');
      const versionIndex = urlParts.findIndex(part => part.startsWith('v'));
      
      if (versionIndex !== -1 && versionIndex + 1 < urlParts.length) {
        // Get everything after version/folder structure
        const pathAfterVersion = urlParts.slice(versionIndex + 1).join('/');
        // Remove file extension
        publicId = pathAfterVersion.replace(/\.[^/.]+$/, '');
      } else {
        // Fallback: get last part and remove extension
        const fileName = urlParts[urlParts.length - 1];
        publicId = fileName.replace(/\.[^/.]+$/, '');
      }
    }

    console.log(`Attempting to delete from Cloudinary: ${publicId} (type: ${resourceType})`);

    // Determine resource type based on URL or passed parameter
    let detectedResourceType = resourceType;
    
    if (fileUrlOrPublicId.includes('cloudinary.com')) {
      if (fileUrlOrPublicId.includes('/video/')) {
        detectedResourceType = 'video';
      } else if (fileUrlOrPublicId.includes('/raw/')) {
        detectedResourceType = 'raw';
      }
    }

    // Delete the file from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: detectedResourceType,
      invalidate: true // Invalidate CDN cache
    });

    console.log('Cloudinary deletion result:', result);

    // Check if deletion was successful
    if (result.result === 'ok' || result.result === 'not found') {
      return { success: true, result };
    } else {
      console.warn('Cloudinary deletion returned:', result);
      return { success: false, result };
    }

  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
}

/**
 * Deletes multiple files from Cloudinary
 * @param {Array<string>} fileUrls - Array of Cloudinary URLs to delete
 * @param {string} resourceType - The type of resource ('image', 'video', or 'raw')
 */
export async function deleteMultipleFromCloudinary(fileUrls, resourceType = 'image') {
  try {
    if (!fileUrls || !fileUrls.length) {
      return { success: true, results: [] };
    }

    const results = await Promise.allSettled(
      fileUrls.map(url => deleteFromCloudinary(url, resourceType))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success);
    const failed = results.filter(r => r.status === 'rejected' || !r.value?.success);

    return {
      success: failed.length === 0,
      successful: successful.length,
      failed: failed.length,
      results
    };

  } catch (error) {
    console.error('Error deleting multiple files from Cloudinary:', error);
    throw error;
  }
}
