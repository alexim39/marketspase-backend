import { NewsletterService } from '../services/newsletter.service.js';
import { CancelNewsletterScheduleDto } from '../application/dto/cancel-newsletter-schedule.dto.js';
import { CancelNewsletterScheduleUseCase } from '../application/use-cases/cancel-newsletter-schedule.use-case.js';
import { DeleteNewsletterDto } from '../application/dto/delete-newsletter.dto.js';
import { DeleteNewsletterUseCase } from '../application/use-cases/delete-newsletter.use-case.js';
import { GetNewsletterDto } from '../application/dto/get-newsletter.dto.js';
import { GetNewsletterStatsUseCase } from '../application/use-cases/get-newsletter-stats.use-case.js';
import { GetNewsletterUseCase } from '../application/use-cases/get-newsletter.use-case.js';
import { GetNewslettersDto } from '../application/dto/get-newsletters.dto.js';
import { GetNewslettersUseCase } from '../application/use-cases/get-newsletters.use-case.js';
import { GetRecipientCountsUseCase } from '../application/use-cases/get-recipient-counts.use-case.js';
import { SaveNewsletterDraftDto } from '../application/dto/save-newsletter-draft.dto.js';
import { SaveNewsletterDraftUseCase } from '../application/use-cases/save-newsletter-draft.use-case.js';
import { ScheduleNewsletterDto } from '../application/dto/schedule-newsletter.dto.js';
import { ScheduleNewsletterUseCase } from '../application/use-cases/schedule-newsletter.use-case.js';
import { SendNewsletterDto } from '../application/dto/send-newsletter.dto.js';
import { SendNewsletterUseCase } from '../application/use-cases/send-newsletter.use-case.js';
import { UpdateNewsletterDto } from '../application/dto/update-newsletter.dto.js';
import { UpdateNewsletterUseCase } from '../application/use-cases/update-newsletter.use-case.js';
import { NewsletterActionRejectedError, NewsletterNotFoundError } from '../domain/errors/newsletter.errors.js';
import { NodemailerNewsletterEmailGateway } from '../infrastructure/gateways/nodemailer-newsletter-email.gateway.js';
import { MongooseNewsletterRepository } from '../infrastructure/repositories/mongoose-newsletter.repository.js';
import { MongooseNewsletterRecipientRepository } from '../infrastructure/repositories/mongoose-newsletter-recipient.repository.js';

export class NewsletterController {
  constructor() {
    this.newsletterService = new NewsletterService();
    this.getNewslettersUseCase = new GetNewslettersUseCase({
      newsletterRepository: new MongooseNewsletterRepository()
    });
    this.getNewsletterUseCase = new GetNewsletterUseCase({
      newsletterRepository: new MongooseNewsletterRepository()
    });
    this.getNewsletterStatsUseCase = new GetNewsletterStatsUseCase({
      newsletterRepository: new MongooseNewsletterRepository()
    });
    this.getRecipientCountsUseCase = new GetRecipientCountsUseCase({
      recipientRepository: new MongooseNewsletterRecipientRepository()
    });
    this.deleteNewsletterUseCase = new DeleteNewsletterUseCase({
      newsletterRepository: new MongooseNewsletterRepository()
    });
    this.updateNewsletterUseCase = new UpdateNewsletterUseCase({
      newsletterRepository: new MongooseNewsletterRepository()
    });
    this.saveNewsletterDraftUseCase = new SaveNewsletterDraftUseCase({
      newsletterRepository: new MongooseNewsletterRepository()
    });
    this.cancelNewsletterScheduleUseCase = new CancelNewsletterScheduleUseCase({
      newsletterRepository: new MongooseNewsletterRepository()
    });
    this.scheduleNewsletterUseCase = new ScheduleNewsletterUseCase({
      newsletterRepository: new MongooseNewsletterRepository()
    });
    this.sendNewsletterUseCase = new SendNewsletterUseCase({
      newsletterRepository: new MongooseNewsletterRepository(),
      recipientRepository: new MongooseNewsletterRecipientRepository(),
      emailGateway: new NodemailerNewsletterEmailGateway()
    });
  }

