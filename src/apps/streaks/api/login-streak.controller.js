import {
  getAdminLoginStreakConfig as legacyGetAdminLoginStreakConfig,
  getLeaderboard as legacyGetLeaderboard,
  getLoginStreakStatus as legacyGetLoginStreakStatus,
  pingLoginStreakSession as legacyPingLoginStreakSession,
  startLoginStreakSession as legacyStartLoginStreakSession,
  updateAdminLoginStreakConfig as legacyUpdateAdminLoginStreakConfig,
  withdrawLoginStreakPoints as legacyWithdrawLoginStreakPoints,
} from '../service/login-streak.service.js';
import { GetLoginStreakLeaderboardDto } from '../application/dto/get-login-streak-leaderboard.dto.js';
import { GetLoginStreakStatusDto } from '../application/dto/get-login-streak-status.dto.js';
import { PingLoginStreakSessionDto } from '../application/dto/ping-login-streak-session.dto.js';
import { StartLoginStreakSessionDto } from '../application/dto/start-login-streak-session.dto.js';
import { UpdateAdminLoginStreakConfigDto } from '../application/dto/update-admin-login-streak-config.dto.js';
import { WithdrawLoginStreakPointsDto } from '../application/dto/withdraw-login-streak-points.dto.js';
import { GetAdminLoginStreakConfigUseCase } from '../application/use-cases/get-admin-login-streak-config.use-case.js';
import { GetLoginStreakLeaderboardUseCase } from '../application/use-cases/get-login-streak-leaderboard.use-case.js';
import { GetLoginStreakStatusUseCase } from '../application/use-cases/get-login-streak-status.use-case.js';
import { PingLoginStreakSessionUseCase } from '../application/use-cases/ping-login-streak-session.use-case.js';
import { StartLoginStreakSessionUseCase } from '../application/use-cases/start-login-streak-session.use-case.js';
import { UpdateAdminLoginStreakConfigUseCase } from '../application/use-cases/update-admin-login-streak-config.use-case.js';
import { WithdrawLoginStreakPointsUseCase } from '../application/use-cases/withdraw-login-streak-points.use-case.js';
import { LegacyLoginStreakAdminConfigGateway } from '../infrastructure/gateways/legacy-login-streak-admin-config.gateway.js';
import { LegacyLoginStreakQueryGateway } from '../infrastructure/gateways/legacy-login-streak-query.gateway.js';
import { LegacyLoginStreakSessionGateway } from '../infrastructure/gateways/legacy-login-streak-session.gateway.js';
import { LegacyLoginStreakWithdrawalGateway } from '../infrastructure/gateways/legacy-login-streak-withdrawal.gateway.js';

const handleError = (res, error, fallbackMessage) => res.status(error.status || 500).json({
  success: false,
  message: error.message || fallbackMessage,
});

const loginStreakQueryGateway = new LegacyLoginStreakQueryGateway();
const loginStreakAdminConfigGateway = new LegacyLoginStreakAdminConfigGateway();
const loginStreakSessionGateway = new LegacyLoginStreakSessionGateway();
const loginStreakWithdrawalGateway = new LegacyLoginStreakWithdrawalGateway();
const getAdminLoginStreakConfigUseCase = new GetAdminLoginStreakConfigUseCase({ loginStreakAdminConfigGateway });
const getLoginStreakLeaderboardUseCase = new GetLoginStreakLeaderboardUseCase({ loginStreakQueryGateway });
const getLoginStreakStatusUseCase = new GetLoginStreakStatusUseCase({ loginStreakQueryGateway });
const pingLoginStreakSessionUseCase = new PingLoginStreakSessionUseCase({ loginStreakSessionGateway });
const startLoginStreakSessionUseCase = new StartLoginStreakSessionUseCase({ loginStreakSessionGateway });
const updateAdminLoginStreakConfigUseCase = new UpdateAdminLoginStreakConfigUseCase({ loginStreakAdminConfigGateway });
const withdrawLoginStreakPointsUseCase = new WithdrawLoginStreakPointsUseCase({ loginStreakWithdrawalGateway });

const isStreaksDddEnabled = () => process.env.STREAKS_DDD_ENABLED !== 'false';

export const startSession = async (req, res) => {
  try {
    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
    const response = isStreaksDddEnabled()
      ? await startLoginStreakSessionUseCase.execute(
        StartLoginStreakSessionDto.fromRequest({
          userId: req.userId,
          metadata,
        }),
      )
      : await legacyStartLoginStreakSession(req.userId, metadata);

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to start login streak session');
  }
};

export const getStatus = async (req, res) => {
  try {
    const response = isStreaksDddEnabled()
      ? await getLoginStreakStatusUseCase.execute(
        GetLoginStreakStatusDto.fromRequest({ userId: req.userId }),
      )
      : await legacyGetLoginStreakStatus(req.userId);

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load login streak status');
  }
};

export const getLeaderboardStats = async (req, res) => {
  try {
    const response = isStreaksDddEnabled()
      ? await getLoginStreakLeaderboardUseCase.execute(
        GetLoginStreakLeaderboardDto.fromRequest({
          userId: req.userId,
          query: req.query || {},
        }),
      )
      : await legacyGetLeaderboard(req.userId, req.query || {});

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load leaderboard data');
  }
};

export const pingSession = async (req, res) => {
  try {
    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
    const response = isStreaksDddEnabled()
      ? await pingLoginStreakSessionUseCase.execute(
        PingLoginStreakSessionDto.fromRequest({
          userId: req.userId,
          body: req.body || {},
          metadata,
        }),
      )
      : await legacyPingLoginStreakSession(
        req.userId,
        req.body?.sessionId || null,
        metadata,
      );

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to update login streak session');
  }
};

export const withdrawPoints = async (req, res) => {
  try {
    const response = isStreaksDddEnabled()
      ? await withdrawLoginStreakPointsUseCase.execute(
        WithdrawLoginStreakPointsDto.fromRequest({
          userId: req.userId,
          body: req.body || {},
        }),
      )
      : await legacyWithdrawLoginStreakPoints(req.userId, req.body || {});

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to withdraw login streak points');
  }
};

export const getAdminConfig = async (_req, res) => {
  try {
    const response = isStreaksDddEnabled()
      ? await getAdminLoginStreakConfigUseCase.execute()
      : await legacyGetAdminLoginStreakConfig();

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load login streak configuration');
  }
};

export const updateAdminConfig = async (req, res) => {
  try {
    const response = isStreaksDddEnabled()
      ? await updateAdminLoginStreakConfigUseCase.execute(
        UpdateAdminLoginStreakConfigDto.fromRequest({
          adminId: req.userId,
          body: req.body || {},
        }),
      )
      : await legacyUpdateAdminLoginStreakConfig(req.userId, req.body || {});

    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, 'Failed to update login streak configuration');
  }
};
