import express from 'express';
import { NewsletterController } from '../controllers/newsletter.controller.js';
import { CreateNewsletterController } from '../controllers/create-newsletter.js';
import { DuplicateNewsletterController } from '../controllers/duplicate-newsletter.controller.js';

const AdminNewsletterRouter = express.Router();
const newsletterController = new NewsletterController();
const creatNewsletterController = new CreateNewsletterController();
const duplicateNewsletterController = new DuplicateNewsletterController();

// Newsletter CRUD routes
AdminNewsletterRouter.get('/newsletters', newsletterController.getNewsletters);
AdminNewsletterRouter.get('/newsletters/stats', newsletterController.getNewsletterStats);
AdminNewsletterRouter.get('/newsletters/recipient-counts', newsletterController.getRecipientCounts);
AdminNewsletterRouter.get('/newsletters/:id', newsletterController.getNewsletterById);
AdminNewsletterRouter.post('/newsletters', creatNewsletterController.createNewsletter);
AdminNewsletterRouter.put('/newsletters/:id', newsletterController.updateNewsletter);
AdminNewsletterRouter.delete('/newsletters/:id', newsletterController.deleteNewsletter);

// Newsletter actions
AdminNewsletterRouter.post('/newsletters/:id/duplicate', duplicateNewsletterController.duplicateNewsletter);
AdminNewsletterRouter.post('/newsletters/:id/send', newsletterController.sendNewsletter);
AdminNewsletterRouter.post('/newsletters/:id/schedule', newsletterController.scheduleNewsletter);
AdminNewsletterRouter.post('/newsletters/:id/cancel-schedule', newsletterController.cancelScheduledNewsletter);
AdminNewsletterRouter.post('/newsletters/:id/save-draft', newsletterController.saveAsDraft);

// Email management (commented out as per your route file)
// AdminNewsletterRouter.post('/newsletters/validate-emails', newsletterController.validateExternalEmails);
// AdminNewsletterRouter.post('/newsletters/upload-emails', upload.single('file'), newsletterController.uploadEmailCSV);

export default AdminNewsletterRouter;