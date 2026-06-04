import { isValidUsernameFormat, normalizeUsername } from '../../domain/services/username-normalizer.js';
import { UpdateUsernameDto } from '../dto/update-username.dto.js';

export class UpdateUsernameUseCase {
  constructor({ usernameGateway } = {}) {
    if (!usernameGateway) {
      throw new Error('usernameGateway is required');
    }

    this.usernameGateway = usernameGateway;
  }

  async execute(input) {
    const dto = input instanceof UpdateUsernameDto ? input : new UpdateUsernameDto(input);
    const username = normalizeUsername(dto.username);

    if (!username || !dto.userId) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Username and user ID are required.',
        },
      };
    }

    if (!isValidUsernameFormat(username)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Username can only contain letters, numbers, and underscores.',
        },
      };
    }

    const result = await this.usernameGateway.updateUsername({
      userId: dto.userId,
      username,
    });

    if (result.status === 'not-found') {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'User not found.',
        },
      };
    }

    if (result.status === 'duplicate') {
      return {
        statusCode: 409,
        body: {
          success: false,
          message: 'Username is already in use by another user.',
        },
      };
    }

    await this.usernameGateway.logUsernameUpdate({
      user: result.user,
      username,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Username updated successfully!',
      },
    };
  }
}
