import {
  ensureGlobalSearchBootstrap,
  queryGlobalSearch,
  reindexGlobalSearchDocuments,
} from '../services/search-index.service.js';
import { SearchEverythingDto } from '../application/dto/search-everything.dto.js';
import { SearchEverythingUseCase } from '../application/use-cases/search-everything.use-case.js';
import { GetSearchSuggestionsDto } from '../application/dto/get-search-suggestions.dto.js';
import { GetSearchSuggestionsUseCase } from '../application/use-cases/get-search-suggestions.use-case.js';
import { RebuildSearchIndexDto } from '../application/dto/rebuild-search-index.dto.js';
import { RebuildSearchIndexUseCase } from '../application/use-cases/rebuild-search-index.use-case.js';
import { LegacySearchIndexGateway } from '../infrastructure/gateways/legacy-search-index.gateway.js';

const searchIndexGateway = new LegacySearchIndexGateway();
const searchEverythingUseCase = new SearchEverythingUseCase({
  searchIndexGateway,
});
const getSearchSuggestionsUseCase = new GetSearchSuggestionsUseCase({
  searchIndexGateway,
});
const rebuildSearchIndexUseCase = new RebuildSearchIndexUseCase({
  searchIndexGateway,
});

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

export const legacySearchEverything = async (req, res) => {
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

export const searchEverything = async (req, res) => {
  if (process.env.SEARCH_DDD_ENABLED === 'false') {
    return legacySearchEverything(req, res);
  }

  try {
    const response = await searchEverythingUseCase.execute(
      SearchEverythingDto.fromRequest({
        query: req.query,
        user: req.user,
      }),
    );

    return res.status(200).json(response);
  } catch (error) {
    console.error('[global-search] searchEverything error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search MarketSpase',
    });
  }
};

export const legacyGetSearchSuggestions = async (req, res) => {
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

export const getSearchSuggestions = async (req, res) => {
  if (process.env.SEARCH_DDD_ENABLED === 'false') {
    return legacyGetSearchSuggestions(req, res);
  }

  try {
    const response = await getSearchSuggestionsUseCase.execute(
      GetSearchSuggestionsDto.fromRequest({
        query: req.query,
        user: req.user,
      }),
    );

    return res.status(200).json(response);
  } catch (error) {
    console.error('[global-search] getSearchSuggestions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch search suggestions',
    });
  }
};

export const legacyRebuildSearchIndex = async (req, res) => {
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

export const rebuildSearchIndex = async (req, res) => {
  if (process.env.SEARCH_DDD_ENABLED === 'false') {
    return legacyRebuildSearchIndex(req, res);
  }

  try {
    const response = await rebuildSearchIndexUseCase.execute(
      RebuildSearchIndexDto.fromRequest({
        body: req.body,
        query: req.query,
      }),
    );

    return res.status(200).json(response);
  } catch (error) {
    console.error('[global-search] rebuildSearchIndex error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to rebuild search index',
    });
  }
};
