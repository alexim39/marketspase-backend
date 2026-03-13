// utils/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export async function logoUploadToCloudinary(fileBuffer, folder) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `store-platform/${folder}`,
        resource_type: 'image',
        transformation: [
          { width: 500, height: 500, crop: 'limit' },
          { quality: 'auto:good' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    // Use file buffer instead of file path
    uploadStream.end(fileBuffer);
  });
}



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
 * Deletes multiple files from Cloudinary
 * @param {Array<string>} fileUrls - Array of Cloudinary URLs to delete
 * @param {string} resourceType - The type of resource ('image', 'video', or 'raw')
 * @returns {Promise<Object>} - Result object with success status and counts
 */
export async function deleteMultipleFromCloudinary(fileUrls, resourceType = 'image') {
  try {
    if (!fileUrls || !Array.isArray(fileUrls) || fileUrls.length === 0) {
      console.log('No files to delete from Cloudinary');
      return { 
        success: true, 
        message: 'No files to delete',
        successful: 0,
        failed: 0,
        results: [] 
      };
    }

    console.log(`Attempting to delete ${fileUrls.length} files from Cloudinary (type: ${resourceType})`);

    // Process all deletions in parallel with Promise.allSettled
    const results = await Promise.allSettled(
      fileUrls.map(url => deleteFromCloudinary(url, resourceType))
    );

    // Analyze results
    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success === true);
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success));

    // Collect failed URLs for logging
    const failedUrls = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value?.success)) {
        failedUrls.push(fileUrls[index]);
      }
    });

    if (failedUrls.length > 0) {
      console.warn('Failed to delete these files from Cloudinary:', failedUrls);
    }

    console.log(`Cloudinary bulk delete complete: ${successful.length} successful, ${failed.length} failed`);

    return {
      success: failed.length === 0,
      successful: successful.length,
      failed: failed.length,
      failedUrls: failedUrls,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
    };

  } catch (error) {
    console.error('Error in deleteMultipleFromCloudinary:', error);
    throw error;
  }
}


/**
 * Deletes a file from Cloudinary using its URL or public ID
 * @param {string} fileUrlOrPublicId - The Cloudinary URL or public ID of the file to delete
 * @param {string} resourceType - The type of resource ('image', 'video', or 'raw')
 * @returns {Promise<Object>} - Result object with success status
 */
export async function deleteFromCloudinary(fileUrlOrPublicId, resourceType = 'image') {
  try {
    if (!fileUrlOrPublicId) {
      console.log('No file URL or public ID provided for deletion');      return { 
        success: false, 
        message: 'No file URL or public ID provided',
        result: null 
      };
    }

    console.log(`Attempting to delete from Cloudinary: ${fileUrlOrPublicId} (type: ${resourceType})`);

    // Extract public ID from URL if a full URL is provided
    let publicId = fileUrlOrPublicId;
    let detectedResourceType = resourceType;
    
    // Check if it's a URL (contains cloudinary.com)
    if (fileUrlOrPublicId.includes('cloudinary.com')) {
      // Extract public ID from Cloudinary URL
      // Format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.ext
      const urlParts = fileUrlOrPublicId.split('/');
      
      // Find the upload part and version
      const uploadIndex = urlParts.findIndex(part => part === 'upload');
      
      if (uploadIndex !== -1 && uploadIndex + 1 < urlParts.length) {
        // Get everything after 'upload' (may include version)
        const afterUpload = urlParts.slice(uploadIndex + 1);
        
        // Skip version part if it exists (starts with v)
        if (afterUpload[0] && afterUpload[0].startsWith('v')) {
          afterUpload.shift();
        }
        
        // Join remaining parts and remove file extension
        publicId = afterUpload.join('/').replace(/\.[^/.]+$/, '');
      } else {
        // Fallback: get last part and remove extension
        const fileName = urlParts[urlParts.length - 1];
        publicId = fileName.replace(/\.[^/.]+$/, '');
      }

      // Determine resource type based on URL
      if (fileUrlOrPublicId.includes('/video/')) {
        detectedResourceType = 'video';
      } else if (fileUrlOrPublicId.includes('/raw/')) {
        detectedResourceType = 'raw';
      }
    }

    console.log(`Extracted public ID: ${publicId} (type: ${detectedResourceType})`);

    // Delete the file from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: detectedResourceType,
      invalidate: true // Invalidate CDN cache
    });

    console.log('Cloudinary deletion result:', result);

    // Check if deletion was successful
    if (result.result === 'ok') {
      return { 
        success: true, 
        message: 'File deleted successfully',
        result: result 
      };
    } else if (result.result === 'not found') {
      console.warn('File not found in Cloudinary:', publicId);
      return { 
        success: true, 
        message: 'File not found (already deleted)',
        result: result 
      };
    } else {
      console.warn('Cloudinary deletion returned unexpected result:', result);
      return { 
        success: false, 
        message: `Deletion failed: ${result.result}`,
        result: result 
      };
    }

  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return {
      success: false,
      message: error.message || 'Unknown error occurred',
      error: error
    };
  }
}