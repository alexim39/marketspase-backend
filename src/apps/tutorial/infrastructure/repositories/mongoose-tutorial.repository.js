import TutorialRepositoryModel from '../../models/tutorial.schema.js';
import { TutorialRepository } from '../../domain/repositories/tutorial.repository.js';

export class MongooseTutorialRepository extends TutorialRepository {
  async findActiveSectionsForRole({ role } = {}) {
    const query = { isActive: true };

    if (role && role !== 'admin') {
      query.targetRole = { $in: [role, 'all'] };
    }

    return TutorialRepositoryModel.find(query)
      .sort({ order: 1 })
      .lean();
  }

  async addVideoToSection({ sectionId, youtubeId, video }) {
    const section = await TutorialRepositoryModel.findById(sectionId);
    if (!section) {
      return { status: 'section_not_found' };
    }

    const existingVideo = section.videos.find((item) => item.youtubeId === youtubeId);
    if (existingVideo) {
      return { status: 'duplicate' };
    }

    section.videos.push({
      ...video,
      order: section.videos.length,
    });

    await section.save();

    return {
      status: 'added',
      section,
    };
  }

  async updateVideoInSection({ sectionId, videoId, updates }) {
    const section = await TutorialRepositoryModel.findById(sectionId);
    if (!section) {
      return { status: 'section_not_found' };
    }

    const video = section.videos.find((item) => item.youtubeId === videoId);
    if (!video) {
      return { status: 'video_not_found' };
    }

    Object.assign(video, updates);
    await section.save();

    return {
      status: 'updated',
      section,
    };
  }

  async removeVideoFromSection({ sectionId, videoId }) {
    const section = await TutorialRepositoryModel.findById(sectionId);
    if (!section) {
      return { status: 'section_not_found' };
    }

    await TutorialRepositoryModel.findByIdAndUpdate(
      sectionId,
      { $pull: { videos: { youtubeId: videoId } } },
    );

    return { status: 'removed' };
  }

  async syncPlaylistVideosToSection({ sectionId, videos }) {
    const section = await TutorialRepositoryModel.findById(sectionId);
    if (!section) {
      return { status: 'section_not_found' };
    }

    let addedCount = 0;

    for (const video of videos) {
      const exists = section.videos.find((item) => item.youtubeId === video.youtubeId);
      if (!exists) {
        section.videos.push({
          ...video,
          isActive: true,
          order: section.videos.length,
        });
        addedCount++;
      }
    }

    await section.save();

    return {
      status: 'synced',
      section,
      addedCount,
    };
  }

  async findActiveSectionsForViewUpdate() {
    return TutorialRepositoryModel.find({ isActive: true }).lean();
  }

  async findSectionForViewUpdate(sectionId) {
    const section = await TutorialRepositoryModel.findById(sectionId).lean();
    if (!section) {
      return { status: 'section_not_found' };
    }

    return {
      status: 'found',
      section,
    };
  }

  async applyVideoViewUpdates({ sectionId, updates }) {
    const section = await TutorialRepositoryModel.findById(sectionId);
    if (!section) {
      return { status: 'section_not_found' };
    }

    for (const update of updates) {
      const video = section.videos.find((item) => item.youtubeId === update.youtubeId);
      if (video) {
        video.views = update.views;
      }
    }

    await section.save();

    return {
      status: 'updated',
      section,
    };
  }
}
