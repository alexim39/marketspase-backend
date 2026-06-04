export class UpdateAllTutorialVideoViewsDto {
  constructor({ delayMs = 100 } = {}) {
    this.delayMs = Number.isFinite(Number(delayMs)) ? Number(delayMs) : 100;
  }

  static fromRequest() {
    return new UpdateAllTutorialVideoViewsDto();
  }
}
