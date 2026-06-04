import test from 'node:test';
import assert from 'node:assert/strict';

import { UpdateAllTutorialVideoViewsUseCase } from '../application/use-cases/update-all-tutorial-video-views.use-case.js';
import { UpdateSectionTutorialVideoViewsUseCase } from '../application/use-cases/update-section-tutorial-video-views.use-case.js';
import { TutorialSectionNotFoundError } from '../domain/errors/tutorial.errors.js';

const sections = [
  {
    _id: 'section-1',
    title: 'Promoter Guide',
    videos: [
      {
        youtubeId: 'video-updated',
        title: 'Updated video',
        views: 10,
        isActive: true,
      },
      {
        youtubeId: 'video-same',
        title: 'Same video',
        views: 20,
        isActive: true,
      },
      {
        youtubeId: 'video-inactive',
        title: 'Inactive video',
        views: 0,
        isActive: false,
      },
      {
        title: 'Missing YouTube id',
        views: 0,
        isActive: true,
      },
    ],
  },
];

test('UpdateAllTutorialVideoViewsUseCase updates changed views and returns legacy endpoint fields', async () => {
  const appliedUpdates = [];
  const useCase = new UpdateAllTutorialVideoViewsUseCase({
    videoMetadataGateway: {
      async fetchVideoDetails(videoId) {
        if (videoId === 'video-updated') {
          return { views: 15 };
        }

        return { views: 20 };
      },
    },
    tutorialRepository: {
      async findActiveSectionsForViewUpdate() {
        return sections;
      },
      async applyVideoViewUpdates(args) {
        appliedUpdates.push(args);
        return {
          status: 'updated',
          section: {
            _id: args.sectionId,
            videos: args.updates,
          },
        };
      },
    },
  });

  const result = await useCase.execute({ delayMs: 0 });

  assert.deepEqual(appliedUpdates, [
    {
      sectionId: 'section-1',
      updates: [
        {
          youtubeId: 'video-updated',
          views: 15,
        },
      ],
    },
  ]);
  assert.equal(result.success, true);
  assert.equal(result.message, 'Updated views for 1 videos');
  assert.equal(result.totalUpdated, 1);
  assert.deepEqual(result.stats, {
    totalVideos: 4,
    updated: 1,
    failed: 0,
    skipped: 3,
  });
});

test('UpdateAllTutorialVideoViewsUseCase records failed video refreshes and continues', async () => {
  const useCase = new UpdateAllTutorialVideoViewsUseCase({
    videoMetadataGateway: {
      async fetchVideoDetails(videoId) {
        if (videoId === 'video-updated') {
          throw new Error('YouTube unavailable');
        }

        return { views: 20 };
      },
    },
    tutorialRepository: {
      async findActiveSectionsForViewUpdate() {
        return sections;
      },
      async applyVideoViewUpdates() {
        assert.fail('No view updates should be applied when changed videos fail');
      },
    },
  });

  const result = await useCase.execute({ delayMs: 0 });

  assert.equal(result.totalUpdated, 0);
  assert.deepEqual(result.stats, {
    totalVideos: 4,
    updated: 0,
    failed: 1,
    skipped: 3,
  });
});

test('UpdateSectionTutorialVideoViewsUseCase returns the legacy section endpoint shape', async () => {
  const savedSection = {
    _id: 'section-1',
    videos: [
      {
        youtubeId: 'video-updated',
        views: 99,
      },
    ],
  };
  const useCase = new UpdateSectionTutorialVideoViewsUseCase({
    videoMetadataGateway: {
      async fetchVideoDetails() {
        return { views: 99 };
      },
    },
    tutorialRepository: {
      async findSectionForViewUpdate(sectionId) {
        assert.equal(sectionId, 'section-1');
        return {
          status: 'found',
          section: {
            _id: 'section-1',
            title: 'Promoter Guide',
            videos: [
              {
                youtubeId: 'video-updated',
                views: 10,
                isActive: true,
              },
            ],
          },
        };
      },
      async applyVideoViewUpdates(args) {
        assert.deepEqual(args, {
          sectionId: 'section-1',
          updates: [
            {
              youtubeId: 'video-updated',
              views: 99,
            },
          ],
        });
        return {
          status: 'updated',
          section: savedSection,
        };
      },
    },
  });

  const result = await useCase.execute({
    sectionId: 'section-1',
    delayMs: 0,
  });

  assert.equal(result.success, true);
  assert.equal(result.message, 'Updated views for 1 videos in section');
  assert.equal(result.updatedCount, 1);
  assert.deepEqual(result.data, savedSection);
});

test('UpdateSectionTutorialVideoViewsUseCase rejects missing sections', async () => {
  const useCase = new UpdateSectionTutorialVideoViewsUseCase({
    videoMetadataGateway: {
      async fetchVideoDetails() {
        assert.fail('fetchVideoDetails should not run for missing sections');
      },
    },
    tutorialRepository: {
      async findSectionForViewUpdate() {
        return { status: 'section_not_found' };
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      sectionId: 'missing',
      delayMs: 0,
    }),
    TutorialSectionNotFoundError,
  );
});
