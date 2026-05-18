import mongoose from 'mongoose';
import { SearchDocumentModel } from '../models/index.js';
import {
  buildSearchPrefixes,
  buildSearchTerms,
  cleanObject,
  escapeRegex,
  firstNonEmpty,
  normalizeSearchText,
  splitSearchTokens,
  uniqueStrings,
} from './search.utils.js';

export const SEARCH_ENTITY_TYPES = ['user', 'campaign', 'promotion', 'product', 'store'];

const pendingEntitySyncs = new Set();
let bootstrapPromise = null;

const toObjectId = (value) => (
  mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null
);

const toPlainId = (value) => (value ? `${value}` : '');

const toRegion = (region = {}) => {
  const country = String(region?.country || '').trim();
  const state = String(region?.state || '').trim();
  const city = String(region?.city || '').trim();
  const label = [city, state, country].filter(Boolean).join(', ');

  return {
    country,
    state,
    city,
    label,
  };
};

const getPrimaryImage = (images = []) => {
  if (!Array.isArray(images) || images.length === 0) {
    return '';
  }

  return images.find((image) => image?.isMain)?.url || images[0]?.url || '';
};

const deriveProductStatus = (product) => {
  if (!product || product.isDeleted) return 'deleted';
  if (product.isPublished && product.isActive) return 'published';
  if (product.isPublished && !product.isActive) return 'inactive';
  return 'draft';
};

const deriveStoreStatus = (store) => {
  if (!store || store.isDeleted) return 'deleted';
  if (store.isActive) return 'active';
  return 'inactive';
};

const deriveCampaignRegion = (campaign = {}, owner = {}, store = {}) => {
  const ownerAddress = owner?.personalInfo?.address || {};
  const storeAddress = store?.address || {};
  const firstTargetLocation = Array.isArray(campaign.targetLocations) ? campaign.targetLocations[0] : null;

  return toRegion({
    city: firstNonEmpty(firstTargetLocation?.name, storeAddress.city, ownerAddress.city),
    state: firstNonEmpty(storeAddress.state, ownerAddress.state),
    country: firstNonEmpty(storeAddress.country, ownerAddress.country),
  });
};

const buildBaseDocument = ({
  entityType,
  entityId,
  title,
  subtitle = '',
  description = '',
  keywords = [],
  region = {},
  status = '',
  userType = '',
  ownerId = null,
  relatedOwnerId = null,
  storeId = null,
  relatedCampaignId = null,
  primaryImage = '',
  visibility = 'public',
  isActive = true,
  isDeleted = false,
  metadata = {},
}) => {
  const normalizedTitle = normalizeSearchText(title);
  const normalizedSubtitle = normalizeSearchText(subtitle);
  const normalizedDescription = normalizeSearchText(description);
  const normalizedKeywords = uniqueStrings(keywords).map((keyword) => normalizeSearchText(keyword)).filter(Boolean);
  const searchTerms = buildSearchTerms([
    normalizedTitle,
    normalizedSubtitle,
    normalizedDescription,
    ...normalizedKeywords,
  ]);

  return {
    entityType,
    entityId,
    title: String(title || '').trim(),
    subtitle: String(subtitle || '').trim(),
    description: String(description || '').trim(),
    normalizedTitle,
    normalizedSubtitle,
    normalizedDescription,
    keywords: normalizedKeywords,
    searchTerms,
    searchPrefixes: buildSearchPrefixes(searchTerms),
    region: toRegion(region),
    status: String(status || '').trim().toLowerCase(),
    userType: String(userType || '').trim().toLowerCase(),
    ownerId: toObjectId(ownerId),
    relatedOwnerId: toObjectId(relatedOwnerId),
    storeId: toObjectId(storeId),
    relatedCampaignId: toObjectId(relatedCampaignId),
    primaryImage: String(primaryImage || '').trim(),
    visibility,
    isActive: Boolean(isActive),
    isDeleted: Boolean(isDeleted),
    metadata: cleanObject(metadata),
  };
};

const buildUserDocument = (user) => {
  if (!user || user.type === 'admin') {
    return null;
  }

  const address = user?.personalInfo?.address || {};
  return buildBaseDocument({
    entityType: 'user',
    entityId: user._id,
    title: user.displayName || user.username || 'MarketSpase User',
    subtitle: `@${user.username || 'user'} • ${user.role || 'member'}`,
    description: user?.personalInfo?.biography || '',
    keywords: [
      user.username,
      user.email,
      user.role,
      user.displayName,
      address.city,
      address.state,
      address.country,
    ],
    region: address,
    status: user.isActive === false ? 'inactive' : 'active',
    userType: user.role || 'user',
    ownerId: user._id,
    visibility: 'public',
    isActive: user.isActive !== false,
    isDeleted: user.isDeleted === true,
    primaryImage: user.avatar || '',
    metadata: {
      username: user.username,
      email: user.email,
      isVerified: Boolean(user.isVerified),
      rating: Number(user.rating || 0),
      ratingCount: Number(user.ratingCount || 0),
    },
  });
};

