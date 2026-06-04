import { SearchIndexGateway } from '../../application/ports/search-index.gateway.js';
import {
  ensureGlobalSearchBootstrap,
  queryGlobalSearch,
  reindexGlobalSearchDocuments,
} from '../../services/search-index.service.js';

export class LegacySearchIndexGateway extends SearchIndexGateway {
  triggerBootstrap() {
    ensureGlobalSearchBootstrap().catch((error) => {
      console.warn('[global-search] background bootstrap trigger failed:', error.message);
    });
  }

  async queryGlobalSearch(input) {
    return queryGlobalSearch(input);
  }

  async reindexGlobalSearchDocuments(input) {
    return reindexGlobalSearchDocuments(input);
  }
}
