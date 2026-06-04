export class TutorialRepository {
  async findActiveSectionsForRole() {
    throw new Error('TutorialRepository.findActiveSectionsForRole must be implemented');
  }

  async addVideoToSection() {
    throw new Error('TutorialRepository.addVideoToSection must be implemented');
  }

  async updateVideoInSection() {
    throw new Error('TutorialRepository.updateVideoInSection must be implemented');
  }

  async removeVideoFromSection() {
    throw new Error('TutorialRepository.removeVideoFromSection must be implemented');
  }

  async syncPlaylistVideosToSection() {
    throw new Error('TutorialRepository.syncPlaylistVideosToSection must be implemented');
  }

  async findActiveSectionsForViewUpdate() {
    throw new Error('TutorialRepository.findActiveSectionsForViewUpdate must be implemented');
  }

  async findSectionForViewUpdate() {
    throw new Error('TutorialRepository.findSectionForViewUpdate must be implemented');
  }

  async applyVideoViewUpdates() {
    throw new Error('TutorialRepository.applyVideoViewUpdates must be implemented');
  }
}
