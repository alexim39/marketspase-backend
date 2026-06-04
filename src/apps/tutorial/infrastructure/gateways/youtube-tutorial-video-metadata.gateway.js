import axios from 'axios';
import { TutorialVideoMetadataGateway } from '../../application/ports/tutorial-video-metadata.gateway.js';

const YOUTUBE_API_KEY = 'AIzaSyAkXv9Lk93BRadrv2NgX53_FiDWYN2EZWY';

export class YoutubeTutorialVideoMetadataGateway extends TutorialVideoMetadataGateway {
  async fetchVideoDetails(videoId) {
    try {
      const response = await axios.get(
        'https://www.googleapis.com/youtube/v3/videos',
        {
          params: {
            part: 'snippet,contentDetails,statistics',
            id: videoId,
            key: YOUTUBE_API_KEY,
          },
        },
      );

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Video not found on YouTube');
      }

      const video = response.data.items[0];
      const snippet = video.snippet;

      return {
        title: snippet.title,
        description: snippet.description,
        duration: this.formatDuration(video.contentDetails.duration),
        thumbnail: snippet.thumbnails?.maxres?.url
          || snippet.thumbnails?.high?.url
          || snippet.thumbnails?.medium?.url
          || snippet.thumbnails?.default?.url
          || '',
        tags: snippet.tags || [],
        views: Number(video.statistics?.viewCount || 0),
      };
    } catch (error) {
      console.error('Error fetching video details:', error.response?.data || error.message);
      return {
        title: `Video ${videoId}`,
        description: 'Video details unavailable',
        duration: '0:00',
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        tags: [],
      };
    }
  }

  async fetchPlaylistVideos(playlistId) {
    const videos = [];
    let pageToken = undefined;

    try {
      do {
        const response = await axios.get(
          'https://www.googleapis.com/youtube/v3/playlistItems',
          {
            params: {
              part: 'snippet,contentDetails',
              playlistId,
              maxResults: 50,
              pageToken,
              key: YOUTUBE_API_KEY,
            },
          },
        );

        const videoIds = response.data.items
          .map((item) => item.snippet.resourceId.videoId)
          .filter((id) => id)
          .join(',');

        if (videoIds) {
          const detailsResponse = await axios.get(
            'https://www.googleapis.com/youtube/v3/videos',
            {
              params: {
                part: 'snippet,contentDetails,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY,
              },
            },
          );

          detailsResponse.data.items.forEach((video) => {
            videos.push({
              youtubeId: video.id,
              title: video.snippet.title,
              description: video.snippet.description,
              duration: this.formatDuration(video.contentDetails.duration),
              thumbnail: video.snippet.thumbnails?.maxres?.url
                || video.snippet.thumbnails?.high?.url
                || `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`,
              tags: video.snippet.tags || [],
              difficulty: 'beginner',
              isActive: true,
              isFeatured: false,
              isRecentlyAdded: false,
              views: video.statistics?.viewCount || 0,
            });
          });
        }

        pageToken = response.data.nextPageToken;
      } while (pageToken);
    } catch (error) {
      console.error('Error fetching playlist:', error.response?.data || error.message);
    }

    return videos;
  }

  formatDuration(isoDuration) {
    if (!isoDuration) {
      return '0:00';
    }

    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) {
      return '0:00';
    }

    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