const buildCampaignDocument = (campaign) => {
  if (!campaign) {
    return null;
  }

  const owner = campaign.owner || {};
  const store = campaign.store || {};

  return buildBaseDocument({
    entityType: 'campaign',
    entityId: campaign._id,
    title: campaign.title || 'Campaign',
    subtitle: `${campaign.category || 'campaign'} • ${campaign.status || 'pending'}`,
    description: campaign.caption || '',
    keywords: [
      campaign.title,
      campaign.category,
      campaign.status,
      campaign.campaignGoal,
      campaign.mediaType,
      campaign.priority,
      ...(campaign.tags || []),
      owner.displayName,
      owner.username,
      store.name,
    ],
    region: deriveCampaignRegion(campaign, owner, store),
    status: campaign.status || 'pending',
    userType: owner.role || 'marketer',
    ownerId: owner._id || campaign.owner,
    storeId: store._id || campaign.store,
    relatedCampaignId: campaign._id,
    visibility: 'restricted',
    isActive: String(campaign.status || '').toLowerCase() === 'active',
    isDeleted: Boolean(campaign.isDeleted),
    primaryImage: campaign.thumbnailUrl || campaign.mediaUrl || store.logo || owner.avatar || '',
    metadata: {
      category: campaign.category,
      ownerName: owner.displayName || owner.username,
      ownerUsername: owner.username,
      currency: campaign.currency || 'NGN',
      budget: Number(campaign.budget || 0),
      spentBudget: Number(campaign.spentBudget || 0),
      costPerClick: Number(campaign.costPerClick || 0),
      totalClicks: Number(campaign.totalClicks || 0),
      billableClicks: Number(campaign.billableClicks || 0),
      storeName: store.name,
      storeLink: store.storeLink,
    },
  });
};

const buildPromotionDocument = (promotion) => {
  if (!promotion || !promotion.campaign) {
    return null;
  }

  const campaign = promotion.campaign || {};
  const promoter = promotion.promoter || {};
  const campaignOwner = campaign.owner || {};
  const store = campaign.store || {};

  return buildBaseDocument({
    entityType: 'promotion',
    entityId: promotion._id,
    title: campaign.title || promotion.upi || 'Promotion',
    subtitle: `${promotion.upi || 'promotion'} • ${promoter.displayName || promoter.username || 'Promoter'}`,
    description: campaign.caption || '',
    keywords: [
      promotion.upi,
      promotion.status,
      campaign.title,
      campaign.category,
      promoter.displayName,
      promoter.username,
      campaignOwner.displayName,
      campaignOwner.username,
    ],
    region: deriveCampaignRegion(campaign, promoter, store),
    status: promotion.status || 'accepted',
    userType: promoter.role || 'promoter',
    ownerId: promoter._id || promotion.promoter,
    relatedOwnerId: campaignOwner._id || campaign.owner,
    storeId: store._id || campaign.store,
    relatedCampaignId: campaign._id || promotion.campaign,
    visibility: 'restricted',
    isActive: promotion.isActive !== false,
    isDeleted: false,
    primaryImage: campaign.thumbnailUrl || campaign.mediaUrl || promoter.avatar || '',
    metadata: {
      upi: promotion.upi,
      campaignTitle: campaign.title,
      promoterName: promoter.displayName || promoter.username,
      campaignOwnerName: campaignOwner.displayName || campaignOwner.username,
      earnedAmount: Number(promotion.clickStats?.earnedAmount || 0),
      trackedClicks: Number(promotion.clickStats?.totalClicks || 0),
      billableClicks: Number(promotion.clickStats?.billableClicks || 0),
      invalidClicks: Number(promotion.clickStats?.invalidClicks || 0) + Number(promotion.clickStats?.duplicateClicks || 0),
      currency: campaign.currency || 'NGN',
      storeName: store.name,
      storeLink: store.storeLink,
    },
  });
};

const buildProductDocument = (product) => {
  if (!product || !product.store) {
    return null;
  }

  const store = product.store || {};
  const owner = store.owner || {};
  const status = deriveProductStatus(product);

  return buildBaseDocument({
    entityType: 'product',
    entityId: product._id,
    title: product.name || 'Product',
    subtitle: `${store.name || 'Store'} • ${product.category || 'product'}`,
    description: product.description || '',
    keywords: [
      product.name,
      product.category,
      product.brand,
      product.sku,
      ...(product.tags || []),
      ...(product.seo?.keywords || []),
      store.name,
      store.storeLink,
      owner.displayName,
      owner.username,
    ],
    region: store.address || owner?.personalInfo?.address || {},
    status,
    userType: owner.role || 'marketer',
    ownerId: owner._id || store.owner,
    storeId: store._id || product.store,
    visibility: product.isPublished && product.isActive ? 'public' : 'restricted',
    isActive: Boolean(product.isActive && product.isPublished && !product.isDeleted),
    isDeleted: Boolean(product.isDeleted),
    primaryImage: getPrimaryImage(product.images),
    metadata: {
      category: product.category,
      brand: product.brand,
      price: Number(product.price || 0),
      originalPrice: Number(product.originalPrice || 0),
      currency: product.currency || store.settings?.currency || 'NGN',
      storeName: store.name,
      storeLink: store.storeLink,
      ownerName: owner.displayName || owner.username,
      affiliateEnabled: Boolean(product.affiliate?.enabled),
      rating: Number(product.averageRating || 0),
      ratingCount: Number(product.ratingCount || 0),
    },
  });
};

