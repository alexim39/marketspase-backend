import { DuplicateNewsletterDto } from '../application/dto/duplicate-newsletter.dto.js';
import { DuplicateNewsletterUseCase } from '../application/use-cases/duplicate-newsletter.use-case.js';
import { NewsletterNotFoundError } from '../domain/errors/newsletter.errors.js';
import { MongooseNewsletterRepository } from '../infrastructure/repositories/mongoose-newsletter.repository.js';
import { NewsletterService } from '../services/newsletter.service.js';

export class DuplicateNewsletterController {
  constructor() {
    this.newsletterService = new NewsletterService();
    this.duplicateNewsletterUseCase = new DuplicateNewsletterUseCase({
      newsletterRepository: new MongooseNewsletterRepository()
    });
  }

  legacyDuplicateNewsletter = async (req, res) => {
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

  // Duplicate newsletter
  duplicateNewsletter = async (req, res) => {
    if (process.env.NEWSLETTER_DDD_ENABLED === 'false') {
      return this.legacyDuplicateNewsletter(req, res);
    }

    try {
      const result = await this.duplicateNewsletterUseCase.execute(
        DuplicateNewsletterDto.fromRequest({ params: req.params })
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

      console.error('Error duplicating newsletter:', error);
      const response = {
        success: false,
        data: null,
        message: 'Failed to duplicate newsletter'
      };
      return res.status(500).json(response);
    }
  };

}
