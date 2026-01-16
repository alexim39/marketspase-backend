import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Generate and upload a video thumbnail to the /thumbnails folder
 * @param {string} videoPublicId - e.g. 'campaigns/1762019990848-462226685'
 * @returns {Promise<string>} - URL of generated thumbnail
 */


// services/thumbnail-generator.service.js
// Build a thumbnail delivery URL for a Cloudinary video without blocking on Admin API calls.
// The first client request to this URL will cause Cloudinary to generate & cache the image.

function stripExtension(id = "") {
  return id.replace(/\.[^/.]+$/, ""); // remove trailing .mp4, .mov, etc.
}

/**
 * Build a Cloudinary delivery URL for a video frame thumbnail.
 * @param {string} videoPublicId - e.g., 'campaigns/1762019990848-462226685' (with or without extension)
 * @param {object} opts - optional overrides
 * @returns {string} - HTTPS URL that delivers a JPG thumbnail derived from the video at 1s
 */
export function buildVideoThumbnailUrl(videoPublicId, opts = {}) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) {
    throw new Error("CLOUDINARY_CLOUD_NAME is not set");
  }

  const id = stripExtension(videoPublicId || "");
  if (!id) {
    // return a static placeholder if id is empty
    return "/static/placeholders/video-thumb.png";
  }

  const {
    width = 600,
    height = 400,
    crop = "fill",
    gravity = "auto",
    startOffset = "1", // frame at 1s
  } = opts;

  // Cloudinary delivery URL for video-derived image
  // Example: https://res.cloudinary.com/<cloud>/video/upload/so_1,w_600,h_400,c_fill,g_auto/<public_id>.jpg
  return `https://res.cloudinary.com/${cloud}/video/upload/so_${startOffset},w_${width},h_${height},c_${crop},g_${gravity}/${id}.jpg`;
}

/**
 * Backward-compatible name kept to avoid touching other imports.
 * Still async, but returns immediately with the computed URL.
 */
export async function GenerateVideoThumbnail(videoPublicId, opts = {}) {
  try {
    return buildVideoThumbnailUrl(videoPublicId, opts);
  } catch (err) {
    console.error("❌ Error building thumbnail URL:", err.message);
    return "/static/placeholders/video-thumb.png";
  }
}


/* export async function GenerateVideoThumbnail(videoPublicId) {
  try {
    console.log("🎬 Generating thumbnail for video:", videoPublicId);

    // Ensure proper format and folder
    const cleanId = videoPublicId.replace(/\.[^/.]+$/, "");

    // Request Cloudinary to create a derived image from the video
    const result = await cloudinary.uploader.explicit(cleanId, {
      resource_type: "video",
      type: "upload",
      eager: [
        {
          width: 600,
          height: 400,
          crop: "fill",
          gravity: "auto",
          start_offset: "1", // capture frame at 1s mark
          format: "jpg",
        },
      ],
      eager_async: false,
    });

    // Extract the derived image URL
    const derivedUrl = result.eager?.[0]?.secure_url;
    if (!derivedUrl) throw new Error("No derived thumbnail URL returned");

    // Upload derived thumbnail to /thumbnails folder
    const uploadResult = await cloudinary.uploader.upload(derivedUrl, {
      folder: "thumbnails",
      public_id: cleanId.split("/").pop(), // same base name
      resource_type: "image",
      overwrite: true,
    });

    console.log("✅ Thumbnail saved to /thumbnails:", uploadResult.secure_url);
    return uploadResult.secure_url;
  } catch (error) {
    console.error("❌ Error generating thumbnail:", error.message);

    // fallback URL
    const fallback = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/w_600,h_400,c_fill,so_1/thumbnails/${videoPublicId}.jpg`;
    console.log("⚠️ Using fallback thumbnail:", fallback);
    return fallback;
  }
}
 */