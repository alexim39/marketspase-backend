export class UpdateSectionTutorialVideoViewsDto {
  constructor({ sectionId, delayMs = 100 } = {}) {
    this.sectionId = sectionId;
    this.delayMs = Number.isFinite(Number(delayMs)) ? Number(delayMs) : 100;
  }

  static fromRequest({ params }) {
    return new UpdateSectionTutorialVideoViewsDto({
      sectionId: params?.sectionId,
    });
  }
}
