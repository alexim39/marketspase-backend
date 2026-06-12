import { FeedPostModel } from '../models/feed/index.js';
import { UserModel } from '../../user/models/user/index.js';
import { CampaignModel } from '../../campaign/models/index.js';
import { ProductModel } from '../../store/models/promotion/index.js';
import { StoreModel } from '../../store/models/store/index.js';
import { uploadToCloudinary } from '../../campaign/utils/cloudinary.js';
import { buildVideoThumbnailUrl } from '../../campaign/services/thumbnail-generator.service.js';
import { evaluateUserBadges } from '../../badges/service/badge.service.js';
import { awardGamificationProgress } from '../../gamification/service/gamification.service.js';
import { mergeHashtags, normalizeHashtagInput } from '../models/feed/feed.utils.js';
import { getAuthorPopulation, shapeFeedPost } from '../services/feed-discovery.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const parseMaybeJson = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const buildUploadedMedia = async (files = [], userId) => {
  if (!Array.isArray(files) || files.length === 0) return [];

  const uploaded = await Promise.all(files.map(async (file, index) => {
    const result = await uploadToCloudinary(file.path, `feeds/${userId}`);
    const type = file.mimetype?.startsWith('video/')
      ? 'video'
      : file.mimetype?.startsWith('image/')
        ? 'image'
        : 'document';

    return {
      url: result.secure_url,
      type,
      thumbnail: type === 'video'
        ? buildVideoThumbnailUrl(result.public_id)
        : undefined,
      altText: file.originalname,
      order: index
    };
  }));

  return uploaded;
};

