export class AddTutorialVideoDto {
  constructor({
    sectionId,
    body = {},
    youtubeUrl,
    tags,
    difficulty,
    isFeatured,
    isRecentlyAdded,
    isNew,
  } = {}) {
    this.sectionId = sectionId;
    this.youtubeUrl = body.youtubeUrl ?? youtubeUrl;
    this.tags = body.tags ?? tags;
    this.difficulty = body.difficulty ?? difficulty;
    this.isFeatured = body.isFeatured ?? isFeatured;
    this.isRecentlyAdded = body.isRecentlyAdded ?? isRecentlyAdded;
    this.isNew = body.isNew ?? isNew;
  }

  static fromRequest({ params, body }) {
    return new AddTutorialVideoDto({
      sectionId: params?.sectionId,
      body,
    });
  }
}
