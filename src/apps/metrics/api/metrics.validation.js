// src/app/metrics/api/metrics.validation.js
import Joi from 'joi';

export const metricsValidation = {
  getMetrics: {
    query: Joi.object({
      includeHistorical: Joi.boolean().default(false),
      days: Joi.number().integer().min(1).max(90).default(30)
    })
  }
};