const buildChallengePayload = (input = {}, hashtags = []) => {
  const tag = input?.tag?.toString?.().trim?.().replace(/^#/, '').toLowerCase?.();
  if (!tag) return null;

  const derivedTitle = input.title || `#${tag} challenge`;

  return {
    tag,
    title: derivedTitle,
    description: input.description || '',
    rewardLabel: input.rewardLabel || '',
    startsAt: input.startsAt || undefined,
    endsAt: input.endsAt || undefined,
    isOfficial: Boolean(input.isOfficial)
  };
};

const buildCampaignSnapshot = (campaign) => ({
  campaignId: campaign._id,
  name: campaign.title,
  budget: campaign.budget,
  spentBudget: campaign.spentBudget || 0,
  status: campaign.status,
  progress: campaign.progress || 0,
  category: campaign.category || '',
  link: campaign.link || '',
  mediaUrl: campaign.mediaUrl || '',
  mediaType: campaign.mediaType || 'image',
  thumbnailUrl: campaign.thumbnailUrl || ''
});

const buildProductSnapshot = (product, store) => ({
  productId: product._id,
  storeId: store?._id || product.store,
  storeName: store?.name || '',
  storeLink: store?.storeLink || '',
  name: product.name,
  description: product.description || '',
  category: product.category || '',
  price: product.price,
  originalPrice: product.originalPrice || 0,
  currency: product.currency || 'NGN',
  commissionType: product.affiliate?.commissionType || 'percentage',
  commissionRate: product.affiliate?.commissionRate || 0,
  fixedCommission: product.affiliate?.fixedCommission || 0,
  productUrl: product._id ? `/product/${product._id}` : '',
  mainImage: product.images?.find?.((image) => image.isMain)?.url || product.images?.[0]?.url || ''
});

const sameId = (left, right) => {
  if (!left || !right) return false;
  return left.toString() === right.toString();
};

const canManageProductPost = ({ user, userId, store, product }) => {
  if (user.role === 'admin') {
    return true;
  }

  const ownershipCandidates = [
    store?.owner,
    product?.createdBy,
    product?.updatedBy,
    product?.publishedBy,
    product?.meta?.createdBy,
    product?.meta?.updatedBy
  ];

  return ownershipCandidates.some((candidate) => sameId(candidate, userId));
};

export const createFeedPost = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const user = await UserModel.findById(userId).select('username displayName avatar role rating badge activitySettings');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!['marketer', 'admin'].includes(user.role)) {
    throw new ApiError(403, 'Only marketers can create posts in the social feed');
  }

  const content = req.body.content?.toString?.().trim?.() || '';
  const source = (req.body.source || 'manual').toString().trim().toLowerCase();
  const requestedType = (req.body.type || '').toString().trim().toLowerCase();
  const campaignId = req.body.campaignId?.toString?.().trim?.() || '';
  const productId = req.body.productId?.toString?.().trim?.() || '';
  const settings = parseMaybeJson(req.body.settings, {});
  const challengeInput = parseMaybeJson(req.body.challenge, {});
  const hashtagsInput = parseMaybeJson(req.body.hashtags, []);

  if (!content && !(req.files?.length)) {
    throw new ApiError(400, 'Post content or media is required');
  }

  const uploadedMedia = await buildUploadedMedia(req.files || [], userId);

  let type = requestedType || 'story';
  let campaign = null;
  let product = null;
  let store = null;
  let campaignSnapshot = null;
  let productSnapshot = null;
  let media = [...uploadedMedia];

  if (campaignId) {
    campaign = await CampaignModel.findById(campaignId);
    if (!campaign) {
      throw new ApiError(404, 'Campaign not found');
    }

    if (campaign.owner.toString() !== userId.toString() && user.role !== 'admin') {
      throw new ApiError(403, 'You can only create campaign posts from your own campaigns');
    }

    campaignSnapshot = buildCampaignSnapshot(campaign);
    type = requestedType || 'campaign';

    if (!media.length && campaign.mediaUrl) {
      media.push({
        url: campaign.mediaUrl,
        type: campaign.mediaType || 'image',
        thumbnail: campaign.thumbnailUrl || undefined,
        altText: campaign.title,
        order: 0
      });
    }
  }

  if (productId) {
    product = await ProductModel.findById(productId);
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    store = await StoreModel.findById(product.store).select('owner name storeLink');
    if (!store) {
      throw new ApiError(404, 'Store not found for selected product');
    }

    if (!canManageProductPost({ user, userId, store, product })) {
      throw new ApiError(403, 'You can only create product posts from your own storefront products');
    }

    productSnapshot = buildProductSnapshot(product, store);
    type = requestedType || 'product';

    if (!media.length) {
      media = (product.images || []).slice(0, 6).map((image, index) => ({
        url: image.url,
        type: 'image',
        thumbnail: image.url,
        altText: image.altText || product.name,
        order: index
      }));
    }
  }

  if (source === 'campaign' && !campaignSnapshot) {
    throw new ApiError(400, 'Select a valid campaign to create this post');
  }

  if (source === 'product' && !productSnapshot) {
    throw new ApiError(400, 'Select a valid product to create this post');
  }

  const challenge = buildChallengePayload(challengeInput, hashtagsInput);
  const hashtags = mergeHashtags(
    normalizeHashtagInput(hashtagsInput),
    challenge?.tag ? [{ tag: challenge.tag }] : [],
    product?.tags || [],
    campaign?.tags || []
  );

  const post = await FeedPostModel.create({
    author: userId,
    content,
    source,
    type,
    campaign: campaignSnapshot,
    product: productSnapshot,
    media,
    challenge,
    hashtags,
    settings: {
      postAnonymously: Boolean(settings?.postAnonymously),
      disableComments: Boolean(settings?.disableComments),
      allowExternalShare: settings?.allowExternalShare !== false
    },
    recommendation: {
      primaryCategory: productSnapshot?.category || campaignSnapshot?.category || type,
      topicalTags: [...new Set([
        ...hashtags.map((entry) => entry.tag),
        productSnapshot?.category,
        campaignSnapshot?.category,
        type
      ].filter(Boolean).map((value) => value.toString().toLowerCase()))]
    }
  });

  if (typeof user.logActivity === 'function') {
    await user.logActivity('community_post', `Created a ${type} social post`, {
      resourceId: post._id,
      metadata: {
        type,
        campaignId: campaign?._id || null,
        productId: product?._id || null
      }
    }).catch(() => null);
  }

  await awardGamificationProgress({
    userId,
    actionKey: 'community_post_published',
    sourceKey: `feed_post:${post._id}:created`,
    sourceType: 'feed_post',
    sourceId: post._id,
    metadata: {
      postId: post._id?.toString?.() || null,
      campaignId: campaign?._id?.toString?.() || null,
      productId: product?._id?.toString?.() || null,
      hashtagCount: hashtags.length,
      mediaCount: media.length
    }
  }).catch((gamificationError) => {
    console.error('Gamification update after social post creation failed:', gamificationError);
  });

  await evaluateUserBadges(userId, {
    force: true,
    trigger: 'community_post_created'
  }).catch((badgeError) => {
    console.error('Badge evaluation after community post creation failed:', badgeError);
  });

  const createdPost = await FeedPostModel.findById(post._id)
    .populate(getAuthorPopulation())
    .lean();

  const responsePost = settings?.postAnonymously
    ? { ...shapeFeedPost(createdPost, userId), author: null }
    : shapeFeedPost(createdPost, userId);

  return res.status(201).json(
    new ApiResponse(201, responsePost, 'Social post created successfully')
  );
});
