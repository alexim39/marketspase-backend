import { UpdateSectionTutorialVideoViewsDto } from '../dto/update-section-tutorial-video-views.dto.js';
import { TutorialSectionNotFoundError } from '../../domain/errors/tutorial.errors.js';
import { UpdateTutorialVideoViewsService } from './update-tutorial-video-views.service.js';

export class UpdateSectionTutorialVideoViewsUseCase {
  constructor({ tutorialRepository, videoMetadataGateway }) {
    this.tutorialRepository = tutorialRepository;
    this.videoMetadataGateway = videoMetadataGateway;
    this.viewUpdateService = new UpdateTutorialVideoViewsService({
      tutorialRepository,
      videoMetadataGateway,
    });
  }

  async execute(input = {}) {
    const dto = input instanceof UpdateSectionTutorialVideoViewsDto
      ? input
      : new UpdateSectionTutorialVideoViewsDto(input);

    const result = await this.tutorialRepository.findSectionForViewUpdate(dto.sectionId);
    if (result.status === 'section_not_found') {
      throw new TutorialSectionNotFoundError();
    }

    const updateResult = await this.viewUpdateService.updateSections({
      sections: [result.section],
      delayMs: dto.delayMs,
    });

    const sectionResult = updateResult.sectionResults[0] || {
      section: result.section,
      updatedCount: 0,
    };

    return {
      success: true,
      message: `Updated views for ${updateResult.stats.updated} videos in section`,
      data: sectionResult.section,
      updatedCount: updateResult.stats.updated,
      stats: updateResult.stats,
    };
  }
}
