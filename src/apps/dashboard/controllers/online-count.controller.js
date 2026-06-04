import { UserModel } from '../../user/models/user/index.js';
import { GetUsersOnlineCountDto } from '../application/dto/get-users-online-count.dto.js';
import { GetUsersOnlineCountUseCase } from '../application/use-cases/get-users-online-count.use-case.js';
import { MongooseDashboardActivityGateway } from '../infrastructure/gateways/mongoose-dashboard-activity.gateway.js';

const ONLINE_WINDOW = 10 * 60 * 1000; // 10 minutes

const dashboardActivityGateway = new MongooseDashboardActivityGateway();
const getUsersOnlineCountUseCase = new GetUsersOnlineCountUseCase({ dashboardActivityGateway });

const isDashboardDddEnabled = () => process.env.DASHBOARD_DDD_ENABLED !== 'false';

const legacyGetUsersOnlineCount = async (req, res) => {
  try {
    if (req.params.userId) {
      return res.status(401).json({ success: false });
    }

    const onlineSince = new Date(Date.now() - ONLINE_WINDOW);

    const count = await UserModel.countDocuments({
      lastSeenAt: { $gte: onlineSince }
    });

    return res.json({ success: true, count });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch online users count'
    });
  }
};

export const getUsersOnlineCount = async (req, res) => {
  if (!isDashboardDddEnabled()) {
    return legacyGetUsersOnlineCount(req, res);
  }

  try {
    const response = await getUsersOnlineCountUseCase.execute(
      GetUsersOnlineCountDto.fromRequest({
        params: req.params || {},
      }),
    );

    return res.status(response.statusCode).json(response.body);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch online users count'
    });
  }
};
