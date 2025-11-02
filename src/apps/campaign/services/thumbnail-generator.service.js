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
export async function GenerateVideoThumbnail(videoPublicId) {
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
