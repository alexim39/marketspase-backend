import test from 'node:test';
import assert from 'node:assert/strict';

import { AddTutorialVideoUseCase } from '../application/use-cases/add-tutorial-video.use-case.js';
import { UpdateTutorialVideoUseCase } from '../application/use-cases/update-tutorial-video.use-case.js';
import { RemoveTutorialVideoUseCase } from '../application/use-cases/remove-tutorial-video.use-case.js';
import { UpdateTutorialVideoDto } from '../application/dto/update-tutorial-video.dto.js';
import {
  TutorialSectionNotFoundError,
  TutorialValidationError,
  TutorialVideoAlreadyExistsError,
  TutorialVideoNotFoundError,
} from '../domain/errors/tutorial.errors.js';

test('AddTutorialVideoUseCase adds a video and returns the legacy response shape', async () => {
  let requestedVideoId = null;
  let addArgs = null;
  const savedSection = { _id: 'section-1', videos: [{ youtubeId: 'jp3LnrZusxA' }] };

  const useCase = new AddTutorialVideoUseCase({
    videoMetadataGateway: {
      async fetchVideoDetails(videoId) {
        requestedVideoId = videoId;
        return {
          title: 'Promoter Video Guide',
          description: 'Learn promotion',
          duration: '5:10',
          thumbnail: 'thumb.jpg',
          tags: ['fallback'],
          views: 100,
        };
      },
    },
    tutorialRepository: {
      async addVideoToSection(args) {
        addArgs = args;
        return {
          status: 'added',
          section: savedSection,
        };
      },
    },
  });

  const result = await useCase.execute({
    sectionId: 'section-1',
    youtubeUrl: 'https://www.youtube.com/watch?v=jp3LnrZusxA&t=23s',
    tags: ['promoter'],
    difficulty: 'advanced',
    isFeatured: true,
    isNew: true,
  });

  assert.equal(requestedVideoId, 'jp3LnrZusxA');
  assert.deepEqual(addArgs, {
    sectionId: 'section-1',
    youtubeId: 'jp3LnrZusxA',
    video: {
      youtubeId: 'jp3LnrZusxA',
      title: 'Promoter Video Guide',
      description: 'Learn promotion',
      duration: '5:10',
      thumbnail: 'thumb.jpg',
      tags: ['promoter'],
      difficulty: 'advanced',
      isFeatured: true,
      isRecentlyAdded: true,
      views: 100,
    },
  });
  assert.deepEqual(result, {
    success: true,
    message: 'Video added successfully',
    data: savedSection,
  });
});

test('AddTutorialVideoUseCase uses video metadata defaults like the legacy controller', async () => {
  let addArgs = null;
  const useCase = new AddTutorialVideoUseCase({
    videoMetadataGateway: {
      async fetchVideoDetails() {
        return {
          title: 'Video title',
          description: 'Video details',
          duration: '0:30',
          thumbnail: 'thumb.jpg',
          tags: ['youtube'],
        };
      },
    },
    tutorialRepository: {
      async addVideoToSection(args) {
        addArgs = args;
        return {
          status: 'added',
          section: { _id: 'section-1' },
        };
      },
    },
  });

  await useCase.execute({
    sectionId: 'section-1',
    youtubeUrl: 'jp3LnrZusxA',
  });

  assert.deepEqual(addArgs.video.tags, ['youtube']);
  assert.equal(addArgs.video.difficulty, 'beginner');
  assert.equal(addArgs.video.isFeatured, false);
  assert.equal(addArgs.video.isRecentlyAdded, false);
  assert.equal(addArgs.video.views, 0);
});

