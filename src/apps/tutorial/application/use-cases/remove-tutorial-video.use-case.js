import { RemoveTutorialVideoDto } from '../dto/remove-tutorial-video.dto.js';
import { TutorialSectionNotFoundError } from '../../domain/errors/tutorial.errors.js';

export class RemoveTutorialVideoUseCase {
  constructor({ tutorialRepository }) {
    this.tutorialRepository = tutorialRepository;
  }

  async execute(input) {
    const dto = input instanceof RemoveTutorialVideoDto
      ? input
      : new RemoveTutorialVideoDto(input);

    const result = await this.tutorialRepository.removeVideoFromSection({
      sectionId: dto.sectionId,
      videoId: dto.videoId,
    });

    if (result.status === 'section_not_found') {
      throw new TutorialSectionNotFoundError();
    }

    return {
      success: true,
      message: 'Video removed',
    };
  }
}
