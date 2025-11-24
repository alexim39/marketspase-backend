import express from 'express';

import { UpdateAdPreferences } from '../controllers/update-ads-preferences.controller.js';

const PreferencesRouter = express.Router();


/**
 * Submits the user data to the controller to update ads preferences.
 * Method: put
 * /api/users/profile/profession:
 */
PreferencesRouter.put('/ads', UpdateAdPreferences);


export default PreferencesRouter;