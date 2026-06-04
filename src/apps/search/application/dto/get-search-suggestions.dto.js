import { clamp, parseCsvList } from './search-everything.dto.js';

export class GetSearchSuggestionsDto {
  constructor({ query = {}, viewer } = {}) {
    this.query = query.q || query.query || '';
    this.types = parseCsvList(query.types);
    this.userTypes = parseCsvList(query.userTypes);
    this.statuses = parseCsvList(query.statuses);
    this.region = query.region || '';
    this.limit = clamp(query.limit, 1, 10, 8);
    this.viewer = viewer;
  }

  get trimmedQuery() {
    return String(this.query || '').trim();
  }

  static fromRequest({ query, user }) {
    return new GetSearchSuggestionsDto({
      query,
      viewer: user,
    });
  }
}
