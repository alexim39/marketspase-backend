import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { evaluateUserBadges } from '../../badges/service/badge.service.js';
import { awardGamificationProgress } from '../../gamification/service/gamification.service.js';
import { UserModel } from '../../user/models/user/index.js';
import { ThreadModel } from '../models/thread/index.js';
import {
  normalizePollPayload,
  normalizeStringList,
  notifyForumFollowers,
  shapeForumThread,
} from '../services/forum-social.service.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype.startsWith('video/') ||
    file.mimetype.startsWith('audio/')
  ) {
    cb(null, true);
    return;
  }

  cb(new Error('Unsupported file type'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 6,
  },
}).fields([
  { name: 'media', maxCount: 6 },
  { name: 'mediaItems', maxCount: 6 },
]);

const promisifyMulter = (req, res) => new Promise((resolve, reject) => {
  upload(req, res, (error) => (error ? reject(error) : resolve()));
});

const mediaTypeFromMime = (mime) => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'image';
};

const uploadToCloudinary = (buffer, options = {}) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    {
      folder: 'threads',
      resource_type: 'auto',
      ...options,
    },
    (error, result) => (error ? reject(error) : resolve(result)),
  );
  stream.end(buffer);
});

const cleanupCloudinaryAsset = async (asset) => {
  if (!asset?.public_id) return;

  const resourceType = asset.resource_type === 'video'
    ? 'video'
    : asset.resource_type === 'raw'
      ? 'raw'
      : 'image';

  try {
    await cloudinary.uploader.destroy(asset.public_id, { resource_type: resourceType });
  } catch (error) {
    console.warn('Cloudinary cleanup failed:', error.message);
  }
};

const getUploadedFiles = (req) => ([
  ...(req.files?.media || []),
  ...(req.files?.mediaItems || []),
].slice(0, 6));

const createThreadDocument = async (threadPayload, authorId, session = null) => {
  const createOptions = session ? { session } : undefined;
  const updateOptions = session ? { session } : undefined;

  const [thread] = await ThreadModel.create([threadPayload], createOptions);

  await UserModel.updateOne(
    { _id: authorId },
    {
      $addToSet: {
        'forumActivity.threads': thread._id,
        'forumActivity.followedThreads': thread._id,
      },
    },
    updateOptions,
  );

  return thread;
};

const isTransactionSupportError = (error) => {
  const messageParts = [
    error?.message,
    error?.errorResponse?.errmsg,
    error?.cause?.message,
  ].filter(Boolean);

  const message = messageParts.join(' ').toLowerCase();

  return [
    'transaction numbers are only allowed on a replica set member or mongos',
    'replica set',
    'transactions are not supported',
    'transaction is not supported',
    'this mongodb deployment does not support retryable writes',
  ].some((fragment) => message.includes(fragment));
};

const createThreadWithFallback = async (threadPayload, authorId) => {
  let session = null;

  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const thread = await createThreadDocument(threadPayload, authorId, session);
    await session.commitTransaction();

    return thread;
  } catch (error) {
    if (session?.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.warn('Failed to abort forum thread transaction:', abortError.message);
      }
    }

    if (!isTransactionSupportError(error)) {
      throw error;
    }

    console.warn('Forum thread creation falling back to non-transactional write:', error.message);
    return createThreadDocument(threadPayload, authorId);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

const classifyThreadCreationError = (error) => {
  if (error?.code === 11000) {
    const duplicatedField = Object.keys(error.keyPattern || error.keyValue || {})[0];
    if (duplicatedField === 'slug') {
      return {
        status: 409,
        message: 'A discussion with a very similar title already exists. Please tweak the title and try again.',
      };
    }

    return {
      status: 409,
      message: 'A discussion with the same details already exists.',
    };
  }

  if (error?.name === 'ValidationError') {
    const firstValidationMessage = Object.values(error.errors || {})[0]?.message;
    return {
      status: 400,
      message: firstValidationMessage || 'The discussion details are invalid.',
    };
  }

  return {
    status: 500,
    message: 'Failed to create thread',
  };
};

