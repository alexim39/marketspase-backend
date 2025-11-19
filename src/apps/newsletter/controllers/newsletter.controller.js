import { NewsletterService } from '../services/newsletter.service.js';

export class NewsletterController {
  constructor() {
    this.newsletterService = new NewsletterService();
  }

  // Get all newsletters with filtering and pagination
  getNewsletters = async (req, res) => {
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

  // Get newsletter by ID
  getNewsletterById = async (req, res) => {
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



  // Update newsletter
  updateNewsletter = async (req, res) => {
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

  // Delete newsletter
  deleteNewsletter = async (req, res) => {
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


  // Send newsletter
  sendNewsletter = async (req, res) => {
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

  // Schedule newsletter
  scheduleNewsletter = async (req, res) => {
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

  // Cancel scheduled newsletter
  cancelScheduledNewsletter = async (req, res) => {
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

  // Save as draft
  saveAsDraft = async (req, res) => {
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

  // Get newsletter statistics
  getNewsletterStats = async (req, res) => {
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

  // Get recipient counts
  getRecipientCounts = async (req, res) => {
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