import { NewsletterService } from '../services/newsletter.service.js';

export class CreateNewsletterController {
  constructor() {
    this.newsletterService = new NewsletterService();
  }

    // Create new newsletter
  createNewsletter = async (req, res) => {
    try {
      const newsletterData = req.body;

      console.log('sent newletter data ', newsletterData)
      
      // Validate required fields
      if (!newsletterData.subject || !newsletterData.content) {
        const response = {
          success: false,
          data: null,
          message: 'Subject and content are required'
        };
        res.status(400).json(response);
        return;
      }

      const newsletter = await this.newsletterService.createNewsletter(newsletterData);
      
      const response = {
        success: true,
        data: newsletter,
        message: 'Newsletter created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to create newsletter'
      };
      res.status(500).json(response);
    }
  };

}