const buildStoreDocument = (store) => {
  if (!store) {
    return null;
  }

  const owner = store.owner || {};
  const status = deriveStoreStatus(store);

  return buildBaseDocument({
    entityType: 'store',
    entityId: store._id,
    title: store.name || 'Store',
    subtitle: `${store.category || 'store'} • ${store.storeLink || 'marketspase.com'}`,
    description: store.description || '',
    keywords: [
      store.name,
      store.category,
      store.storeLink,
      store.whatsappNumber,
      owner.displayName,
      owner.username,
    ],
    region: store.address || owner?.personalInfo?.address || {},
    status,
    userType: owner.role || 'marketer',
    ownerId: owner._id || store.owner,
    storeId: store._id,
    visibility: store.isActive && !store.isDeleted ? 'public' : 'restricted',
    isActive: Boolean(store.isActive && !store.isDeleted),
    isDeleted: Boolean(store.isDeleted),
    primaryImage: store.logo || owner.avatar || '',
    metadata: {
      category: store.category,
      storeLink: store.storeLink,
      ownerName: owner.displayName || owner.username,
      isVerified: Boolean(store.isVerified),
      totalViews: Number(store.analytics?.totalViews || 0),
      totalSales: Number(store.analytics?.totalSales || 0),
    },
  });
};

const fetchEntityForSearch = async (entityType, entityId) => {
  const objectId = toObjectId(entityId);
  if (!objectId) {
    return null;
  }

  switch (entityType) {
    case 'user':
      return mongoose.model('User').findById(objectId)
        .select([
          'displayName',
          'username',
          'email',
          'avatar',
          'role',
          'type',
          'isActive',
          'isDeleted',
          'isVerified',
          'rating',
          'ratingCount',
          'personalInfo.address',
          'personalInfo.biography',
        ].join(' '))
        .lean();

    case 'campaign':
      return mongoose.model('Campaign').findById(objectId)
        .select([
          'owner',
          'title',
          'caption',
          'category',
          'status',
          'campaignGoal',
          'mediaType',
          'priority',
          'tags',
          'currency',
          'budget',
          'spentBudget',
          'costPerClick',
          'totalClicks',
          'billableClicks',
          'targetLocations',
          'thumbnailUrl',
          'mediaUrl',
          'store',
          'isDeleted',
        ].join(' '))
        .populate([
          {
            path: 'owner',
            select: 'displayName username avatar role personalInfo.address isVerified',
          },
          {
            path: 'store',
            select: 'name storeLink logo address owner isActive isDeleted',
          },
        ])
        .lean();

    case 'promotion':
      return mongoose.model('Promotion').findById(objectId)
        .select([
          'campaign',
          'promoter',
          'status',
          'upi',
          'promotionUrl',
          'isActive',
          'clickStats',
          'createdAt',
          'updatedAt',
        ].join(' '))
        .populate([
          {
            path: 'promoter',
            select: 'displayName username avatar role personalInfo.address isVerified',
          },
          {
            path: 'campaign',
            select: 'title caption category status currency costPerClick owner thumbnailUrl mediaUrl store targetLocations',
            populate: [
              {
                path: 'owner',
                select: 'displayName username avatar role personalInfo.address isVerified',
              },
              {
                path: 'store',
                select: 'name storeLink logo address owner isActive isDeleted',
              },
            ],
          },
        ])
        .lean();

    case 'product':
      return mongoose.model('Product').findById(objectId)
        .select([
          'store',
          'name',
          'description',
          'category',
          'brand',
          'tags',
          'seo.keywords',
          'sku',
          'price',
          'originalPrice',
          'currency',
          'affiliate.enabled',
          'averageRating',
          'ratingCount',
          'images',
          'isActive',
          'isPublished',
          'isDeleted',
        ].join(' '))
        .populate({
          path: 'store',
          select: 'name storeLink owner logo address settings.currency isActive isDeleted',
          populate: {
            path: 'owner',
            select: 'displayName username avatar role personalInfo.address isVerified',
          },
        })
        .lean();

    case 'store':
      return mongoose.model('Store').findById(objectId)
        .select([
          'owner',
          'name',
          'description',
          'logo',
          'category',
          'isVerified',
          'storeLink',
          'analytics',
          'whatsappNumber',
          'address',
          'isDeleted',
          'isActive',
        ].join(' '))
        .populate({
          path: 'owner',
          select: 'displayName username avatar role personalInfo.address isVerified',
        })
        .lean();

    default:
      return null;
  }
};

const buildDocumentFromEntity = (entityType, entity) => {
  switch (entityType) {
    case 'user':
      return buildUserDocument(entity);
    case 'campaign':
      return buildCampaignDocument(entity);
    case 'promotion':
      return buildPromotionDocument(entity);
    case 'product':
      return buildProductDocument(entity);
    case 'store':
      return buildStoreDocument(entity);
    default:
      return null;
  }
};

const upsertSearchDocument = async (document) => SearchDocumentModel.findOneAndUpdate(
  {
    entityType: document.entityType,
    entityId: document.entityId,
  },
  {
    $set: document,
  },
  {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  }
);

