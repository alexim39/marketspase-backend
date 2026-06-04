import { CreateNewsletterDto } from '../application/dto/create-newsletter.dto.js';
import { CreateNewsletterUseCase } from '../application/use-cases/create-newsletter.use-case.js';
import { NewsletterActionRejectedError } from '../domain/errors/newsletter.errors.js';
import { MongooseNewsletterRepository } from '../infrastructure/repositories/mongoose-newsletter.repository.js';
import { NewsletterService } from '../services/newsletter.service.js';

export class CreateNewsletterController {
  constructor() {
    this.newsletterService = new NewsletterService();
    this.createNewsletterUseCase = new CreateNewsletterUseCase({
      newsletterRepository: new MongooseNewsletterRepository()
    });
  }

  legacyCreateNewsletter = async (req, res) => {
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

  // Create new newsletter
  createNewsletter = async (req, res) => {
    if (process.env.NEWSLETTER_DDD_ENABLED === 'false') {
      return this.legacyCreateNewsletter(req, res);
    }

    try {
      const result = await this.createNewsletterUseCase.execute(
        CreateNewsletterDto.fromRequest({ body: req.body })
      );

      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof NewsletterActionRejectedError) {
        const response = {
          success: false,
          data: null,
          message: error.message || 'Subject and content are required'
        };
        return res.status(400).json(response);
      }

      console.error('Error creating newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to create newsletter'
      };
      return res.status(500).json(response);
    }
  };

}

