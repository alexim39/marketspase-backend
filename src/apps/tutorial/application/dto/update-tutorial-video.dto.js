import { normalizeTutorialVideoPayload } from '../../domain/services/tutorial-video.service.js';

export class UpdateTutorialVideoDto {
  constructor({ sectionId, videoId, body = {} } = {}) {
    this.sectionId = sectionId;
    this.videoId = videoId;
    this.updates = normalizeTutorialVideoPayload(body);
  }

  static fromRequest({ params, body }) {
    return new UpdateTutorialVideoDto({
      sectionId: params?.sectionId,
      videoId: params?.videoId,
      body,
    });
  }
}