const buildVisibilityClauses = (viewer = {}) => {
  const userId = toObjectId(viewer?._id);
  const isAdmin = viewer?.type === 'admin' || viewer?.role === 'admin' || viewer?.role === 'super-admin';
  const clauses = [
    {
      entityType: 'user',
      isDeleted: false,
      isActive: true,
      userType: { $in: ['marketer', 'promoter', 'marketing_rep'] },
    },
  ];

  if (isAdmin) {
    clauses.push(
      { entityType: 'campaign', isDeleted: false },
      { entityType: 'promotion' },
      { entityType: 'product', isDeleted: false },
      { entityType: 'store', isDeleted: false },
    );
    return clauses;
  }

  if (viewer?.role === 'marketer') {
    clauses.push(
      { entityType: 'campaign', isDeleted: false, ownerId: userId },
      {
        entityType: 'promotion',
        $or: [
          { relatedOwnerId: userId },
          { ownerId: userId },
        ],
      },
      {
        entityType: 'product',
        isDeleted: false,
        $or: [
          { ownerId: userId },
          { visibility: 'public', isActive: true, status: 'published' },
        ],
      },
      {
        entityType: 'store',
        isDeleted: false,
        $or: [
          { ownerId: userId },
          { visibility: 'public', isActive: true },
        ],
      },
    );
    return clauses;
  }

  if (viewer?.role === 'promoter') {
    clauses.push(
      { entityType: 'campaign', isDeleted: false, isActive: true, status: 'active' },
      { entityType: 'promotion', ownerId: userId },
      { entityType: 'product', isDeleted: false, visibility: 'public', isActive: true, status: 'published' },
      { entityType: 'store', isDeleted: false, visibility: 'public', isActive: true },
    );
    return clauses;
  }

  clauses.push(
    { entityType: 'campaign', isDeleted: false, isActive: true, status: 'active' },
    { entityType: 'product', isDeleted: false, visibility: 'public', isActive: true, status: 'published' },
    { entityType: 'store', isDeleted: false, visibility: 'public', isActive: true },
  );

  return clauses;
};

const isDocumentVisibleToViewer = (document, viewer = {}) => {
  if (!document || document.isDeleted) {
    return false;
  }

  const viewerId = toPlainId(viewer?._id);
  const ownerId = toPlainId(document.ownerId);
  const relatedOwnerId = toPlainId(document.relatedOwnerId);
  const isAdmin = viewer?.type === 'admin' || viewer?.role === 'admin' || viewer?.role === 'super-admin';

  if (document.entityType === 'user') {
    return document.isActive && ['marketer', 'promoter', 'marketing_rep'].includes(document.userType);
  }

  if (isAdmin) {
    return true;
  }

  if (viewer?.role === 'marketer') {
    switch (document.entityType) {
      case 'campaign':
        return viewerId && viewerId === ownerId;
      case 'promotion':
        return viewerId && (viewerId === ownerId || viewerId === relatedOwnerId);
      case 'product':
        return (viewerId && viewerId === ownerId) || (document.visibility === 'public' && document.isActive && document.status === 'published');
      case 'store':
        return (viewerId && viewerId === ownerId) || (document.visibility === 'public' && document.isActive);
      default:
        return false;
    }
  }

  if (viewer?.role === 'promoter') {
    switch (document.entityType) {
      case 'campaign':
        return document.isActive && document.status === 'active';
      case 'promotion':
        return viewerId && viewerId === ownerId;
      case 'product':
        return document.visibility === 'public' && document.isActive && document.status === 'published';
      case 'store':
        return document.visibility === 'public' && document.isActive;
      default:
        return false;
    }
  }

  return (
    (document.entityType === 'campaign' && document.isActive && document.status === 'active') ||
    (document.entityType === 'product' && document.visibility === 'public' && document.isActive && document.status === 'published') ||
    (document.entityType === 'store' && document.visibility === 'public' && document.isActive)
  );
};

const computeRelevanceScore = (document, normalizedQuery, queryTokens = [], prefixTokens = []) => {
  if (!normalizedQuery) {
    return 0;
  }

  const normalizedTitle = String(document.normalizedTitle || '');
  const normalizedSubtitle = String(document.normalizedSubtitle || '');
  const normalizedDescription = String(document.normalizedDescription || '');
  const searchTerms = Array.isArray(document.searchTerms) ? document.searchTerms : [];
  const searchPrefixes = Array.isArray(document.searchPrefixes) ? document.searchPrefixes : [];

  const intersectingTerms = searchTerms.filter((term) => queryTokens.includes(term)).length;
  const intersectingPrefixes = searchPrefixes.filter((prefix) => prefixTokens.includes(prefix)).length;

  return (
    (normalizedTitle === normalizedQuery ? 120 : 0) +
    (normalizedTitle.startsWith(normalizedQuery) ? 80 : 0) +
    (normalizedTitle.includes(normalizedQuery) ? 45 : 0) +
    (normalizedSubtitle.includes(normalizedQuery) ? 24 : 0) +
    (normalizedDescription.includes(normalizedQuery) ? 12 : 0) +
    (intersectingTerms * 12) +
    (intersectingPrefixes * 6) +
    (document.status === 'active' ? 5 : 0) +
    (document.isActive ? 3 : 0)
  );
};

