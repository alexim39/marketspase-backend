import { parseCsvList } from './search-everything.dto.js';

export class RebuildSearchIndexDto {
  constructor({ body = {}, query = {} } = {}) {
    const entityTypes = parseCsvList(body?.entityTypes || query.types);
    this.entityTypes = entityTypes.length > 0 ? entityTypes : undefined;
  }

  static fromRequest({ body, query }) {
    return new RebuildSearchIndexDto({
      body,
      query,
    });
  }
}