export const createThread = async (req, res) => {
  let uploadedAssets = [];

  try {
    await promisifyMulter(req, res);

    const authorId = req.userId || req.user?._id?.toString?.();
    const { title, content } = req.body;

    if (!authorId || !title || !content) {
      return res.status(400).json({
        success: false,
        message: 'title and content are required',
      });
    }

    const author = await UserModel.findById(authorId)
      .select('displayName username role avatar')
      .lean();

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Author not found',
      });
    }

    const tags = normalizeStringList(req.body.tags, { limit: 10, maxLength: 30 });
    const topicTags = normalizeStringList(req.body.topicTags || req.body.topics, { limit: 8, maxLength: 32 });
    const category = typeof req.body.category === 'string' && req.body.category.trim()
      ? req.body.category.trim().toLowerCase()
      : 'discussion';
    const poll = normalizePollPayload(req.body.poll);
    const source = String(req.body.source || 'web').trim() || 'web';
    const files = getUploadedFiles(req);

    const uploadedMediaItems = [];
    if (files.length) {
      uploadedAssets = await Promise.all(files.map((file, index) => (
        uploadToCloudinary(file.buffer, {
          public_id: `thread_${Date.now()}_${index}_${Math.round(Math.random() * 1e9)}`,
        })
      )));

      uploadedMediaItems.push(...uploadedAssets.map((asset, index) => ({
        url: asset.secure_url,
        type: mediaTypeFromMime(files[index].mimetype),
        filename: asset.public_id,
        originalName: files[index].originalname,
        size: files[index].size,
        thumbnail: asset.secure_url,
        duration: asset.duration || null,
        mimeType: files[index].mimetype,
      })));
    }

    const threadPayload = {
      title: String(title).trim(),
      content: String(content).trim(),
      author: authorId,
      tags,
      topicTags,
      category,
      poll,
      mediaItems: uploadedMediaItems,
      media: uploadedMediaItems[0] || null,
      followers: [new mongoose.Types.ObjectId(authorId)],
      followerCount: 1,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || '',
        source,
      },
    };

    try {
      const thread = await createThreadWithFallback(threadPayload, authorId);

      const populatedThread = await ThreadModel.findById(thread._id)
        .populate('author', 'displayName username avatar role badgeProfile gamificationProfile')
        .lean();

      await awardGamificationProgress({
        userId: authorId,
        actionKey: 'forum_thread_created',
        sourceKey: `forum-thread:${thread._id}`,
        sourceType: 'forum_thread',
        sourceId: thread._id?.toString?.() || null,
        metadata: {
          threadId: thread._id?.toString?.() || null,
          category,
          mediaCount: uploadedMediaItems.length,
          hasPoll: Boolean(poll?.question),
        },
      }).catch((error) => {
        console.error('Gamification award for forum thread creation failed:', error);
      });

      await evaluateUserBadges(authorId, {
        trigger: 'forum_thread_created',
      }).catch((error) => {
        console.error('Badge evaluation after forum thread creation failed:', error);
      });

      await notifyForumFollowers({
        thread: populatedThread,
        actorId: authorId,
        actorDisplayName: author.displayName || author.username || 'A community member',
        eventType: 'new_thread',
      }).catch((error) => {
        console.error('Failed to notify topic followers about new thread:', error);
      });

      return res.status(201).json({
        success: true,
        data: shapeForumThread(populatedThread, authorId),
        message: 'Thread created successfully',
      });
    } catch (dbError) {
      await Promise.allSettled(uploadedAssets.map(cleanupCloudinaryAsset));
      const classifiedError = classifyThreadCreationError(dbError);

      return res.status(classifiedError.status).json({
        success: false,
        message: classifiedError.message,
        error: process.env.NODE_ENV === 'development' ? dbError.message : undefined,
      });
    }
  } catch (error) {
    console.error('Create Thread Error:', error);
    await Promise.allSettled(uploadedAssets.map(cleanupCloudinaryAsset));

    return res.status(400).json({
      success: false,
      message: error?.message || 'Invalid request',
    });
  }
};
