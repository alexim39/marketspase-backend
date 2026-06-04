export class GetTutorialsDto {
  constructor(query = {}) {
    this.role = query.role;
  }

  static fromRequest({ query }) {
    return new GetTutorialsDto(query);
  }
}
