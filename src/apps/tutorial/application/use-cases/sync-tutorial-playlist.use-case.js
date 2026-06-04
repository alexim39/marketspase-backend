import { SyncTutorialPlaylistDto } from '../dto/sync-tutorial-playlist.dto.js';
import {
  TutorialSectionNotFoundError,
  TutorialValidationError,
} from '../../domain/errors/tutorial.errors.js';

export class SyncTutorialPlaylistUseCase {
  constructor({ tutorialRepository, videoMetadataGateway }) {
    this.tutorialRepository = tutorialRepository;
    this.videoMetadataGateway = videoMetadataGateway;
  }

  async execute(input) {
    const dto = input instanceof SyncTutorialPlaylistDto
      ? input
      : new SyncTutorialPlaylistDto(input);

    if (!dto.sectionId || !dto.playlistId) {
      throw new TutorialValidationError('sectionId and playlistId are required');
    }

    const videos = await this.videoMetadataGateway.fetchPlaylistVideos(dto.playlistId);
    const result = await this.tutorialRepository.syncPlaylistVideosToSection({
      sectionId: dto.sectionId,
      videos,
    });

    if (result.status === 'section_not_found') {
      throw new TutorialSectionNotFoundError();
    }

    return {
      success: true,
      message: `Synced ${result.addedCount} new videos (${videos.length} total in playlist)`,
      data: result.section,
    };
  }
}
