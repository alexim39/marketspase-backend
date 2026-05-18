import {
  ensureGlobalSearchBootstrap,
  queryGlobalSearch,
  reindexGlobalSearchDocuments,
} from '../services/search-index.service.js';

const parseCsvList = (value) => String(value || '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

const clamp = (value, minimum, maximum, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.trunc(numeric)));
};

export const searchEverything = async (req, res) => {
  try {
    ensureGlobalSearchBootstrap().catch((error) => {
      console.warn('[global-search] background bootstrap trigger failed:', error.message);
    });

    const data = await queryGlobalSearch({
      query: req.query.q || req.query.query || '',
      types: parseCsvList(req.query.types),
      userTypes: parseCsvList(req.query.userTypes),
      statuses: parseCsvList(req.query.statuses),
      region: req.query.region || '',
      page: clamp(req.query.page, 1, 5000, 1),
      limit: clamp(req.query.limit, 1, 50, 12),
      viewer: req.user,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[global-search] searchEverything error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search MarketSpase',
    });
  }
};

export const getSearchSuggestions = async (req, res) => {
  try {
    ensureGlobalSearchBootstrap().catch((error) => {
      console.warn('[global-search] background bootstrap trigger failed:', error.message);
    });

    const query = req.query.q || req.query.query || '';
    if (String(query || '').trim().length < 2) {
      return res.status(200).json({
        success: true,
        data: {
          query: String(query || '').trim(),
          pagination: {
            page: 1,
            limit: 8,
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
        },
      });
    }

    const data = await queryGlobalSearch({
      query,
      types: parseCsvList(req.query.types),
      userTypes: parseCsvList(req.query.userTypes),
      statuses: parseCsvList(req.query.statuses),
      region: req.query.region || '',
      page: 1,
      limit: clamp(req.query.limit, 1, 10, 8),
      includeFacets: false,
      suggestionMode: true,
      viewer: req.user,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[global-search] getSearchSuggestions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch search suggestions',
    });
  }
};

export const rebuildSearchIndex = async (req, res) => {
  try {
    const entityTypes = parseCsvList(req.body?.entityTypes || req.query.types);
    const summary = await reindexGlobalSearchDocuments({
      entityTypes: entityTypes.length > 0 ? entityTypes : undefined,
    });

    return res.status(200).json({
      success: true,
      message: 'Search index rebuilt successfully',
      data: summary,
    });
  } catch (error) {
    console.error('[global-search] rebuildSearchIndex error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to rebuild search index',
    });
  }
};