  legacyGetNewsletters = async (req, res) => {
    try {
      const { status, search, page = 1, limit = 10 } = req.query;
      
      const result = await this.newsletterService.getNewsletters({
        status: status,
        search: search,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      const response = {
        success: true,
        data: result.newsletters,
        pagination: result.pagination,
        message: 'Newsletters retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error getting newsletters:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to retrieve newsletters'
      };
      res.status(500).json(response);
    }
  };

  // Get all newsletters with filtering and pagination
  getNewsletters = async (req, res) => {
    if (process.env.NEWSLETTER_DDD_ENABLED === 'false') {
      return this.legacyGetNewsletters(req, res);
    }

    try {
      const result = await this.getNewslettersUseCase.execute(
        GetNewslettersDto.fromRequest({ query: req.query })
      );

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error getting newsletters:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to retrieve newsletters'
      };
      return res.status(500).json(response);
    }
  };

  legacyGetNewsletterById = async (req, res) => {
    try {
      const { id } = req.params;
      
      const newsletter = await this.newsletterService.getNewsletterById(id);
      
      if (!newsletter) {
        const response = {
          success: false,
          data: null,
          message: 'Newsletter not found'
        };
        res.status(404).json(response);
        return;
      }

      const response = {
        success: true,
        data: newsletter,
        message: 'Newsletter retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error getting newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to retrieve newsletter'
      };
      res.status(500).json(response);
    }
  };

  // Get newsletter by ID
  getNewsletterById = async (req, res) => {
    if (process.env.NEWSLETTER_DDD_ENABLED === 'false') {
      return this.legacyGetNewsletterById(req, res);
    }

    try {
      const result = await this.getNewsletterUseCase.execute(
        GetNewsletterDto.fromRequest({ params: req.params })
      );

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof NewsletterNotFoundError) {
        const response = {
          success: false,
          data: null,
          message: 'Newsletter not found'
        };
        return res.status(404).json(response);
      }

      console.error('Error getting newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to retrieve newsletter'
      };
      return res.status(500).json(response);
    }
  };



  legacyUpdateNewsletter = async (req, res) => {
    try {
      const { id } = req.params;
      const newsletterData = req.body;
      
      const newsletter = await this.newsletterService.updateNewsletter(id, newsletterData);
      
      if (!newsletter) {
        const response = {
          success: false,
          data: null,
          message: 'Newsletter not found'
        };
        res.status(404).json(response);
        return;
      }

      const response = {
        success: true,
        data: newsletter,
        message: 'Newsletter updated successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error updating newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to update newsletter'
      };
      res.status(500).json(response);
    }
  };

  legacyDeleteNewsletter = async (req, res) => {
    try {
      const { id } = req.params;
      
      const deleted = await this.newsletterService.deleteNewsletter(id);
      
      if (!deleted) {
        const response = {
          success: false,
          data: null,
          message: 'Newsletter not found'
        };
        res.status(404).json(response);
        return;
      }

      const response = {
        success: true,
        data: null,
        message: 'Newsletter deleted successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error deleting newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to delete newsletter'
      };
      res.status(500).json(response);
    }
  };


  legacySendNewsletter = async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await this.newsletterService.sendNewsletter(id);
      
      if (!result.success) {
        const response = {
          success: false,
          data: null,
          message: result.message || 'Failed to send newsletter'
        };
        res.status(400).json(response);
        return;
      }

