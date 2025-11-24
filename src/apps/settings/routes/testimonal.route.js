import express from 'express';

import { 
    createOrUpdateTestimonial, reactToTestimonial, getTestimonials, getUserTestimonial, getRandomTestimonials
} from '../controllers/testimonial.controller.js'

import {
  adminGetTestimonials,
  updateTestimonialStatus,
  toggleFeatured,
  deleteTestimonial
} from '../controllers/admin.controller.js';

const TestimonialRouter = express.Router();


// Admin routes - require authentication and admin authorization
TestimonialRouter.get('/admin', adminGetTestimonials);
TestimonialRouter.patch('/admin/:id/status', updateTestimonialStatus);
TestimonialRouter.patch('/admin/:id/featured',  toggleFeatured);
TestimonialRouter.delete('/admin/:id',  deleteTestimonial);


/* User testimonial */
TestimonialRouter.put('/', createOrUpdateTestimonial);
TestimonialRouter.post('/reaction', reactToTestimonial);
TestimonialRouter.get('/', getTestimonials);
TestimonialRouter.get('/dashboard', getRandomTestimonials);
TestimonialRouter.get('/:userId', getUserTestimonial);


export default TestimonialRouter;