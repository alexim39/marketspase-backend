import { SearchEverythingDto } from '../dto/search-everything.dto.js';

export class SearchEverythingUseCase {
  constructor({ searchIndexGateway }) {
    this.searchIndexGateway = searchIndexGateway;
  }

  async execute(input) {
    const dto = input instanceof SearchEverythingDto
      ? input
      : new SearchEverythingDto(input);

    this.searchIndexGateway.triggerBootstrap();

    const data = await this.searchIndexGateway.queryGlobalSearch({
      query: dto.query,
      types: dto.types,
      userTypes: dto.userTypes,
      statuses: dto.statuses,
      region: dto.region,
      page: dto.page,
      limit: dto.limit,
      viewer: dto.viewer,
    });

    return {
      success: true,
      data,
    };
  }
}
