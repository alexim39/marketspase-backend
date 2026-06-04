import { GetTutorialsDto } from '../dto/get-tutorials.dto.js';

const getRecentVideoFlag = (video) => Boolean(video?.isRecentlyAdded ?? video?.isNew);

export class GetTutorialsUseCase {
  constructor({ tutorialRepository }) {
    this.tutorialRepository = tutorialRepository;
  }

  async execute(input) {
    const dto = input instanceof GetTutorialsDto
      ? input
      : new GetTutorialsDto(input);

    const sections = await this.tutorialRepository.findActiveSectionsForRole({
      role: dto.role,
    });

    return {
      success: true,
      data: sections.map((section) => this.toTutorialSectionResponse(section)),
    };
  }

  toTutorialSectionResponse(section) {
    return {
      title: section.title,
      description: section.description,
      icon: section.icon,
      videos: (section.videos || [])
        .filter((video) => video.isActive)
        .sort((first, second) => first.order - second.order)
        .map((video) => ({
          id: video.youtubeId,
          title: video.title,
          description: video.description,
          thumbnail: video.thumbnail,
          duration: video.duration,
          videoUrl: `https://www.youtube.com/embed/${video.youtubeId}`,
          videoType: 'youtube',
          tags: video.tags,
          difficulty: video.difficulty,
          views: video.views || 0,
          isNew: getRecentVideoFlag(video),
          isPopular: video.isFeatured,
        })),
    };
  }
}
