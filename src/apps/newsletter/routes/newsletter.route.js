import express from 'express';
import { NewsletterController } from '../controllers/newsletter.controller.js';

const AdminNewsletterRouter = express.Router();
const newsletterController = new NewsletterController();

// Newsletter CRUD routes
AdminNewsletterRouter.get('/newsletters', newsletterController.getNewsletters);
AdminNewsletterRouter.get('/newsletters/stats', newsletterController.getNewsletterStats);
AdminNewsletterRouter.get('/newsletters/recipient-counts', newsletterController.getRecipientCounts);
AdminNewsletterRouter.get('/newsletters/:id', newsletterController.getNewsletterById);
AdminNewsletterRouter.post('/newsletters', newsletterController.createNewsletter);
AdminNewsletterRouter.put('/newsletters/:id', newsletterController.updateNewsletter);
AdminNewsletterRouter.delete('/newsletters/:id', newsletterController.deleteNewsletter);

// Newsletter actions
AdminNewsletterRouter.post('/newsletters/:id/duplicate', newsletterController.duplicateNewsletter);
AdminNewsletterRouter.post('/newsletters/:id/send', newsletterController.sendNewsletter);
AdminNewsletterRouter.post('/newsletters/:id/schedule', newsletterController.scheduleNewsletter);
AdminNewsletterRouter.post('/newsletters/:id/cancel-schedule', newsletterController.cancelScheduledNewsletter);
AdminNewsletterRouter.post('/newsletters/:id/save-draft', newsletterController.saveAsDraft);

// Email management (commented out as per your route file)
// AdminNewsletterRouter.post('/newsletters/validate-emails', newsletterController.validateExternalEmails);
// AdminNewsletterRouter.post('/newsletters/upload-emails', upload.single('file'), newsletterController.uploadEmailCSV);

export default AdminNewsletterRouter;