      const response = {
        success: true,
        data: result.newsletter,
        message: 'Newsletter sent successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error sending newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to send newsletter'
      };
      res.status(500).json(response);
    }
  };

  legacyScheduleNewsletter = async (req, res) => {
    try {
      const { id } = req.params;
      const { scheduledDate } = req.body;
      
      if (!scheduledDate) {
        const response = {
          success: false,
          data: null,
          message: 'Scheduled date is required'
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.newsletterService.scheduleNewsletter(id, new Date(scheduledDate));
      
      if (!result.success) {
        const response = {
          success: false,
          data: null,
          message: result.message || 'Failed to schedule newsletter'
        };
        res.status(400).json(response);
        return;
      }

      const response = {
        success: true,
        data: result.newsletter,
        message: 'Newsletter scheduled successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error scheduling newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to schedule newsletter'
      };
      res.status(500).json(response);
    }
  };

  legacyCancelScheduledNewsletter = async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await this.newsletterService.cancelScheduledNewsletter(id);
      
      if (!result.success) {
        const response = {
          success: false,
          data: null,
          message: result.message || 'Failed to cancel scheduled newsletter'
        };
        res.status(400).json(response);
        return;
      }

      const response = {
        success: true,
        data: result.newsletter,
        message: 'Scheduled newsletter cancelled successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error cancelling scheduled newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to cancel scheduled newsletter'
      };
      res.status(500).json(response);
    }
  };

  legacySaveAsDraft = async (req, res) => {
    try {
      const { id } = req.params;
      
      const newsletter = await this.newsletterService.saveAsDraft(id);
      
      if (!newsletter) {
        const response = {
          success: false,
          data: null,
          message: 'Newsletter not found'
        };
        res.status(404).json(response);
        return;
      }

      const response = {
        success: true,
        data: newsletter,
        message: 'Newsletter saved as draft successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error saving newsletter as draft:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to save newsletter as draft'
      };
      res.status(500).json(response);
    }
  };

  legacyGetNewsletterStats = async (req, res) => {
    try {
      const stats = await this.newsletterService.getNewsletterStats();
      
      const response = {
        success: true,
        data: stats,
        message: 'Newsletter statistics retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error getting newsletter stats:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to retrieve newsletter statistics'
      };
      res.status(500).json(response);
    }
  };

  // Send newsletter
  sendNewsletter = async (req, res) => {
    if (process.env.NEWSLETTER_DDD_ENABLED === 'false') {
      return this.legacySendNewsletter(req, res);
    }

    try {
      const result = await this.sendNewsletterUseCase.execute(
        SendNewsletterDto.fromRequest({ params: req.params })
      );

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof NewsletterActionRejectedError) {
        const response = {
          success: false,
          data: null,
          message: error.message || 'Failed to send newsletter'
        };
        return res.status(400).json(response);
      }

      console.error('Error sending newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to send newsletter'
      };
      return res.status(500).json(response);
    }
  };

  // Schedule newsletter
  scheduleNewsletter = async (req, res) => {
    if (process.env.NEWSLETTER_DDD_ENABLED === 'false') {
      return this.legacyScheduleNewsletter(req, res);
    }

    try {
      const result = await this.scheduleNewsletterUseCase.execute(
        ScheduleNewsletterDto.fromRequest({
          params: req.params,
          body: req.body
        })
      );

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof NewsletterActionRejectedError) {
        const response = {
          success: false,
          data: null,
          message: error.message || 'Failed to schedule newsletter'
        };
        return res.status(400).json(response);
      }

      console.error('Error scheduling newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to schedule newsletter'
      };
      return res.status(500).json(response);
    }
  };

  // Cancel scheduled newsletter
  cancelScheduledNewsletter = async (req, res) => {
    if (process.env.NEWSLETTER_DDD_ENABLED === 'false') {
      return this.legacyCancelScheduledNewsletter(req, res);
    }

    try {
      const result = await this.cancelNewsletterScheduleUseCase.execute(
        CancelNewsletterScheduleDto.fromRequest({ params: req.params })
      );

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof NewsletterActionRejectedError) {
        const response = {
          success: false,
          data: null,
          message: error.message || 'Failed to cancel scheduled newsletter'
        };
        return res.status(400).json(response);
      }

      console.error('Error cancelling scheduled newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to cancel scheduled newsletter'
      };
      return res.status(500).json(response);
    }
  };

  // Save as draft
  saveAsDraft = async (req, res) => {
    if (process.env.NEWSLETTER_DDD_ENABLED === 'false') {
      return this.legacySaveAsDraft(req, res);
    }

    try {
      const result = await this.saveNewsletterDraftUseCase.execute(
        SaveNewsletterDraftDto.fromRequest({ params: req.params })
      );

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof NewsletterNotFoundError) {
        const response = {
          success: false,
          data: null,
          message: 'Newsletter not found'
        };
        return res.status(404).json(response);
      }

      console.error('Error saving newsletter as draft:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to save newsletter as draft'
      };
      return res.status(500).json(response);
    }
  };

  // Update newsletter
  updateNewsletter = async (req, res) => {
    if (process.env.NEWSLETTER_DDD_ENABLED === 'false') {
      return this.legacyUpdateNewsletter(req, res);
    }

    try {
      const result = await this.updateNewsletterUseCase.execute(
        UpdateNewsletterDto.fromRequest({
          params: req.params,
          body: req.body
        })
      );

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof NewsletterNotFoundError) {
        const response = {
          success: false,
          data: null,
          message: 'Newsletter not found'
        };
        return res.status(404).json(response);
      }

      console.error('Error updating newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to update newsletter'
      };
      return res.status(500).json(response);
    }
  };

  // Delete newsletter
  deleteNewsletter = async (req, res) => {
    if (process.env.NEWSLETTER_DDD_ENABLED === 'false') {
      return this.legacyDeleteNewsletter(req, res);
    }

    try {
      const result = await this.deleteNewsletterUseCase.execute(
        DeleteNewsletterDto.fromRequest({ params: req.params })
      );

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof NewsletterNotFoundError) {
        const response = {
          success: false,
          data: null,
          message: 'Newsletter not found'
        };
        return res.status(404).json(response);
      }

      console.error('Error deleting newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to delete newsletter'
      };
      return res.status(500).json(response);
    }
  };

  // Get newsletter statistics
  getNewsletterStats = async (req, res) => {
    if (process.env.NEWSLETTER_DDD_ENABLED === 'false') {
      return this.legacyGetNewsletterStats(req, res);
    }

    try {
      const result = await this.getNewsletterStatsUseCase.execute();

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error getting newsletter stats:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to retrieve newsletter statistics'
      };
      return res.status(500).json(response);
    }
  };

  legacyGetRecipientCounts = async (req, res) => {
    try {
      const counts = await this.newsletterService.getRecipientCounts();
      
      const response = {
        success: true,
        data: counts,
        message: 'Recipient counts retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error getting recipient counts:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to retrieve recipient counts'
      };
      res.status(500).json(response);
    }
  };

  // Get recipient counts
  getRecipientCounts = async (req, res) => {
    if (process.env.NEWSLETTER_DDD_ENABLED === 'false') {
      return this.legacyGetRecipientCounts(req, res);
    }

    try {
      const result = await this.getRecipientCountsUseCase.execute();

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error getting recipient counts:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to retrieve recipient counts'
      };
      return res.status(500).json(response);
    }
  };

  // Validate external emails
  validateExternalEmails = async (req, res) => {
    try {
      const { emails } = req.body;
      
      if (!emails || !Array.isArray(emails)) {
        const response = {
          success: false,
          data: null,
          message: 'Emails array is required'
        };
        res.status(400).json(response);
        return;
      }

      const validationResult = await this.newsletterService.validateExternalEmails(emails);
      
      const response = {
        success: true,
        data: validationResult,
        message: 'Emails validated successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error validating emails:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to validate emails'
      };
      res.status(500).json(response);
    }
  };

  // Upload CSV with emails
  uploadEmailCSV = async (req, res) => {
    try {
      if (!req.file) {
        const response = {
          success: false,
          data: null,
          message: 'CSV file is required'
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.newsletterService.processEmailCSV(req.file);
      
      const response = {
        success: true,
        data: result,
        message: 'CSV file processed successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error processing CSV file:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to process CSV file'
      };
      res.status(500).json(response);
    }
  };
}
