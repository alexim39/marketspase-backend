import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});


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