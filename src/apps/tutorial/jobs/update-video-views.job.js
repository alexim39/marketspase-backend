// jobs/update-video-views.job.js
import cron from 'node-cron';
import mongoose from 'mongoose';
import TutorialSection from '../models/tutorial.schema.js';
import TutorialController from '../controllers/tutorial.controller.js';

class UpdateVideoViewsJob {
  constructor() {
    this.isRunning = false;
    this.lastRunTime = null;
    this.successCount = 0;
    this.failureCount = 0;
  }

  start() {
    // Schedule 1: Every 24 hours (recommended)
    cron.schedule('0 0 * * *', async () => {
    //cron.schedule('*/1 * * * *', async () => {
      await this.execute();
    });

    // Alternative schedules (uncomment one):
    // Schedule 2: Once daily at midnight
    // cron.schedule('0 0 * * *', async () => {
    //   await this.execute();
    // });

    // Schedule 3: Every 12 hours (midnight and noon)
    // cron.schedule('0 0,12 * * *', async () => {
    //   await this.execute();
    // });

    // Schedule 4: For testing - every minute
    // cron.schedule('*/1 * * * *', async () => {
    //   await this.execute();
    // });

    console.log('✅ Video views update cron job scheduled (every 24 hours)');
    console.log(`📅 Next run: ${this.getNextRunTime()}`);
  }

  async execute() {
    if (this.isRunning) {
      console.log('⚠️ Previous video views update still running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();
    const jobId = Date.now().toString();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 Job #${jobId} - Starting video views update`);
    console.log(`⏰ Start time: ${startTime.toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Check database connection
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Database not connected. Current state: ' + mongoose.connection.readyState);
      }

      const sections = await TutorialSection.find({ isActive: true });
      console.log(`📚 Found ${sections.length} active sections\n`);

      const stats = {
        totalVideos: 0,
        updated: 0,
        failed: 0,
        skipped: 0
      };

      for (const section of sections) {
        let sectionModified = false;
        console.log(`📂 Processing: ${section.title} (${section.videos.length} videos)`);

        for (const video of section.videos) {
          stats.totalVideos++;

          if (!video.isActive || !video.youtubeId) {
            stats.skipped++;
            continue;
          }

          try {
            const details = await TutorialController.fetchYouTubeVideoDetails(video.youtubeId);
            
            if (details.views !== video.views) {
              const oldViews = video.views || 0;
              video.views = details.views;
              sectionModified = true;
              stats.updated++;
              console.log(`   ✅ ${video.title?.substring(0, 50)}: ${oldViews.toLocaleString()} → ${details.views.toLocaleString()} views`);
            } else {
              stats.skipped++;
            }
          } catch (error) {
            stats.failed++;
            console.error(`   ❌ ${video.title?.substring(0, 50)}: ${error.message}`);
          }

          // Rate limiting: 200ms between API calls (5 requests per second)
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        if (sectionModified) {
          try {
            await section.save();
            console.log(`   💾 Saved successfully\n`);
          } catch (saveError) {
            console.error(`   ❌ Failed to save section: ${saveError.message}\n`);
            stats.failed++;
          }
        } else {
          console.log(`   ℹ️ No changes needed\n`);
        }
      }

      // Update success metrics
      this.successCount++;
      this.failureCount = 0;
      this.lastRunTime = new Date();

      // Log completion
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;

      console.log(`${'='.repeat(60)}`);
      console.log(`✅ Job #${jobId} - Completed successfully`);
      console.log(`${'='.repeat(60)}`);
      console.log(`📊 Statistics:`);
      console.log(`   • Total videos: ${stats.totalVideos}`);
      console.log(`   • Updated: ${stats.updated}`);
      console.log(`   • Skipped: ${stats.skipped}`);
      console.log(`   • Failed: ${stats.failed}`);
      console.log(`   • Duration: ${duration.toFixed(2)} seconds`);
      console.log(`📅 Next scheduled run: ${this.getNextRunTime()}`);
      console.log(`${'='.repeat(60)}\n`);

    } catch (error) {
      this.failureCount++;
      console.error(`❌ Job #${jobId} - Failed:`, error);
    } finally {
      this.isRunning = false;
    }
  }

  getNextRunTime() {
    const now = new Date();
    const currentHour = now.getHours();
    const nextRun = new Date(now);
    
    // Calculate next 6-hour mark
    const nextHour = Math.ceil((currentHour + 1) / 6) * 6;
    nextRun.setHours(nextHour % 24, 0, 0, 0);
    
    // If we're past midnight, it means next run is tomorrow
    if (nextHour >= 24) {
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(0, 0, 0, 0);
    }
    
    return nextRun.toISOString();
  }

  async runNow() {
    console.log('🚀 Manual trigger: Starting video views update...');
    await this.execute();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime?.toISOString(),
      nextRunTime: this.getNextRunTime(),
      successCount: this.successCount,
      failureCount: this.failureCount,
      uptime: process.uptime()
    };
  }
}

// Export singleton instance
export const updateVideoViewsJob = new UpdateVideoViewsJob();