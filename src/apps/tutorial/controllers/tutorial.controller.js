// controllers/tutorial.controller.js
import TutorialSection from '../models/tutorial.schema.js';
import axios from 'axios';

const YOUTUBE_API_KEY = 'AIzaSyAkXv9Lk93BRadrv2NgX53_FiDWYN2EZWY';
const CHANNEL_ID = 'UC1E9WcNpP_3A0ZqMI3a_wtw';

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value ?? {}, key);
const getRecentVideoFlag = (video) => Boolean(video?.isRecentlyAdded ?? video?.isNew);
const normalizeVideoPayload = (payload = {}) => {
  const normalized = { ...payload };

  if (hasOwn(normalized, 'isNew') && !hasOwn(normalized, 'isRecentlyAdded')) {
    normalized.isRecentlyAdded = Boolean(normalized.isNew);
  }

  delete normalized.isNew;

  return normalized;
};

class TutorialController {
  
  // Get tutorials for frontend
  getTutorials = async (req, res) => {
    try {
      const { role } = req.query;
      
      const query = { isActive: true };
      if (role && role !== 'admin') {
        query.targetRole = { $in: [role, 'all'] };
      }

      const sections = await TutorialSection.find(query)
        .sort({ order: 1 })
        .lean();

      // Transform to match your frontend interface
      const formattedSections = sections.map(section => ({
        title: section.title,
        description: section.description,
        icon: section.icon,
        videos: section.videos
          .filter(v => v.isActive)
          .sort((a, b) => a.order - b.order)
          .map(v => ({
            id: v.youtubeId,
            title: v.title,
            description: v.description,
            thumbnail: v.thumbnail,
            duration: v.duration,
            videoUrl: `https://www.youtube.com/embed/${v.youtubeId}`,
            videoType: 'youtube',
            tags: v.tags,
            difficulty: v.difficulty,
            views: v.views || 0,
            isNew: getRecentVideoFlag(v),
            isPopular: v.isFeatured
          }))
      }));

      res.json({ success: true, data: formattedSections });
    } catch (error) {
      console.error('Error in getTutorials:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Add a video to a section (admin use)
  addVideo = async (req, res) => {
    try {
      //console.log('Request body:', req.body);
      //console.log('Request params:', req.params);
      
      const { sectionId } = req.params;
      const { youtubeUrl, tags, difficulty, isFeatured } = req.body;
      const isRecentlyAdded = getRecentVideoFlag(req.body);

      if (!youtubeUrl) {
        return res.status(400).json({ 
          success: false, 
          error: 'youtubeUrl is required' 
        });
      }

      // Extract YouTube ID from URL
      const youtubeId = this.extractYouTubeId(youtubeUrl);
      //console.log('Extracted YouTube ID:', youtubeId);
      
      if (!youtubeId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid YouTube URL' 
        });
      }
      
      // Fetch video details from YouTube
      const videoDetails = await this.fetchYouTubeVideoDetails(youtubeId);
      //console.log('Fetched video details:', videoDetails.title);

      const section = await TutorialSection.findById(sectionId);
      if (!section) {
        return res.status(404).json({ 
          success: false, 
          error: 'Section not found' 
        });
      }

      // Check if video already exists
      const existingVideo = section.videos.find(v => v.youtubeId === youtubeId);
      if (existingVideo) {
        return res.status(400).json({ 
          success: false, 
          error: 'Video already exists in this section' 
        });
      }

      section.videos.push({
        youtubeId,
        title: videoDetails.title,
        description: videoDetails.description,
        duration: videoDetails.duration,
        thumbnail: videoDetails.thumbnail,
        tags: tags || videoDetails.tags,
        difficulty: difficulty || 'beginner',
        isFeatured: isFeatured || false,
        isRecentlyAdded,
        order: section.videos.length,
        views: videoDetails.views || 0 
      });

      await section.save();

      res.json({ 
        success: true, 
        message: 'Video added successfully',
        data: section 
      });
    } catch (error) {
      console.error('Error in addVideo:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Bulk sync from YouTube playlist (admin use)
  syncFromPlaylist = async (req, res) => {
    try {
      const { sectionId, playlistId } = req.body;

      if (!sectionId || !playlistId) {
        return res.status(400).json({ 
          success: false, 
          error: 'sectionId and playlistId are required' 
        });
      }

      const section = await TutorialSection.findById(sectionId);
      if (!section) {
        return res.status(404).json({ error: 'Section not found' });
      }

      //console.log(`Syncing playlist ${playlistId} to section ${section.title}`);
      
      // Fetch all videos from YouTube playlist
      const videos = await this.fetchPlaylistVideos(playlistId);
      //console.log(`Fetched ${videos.length} videos from playlist`);
      
      let addedCount = 0;
      
      // Add new videos that don't already exist
      for (const video of videos) {
        const exists = section.videos.find(v => v.youtubeId === video.youtubeId);
        if (!exists) {
          section.videos.push({
            ...video,
            isActive: true,
            order: section.videos.length
          });
          addedCount++;
        }
      }

      await section.save();

      res.json({ 
        success: true, 
        message: `Synced ${addedCount} new videos (${videos.length} total in playlist)`,
        data: section 
      });
    } catch (error) {
      console.error('Error in syncFromPlaylist:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Update video settings
  updateVideo = async (req, res) => {
    try {
      const { sectionId, videoId } = req.params;
      const updates = normalizeVideoPayload(req.body);

      const section = await TutorialSection.findById(sectionId);
      if (!section) {
        return res.status(404).json({ error: 'Section not found' });
      }

      const video = section.videos.find(v => v.youtubeId === videoId);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      Object.assign(video, updates);
      await section.save();

      res.json({ success: true, data: section });
    } catch (error) {
      console.error('Error in updateVideo:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Delete video from section
  removeVideo = async (req, res) => {
    try {
      const { sectionId, videoId } = req.params;

      const section = await TutorialSection.findById(sectionId);
      if (!section) {
        return res.status(404).json({ error: 'Section not found' });
      }

      const result = await TutorialSection.findByIdAndUpdate(
        sectionId,
        { $pull: { videos: { youtubeId: videoId } } }
      );

      res.json({ success: true, message: 'Video removed' });
    } catch (error) {
      console.error('Error in removeVideo:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Helper: Extract YouTube ID from URL
  extractYouTubeId = (url) => {
    if (!url) return null;
    
    //console.log('Extracting ID from URL:', url);
    
    // Handle different YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        //console.log('Matched ID:', match[1]);
        return match[1];
      }
    }
    
    //console.log('No match found, returning original URL');
    return url; // Assume it's already an ID
  }

  // Helper: Fetch video details from YouTube
  fetchYouTubeVideoDetails = async (videoId) => {
    try {
      console.log('Fetching details for video:', videoId);
      
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos`,
        {
          params: {
            part: 'snippet,contentDetails,statistics',
            id: videoId,
            key: YOUTUBE_API_KEY
          }
        }
      );

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Video not found on YouTube');
      }

      const video = response.data.items[0];
      const snippet = video.snippet;
      const duration = this.formatDuration(video.contentDetails.duration);

      return {
        title: snippet.title,
        description: snippet.description,
        duration: duration,
        thumbnail: snippet.thumbnails?.maxres?.url || 
                   snippet.thumbnails?.high?.url || 
                   snippet.thumbnails?.medium?.url || 
                   snippet.thumbnails?.default?.url || '',
        tags: snippet.tags || [],
        views: Number(video.statistics?.viewCount || 0)
      };
    } catch (error) {
      console.error('Error fetching video details:', error.response?.data || error.message);
      // Return default values instead of failing completely
      return {
        title: `Video ${videoId}`,
        description: 'Video details unavailable',
        duration: '0:00',
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        tags: []
      };
    }
  }

  // Helper: Fetch playlist videos
  fetchPlaylistVideos = async (playlistId) => {
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
              key: YOUTUBE_API_KEY
            }
          }
        );

        const videoIds = response.data.items
          .map(item => item.snippet.resourceId.videoId)
          .filter(id => id) // Remove any undefined/null IDs
          .join(',');

        if (videoIds) {
          // Get detailed info for all videos
          const detailsResponse = await axios.get(
            'https://www.googleapis.com/youtube/v3/videos',
            {
              params: {
                part: 'snippet,contentDetails,statistics',
                id: videoIds,
                key: YOUTUBE_API_KEY
              }
            }
          );

          detailsResponse.data.items.forEach(video => {
            videos.push({
              youtubeId: video.id,
              title: video.snippet.title,
              description: video.snippet.description,
              duration: this.formatDuration(video.contentDetails.duration),
              thumbnail: video.snippet.thumbnails?.maxres?.url || 
                         video.snippet.thumbnails?.high?.url || 
                         `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`,
              tags: video.snippet.tags || [],
              difficulty: 'beginner',
              isActive: true,
              isFeatured: false,
              isRecentlyAdded: false,
              views: video.statistics?.viewCount || 0
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

  // Helper: Format ISO 8601 duration to readable format
  formatDuration = (isoDuration) => {
    if (!isoDuration) return '0:00';
    
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '0:00';
    
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }



  // Add this new method to your controller
  updateAllVideoViews = async (req, res) => {
    try {
      const sections = await TutorialSection.find({ isActive: true });
      let totalUpdated = 0;

      for (const section of sections) {
        for (const video of section.videos) {
          if (video.isActive && video.youtubeId) {
            try {
              const details = await this.fetchYouTubeVideoDetails(video.youtubeId);
              if (details.views !== video.views) {
                video.views = details.views;
                totalUpdated++;
              }
              // Small delay to avoid hitting API rate limits
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
              console.error(`Failed to update views for video ${video.youtubeId}:`, error.message);
            }
          }
        }
        if (section.isModified()) {
          await section.save();
        }
      }

      res.json({
        success: true,
        message: `Updated views for ${totalUpdated} videos`,
        totalUpdated
      });
    } catch (error) {
      console.error('Error updating video views:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Add a method to update views for a single section
  updateSectionVideoViews = async (req, res) => {
    try {
      const { sectionId } = req.params;
      const section = await TutorialSection.findById(sectionId);
      
      if (!section) {
        return res.status(404).json({ error: 'Section not found' });
      }

      let updatedCount = 0;
      
      for (const video of section.videos) {
        if (video.isActive && video.youtubeId) {
          try {
            const details = await this.fetchYouTubeVideoDetails(video.youtubeId);
            if (details.views !== video.views) {
              video.views = details.views;
              updatedCount++;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`Failed to update views for video ${video.youtubeId}:`, error.message);
          }
        }
      }

      await section.save();

      res.json({
        success: true,
        message: `Updated views for ${updatedCount} videos in section`,
        data: section
      });
    } catch (error) {
      console.error('Error updating section video views:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new TutorialController();
