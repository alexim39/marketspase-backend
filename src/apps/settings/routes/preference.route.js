import express from 'express';

import { UpdateAdPreferences } from '../controllers/update-ads-preferences.controller.js';
import { updateThemePreferences } from '../controllers/update-theme-preference.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';

const PreferencesRouter = express.Router();
PreferencesRouter.use(authenticate);


/**
 * Submits the user data to the controller to update ads preferences.
 * Method: put
 * /settings/preferences/ads
 */
PreferencesRouter.put('/ads', UpdateAdPreferences);

/**
 * Submits the user data to the controller to update theme preferences.
 * Method: put
 * /settings/preferences/theme
 */
PreferencesRouter.put('/theme', updateThemePreferences);


export default PreferencesRouter;
