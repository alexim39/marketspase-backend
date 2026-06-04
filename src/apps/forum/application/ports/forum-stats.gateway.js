export class ForumStatsGateway {
  async getCommunityStats(_query = {}) {
    throw new Error('ForumStatsGateway.getCommunityStats must be implemented');
  }

  async listPinnedThreads(_query = {}) {
    throw new Error('ForumStatsGateway.listPinnedThreads must be implemented');
  }

  async getThreadHighlights(_query = {}) {
    throw new Error('ForumStatsGateway.getThreadHighlights must be implemented');
  }

  async getContributorSpotlight(_query = {}) {
    throw new Error('ForumStatsGateway.getContributorSpotlight must be implemented');
  }

  async getHotTopics(_query = {}) {
    throw new Error('ForumStatsGateway.getHotTopics must be implemented');
  }
}
