import { metricsService } from '../service/metrics.service.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.middleware.js';

export const metricsController = {
  getAppMetrics: asyncHandler(async (req, res) => {
    const { includeHistorical, days } = req.query;
    
    const metrics = await metricsService.getDashboardMetrics();

    let response = { success: true, data: metrics };

    if (includeHistorical === 'true') {
      const history = await metricsService.getHistoricalData(Number(days));
      response = { ...response, history };
    }

    res.status(200).json(response);
  })
};