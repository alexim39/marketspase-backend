
// routes/tutorial.routes.js
import express from 'express';
import TutorialController from '../controllers/tutorial.controller.js';

const router = express.Router();

// Public route - get tutorials
router.get('/list', (req, res) => TutorialController.getTutorials(req, res));

// Admin routes for managing tutorials
router.post('/section/:sectionId/video', (req, res) => TutorialController.addVideo(req, res));
router.put('/section/:sectionId/video/:videoId', (req, res) => TutorialController.updateVideo(req, res));
router.delete('/section/:sectionId/video/:videoId', (req, res) => TutorialController.removeVideo(req, res));
router.post('/sync-playlist', (req, res) => TutorialController.syncFromPlaylist(req, res));

export default router;