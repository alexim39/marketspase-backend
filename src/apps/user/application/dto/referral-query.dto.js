const toInteger = (value) => Number.parseInt(value, 10);

const getRequestUserId = ({ user = null, userId = null } = {}) =>
  userId || user?._id?.toString?.() || user?._id || null;

const getRequestUserRole = ({ user = null } = {}) => user?.role || null;

export class GetReferralStatsDto {
  constructor({
    userId = null,
    requestUserId = null,
    requestUserRole = null,
  } = {}) {
    this.userId = userId;
    this.requestUserId = requestUserId;
    this.requestUserRole = requestUserRole;
  }

  static fromRequest({ params = {}, user = null, userId = null } = {}) {
    return new GetReferralStatsDto({
      userId: params?.userId || null,
      requestUserId: getRequestUserId({ user, userId }),
      requestUserRole: getRequestUserRole({ user }),
    });
  }
}

export class GetReferralDetailsDto {
  constructor({
    userId = null,
    query = {},
    requestUserId = null,
    requestUserRole = null,
  } = {}) {
    this.userId = userId;
    this.page = query.page ?? 1;
    this.limit = query.limit ?? 20;
    this.pageNumber = toInteger(this.page);
    this.limitNumber = toInteger(this.limit);
    this.skip = (this.page - 1) * this.limit;
    this.requestUserId = requestUserId;
    this.requestUserRole = requestUserRole;
  }

  static fromRequest({ params = {}, query = {}, user = null, userId = null } = {}) {
    return new GetReferralDetailsDto({
      userId: params?.userId || null,
      query,
      requestUserId: getRequestUserId({ user, userId }),
      requestUserRole: getRequestUserRole({ user }),
    });
  }
}

export class ValidateReferralCodeDto {
  constructor({ referralCode = null } = {}) {
    this.referralCode = referralCode;
  }

  static fromRequest({ params = {} } = {}) {
    return new ValidateReferralCodeDto({
      referralCode: params?.referralCode || null,
    });
  }
}
