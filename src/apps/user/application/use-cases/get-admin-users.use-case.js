import {
  buildAdminUserListPagination,
  buildAdminUserListProjection,
  buildAdminUserListQuery,
  buildAdminUserListSort,
} from '../../domain/services/admin-user-list-query.js';
import { GetAdminUsersDto } from '../dto/get-admin-users.dto.js';

export class GetAdminUsersUseCase {
  constructor({ adminUserListGateway } = {}) {
    if (!adminUserListGateway) {
      throw new Error('adminUserListGateway is required');
    }

    this.adminUserListGateway = adminUserListGateway;
  }

  async execute(input) {
    const dto = input instanceof GetAdminUsersDto
      ? input
      : new GetAdminUsersDto(input);

    const { pageNum, limitNum, skip } = buildAdminUserListPagination({
      page: dto.page,
      limit: dto.limit,
    });
    const query = buildAdminUserListQuery({
      search: dto.search,
      role: dto.role,
      isActive: dto.isActive,
      isVerified: dto.isVerified,
    });
    const sort = buildAdminUserListSort(dto.sort);
    const projection = buildAdminUserListProjection();

    const { users, total } = await this.adminUserListGateway.findUsers({
      query,
      sort,
      projection,
      skip,
      limit: limitNum,
    });

    const totalPages = Math.ceil(total / limitNum);

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Users fetched successfully',
        data: {
          users,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
      },
    };
  }
}