const buildFacetSummary = (documents = []) => {
  const facetKeys = ['entityTypes', 'statuses', 'userTypes', 'regions'];
  const facets = {
    entityTypes: {},
    statuses: {},
    userTypes: {},
    regions: {},
  };

  for (const document of documents) {
    if (document.entityType) {
      facets.entityTypes[document.entityType] = Number(facets.entityTypes[document.entityType] || 0) + 1;
    }
    if (document.status) {
      facets.statuses[document.status] = Number(facets.statuses[document.status] || 0) + 1;
    }
    if (document.userType) {
      facets.userTypes[document.userType] = Number(facets.userTypes[document.userType] || 0) + 1;
    }
    const regionLabel = document.region?.label;
    if (regionLabel) {
      facets.regions[regionLabel] = Number(facets.regions[regionLabel] || 0) + 1;
    }
  }

  for (const key of facetKeys) {
    facets[key] = Object.fromEntries(
      Object.entries(facets[key]).sort(([, left], [, right]) => Number(right) - Number(left))
    );
  }

  return facets;
};

const resolveNavigationPath = (document, viewer = {}) => {
  const viewerId = toPlainId(viewer?._id);
  const ownerId = toPlainId(document.ownerId);
  const relatedOwnerId = toPlainId(document.relatedOwnerId);
  const storeId = toPlainId(document.storeId);
  const campaignId = toPlainId(document.relatedCampaignId);
  const entityId = toPlainId(document.entityId);
  const metadata = document.metadata || {};

  switch (document.entityType) {
    case 'user':
      return `/dashboard/profile/${entityId}`;
    case 'campaign':
      return `/dashboard/campaigns/${entityId}`;
    case 'promotion':
      if (viewerId && viewerId === ownerId) {
        return `/dashboard/campaigns/promotions/${entityId}`;
      }
      if (viewerId && viewerId === relatedOwnerId && campaignId) {
        return `/dashboard/campaigns/${campaignId}`;
      }
      return campaignId ? `/dashboard/campaigns/${campaignId}` : '/dashboard/campaigns/promotions';
    case 'product':
      if (viewerId && viewerId === ownerId && storeId) {
        return `/dashboard/stores/${storeId}/products/${entityId}`;
      }
      return `/dashboard/stores/product/${entityId}`;
    case 'store':
      if (viewerId && viewerId === ownerId) {
        return `/dashboard/stores/${entityId}/products`;
      }
      if (storeId) {
        return `/dashboard/stores/store/${entityId}/products`;
      }
      if (metadata.storeLink) {
        return `/store/${metadata.storeLink}`;
      }
      return '/dashboard/stores';
    default:
      return '/dashboard';
  }
};

const formatEntityLabel = (entityType) => {
  switch (entityType) {
    case 'user':
      return 'User';
    case 'campaign':
      return 'Campaign';
    case 'promotion':
      return 'Promotion';
    case 'product':
      return 'Product';
    case 'store':
      return 'Store';
    default:
      return entityType;
  }
};

const serializeResult = (document, viewer = {}) => ({
  entityType: document.entityType,
  entityLabel: formatEntityLabel(document.entityType),
  entityId: toPlainId(document.entityId),
  title: document.title,
  subtitle: document.subtitle,
  description: document.description,
  status: document.status,
  userType: document.userType,
  region: document.region || { country: '', state: '', city: '', label: '' },
  primaryImage: document.primaryImage || '',
  isActive: Boolean(document.isActive),
  relevanceScore: Number(document.relevanceScore || 0),
  navigationPath: resolveNavigationPath(document, viewer),
  metadata: document.metadata || {},
});

const buildFacetMap = (rows = []) => rows.reduce((accumulator, row) => {
  if (!row?._id) {
    return accumulator;
  }

  accumulator[row._id] = Number(row.count || 0);
  return accumulator;
}, {});

export const upsertSearchEntity = async (entityType, entityId) => {
  if (!SEARCH_ENTITY_TYPES.includes(entityType)) {
    return null;
  }

  const entity = await fetchEntityForSearch(entityType, entityId);
  if (!entity) {
    await SearchDocumentModel.deleteOne({ entityType, entityId: toObjectId(entityId) });
    return null;
  }

  const document = buildDocumentFromEntity(entityType, entity);
  if (!document) {
    await SearchDocumentModel.deleteOne({ entityType, entityId: toObjectId(entityId) });
    return null;
  }

  await upsertSearchDocument(document);
  return document;
};

export const scheduleSearchEntitySync = (entityType, entityId) => {
  if (!entityId || !SEARCH_ENTITY_TYPES.includes(entityType)) {
    return;
  }

  const key = `${entityType}:${entityId}`;
  if (pendingEntitySyncs.has(key)) {
    return;
  }

  pendingEntitySyncs.add(key);

  setImmediate(async () => {
    try {
      await upsertSearchEntity(entityType, entityId);
    } catch (error) {
      console.warn(`[global-search] Failed to sync ${key}:`, error.message);
    } finally {
      pendingEntitySyncs.delete(key);
    }
  });
};

export const removeSearchEntity = async (entityType, entityId) => {
  if (!entityId || !SEARCH_ENTITY_TYPES.includes(entityType)) {
    return;
  }

  await SearchDocumentModel.deleteOne({
    entityType,
    entityId: toObjectId(entityId),
  });
};

const buildReindexSourceQuery = (entityType) => {
  switch (entityType) {
    case 'user':
      return {
        role: { $in: ['marketer', 'promoter', 'marketing_rep'] },
        isDeleted: { $ne: true },
      };
    case 'campaign':
      return { isDeleted: { $ne: true } };
    case 'promotion':
      return {};
    case 'product':
      return { isDeleted: { $ne: true } };
    case 'store':
      return { isDeleted: { $ne: true } };
    default:
      return {};
  }
};

