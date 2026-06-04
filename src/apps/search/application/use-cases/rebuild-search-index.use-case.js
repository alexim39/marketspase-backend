import { RebuildSearchIndexDto } from '../dto/rebuild-search-index.dto.js';

export class RebuildSearchIndexUseCase {
  constructor({ searchIndexGateway }) {
    this.searchIndexGateway = searchIndexGateway;
  }

  async execute(input) {
    const dto = input instanceof RebuildSearchIndexDto
      ? input
      : new RebuildSearchIndexDto(input);

    const summary = await this.searchIndexGateway.reindexGlobalSearchDocuments({
      entityTypes: dto.entityTypes,
    });

    return {
      success: true,
      message: 'Search index rebuilt successfully',
      data: summary,
    };
  }
}
