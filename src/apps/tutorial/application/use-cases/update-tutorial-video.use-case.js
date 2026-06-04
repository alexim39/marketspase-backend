import { UpdateTutorialVideoDto } from '../dto/update-tutorial-video.dto.js';
import {
  TutorialSectionNotFoundError,
  TutorialVideoNotFoundError,
} from '../../domain/errors/tutorial.errors.js';

export class UpdateTutorialVideoUseCase {
  constructor({ tutorialRepository }) {
    this.tutorialRepository = tutorialRepository;
  }

  async execute(input) {
    const dto = input instanceof UpdateTutorialVideoDto
      ? input
      : new UpdateTutorialVideoDto(input);

    const result = await this.tutorialRepository.updateVideoInSection({
      sectionId: dto.sectionId,
      videoId: dto.videoId,
      updates: dto.updates,
    });

    if (result.status === 'section_not_found') {
      throw new TutorialSectionNotFoundError();
    }

    if (result.status === 'video_not_found') {
      throw new TutorialVideoNotFoundError();
    }

    return {
      success: true,
      data: result.section,
    };
  }
}
