import test from 'node:test';
import assert from 'node:assert/strict';

import { SyncTutorialPlaylistUseCase } from '../application/use-cases/sync-tutorial-playlist.use-case.js';
import {
  TutorialSectionNotFoundError,
  TutorialValidationError,
} from '../domain/errors/tutorial.errors.js';

test('SyncTutorialPlaylistUseCase syncs playlist videos and returns the legacy response shape', async () => {
  let requestedPlaylistId = null;
  let syncArgs = null;
  const videos = [
    {
      youtubeId: 'video-1',
      title: 'First video',
      isActive: true,
    },
    {
      youtubeId: 'video-2',
      title: 'Second video',
      isActive: true,
    },
  ];
  const savedSection = {
    _id: 'section-1',
    videos,
  };

  const useCase = new SyncTutorialPlaylistUseCase({
    videoMetadataGateway: {
      async fetchPlaylistVideos(playlistId) {
        requestedPlaylistId = playlistId;
        return videos;
      },
    },
    tutorialRepository: {
      async syncPlaylistVideosToSection(args) {
        syncArgs = args;
        return {
          status: 'synced',
          addedCount: 1,
          section: savedSection,
        };
      },
    },
  });

  const result = await useCase.execute({
    sectionId: 'section-1',
    playlistId: 'playlist-1',
  });

  assert.equal(requestedPlaylistId, 'playlist-1');
  assert.deepEqual(syncArgs, {
    sectionId: 'section-1',
    videos,
  });
  assert.deepEqual(result, {
    success: true,
    message: 'Synced 1 new videos (2 total in playlist)',
    data: savedSection,
  });
});

test('SyncTutorialPlaylistUseCase rejects missing required fields before external calls', async () => {
  const useCase = new SyncTutorialPlaylistUseCase({
    videoMetadataGateway: {
      async fetchPlaylistVideos() {
        assert.fail('fetchPlaylistVideos should not run for invalid payloads');
      },
    },
    tutorialRepository: {
      async syncPlaylistVideosToSection() {
        assert.fail('syncPlaylistVideosToSection should not run for invalid payloads');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      sectionId: 'section-1',
    }),
    (error) => error instanceof TutorialValidationError
      && error.message === 'sectionId and playlistId are required',
  );
});

test('SyncTutorialPlaylistUseCase maps missing sections to the domain error', async () => {
  const useCase = new SyncTutorialPlaylistUseCase({
    videoMetadataGateway: {
      async fetchPlaylistVideos() {
        return [];
      },
    },
    tutorialRepository: {
      async syncPlaylistVideosToSection() {
        return { status: 'section_not_found' };
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      sectionId: 'missing',
      playlistId: 'playlist-1',
    }),
    TutorialSectionNotFoundError,
  );
});

test('SyncTutorialPlaylistUseCase keeps zero-video playlist sync legacy-compatible', async () => {
  const savedSection = {
    _id: 'section-1',
    videos: [],
  };
  const useCase = new SyncTutorialPlaylistUseCase({
    videoMetadataGateway: {
      async fetchPlaylistVideos() {
        return [];
      },
    },
    tutorialRepository: {
      async syncPlaylistVideosToSection() {
        return {
          status: 'synced',
          addedCount: 0,
          section: savedSection,
        };
      },
    },
  });

  const result = await useCase.execute({
    sectionId: 'section-1',
    playlistId: 'playlist-empty',
  });

  assert.deepEqual(result, {
    success: true,
    message: 'Synced 0 new videos (0 total in playlist)',
    data: savedSection,
  });
});

test('SyncTutorialPlaylistUseCase lets repository errors propagate to the controller failure path', async () => {
  const useCase = new SyncTutorialPlaylistUseCase({
    videoMetadataGateway: {
      async fetchPlaylistVideos() {
        return [];
      },
    },
    tutorialRepository: {
      async syncPlaylistVideosToSection() {
        throw new Error('Database unavailable');
      },
    },
  });

  await assert.rejects(
    () => useCase.execute({
      sectionId: 'section-1',
      playlistId: 'playlist-1',
    }),
    /Database unavailable/,
  );
});
