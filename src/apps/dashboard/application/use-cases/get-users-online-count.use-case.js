import { GetUsersOnlineCountDto } from '../dto/get-users-online-count.dto.js';

export class GetUsersOnlineCountUseCase {
  constructor({ dashboardActivityGateway } = {}) {
    if (!dashboardActivityGateway) {
      throw new Error('dashboardActivityGateway is required');
    }

    this.dashboardActivityGateway = dashboardActivityGateway;
  }

  async execute(input) {
    const dto = input instanceof GetUsersOnlineCountDto
      ? input
      : new GetUsersOnlineCountDto(input);

    if (dto.params?.userId) {
      return {
        statusCode: 401,
        body: { success: false },
      };
    }

    const count = await this.dashboardActivityGateway.getUsersOnlineCount();
    return {
      statusCode: 200,
      body: {
        success: true,
        count,
      },
    };
  }
}
