
// controllers/create-thread.controller.js
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { UserModel } from '../../user/models/user/index.js';
import { ThreadModel } from '../models/thread/index.js';

// ---------- Cloudinary config ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------- Multer (memory) ----------
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept images, videos, audio
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype.startsWith('video/') ||
    file.mimetype.startsWith('audio/')
  ) {
    return cb(null, true);
  }
  return cb(new Error('Unsupported file type'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
}).single('media');

// ---------- Helpers ----------
const promisifyMulter = (req, res) =>
  new Promise((resolve, reject) => {
    upload(req, res, (err) => (err ? reject(err) : resolve()));
  });


// Normalize tags: allow up to 10 (to match schema limit)
const normalizeTags = (tags) => {
  if (!tags) return [];
  let arr = [];
  if (Array.isArray(tags)) arr = tags;
  else if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      arr = Array.isArray(parsed) ? parsed : String(tags).split(',');
    } catch {
      arr = String(tags).split(',');
    }
  }
  // trim, dedupe, limit to 10 (aligned with schema)
  const cleaned = Array.from(
    new Set(
      arr
        .map((t) => String(t).trim())
        .filter(Boolean)
    )
  ).slice(0, 10);
  return cleaned;
};


const mediaTypeFromMime = (mime) => {
  // Map to your schema enum: ['image', 'video', 'audio']
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  // Fallback - should not happen because of fileFilter
  return 'image';
};

const uploadToCloudinary = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'threads',
        resource_type: 'auto', // image/video/raw (audio is treated as video by Cloudinary, but we map type from MIME)
        ...options,
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });

// ---------- Controller ----------
/**
 * @desc Create a new forum thread with optional media (uploaded to Cloudinary)
 */
export const createThread = async (req, res) => {

    console.log('calling new thread creation controller');
    
  let uploadedAsset = null; // { public_id, secure_url, resource_type }
  try {
    // 1) Parse the multipart/form-data (if any)
    await promisifyMulter(req, res);

    // 2) Validate inputs
    const { title, content, tags } = req.body;
    const authorId = req.userId || req.user?._id?.toString?.();

    if (!title || !content || !authorId) {
      return res.status(400).json({
        success: false,
        message: 'title and content are required',
      });
    }

    // (Optional) upfront author existence check (reduces wasted uploads in some flows)
    const authorExists = await UserModel.exists({ _id: authorId });
    if (!authorExists) {
      return res.status(404).json({
        success: false,
        message: 'Author not found',
      });
    }

    // 3) If a file is present, upload it to Cloudinary first
    if (req.file) {
      const publicId = `thread_${Date.now()}_${Math.round(Math.random() * 1e9)}`;
      uploadedAsset = await uploadToCloudinary(req.file.buffer, {
        public_id: publicId,
      });
    }

    // 4) Build the thread payload

    // for clarity we ensure media is only included when present:
    const threadData = {
    title: String(title).trim(),
    content: String(content).trim(),
    author: authorId,
    tags: normalizeTags(tags),
    ...(req.file && uploadedAsset
        ? {
            media: {
            url: uploadedAsset.secure_url,
            type: mediaTypeFromMime(req.file.mimetype),
            filename: uploadedAsset.public_id,
            originalName: req.file.originalname,
            size: req.file.size,
            },
        }
        : {}), // no media field when there is no file
    };

    // 5) Atomic DB writes (transaction)
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Create thread
      const [savedThread] = await ThreadModel.create([threadData], {
        session,
      });

      // Record user forum activity (use $addToSet to avoid duplicates)
      await UserModel.updateOne(
        { _id: authorId },
        { $addToSet: { 'forumActivity.threads': savedThread._id } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      // Populate author details for response
      const populated = await ThreadModel.findById(savedThread._id)
        .populate('author', 'displayName username')
        .lean();

      return res.status(201).json({
        success: true,
        data: populated,
        message: 'Thread created successfully',
      });
    } catch (dbErr) {
      // Roll back DB and delete the uploaded Cloudinary asset to avoid orphans
      await session.abortTransaction();
      session.endSession();

      if (uploadedAsset?.public_id) {
        try {
          // resource_type: try to mirror the upload type; default to 'image'
          const rt =
            uploadedAsset.resource_type === 'video' ? 'video' :
            uploadedAsset.resource_type === 'raw'   ? 'raw'   : 'image';
          await cloudinary.uploader.destroy(uploadedAsset.public_id, {
            resource_type: rt,
          });
        } catch (cleanupErr) {
          // Do not fail the response because cleanup failed; log instead
          console.warn('Cloudinary cleanup failed:', cleanupErr);
        }
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to create thread',
        error: process.env.NODE_ENV === 'development' ? dbErr.message : undefined,
      });
    }
  } catch (error) {
    console.error('Create Thread Error:', error);
    // multer / validation / cloudinary error (before transaction)
    return res.status(400).json({
      success: false,
      message: error?.message || 'Invalid request',
    });
  }
};
