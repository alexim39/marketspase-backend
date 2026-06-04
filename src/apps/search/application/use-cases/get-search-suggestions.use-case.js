import { GetSearchSuggestionsDto } from '../dto/get-search-suggestions.dto.js';

const emptySuggestionData = (query) => ({
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
});

export class GetSearchSuggestionsUseCase {
  constructor({ searchIndexGateway }) {
    this.searchIndexGateway = searchIndexGateway;
  }

  async execute(input) {
    const dto = input instanceof GetSearchSuggestionsDto
      ? input
      : new GetSearchSuggestionsDto(input);

    this.searchIndexGateway.triggerBootstrap();

    if (dto.trimmedQuery.length < 2) {
      return {
        success: true,
        data: emptySuggestionData(dto.query),
      };
    }

    const data = await this.searchIndexGateway.queryGlobalSearch({
      query: dto.query,
      types: dto.types,
      userTypes: dto.userTypes,
      statuses: dto.statuses,
      region: dto.region,
      page: 1,
      limit: dto.limit,
      includeFacets: false,
      suggestionMode: true,
      viewer: dto.viewer,
    });

    return {
      success: true,
      data,
    };
  }
}
