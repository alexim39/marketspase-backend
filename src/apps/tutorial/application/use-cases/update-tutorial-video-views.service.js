const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

export class UpdateTutorialVideoViewsService {
  constructor({ tutorialRepository, videoMetadataGateway }) {
    this.tutorialRepository = tutorialRepository;
    this.videoMetadataGateway = videoMetadataGateway;
  }

  async updateSections({ sections, delayMs = 100, onSectionStart, onVideoUpdated, onVideoFailed } = {}) {
    const stats = {
      totalVideos: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
    };
    const sectionResults = [];

    for (const section of sections) {
      const updates = [];
      const videos = section.videos || [];
      await onSectionStart?.(section);

      for (const video of videos) {
        stats.totalVideos++;

        if (!video.isActive || !video.youtubeId) {
          stats.skipped++;
          continue;
        }

        try {
          const details = await this.videoMetadataGateway.fetchVideoDetails(video.youtubeId);
          if (details.views !== video.views) {
            const oldViews = video.views || 0;
            updates.push({
              youtubeId: video.youtubeId,
              views: details.views,
            });
            stats.updated++;
            await onVideoUpdated?.({
              section,
              video,
              oldViews,
              newViews: details.views,
            });
          } else {
            stats.skipped++;
          }
        } catch (error) {
          stats.failed++;
          await onVideoFailed?.({
            section,
            video,
            error,
          });
        }

        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }

      if (updates.length > 0) {
        const result = await this.tutorialRepository.applyVideoViewUpdates({
          sectionId: section._id,
          updates,
        });
        sectionResults.push({
          sectionId: section._id,
          updatedCount: updates.length,
          section: result.section,
        });
      } else {
        sectionResults.push({
          sectionId: section._id,
          updatedCount: 0,
          section,
        });
      }
    }

    return {
      stats,
      sectionResults,
    };
  }
}
