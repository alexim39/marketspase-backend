import { UserModel } from "../../../user/models/user/index.js";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ACTIONS_ARRAY,
  RESOURCE_TYPES_ARRAY,
} from "../../../user/models/activity/activity.constants.js";

const knownActivityActions = new Set(ACTIVITY_ACTIONS_ARRAY);
const knownResourceTypes = new Set(RESOURCE_TYPES_ARRAY);

const createStatusError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export class MongooseAuthUserRepository {
  async findByAuthIdentity(providerProfile) {
    const [uidUser, emailUser] = await Promise.all([
      providerProfile.uid ? UserModel.findOne({ uid: providerProfile.uid }).lean() : Promise.resolve(null),
      providerProfile.email ? UserModel.findOne({ email: providerProfile.email }).lean() : Promise.resolve(null),
    ]);

    if (uidUser && emailUser && String(uidUser._id) !== String(emailUser._id)) {
      throw createStatusError(409, "Account identity conflict detected for this sign-in method.");
    }

    return {
      existingUser: uidUser || emailUser || null,
      matchedBy: uidUser ? "uid" : emailUser ? "email" : "new",
    };
  }

  async findByEmail(email, projection) {
    const query = UserModel.findOne({ email: String(email || "").toLowerCase() });

    if (projection) {
      query.select(projection);
    }

    return query.lean();
  }

  async findLocalAuthByEmail(email) {
    return UserModel.findOne({ email: String(email || "").toLowerCase() })
      .select("+password +localAuth.verificationCodeHash +localAuth.verificationCodeExpiresAt +localAuth.resetCodeHash +localAuth.resetCodeExpiresAt")
      .lean();
  }

  async updateById(userId, setFields, projection) {
    const query = UserModel.findByIdAndUpdate(
      userId,
      { $set: setFields },
      { new: true, runValidators: true }
    );

    if (projection) {
      query.select(projection);
    }

    return query.lean();
  }

  async updateByIdWithOperators(userId, update, projection) {
    const query = UserModel.findByIdAndUpdate(
      userId,
      update,
      { new: true, runValidators: true }
    );

    if (projection) {
      query.select(projection);
    }

    return query.lean();
  }

  async createUser(createData, projection) {
    const createdUser = await UserModel.create(createData);
    return this.findById(createdUser._id, projection);
  }

  async findById(userId, projection) {
    const query = UserModel.findById(userId);

    if (projection) {
      query.select(projection);
    }

    // Always include regional preferences for internationalization
    query.select('preferredCurrency preferredLocale regionalCountry');

    return query.lean();
  }

  async appendActivity(userId, activity) {
    const action = knownActivityActions.has(activity?.action)
      ? activity.action
      : ACTIVITY_ACTIONS.SYSTEM_EVENT;
    const resourceType = activity?.resourceType && knownResourceTypes.has(activity.resourceType)
      ? activity.resourceType
      : undefined;
    const normalizedActivity = {
      ...activity,
      action,
      resourceType,
      metadata: {
        ...(activity?.metadata || {}),
        ...(action !== activity?.action ? { originalAction: activity?.action } : {}),
        ...(activity?.resourceType && resourceType !== activity.resourceType
          ? { originalResourceType: activity.resourceType }
          : {}),
      },
    };

    await UserModel.updateOne(
      { _id: userId },
      {
        $push: {
          activityLog: {
            $each: [normalizedActivity],
            $slice: -200,
          },
        },
      }
    );
  }
}
