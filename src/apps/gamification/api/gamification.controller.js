import {
  getAdminGamificationConfig,
  getGamificationDashboard,
  getGamificationFeed,
  updateAdminGamificationConfig,
} from '../service/gamification.service.js';

export const getDashboard = async (req, res) => {
  try {
    const response = await getGamificationDashboard(req.userId);
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
    const response = await getGamificationFeed(req.userId);
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
    const response = await getAdminGamificationConfig();
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
    const response = await updateAdminGamificationConfig(req.userId, req.body || {});
    return res.status(200).json(response);
  } catch (error) {
    console.error('Gamification config update error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to update gamification configuration.',
    });
  }
};
