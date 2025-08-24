import express from 'express';
import { 
    toggleNotification,
} from '../controllers/settings.controller.js'

const SettingsRouter = express.Router();

// toggle notification settings
SettingsRouter.post('/notification', toggleNotification);

/* User testimonial */
SettingsRouter.put('/testimonial', createOrUpdateTestimonial);
SettingsRouter.post('/testimonial/reaction', reactToTestimonial);
SettingsRouter.get('/testimonial', getTestimonials);

export default SettingsRouter;