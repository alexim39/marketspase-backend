import mongoose from 'mongoose';
import {
  createBadgeDefinition,
  deleteBadgeDefinition,
  getAdminBadgeConfig,
  getMyBadgeFeed,
  getUserBadgeOverview,
  updateAdminBadgeConfig,
  updateBadgeDefinition,
} from '../service/badge.service.js';

const handleError = (res, error, fallbackMessage) => res.status(error.status || 500).json({
  success: false,
  message: error.message || fallbackMessage,
});

export const getBadgeFeed = async (req, res) => {
  try {
    const response = await getMyBadgeFeed(req.userId, req.query || {});
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

    const response = await getUserBadgeOverview(req.userId, userId);
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load badge overview');
  }
};

export const getAdminConfig = async (_req, res) => {
  try {
    const response = await getAdminBadgeConfig();
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load badge configuration');
  }
};

export const updateAdminConfig = async (req, res) => {
  try {
    const response = await updateAdminBadgeConfig(req.userId, req.body || {});
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to update badge configuration');
  }
};

export const createDefinition = async (req, res) => {
  try {
    const response = await createBadgeDefinition(req.userId, req.body || {});
    res.status(201).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to create badge');
  }
};

export const editDefinition = async (req, res) => {
  try {
    const response = await updateBadgeDefinition(req.userId, req.params.badgeId, req.body || {});
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to update badge');
  }
};

export const removeDefinition = async (req, res) => {
  try {
    const response = await deleteBadgeDefinition(req.userId, req.params.badgeId);
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to delete badge');
  }
};
