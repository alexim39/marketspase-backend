import { isSwitchableUserRole } from '../../domain/services/user-role-switch.policy.js';
import { SwitchUserRoleDto } from '../dto/switch-user-role.dto.js';

export class SwitchUserRoleUseCase {
  constructor({ userRoleGateway, now = () => new Date() } = {}) {
    if (!userRoleGateway) {
      throw new Error('userRoleGateway is required');
    }

    this.userRoleGateway = userRoleGateway;
    this.now = now;
  }

  async execute(input) {
    const dto = input instanceof SwitchUserRoleDto ? input : new SwitchUserRoleDto(input);

    if (!dto.userId) {
      return {
        statusCode: 401,
        body: {
          success: false,
          message: 'Authentication required.',
        },
      };
    }

    if (!isSwitchableUserRole(dto.role)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Invalid target role.',
        },
      };
    }

    const user = await this.userRoleGateway.findUserById(dto.userId);

    if (!user) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'User not found.',
        },
      };
    }

    if (!isSwitchableUserRole(user.role)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: `User's current role '${user.role}' cannot be switched.`,
        },
      };
    }

    const activity = {
      action: 'role_change',
      description: `You switched user role to ${dto.role}`,
      timestamp: this.now(),
    };

    await this.userRoleGateway.updateUserRole({
      userId: user._id,
      role: dto.role,
      activity,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        message: `User role successfully switched to '${dto.role}'.`,
      },
      meta: {
        username: user.username,
        role: dto.role,
      },
    };
  }
}
