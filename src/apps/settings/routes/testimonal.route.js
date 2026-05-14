import express from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../shared/middleware/authorization.middleware.js';

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
TestimonialRouter.get('/admin', authenticate, requireAdmin, adminGetTestimonials);
TestimonialRouter.patch('/admin/:id/status', authenticate, requireAdmin, updateTestimonialStatus);
TestimonialRouter.patch('/admin/:id/featured', authenticate, requireAdmin, toggleFeatured);
TestimonialRouter.delete('/admin/:id', authenticate, requireAdmin, deleteTestimonial);


/* User testimonial */
TestimonialRouter.put('/', authenticate, createOrUpdateTestimonial);
TestimonialRouter.post('/reaction', authenticate, reactToTestimonial);
TestimonialRouter.get('/', getTestimonials);
TestimonialRouter.get('/dashboard', getRandomTestimonials);
TestimonialRouter.get('/:userId', authenticate, getUserTestimonial);


export default TestimonialRouter;
