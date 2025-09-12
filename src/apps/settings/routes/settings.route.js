import express from 'express';
import { 
    toggleNotification,
} from '../controllers/settings.controller.js'
import { 
    createOrUpdateTestimonial, reactToTestimonial, getTestimonials, getUserTestimonial, getRandomTestimonials
} from '../controllers/testimonial.controller.js'

import {
  adminGetTestimonials,
  updateTestimonialStatus,
  toggleFeatured,
  deleteTestimonial
} from '../controllers/admin.controller.js';

const SettingsRouter = express.Router();

// toggle notification settings
SettingsRouter.post('/notification', toggleNotification);





// Admin routes - require authentication and admin authorization
SettingsRouter.get('/testimonial/admin', adminGetTestimonials);
SettingsRouter.patch('/testimonial/admin/:id/status', updateTestimonialStatus);
SettingsRouter.patch('/testimonial/admin/:id/featured',  toggleFeatured);
SettingsRouter.delete('/testimonial/admin/:id',  deleteTestimonial);


/* User testimonial */
SettingsRouter.put('/testimonial', createOrUpdateTestimonial);
SettingsRouter.post('/testimonial/reaction', reactToTestimonial);
SettingsRouter.get('/testimonial', getTestimonials);
SettingsRouter.get('/testimonial/dashboard', getRandomTestimonials);
SettingsRouter.get('/testimonial/:userId', getUserTestimonial);



export default SettingsRouter;