test('AddTutorialVideoUseCase rejects missing YouTube URLs before external calls', async () => {
  const useCase = new AddTutorialVideoUseCase({
    videoMetadataGateway: {
      async fetchVideoDetails() {
        assert.fail('fetchVideoDetails should not run for missing YouTube URLs');
      },
    },
    tutorialRepository: {
      async addVideoToSection() {
        assert.fail('addVideoToSection should not run for missing YouTube URLs');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({ sectionId: 'section-1' }),
    (error) => error instanceof TutorialValidationError
      && error.message === 'youtubeUrl is required',
  );
});

test('AddTutorialVideoUseCase maps missing sections and duplicate videos to domain errors', async () => {
  const videoMetadataGateway = {
    async fetchVideoDetails() {
      return {
        title: 'Video title',
        description: 'Video details',
        duration: '1:00',
        thumbnail: 'thumb.jpg',
        tags: [],
      };
    },
  };

  const missingSectionUseCase = new AddTutorialVideoUseCase({
    videoMetadataGateway,
    tutorialRepository: {
      async addVideoToSection() {
        return { status: 'section_not_found' };
      },
    },
  });

  await assert.rejects(
    () => missingSectionUseCase.execute({
      sectionId: 'missing',
      youtubeUrl: 'jp3LnrZusxA',
    }),
    TutorialSectionNotFoundError,
  );

  const duplicateUseCase = new AddTutorialVideoUseCase({
    videoMetadataGateway,
    tutorialRepository: {
      async addVideoToSection() {
        return { status: 'duplicate' };
      },
    },
  });

  await assert.rejects(
    () => duplicateUseCase.execute({
      sectionId: 'section-1',
      youtubeUrl: 'jp3LnrZusxA',
    }),
    TutorialVideoAlreadyExistsError,
  );
});

test('UpdateTutorialVideoUseCase updates a video and normalizes legacy isNew alias', async () => {
  let updateArgs = null;
  const savedSection = { _id: 'section-1' };
  const useCase = new UpdateTutorialVideoUseCase({
    tutorialRepository: {
      async updateVideoInSection(args) {
        updateArgs = args;
        return {
          status: 'updated',
          section: savedSection,
        };
      },
    },
  });

  const result = await useCase.execute(
    UpdateTutorialVideoDto.fromRequest({
      params: {
        sectionId: 'section-1',
        videoId: 'video-1',
      },
      body: {
        title: 'Updated title',
        isNew: true,
      },
    }),
  );

  assert.deepEqual(updateArgs, {
    sectionId: 'section-1',
    videoId: 'video-1',
    updates: {
      title: 'Updated title',
      isRecentlyAdded: true,
    },
  });
  assert.deepEqual(result, {
    success: true,
    data: savedSection,
  });
});

test('UpdateTutorialVideoUseCase maps missing section and video states', async () => {
  const missingSectionUseCase = new UpdateTutorialVideoUseCase({
    tutorialRepository: {
      async updateVideoInSection() {
        return { status: 'section_not_found' };
      },
    },
  });

  await assert.rejects(
    () => missingSectionUseCase.execute({
      sectionId: 'missing',
      videoId: 'video-1',
      body: {},
    }),
    TutorialSectionNotFoundError,
  );

  const missingVideoUseCase = new UpdateTutorialVideoUseCase({
    tutorialRepository: {
      async updateVideoInSection() {
        return { status: 'video_not_found' };
      },
    },
  });

  await assert.rejects(
    () => missingVideoUseCase.execute({
      sectionId: 'section-1',
      videoId: 'missing-video',
      body: {},
    }),
    TutorialVideoNotFoundError,
  );
});

test('RemoveTutorialVideoUseCase preserves the legacy success response', async () => {
  let removeArgs = null;
  const useCase = new RemoveTutorialVideoUseCase({
    tutorialRepository: {
      async removeVideoFromSection(args) {
        removeArgs = args;
        return { status: 'removed' };
      },
    },
  });

  const result = await useCase.execute({
    sectionId: 'section-1',
    videoId: 'video-1',
  });

  assert.deepEqual(removeArgs, {
    sectionId: 'section-1',
    videoId: 'video-1',
  });
  assert.deepEqual(result, {
    success: true,
    message: 'Video removed',
  });
});

test('RemoveTutorialVideoUseCase rejects missing sections', async () => {
  const useCase = new RemoveTutorialVideoUseCase({
    tutorialRepository: {
      async removeVideoFromSection() {
        return { status: 'section_not_found' };
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      sectionId: 'missing',
      videoId: 'video-1',
    }),
    TutorialSectionNotFoundError,
  );
});
