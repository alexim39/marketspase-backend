import express from 'express';
import { 
    toggleNotification,
} from '../controllers/settings.controller.js'
import { 
    createOrUpdateTestimonial, reactToTestimonial, getTestimonials, getUserTestimonial, getRandomTestimonials
} from '../controllers/testimonial.controller.js'

const SettingsRouter = express.Router();

// toggle notification settings
SettingsRouter.post('/notification', toggleNotification);

/* User testimonial */
SettingsRouter.put('/testimonial', createOrUpdateTestimonial);
SettingsRouter.post('/testimonial/reaction', reactToTestimonial);
SettingsRouter.get('/testimonial', getTestimonials);
SettingsRouter.get('/testimonial/dashboard', getRandomTestimonials);
SettingsRouter.get('/testimonial/:userId', getUserTestimonial);


export default SettingsRouter;