const getModelForEntityType = (entityType) => {
  switch (entityType) {
    case 'user':
      return mongoose.model('User');
    case 'campaign':
      return mongoose.model('Campaign');
    case 'promotion':
      return mongoose.model('Promotion');
    case 'product':
      return mongoose.model('Product');
    case 'store':
      return mongoose.model('Store');
    default:
      return null;
  }
};

const buildFallbackMatchQuery = (entityType, normalizedQuery) => {
  const regex = new RegExp(escapeRegex(normalizedQuery), 'i');

  switch (entityType) {
    case 'user':
      return {
        role: { $in: ['marketer', 'promoter', 'marketing_rep'] },
        isDeleted: { $ne: true },
        isActive: true,
        $or: [
          { displayName: regex },
          { username: regex },
          { email: regex },
          { 'personalInfo.biography': regex },
          { 'personalInfo.address.city': regex },
          { 'personalInfo.address.state': regex },
          { 'personalInfo.address.country': regex },
        ],
      };
    case 'campaign':
      return {
        isDeleted: { $ne: true },
        $or: [
          { title: regex },
          { caption: regex },
          { category: regex },
          { tags: regex },
        ],
      };
    case 'promotion':
      return {
        $or: [
          { upi: regex },
          { status: regex },
        ],
      };
    case 'product':
      return {
        isDeleted: { $ne: true },
        $or: [
          { name: regex },
          { description: regex },
          { category: regex },
          { brand: regex },
          { tags: regex },
          { 'seo.keywords': regex },
          { sku: regex },
        ],
      };
    case 'store':
      return {
        isDeleted: { $ne: true },
        $or: [
          { name: regex },
          { description: regex },
          { category: regex },
          { storeLink: regex },
          { whatsappNumber: regex },
        ],
      };
    default:
      return {};
  }
};

const fetchFallbackSourceEntities = async (entityType, normalizedQuery, perTypeLimit) => {
  const matchQuery = buildFallbackMatchQuery(entityType, normalizedQuery);

  switch (entityType) {
    case 'user':
      return mongoose.model('User').find(matchQuery)
        .select([
          'displayName',
          'username',
          'email',
          'avatar',
          'role',
          'type',
          'isActive',
          'isDeleted',
          'isVerified',
          'rating',
          'ratingCount',
          'personalInfo.address',
          'personalInfo.biography',
        ].join(' '))
        .limit(perTypeLimit)
        .lean();

    case 'campaign':
      return mongoose.model('Campaign').find(matchQuery)
        .select([
          'owner',
          'title',
          'caption',
          'category',
          'status',
          'campaignGoal',
          'mediaType',
          'priority',
          'tags',
          'currency',
          'budget',
          'spentBudget',
          'costPerClick',
          'totalClicks',
          'billableClicks',
          'targetLocations',
          'thumbnailUrl',
          'mediaUrl',
          'store',
          'isDeleted',
        ].join(' '))
        .populate([
          {
            path: 'owner',
            select: 'displayName username avatar role personalInfo.address isVerified',
          },
          {
            path: 'store',
            select: 'name storeLink logo address owner isActive isDeleted',
          },
        ])
        .limit(perTypeLimit)
        .lean();

    case 'promotion': {
      const promotions = await mongoose.model('Promotion').find(matchQuery)
        .select([
          'campaign',
          'promoter',
          'status',
          'upi',
          'promotionUrl',
          'isActive',
          'clickStats',
          'createdAt',
          'updatedAt',
        ].join(' '))
        .populate([
          {
            path: 'promoter',
            select: 'displayName username avatar role personalInfo.address isVerified',
          },
          {
            path: 'campaign',
            select: 'title caption category status currency costPerClick owner thumbnailUrl mediaUrl store targetLocations',
            populate: [
              {
                path: 'owner',
                select: 'displayName username avatar role personalInfo.address isVerified',
              },
              {
                path: 'store',
                select: 'name storeLink logo address owner isActive isDeleted',
              },
            ],
          },
        ])
        .limit(perTypeLimit)
        .lean();

      if (promotions.length > 0) {
        return promotions;
      }

      const matchingCampaigns = await mongoose.model('Campaign').find({
        isDeleted: { $ne: true },
        $or: [
          { title: new RegExp(escapeRegex(normalizedQuery), 'i') },
          { caption: new RegExp(escapeRegex(normalizedQuery), 'i') },
        ],
      }).select('_id').limit(perTypeLimit).lean();

      const campaignIds = matchingCampaigns.map((campaign) => campaign._id);
      if (campaignIds.length === 0) {
        return [];
      }

      return mongoose.model('Promotion').find({ campaign: { $in: campaignIds } })
        .select([
          'campaign',
          'promoter',
          'status',
          'upi',
          'promotionUrl',
          'isActive',
          'clickStats',
          'createdAt',
          'updatedAt',
        ].join(' '))
        .populate([
          {
            path: 'promoter',
            select: 'displayName username avatar role personalInfo.address isVerified',
          },
          {
            path: 'campaign',
            select: 'title caption category status currency costPerClick owner thumbnailUrl mediaUrl store targetLocations',
            populate: [
              {
                path: 'owner',
                select: 'displayName username avatar role personalInfo.address isVerified',
              },
              {
                path: 'store',
                select: 'name storeLink logo address owner isActive isDeleted',
              },
            ],
          },
        ])
        .limit(perTypeLimit)
        .lean();
    }

    case 'product':
      return mongoose.model('Product').find(matchQuery)
        .select([
          'store',
          'name',
          'description',
          'category',
          'brand',
          'tags',
          'seo.keywords',
          'sku',
          'price',
          'originalPrice',
          'currency',
          'affiliate.enabled',
          'averageRating',
          'ratingCount',
          'images',
          'isActive',
          'isPublished',
          'isDeleted',
        ].join(' '))
        .populate({
          path: 'store',
          select: 'name storeLink owner logo address settings.currency isActive isDeleted',
          populate: {
            path: 'owner',
            select: 'displayName username avatar role personalInfo.address isVerified',
          },
        })
        .limit(perTypeLimit)
        .lean();

    case 'store':
      return mongoose.model('Store').find(matchQuery)
        .select([
          'owner',
          'name',
          'description',
          'logo',
          'category',
          'isVerified',
          'storeLink',
          'analytics',
          'whatsappNumber',
          'address',
          'isDeleted',
          'isActive',
        ].join(' '))
        .populate({
          path: 'owner',
          select: 'displayName username avatar role personalInfo.address isVerified',
        })
        .limit(perTypeLimit)
        .lean();

    default:
      return [];
  }
};

