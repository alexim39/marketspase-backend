export class RemoveTutorialVideoDto {
  constructor({ sectionId, videoId } = {}) {
    this.sectionId = sectionId;
    this.videoId = videoId;
  }

  static fromRequest({ params }) {
    return new RemoveTutorialVideoDto({
      sectionId: params?.sectionId,
      videoId: params?.videoId,
    });
  }
}
