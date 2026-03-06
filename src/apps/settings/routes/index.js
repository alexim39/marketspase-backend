import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware

import TestimonialRouter from './testimonal.route.js';
import NotificationRouter from './notification.route.js';
import PreferencesRouter from './preference.route.js';


const SettingsRouter = express.Router();

// Mount TestimonialRouter under SettingsRouter
SettingsRouter.use('/testimonial', TestimonialRouter);
// Mount NotificationRouter under SettingsRouter
SettingsRouter.use('/notification', NotificationRouter);
// Mount PreferencesRouter under SettingsRouter
SettingsRouter.use('/preferences', PreferencesRouter);

export default SettingsRouter;