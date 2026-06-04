import { UpdateAllTutorialVideoViewsDto } from '../dto/update-all-tutorial-video-views.dto.js';
import { UpdateTutorialVideoViewsService } from './update-tutorial-video-views.service.js';

export class UpdateAllTutorialVideoViewsUseCase {
  constructor({ tutorialRepository, videoMetadataGateway }) {
    this.tutorialRepository = tutorialRepository;
    this.videoMetadataGateway = videoMetadataGateway;
    this.viewUpdateService = new UpdateTutorialVideoViewsService({
      tutorialRepository,
      videoMetadataGateway,
    });
  }

  async execute(input = {}) {
    const dto = input instanceof UpdateAllTutorialVideoViewsDto
      ? input
      : new UpdateAllTutorialVideoViewsDto(input);

    const sections = await this.tutorialRepository.findActiveSectionsForViewUpdate();
    const result = await this.viewUpdateService.updateSections({
      sections,
      delayMs: dto.delayMs,
    });

    return {
      success: true,
      message: `Updated views for ${result.stats.updated} videos`,
      totalUpdated: result.stats.updated,
      stats: result.stats,
      sectionResults: result.sectionResults,
    };
  }
}
