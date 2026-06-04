import mongoose from 'mongoose';
import {
  createBadgeDefinition as legacyCreateBadgeDefinition,
  deleteBadgeDefinition as legacyDeleteBadgeDefinition,
  getAdminBadgeConfig as legacyGetAdminBadgeConfig,
  getMyBadgeFeed as legacyGetMyBadgeFeed,
  getUserBadgeOverview as legacyGetUserBadgeOverview,
  updateAdminBadgeConfig as legacyUpdateAdminBadgeConfig,
  updateBadgeDefinition as legacyUpdateBadgeDefinition,
} from '../service/badge.service.js';
import { CreateBadgeDefinitionDto } from '../application/dto/create-badge-definition.dto.js';
import { DeleteBadgeDefinitionDto } from '../application/dto/delete-badge-definition.dto.js';
import { GetBadgeOverviewDto } from '../application/dto/get-badge-overview.dto.js';
import { GetMyBadgeFeedDto } from '../application/dto/get-my-badge-feed.dto.js';
import { UpdateAdminBadgeConfigDto } from '../application/dto/update-admin-badge-config.dto.js';
import { UpdateBadgeDefinitionDto } from '../application/dto/update-badge-definition.dto.js';
import { CreateBadgeDefinitionUseCase } from '../application/use-cases/create-badge-definition.use-case.js';
import { DeleteBadgeDefinitionUseCase } from '../application/use-cases/delete-badge-definition.use-case.js';
import { GetAdminBadgeConfigUseCase } from '../application/use-cases/get-admin-badge-config.use-case.js';
import { GetBadgeOverviewUseCase } from '../application/use-cases/get-badge-overview.use-case.js';
import { GetMyBadgeFeedUseCase } from '../application/use-cases/get-my-badge-feed.use-case.js';
import { UpdateAdminBadgeConfigUseCase } from '../application/use-cases/update-admin-badge-config.use-case.js';
import { UpdateBadgeDefinitionUseCase } from '../application/use-cases/update-badge-definition.use-case.js';
import { LegacyBadgeAdminConfigGateway } from '../infrastructure/gateways/legacy-badge-admin-config.gateway.js';
import { LegacyBadgeDefinitionGateway } from '../infrastructure/gateways/legacy-badge-definition.gateway.js';
import { LegacyBadgeQueryGateway } from '../infrastructure/gateways/legacy-badge-query.gateway.js';

const handleError = (res, error, fallbackMessage) => res.status(error.status || 500).json({
  success: false,
  message: error.message || fallbackMessage,
});

const badgeQueryGateway = new LegacyBadgeQueryGateway();
const badgeAdminConfigGateway = new LegacyBadgeAdminConfigGateway();
const badgeDefinitionGateway = new LegacyBadgeDefinitionGateway();
const createBadgeDefinitionUseCase = new CreateBadgeDefinitionUseCase({ badgeDefinitionGateway });
const deleteBadgeDefinitionUseCase = new DeleteBadgeDefinitionUseCase({ badgeDefinitionGateway });
const getAdminBadgeConfigUseCase = new GetAdminBadgeConfigUseCase({ badgeAdminConfigGateway });
const getBadgeOverviewUseCase = new GetBadgeOverviewUseCase({ badgeQueryGateway });
const getMyBadgeFeedUseCase = new GetMyBadgeFeedUseCase({ badgeQueryGateway });
const updateAdminBadgeConfigUseCase = new UpdateAdminBadgeConfigUseCase({ badgeAdminConfigGateway });
const updateBadgeDefinitionUseCase = new UpdateBadgeDefinitionUseCase({ badgeDefinitionGateway });

const isBadgesDddEnabled = () => process.env.BADGES_DDD_ENABLED !== 'false';

export const getBadgeFeed = async (req, res) => {
  try {
    const response = isBadgesDddEnabled()
      ? await getMyBadgeFeedUseCase.execute(
        GetMyBadgeFeedDto.fromRequest({
          userId: req.userId,
          query: req.query || {},
        }),
      )
      : await legacyGetMyBadgeFeed(req.userId, req.query || {});

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load badge feed');
  }
};

export const getBadgeOverview = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const response = isBadgesDddEnabled()
      ? await getBadgeOverviewUseCase.execute(
        GetBadgeOverviewDto.fromRequest({
          viewerUserId: req.userId,
          targetUserId: userId,
        }),
      )
      : await legacyGetUserBadgeOverview(req.userId, userId);

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load badge overview');
  }
};

export const getAdminConfig = async (_req, res) => {
  try {
    const response = isBadgesDddEnabled()
      ? await getAdminBadgeConfigUseCase.execute()
      : await legacyGetAdminBadgeConfig();

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load badge configuration');
  }
};

export const updateAdminConfig = async (req, res) => {
  try {
    const response = isBadgesDddEnabled()
      ? await updateAdminBadgeConfigUseCase.execute(
        UpdateAdminBadgeConfigDto.fromRequest({
          adminId: req.userId,
          body: req.body || {},
        }),
      )
      : await legacyUpdateAdminBadgeConfig(req.userId, req.body || {});

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to update badge configuration');
  }
};

export const createDefinition = async (req, res) => {
  try {
    const response = isBadgesDddEnabled()
      ? await createBadgeDefinitionUseCase.execute(
        CreateBadgeDefinitionDto.fromRequest({
          adminId: req.userId,
          body: req.body || {},
        }),
      )
      : await legacyCreateBadgeDefinition(req.userId, req.body || {});

    res.status(201).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to create badge');
  }
};

export const editDefinition = async (req, res) => {
  try {
    const response = isBadgesDddEnabled()
      ? await updateBadgeDefinitionUseCase.execute(
        UpdateBadgeDefinitionDto.fromRequest({
          adminId: req.userId,
          badgeId: req.params.badgeId,
          body: req.body || {},
        }),
      )
      : await legacyUpdateBadgeDefinition(req.userId, req.params.badgeId, req.body || {});

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to update badge');
  }
};

export const removeDefinition = async (req, res) => {
  try {
    const response = isBadgesDddEnabled()
      ? await deleteBadgeDefinitionUseCase.execute(
        DeleteBadgeDefinitionDto.fromRequest({
          adminId: req.userId,
          badgeId: req.params.badgeId,
        }),
      )
      : await legacyDeleteBadgeDefinition(req.userId, req.params.badgeId);

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to delete badge');
  }
};
