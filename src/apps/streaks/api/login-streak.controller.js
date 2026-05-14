import {
  getAdminLoginStreakConfig,
  getLeaderboard,
  getLoginStreakStatus,
  pingLoginStreakSession,
  startLoginStreakSession,
  updateAdminLoginStreakConfig,
  withdrawLoginStreakPoints,
} from '../service/login-streak.service.js';

const handleError = (res, error, fallbackMessage) => res.status(error.status || 500).json({
  success: false,
  message: error.message || fallbackMessage,
});

export const startSession = async (req, res) => {
  try {
    const response = await startLoginStreakSession(req.userId, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to start login streak session');
  }
};

export const getStatus = async (req, res) => {
  try {
    const response = await getLoginStreakStatus(req.userId);
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load login streak status');
  }
};

export const getLeaderboardStats = async (req, res) => {
  try {
    const response = await getLeaderboard(req.userId, req.query || {});
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load leaderboard data');
  }
};

export const pingSession = async (req, res) => {
  try {
    const response = await pingLoginStreakSession(req.userId, req.body?.sessionId || null);
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to update login streak session');
  }
};

export const withdrawPoints = async (req, res) => {
  try {
    const response = await withdrawLoginStreakPoints(req.userId, req.body || {});
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to withdraw login streak points');
  }
};

export const getAdminConfig = async (_req, res) => {
  try {
    const response = await getAdminLoginStreakConfig();
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load login streak configuration');
  }
};

export const updateAdminConfig = async (req, res) => {
  try {
    const response = await updateAdminLoginStreakConfig(req.userId, req.body || {});
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to update login streak configuration');
  }
};
