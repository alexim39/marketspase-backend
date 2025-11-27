import express from 'express';

import { UpdateAdPreferences } from '../controllers/update-ads-preferences.controller.js';
import { updateThemePreferences } from '../controllers/update-theme-preference.controller.js';

const PreferencesRouter = express.Router();


/**
 * Submits the user data to the controller to update ads preferences.
 * Method: put
 * /api/users/profile/profession:
 */
PreferencesRouter.put('/ads', UpdateAdPreferences);

/**
 * Submits the user data to the controller to update theme preferences.
 * Method: put
 * /api/users/profile/profession:
 */
PreferencesRouter.put('/theme', updateThemePreferences);


export default PreferencesRouter;