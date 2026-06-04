import {
  getAdminGamificationConfig as legacyGetAdminGamificationConfig,
  getGamificationDashboard as legacyGetGamificationDashboard,
  getGamificationFeed as legacyGetGamificationFeed,
  updateAdminGamificationConfig as legacyUpdateAdminGamificationConfig,
} from '../service/gamification.service.js';
import { GetGamificationDashboardDto } from '../application/dto/get-gamification-dashboard.dto.js';
import { GetGamificationFeedDto } from '../application/dto/get-gamification-feed.dto.js';
import { UpdateAdminGamificationConfigDto } from '../application/dto/update-admin-gamification-config.dto.js';
import { GetAdminGamificationConfigUseCase } from '../application/use-cases/get-admin-gamification-config.use-case.js';
import { GetGamificationDashboardUseCase } from '../application/use-cases/get-gamification-dashboard.use-case.js';
import { GetGamificationFeedUseCase } from '../application/use-cases/get-gamification-feed.use-case.js';
import { UpdateAdminGamificationConfigUseCase } from '../application/use-cases/update-admin-gamification-config.use-case.js';
import { LegacyGamificationAdminConfigGateway } from '../infrastructure/gateways/legacy-gamification-admin-config.gateway.js';
import { LegacyGamificationQueryGateway } from '../infrastructure/gateways/legacy-gamification-query.gateway.js';

const gamificationQueryGateway = new LegacyGamificationQueryGateway();
const gamificationAdminConfigGateway = new LegacyGamificationAdminConfigGateway();
const getAdminGamificationConfigUseCase = new GetAdminGamificationConfigUseCase({ gamificationAdminConfigGateway });
const getGamificationDashboardUseCase = new GetGamificationDashboardUseCase({ gamificationQueryGateway });
const getGamificationFeedUseCase = new GetGamificationFeedUseCase({ gamificationQueryGateway });
const updateAdminGamificationConfigUseCase = new UpdateAdminGamificationConfigUseCase({ gamificationAdminConfigGateway });

const isGamificationDddEnabled = () => process.env.GAMIFICATION_DDD_ENABLED !== 'false';

export const getDashboard = async (req, res) => {
  try {
    const response = isGamificationDddEnabled()
      ? await getGamificationDashboardUseCase.execute(
        GetGamificationDashboardDto.fromRequest({ userId: req.userId }),
      )
      : await legacyGetGamificationDashboard(req.userId);

    return res.status(200).json(response);
  } catch (error) {
    console.error('Gamification dashboard error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to load gamification dashboard.',
    });
  }
};

export const getFeed = async (req, res) => {
  try {
    const response = isGamificationDddEnabled()
      ? await getGamificationFeedUseCase.execute(
        GetGamificationFeedDto.fromRequest({ userId: req.userId }),
      )
      : await legacyGetGamificationFeed(req.userId);

    return res.status(200).json(response);
  } catch (error) {
    console.error('Gamification feed error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to load gamification feed.',
    });
  }
};

export const getAdminConfig = async (req, res) => {
  try {
    const response = isGamificationDddEnabled()
      ? await getAdminGamificationConfigUseCase.execute()
      : await legacyGetAdminGamificationConfig();

    return res.status(200).json(response);
  } catch (error) {
    console.error('Gamification admin config error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to load gamification configuration.',
    });
  }
};

export const saveAdminConfig = async (req, res) => {
  try {
    const response = isGamificationDddEnabled()
      ? await updateAdminGamificationConfigUseCase.execute(
        UpdateAdminGamificationConfigDto.fromRequest({
          adminId: req.userId,
          body: req.body || {},
        }),
      )
      : await legacyUpdateAdminGamificationConfig(req.userId, req.body || {});

    return res.status(200).json(response);
  } catch (error) {
    console.error('Gamification config update error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to update gamification configuration.',
    });
  }
};
