import {
  buildAdminUserListProjection,
  buildAdminUserListQuery,
} from '../../domain/services/admin-user-list-query.js';
import { formatAdminUserExportRecord } from '../mappers/admin-user-export.mapper.js';
import { StreamAdminUsersDto } from '../dto/stream-admin-users.dto.js';

export class StreamAdminUsersUseCase {
  constructor({
    adminUserListGateway,
    now = () => new Date(),
  } = {}) {
    if (!adminUserListGateway) {
      throw new Error('adminUserListGateway is required');
    }

    this.adminUserListGateway = adminUserListGateway;
    this.now = now;
  }

  execute(input) {
    const dto = input instanceof StreamAdminUsersDto
      ? input
      : new StreamAdminUsersDto(input);

    const query = buildAdminUserListQuery({
      search: dto.search,
      role: dto.role,
      isActive: dto.isActive,
      isVerified: dto.isVerified,
    });
    const projection = buildAdminUserListProjection();
    const cursor = this.adminUserListGateway.streamUsersForExport({
      query,
      projection,
      sort: { createdAt: -1 },
      batchSize: 100,
    });
    const exportDate = this.now().toISOString().split('T')[0];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="users_export_${exportDate}.json"`,
      },
      cursor,
      openingChunk: '{"success":true,"message":"Users export stream","data":{"users":[',
      closingChunk: ']}}',
      formatRecord: formatAdminUserExportRecord,
    };
  }
}
