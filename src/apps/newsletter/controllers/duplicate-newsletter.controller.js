
import { NewsletterService } from '../services/newsletter.service.js';

export class DuplicateNewsletterController {
  constructor() {
    this.newsletterService = new NewsletterService();
  }

  // Duplicate newsletter
  duplicateNewsletter = async (req, res) => {
    try {
      const { id } = req.params;

      //console.log('sent id ',id)
      
      const duplicatedNewsletter = await this.newsletterService.duplicateNewsletter(id);
      
      if (!duplicatedNewsletter) {
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
        data: duplicatedNewsletter,
        message: 'Newsletter duplicated successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error duplicating newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to duplicate newsletter'
      };
      res.status(500).json(response);
    }
  };

}