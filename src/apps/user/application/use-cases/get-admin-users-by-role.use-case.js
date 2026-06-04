import {
  buildAdminUserListPagination,
  buildAdminUserListProjection,
  buildAdminUserListSort,
  buildAdminUsersByRoleListQuery,
  formatAdminUserRoleLabel,
  isValidAdminUserListRole,
} from '../../domain/services/admin-user-list-query.js';
import { GetAdminUsersByRoleDto } from '../dto/get-admin-users-by-role.dto.js';

export class GetAdminUsersByRoleUseCase {
  constructor({ adminUserListGateway } = {}) {
    if (!adminUserListGateway) {
      throw new Error('adminUserListGateway is required');
    }

    this.adminUserListGateway = adminUserListGateway;
  }

  async execute(input) {
    const dto = input instanceof GetAdminUsersByRoleDto
      ? input
      : new GetAdminUsersByRoleDto(input);

    if (!isValidAdminUserListRole(dto.role)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Invalid role. Must be one of: marketer, promoter, admin',
        },
      };
    }

    const { pageNum, limitNum, skip } = buildAdminUserListPagination({
      page: dto.page,
      limit: dto.limit,
    });
    const query = buildAdminUsersByRoleListQuery({
      role: dto.role,
      search: dto.search,
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
        message: `${formatAdminUserRoleLabel(dto.role)} users fetched successfully`,
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
