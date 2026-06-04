import { UserModel } from '../../user/models/user/index.js';
import { FollowModel } from '../models/follow/index.js';
import { GetSuggestedUsersDto } from '../application/dto/profile-social-query.dto.js';
import { GetSuggestedUsersUseCase } from '../application/use-cases/get-suggested-users.use-case.js';
import { MongooseProfileSocialGateway } from '../infrastructure/gateways/mongoose-profile-social.gateway.js';

const isProfileDddEnabled = () => process.env.PROFILE_DDD_ENABLED !== 'false';
const profileSocialGateway = new MongooseProfileSocialGateway();
const getSuggestedUsersUseCase = new GetSuggestedUsersUseCase({ profileSocialGateway });

export const getSuggestedUsers = async (req, res) => {
  if (isProfileDddEnabled()) {
    try {
      const response = await getSuggestedUsersUseCase.execute(
        GetSuggestedUsersDto.fromRequest({
          query: req.query || {},
        }),
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  try {
    const { userId, limit = 5 } = req.query;
    // Find users not followed by current user, excluding self
    const following = await FollowModel.find({ follower: userId }).distinct('following');
    const suggested = await UserModel.find({
      _id: { $ne: userId, $nin: following },
      isActive: true,
    })
      .limit(parseInt(limit))
      .select('displayName username avatar')
      .lean();

    // Optionally add isFollowing flag (always false here)
    res.json(suggested.map(u => ({ ...u, isFollowing: false })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
