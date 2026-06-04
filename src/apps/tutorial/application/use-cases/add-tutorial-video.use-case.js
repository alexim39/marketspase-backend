import { AddTutorialVideoDto } from '../dto/add-tutorial-video.dto.js';
import {
  TutorialSectionNotFoundError,
  TutorialValidationError,
  TutorialVideoAlreadyExistsError,
} from '../../domain/errors/tutorial.errors.js';
import {
  extractYouTubeId,
  getRecentVideoFlag,
} from '../../domain/services/tutorial-video.service.js';

export class AddTutorialVideoUseCase {
  constructor({ tutorialRepository, videoMetadataGateway }) {
    this.tutorialRepository = tutorialRepository;
    this.videoMetadataGateway = videoMetadataGateway;
  }

  async execute(input) {
    const dto = input instanceof AddTutorialVideoDto
      ? input
      : new AddTutorialVideoDto(input);

    if (!dto.youtubeUrl) {
      throw new TutorialValidationError('youtubeUrl is required');
    }

    const youtubeId = extractYouTubeId(dto.youtubeUrl);
    if (!youtubeId) {
      throw new TutorialValidationError('Invalid YouTube URL');
    }

    const videoDetails = await this.videoMetadataGateway.fetchVideoDetails(youtubeId);
    const result = await this.tutorialRepository.addVideoToSection({
      sectionId: dto.sectionId,
      youtubeId,
      video: {
        youtubeId,
        title: videoDetails.title,
        description: videoDetails.description,
        duration: videoDetails.duration,
        thumbnail: videoDetails.thumbnail,
        tags: dto.tags || videoDetails.tags,
        difficulty: dto.difficulty || 'beginner',
        isFeatured: dto.isFeatured || false,
        isRecentlyAdded: getRecentVideoFlag(dto),
        views: videoDetails.views || 0,
      },
    });

    if (result.status === 'section_not_found') {
      throw new TutorialSectionNotFoundError();
    }

    if (result.status === 'duplicate') {
      throw new TutorialVideoAlreadyExistsError();
    }

    return {
      success: true,
      message: 'Video added successfully',
      data: result.section,
    };
  }
}