const queryFallbackEntities = async ({
  normalizedQuery,
  allowedTypes,
  pageSize,
  suggestionMode = false,
  viewer,
}) => {
  if (!normalizedQuery) {
    return [];
  }

  const perTypeLimit = suggestionMode
    ? Math.max(2, Math.min(4, pageSize))
    : Math.max(4, Math.min(12, pageSize));
  const entityTypes = allowedTypes.length > 0 ? allowedTypes : SEARCH_ENTITY_TYPES;
  const groupedEntities = await Promise.all(
    entityTypes.map((entityType) => fetchFallbackSourceEntities(entityType, normalizedQuery, perTypeLimit))
  );

  const collectedDocuments = [];
  const seenKeys = new Set();

  entityTypes.forEach((entityType, index) => {
    const entities = groupedEntities[index] || [];
    for (const entity of entities) {
      const document = buildDocumentFromEntity(entityType, entity);
      if (!document || !isDocumentVisibleToViewer(document, viewer)) {
        continue;
      }

      const key = `${document.entityType}:${toPlainId(document.entityId)}`;
      if (seenKeys.has(key)) {
        continue;
      }

      seenKeys.add(key);
      collectedDocuments.push(document);
    }
  });

  return collectedDocuments;
};

export const reindexGlobalSearchDocuments = async ({ entityTypes = SEARCH_ENTITY_TYPES } = {}) => {
  const summary = {
    entityTypes: [],
    indexed: 0,
  };

  for (const entityType of entityTypes) {
    const Model = getModelForEntityType(entityType);
    if (!Model) {
      continue;
    }

    let indexedCount = 0;
    const cursor = Model.find(buildReindexSourceQuery(entityType)).select('_id').lean().cursor();

    for await (const row of cursor) {
      await upsertSearchEntity(entityType, row._id);
      indexedCount += 1;
    }

    summary.entityTypes.push({ entityType, indexed: indexedCount });
    summary.indexed += indexedCount;
  }

  return summary;
};

export const ensureGlobalSearchBootstrap = async () => {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  const existingCount = await SearchDocumentModel.estimatedDocumentCount();
  if (existingCount > 0) {
    return null;
  }

  bootstrapPromise = reindexGlobalSearchDocuments()
    .catch((error) => {
      console.error('[global-search] Bootstrap failed:', error);
      throw error;
    })
    .finally(() => {
      bootstrapPromise = null;
    });

  return bootstrapPromise;
};

