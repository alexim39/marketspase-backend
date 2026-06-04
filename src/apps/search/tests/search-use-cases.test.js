import test from 'node:test';
import assert from 'node:assert/strict';

import { SearchEverythingUseCase } from '../application/use-cases/search-everything.use-case.js';
import { SearchEverythingDto } from '../application/dto/search-everything.dto.js';
import { GetSearchSuggestionsUseCase } from '../application/use-cases/get-search-suggestions.use-case.js';
import { GetSearchSuggestionsDto } from '../application/dto/get-search-suggestions.dto.js';
import { RebuildSearchIndexUseCase } from '../application/use-cases/rebuild-search-index.use-case.js';
import { RebuildSearchIndexDto } from '../application/dto/rebuild-search-index.dto.js';

test('SearchEverythingUseCase preserves the legacy search query contract', async () => {
  const calls = [];
  const data = {
    query: 'bags',
    pagination: {
      page: 5000,
      limit: 50,
      total: 1,
      totalPages: 1,
    },
    results: [],
    facets: {},
  };
  const viewer = { _id: 'viewer-1', role: 'marketer' };

  const useCase = new SearchEverythingUseCase({
    searchIndexGateway: {
      triggerBootstrap() {
        calls.push({ method: 'triggerBootstrap' });
      },
      async queryGlobalSearch(args) {
        calls.push({ method: 'queryGlobalSearch', args });
        return data;
      },
    },
  });

  const result = await useCase.execute(
    SearchEverythingDto.fromRequest({
      query: {
        q: 'bags',
        types: 'Product,store,,',
        userTypes: 'Promoter',
        statuses: 'Active,Published',
        region: 'Lagos',
        page: '9000',
        limit: '100',
      },
      user: viewer,
    }),
  );

  assert.deepEqual(result, {
    success: true,
    data,
  });
  assert.deepEqual(calls, [
    { method: 'triggerBootstrap' },
    {
      method: 'queryGlobalSearch',
      args: {
        query: 'bags',
        types: ['product', 'store'],
        userTypes: ['promoter'],
        statuses: ['active', 'published'],
        region: 'Lagos',
        page: 5000,
        limit: 50,
        viewer,
      },
    },
  ]);
});

test('GetSearchSuggestionsUseCase returns the legacy empty payload for short queries', async () => {
  const useCase = new GetSearchSuggestionsUseCase({
    searchIndexGateway: {
      triggerBootstrap() {},
      async queryGlobalSearch() {
        assert.fail('queryGlobalSearch should not run for short suggestion queries');
      },
    },
  });

  const result = await useCase.execute(
    GetSearchSuggestionsDto.fromRequest({
      query: { q: ' a ' },
      user: { _id: 'viewer-1' },
    }),
  );

  assert.deepEqual(result, {
    success: true,
    data: {
      query: 'a',
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
});

test('GetSearchSuggestionsUseCase queries suggestions with legacy flags', async () => {
  const viewer = { _id: 'viewer-1', role: 'promoter' };
  let queryArgs = null;
  const data = {
    query: 'bag',
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
    results: [],
    facets: {},
  };

  const useCase = new GetSearchSuggestionsUseCase({
    searchIndexGateway: {
      triggerBootstrap() {},
      async queryGlobalSearch(args) {
        queryArgs = args;
        return data;
      },
    },
  });

  const result = await useCase.execute(
    GetSearchSuggestionsDto.fromRequest({
      query: {
        query: 'bag',
        types: 'product',
        limit: '20',
      },
      user: viewer,
    }),
  );

  assert.deepEqual(result, {
    success: true,
    data,
  });
  assert.deepEqual(queryArgs, {
    query: 'bag',
    types: ['product'],
    userTypes: [],
    statuses: [],
    region: '',
    page: 1,
    limit: 10,
    includeFacets: false,
    suggestionMode: true,
    viewer,
  });
});

test('RebuildSearchIndexUseCase preserves entity type parsing and response shape', async () => {
  let reindexArgs = null;
  const summary = {
    entityTypes: [
      { entityType: 'product', indexed: 12 },
    ],
    indexed: 12,
  };
  const useCase = new RebuildSearchIndexUseCase({
    searchIndexGateway: {
      async reindexGlobalSearchDocuments(args) {
        reindexArgs = args;
        return summary;
      },
    },
  });

  const result = await useCase.execute(
    RebuildSearchIndexDto.fromRequest({
      body: {
        entityTypes: ['Product', 'store'],
      },
      query: {},
    }),
  );

  assert.deepEqual(reindexArgs, {
    entityTypes: ['product', 'store'],
  });
  assert.deepEqual(result, {
    success: true,
    message: 'Search index rebuilt successfully',
    data: summary,
  });
});

test('Search use cases let gateway errors propagate to controller failure paths', async () => {
  const useCase = new SearchEverythingUseCase({
    searchIndexGateway: {
      triggerBootstrap() {},
      async queryGlobalSearch() {
        throw new Error('Search unavailable');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      query: {
        q: 'bags',
      },
    }),
    /Search unavailable/,
  );
});
