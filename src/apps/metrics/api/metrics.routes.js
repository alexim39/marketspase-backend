// src/app/metrics/api/metrics.routes.js
import express from 'express';
import { metricsController } from './metrics.controller.js';
import { metricsValidation } from './metrics.validation.js';
import { validate } from '../../../shared/middleware/validation.middleware.js';

const router = express.Router();

router.get(
  '/',
  validate(metricsValidation.getMetrics),   // ← This is now implemented
  metricsController.getAppMetrics
);

export default router;