export const queryGlobalSearch = async ({
  query = '',
  types = [],
  userTypes = [],
  statuses = [],
  region = '',
  page = 1,
  limit = 12,
  includeFacets = true,
  suggestionMode = false,
  viewer = {},
}) => {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = splitSearchTokens(normalizedQuery);
  const prefixTokens = queryTokens.map((token) => token.slice(0, 12));
  const escapedQuery = escapeRegex(normalizedQuery);
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 12));
  const skip = (currentPage - 1) * pageSize;
  const allowedTypes = types.filter((type) => SEARCH_ENTITY_TYPES.includes(type));
  const allowedUserTypes = userTypes
    .map((type) => String(type || '').trim().toLowerCase())
    .filter(Boolean);
  const allowedStatuses = statuses
    .map((status) => String(status || '').trim().toLowerCase())
    .filter(Boolean);
  const regionRegex = region ? new RegExp(escapeRegex(normalizeSearchText(region)), 'i') : null;

  if (!normalizedQuery && allowedTypes.length === 0 && allowedUserTypes.length === 0 && allowedStatuses.length === 0 && !regionRegex) {
    return {
      query: '',
      pagination: {
        page: 1,
        limit: pageSize,
        total: 0,
        totalPages: 0,
      },
      results: [],
      facets: {
        entityTypes: {},
        statuses: {},
        userTypes: {},
        regions: {},
      },
    };
  }

  const pipeline = [
    {
      $match: {
        $or: buildVisibilityClauses(viewer),
      },
    },
  ];

  if (allowedTypes.length > 0) {
    pipeline.push({
      $match: {
        entityType: { $in: allowedTypes },
      },
    });
  }

  if (allowedUserTypes.length > 0) {
    pipeline.push({
      $match: {
        userType: { $in: allowedUserTypes },
      },
    });
  }

  if (allowedStatuses.length > 0) {
    pipeline.push({
      $match: {
        status: { $in: allowedStatuses },
      },
    });
  }

  if (regionRegex) {
    pipeline.push({
      $match: {
        $or: [
          { 'region.country': regionRegex },
          { 'region.state': regionRegex },
          { 'region.city': regionRegex },
          { 'region.label': regionRegex },
        ],
      },
    });
  }

  if (normalizedQuery) {
    const candidateClauses = [
      { normalizedTitle: { $regex: escapedQuery, $options: 'i' } },
      { normalizedSubtitle: { $regex: escapedQuery, $options: 'i' } },
      { normalizedDescription: { $regex: escapedQuery, $options: 'i' } },
    ];

    if (queryTokens.length > 0) {
      candidateClauses.unshift(
        { searchPrefixes: { $all: prefixTokens } },
        { searchTerms: { $all: queryTokens } },
      );
    }

    pipeline.push({ $match: { $or: candidateClauses } });
    pipeline.push({
      $addFields: {
        relevanceScore: {
          $add: [
            { $cond: [{ $eq: ['$normalizedTitle', normalizedQuery] }, 120, 0] },
            { $cond: [{ $regexMatch: { input: '$normalizedTitle', regex: `^${escapedQuery}` } }, 80, 0] },
            { $cond: [{ $regexMatch: { input: '$normalizedTitle', regex: escapedQuery } }, 45, 0] },
            { $cond: [{ $regexMatch: { input: '$normalizedSubtitle', regex: escapedQuery } }, 24, 0] },
            { $cond: [{ $regexMatch: { input: '$normalizedDescription', regex: escapedQuery } }, 12, 0] },
            { $multiply: [{ $size: { $setIntersection: ['$searchTerms', queryTokens] } }, 12] },
            { $multiply: [{ $size: { $setIntersection: ['$searchPrefixes', prefixTokens] } }, 6] },
            { $cond: [{ $eq: ['$status', 'active'] }, 5, 0] },
            { $cond: ['$isActive', 3, 0] },
          ],
        },
      },
    });
  } else {
    pipeline.push({
      $addFields: {
        relevanceScore: 0,
      },
    });
  }

  pipeline.push({ $sort: { relevanceScore: -1, isActive: -1, updatedAt: -1, createdAt: -1 } });

  if (includeFacets) {
    pipeline.push({
      $facet: {
        results: [
          { $skip: skip },
          { $limit: pageSize },
        ],
        total: [{ $count: 'count' }],
        entityTypes: [
          { $group: { _id: '$entityType', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        statuses: [
          { $match: { status: { $ne: '' } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        userTypes: [
          { $match: { userType: { $ne: '' } } },
          { $group: { _id: '$userType', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        regions: [
          { $match: { 'region.label': { $ne: '' } } },
          { $group: { _id: '$region.label', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
        ],
      },
    });
  } else {
    pipeline.push({
      $facet: {
        results: [
          { $limit: pageSize },
        ],
      },
    });
  }

  const [aggregateResult] = await SearchDocumentModel.aggregate(pipeline).allowDiskUse(true);
  let indexedResults = aggregateResult?.results || [];
  let total = includeFacets ? Number(aggregateResult?.total?.[0]?.count || 0) : indexedResults.length;
  let facets = includeFacets
    ? {
        entityTypes: buildFacetMap(aggregateResult?.entityTypes || []),
        statuses: buildFacetMap(aggregateResult?.statuses || []),
        userTypes: buildFacetMap(aggregateResult?.userTypes || []),
        regions: buildFacetMap(aggregateResult?.regions || []),
      }
    : {
        entityTypes: {},
        statuses: {},
        userTypes: {},
        regions: {},
      };

  if (normalizedQuery && indexedResults.length === 0) {
    const fallbackDocuments = await queryFallbackEntities({
      normalizedQuery,
      allowedTypes,
      pageSize,
      suggestionMode,
      viewer,
    });

    const rankedFallbackDocuments = fallbackDocuments
      .map((document) => ({
        ...document,
        relevanceScore: computeRelevanceScore(document, normalizedQuery, queryTokens, prefixTokens),
      }))
      .sort((left, right) => (
        Number(right.relevanceScore || 0) - Number(left.relevanceScore || 0) ||
        Number(right.isActive || 0) - Number(left.isActive || 0)
      ));

    indexedResults = rankedFallbackDocuments.slice(skip, skip + pageSize);
      total = rankedFallbackDocuments.length;
      facets = buildFacetSummary(rankedFallbackDocuments);

      if (fallbackDocuments.length > 0) {
        setImmediate(() => {
          Promise.allSettled(
            fallbackDocuments.map((document) => upsertSearchDocument(document))
          ).catch((error) => {
            console.warn('[global-search] async fallback backfill failed:', error.message);
          });
        });
      }
    }

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  return {
    query: normalizedQuery,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages,
    },
    results: indexedResults.map((document) => serializeResult(document, viewer)),
    facets,
  };
};
