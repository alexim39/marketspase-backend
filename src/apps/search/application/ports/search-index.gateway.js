export class SearchIndexGateway {
  async triggerBootstrap() {
    throw new Error('SearchIndexGateway.triggerBootstrap must be implemented');
  }

  async queryGlobalSearch() {
    throw new Error('SearchIndexGateway.queryGlobalSearch must be implemented');
  }

  async reindexGlobalSearchDocuments() {
    throw new Error('SearchIndexGateway.reindexGlobalSearchDocuments must be implemented');
  }
}
