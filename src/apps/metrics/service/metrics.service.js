// src/app/metrics/service/metrics.service.js
import { metricsRepository } from '../repository/metrics.repository.js';

export class MetricsService {
  async getDashboardMetrics() {
    return metricsRepository.getAppMetrics();
  }
}

export const metricsService = new MetricsService();