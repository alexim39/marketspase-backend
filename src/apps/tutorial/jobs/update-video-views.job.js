// jobs/update-video-views.job.js
import cron from 'node-cron';
import mongoose from 'mongoose';
import { UpdateAllTutorialVideoViewsUseCase } from '../application/use-cases/update-all-tutorial-video-views.use-case.js';
import { MongooseTutorialRepository } from '../infrastructure/repositories/mongoose-tutorial.repository.js';
import { YoutubeTutorialVideoMetadataGateway } from '../infrastructure/gateways/youtube-tutorial-video-metadata.gateway.js';

const updateAllTutorialVideoViewsUseCase = new UpdateAllTutorialVideoViewsUseCase({
  tutorialRepository: new MongooseTutorialRepository(),
  videoMetadataGateway: new YoutubeTutorialVideoMetadataGateway(),
});

class UpdateVideoViewsJob {
  constructor() {
    this.isRunning = false;
    this.lastRunTime = null;
    this.successCount = 0;
    this.failureCount = 0;
  }

  start() {
    cron.schedule('0 0 * * *', async () => {
      await this.execute();
    });

    console.log('Video views update cron job scheduled (every 24 hours)');
    console.log(`Next run: ${this.getNextRunTime()}`);
  }

  async execute() {
    if (this.isRunning) {
      console.log('Previous video views update still running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();
    const jobId = Date.now().toString();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Job #${jobId} - Starting video views update`);
    console.log(`Start time: ${startTime.toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      if (mongoose.connection.readyState !== 1) {
        throw new Error(`Database not connected. Current state: ${mongoose.connection.readyState}`);
      }

      const result = await updateAllTutorialVideoViewsUseCase.execute({ delayMs: 200 });
      const stats = result.stats;

      this.successCount++;
      this.failureCount = 0;
      this.lastRunTime = new Date();

      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;

      console.log(`${'='.repeat(60)}`);
      console.log(`Job #${jobId} - Completed successfully`);
      console.log(`${'='.repeat(60)}`);
      console.log('Statistics:');
      console.log(`   Total sections: ${result.sectionResults.length}`);
      console.log(`   Total videos: ${stats.totalVideos}`);
      console.log(`   Updated: ${stats.updated}`);
      console.log(`   Skipped: ${stats.skipped}`);
      console.log(`   Failed: ${stats.failed}`);
      console.log(`   Duration: ${duration.toFixed(2)} seconds`);
      console.log(`Next scheduled run: ${this.getNextRunTime()}`);
      console.log(`${'='.repeat(60)}\n`);
    } catch (error) {
      this.failureCount++;
      console.error(`Job #${jobId} - Failed:`, error);
    } finally {
      this.isRunning = false;
    }
  }

  getNextRunTime() {
    const now = new Date();
    const currentHour = now.getHours();
    const nextRun = new Date(now);
    const nextHour = Math.ceil((currentHour + 1) / 6) * 6;

    nextRun.setHours(nextHour % 24, 0, 0, 0);

    if (nextHour >= 24) {
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(0, 0, 0, 0);
    }

    return nextRun.toISOString();
  }

  async runNow() {
    console.log('Manual trigger: Starting video views update...');
    await this.execute();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime?.toISOString(),
      nextRunTime: this.getNextRunTime(),
      successCount: this.successCount,
      failureCount: this.failureCount,
      uptime: process.uptime(),
    };
  }
}

export const updateVideoViewsJob = new UpdateVideoViewsJob();
